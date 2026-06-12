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
