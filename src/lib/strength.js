// Strength helpers — pure, dependency-free.

// Epley estimated one-rep max: weight * (1 + reps/30).
// Returns a value rounded to 1 decimal. A single rep is already a true max.
// Non-positive weight or reps yield 0 (nothing to estimate).
export function epley1RM(weight, reps) {
  const w = Number(weight)
  const r = Number(reps)
  if (!(w > 0) || !(r > 0)) return 0
  if (r === 1) return Math.round(w * 10) / 10
  return Math.round(w * (1 + r / 30) * 10) / 10
}

// Caffeine pre-workout timing. Caffeine plasma concentration peaks roughly
// 45–60 min after ingestion, so to have it peaking at training time we suggest
// taking it `leadMin` (default 45) minutes before. Given a set/training time
// (a Date), returns the recommended "take caffeine at" Date.
export function caffeineIntakeTime(setTime, leadMin = 45) {
  const t = setTime instanceof Date ? setTime : new Date(setTime)
  if (Number.isNaN(t.getTime())) return null
  return new Date(t.getTime() - leadMin * 60 * 1000)
}

// Auto-deload readiness heuristic — pure & testable.
// Scans the most recent `sessionCount` sessions (each an array of sets) and
// computes the share of "scored" sets (those with a numeric rpe) that are very
// hard (rpe >= hardRpe). If at least `minSets` scored sets exist and the hard
// share meets `threshold`, we flag a possible deload. Simple on purpose.
export function deloadReadiness(sessions, opts = {}) {
  const { sessionCount = 2, hardRpe = 9, threshold = 0.5, minSets = 4 } = opts
  const recent = (sessions || []).slice(0, sessionCount)
  let scored = 0
  let hard = 0
  for (const sets of recent) {
    for (const s of sets || []) {
      if (s == null || s.rpe == null || s.rpe === '') continue
      const rpe = Number(s.rpe)
      if (Number.isNaN(rpe)) continue
      scored += 1
      if (rpe >= hardRpe) hard += 1
    }
  }
  const share = scored ? hard / scored : 0
  const deload = scored >= minSets && share >= threshold
  return { deload, share, scored, hard }
}
