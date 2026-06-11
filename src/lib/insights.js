// Derived weekly insights — pure arithmetic over the same series the dashboard
// already has. Kept separate from the adaptive engine so it stays easy to test.
import { todayISO, addDaysISO, daysBetween } from './dates.js'

/**
 * Logging streaks from the set of days that have food logged.
 * The current streak stays "alive" if today isn't logged yet but yesterday was.
 *
 * @param {string[]} loggedDates  ISO dates that count as logged
 * @param {string} [today]
 * @returns {{ current:number, longest:number }}
 */
export function computeStreak(loggedDates, today = todayISO()) {
  const set = new Set(loggedDates)

  let current = 0
  let cursor = set.has(today) ? today : addDaysISO(today, -1)
  while (set.has(cursor)) {
    current++
    cursor = addDaysISO(cursor, -1)
  }

  let longest = 0
  let run = 0
  let prev = null
  for (const d of [...set].sort()) {
    run = prev && daysBetween(prev, d) === 1 ? run + 1 : 1
    if (run > longest) longest = run
    prev = d
  }

  return { current, longest }
}

function mondayISO(iso) {
  const d = new Date(`${iso}T00:00:00`)
  const dow = (d.getDay() + 6) % 7 // 0 = Monday
  return addDaysISO(iso, -dow)
}

/**
 * Weekly calorie budget with banking. Surplus/deficit on earlier complete days
 * in the current week rolls into today's adjusted target, so one big (or light)
 * day flexes across the week instead of being lost.
 *
 * @param {object} args
 * @param {{logged_on:string, kcal:number}[]} args.intakeSeries
 * @param {Record<string,string>} [args.statusByDate]  partial/unlogged days skip the bank
 * @param {number} args.target  current daily calorie target
 * @param {string} [args.today]
 */
export function weeklyBudget({ intakeSeries = [], statusByDate = {}, target = 0, today = todayISO() }) {
  if (!target) return null
  const weekStart = mondayISO(today)
  const byDate = new Map(intakeSeries.map((d) => [d.logged_on, Number(d.kcal) || 0]))

  let daysElapsed = 0
  let consumed = 0
  let bank = 0 // surplus(+)/deficit(-) carried from earlier complete days this week
  let cursor = weekStart
  while (cursor <= today) {
    daysElapsed++
    const kcal = byDate.get(cursor) || 0
    consumed += kcal
    if (cursor < today) {
      const st = statusByDate[cursor]
      if (st !== 'partial' && st !== 'unlogged') bank += target - kcal
    }
    cursor = addDaysISO(cursor, 1)
  }

  const weeklyTarget = target * 7
  return {
    weeklyTarget: Math.round(weeklyTarget),
    consumed: Math.round(consumed),
    remaining: Math.round(weeklyTarget - consumed),
    bank: Math.round(bank),
    todayAdjusted: Math.max(0, Math.round(target + bank)),
    daysElapsed,
  }
}

function mean(xs) {
  if (!xs.length) return null
  return xs.reduce((a, b) => a + b, 0) / xs.length
}
function round1(n) {
  return Math.round(n * 10) / 10
}

/**
 * @param {object} args
 * @param {{logged_on:string, kcal:number}[]} args.intakeSeries  per-day kcal, ascending
 * @param {number} args.target        current calorie target
 * @param {number} args.trendKg       current EWMA bodyweight trend
 * @param {number} args.weeklySlopeKg current weekly trend slope (kg/week)
 * @param {number|null} [args.goalWeightKg]  optional target weight for ETA
 * @param {number} [args.days]         window for averages (default 7)
 */
export function computeInsights({
  intakeSeries = [],
  target = 0,
  trendKg = null,
  weeklySlopeKg = 0,
  goalWeightKg = null,
  days = 7,
}) {
  const recent = intakeSeries.filter((d) => Number(d.kcal) > 0).slice(-days)
  const loggedDays = recent.length
  const avgIntake = loggedDays ? Math.round(mean(recent.map((d) => Number(d.kcal)))) : null

  // Adherence: share of logged days at or under the calorie target.
  const onTargetDays = target > 0 ? recent.filter((d) => Number(d.kcal) <= target).length : 0
  const adherencePct = loggedDays && target > 0 ? Math.round((100 * onTargetDays) / loggedDays) : null

  // Where the trend lands in 4 weeks if nothing changes.
  const projWeight4 = trendKg != null ? round1(trendKg + weeklySlopeKg * 4) : null

  // ETA to the goal weight, only when the trend is actually moving toward it.
  let etaWeeks = null
  let etaDateISO = null
  let onTrack = null
  if (goalWeightKg != null && trendKg != null) {
    const remaining = goalWeightKg - trendKg
    if (Math.abs(remaining) < 0.1) {
      onTrack = true
      etaWeeks = 0
      etaDateISO = todayISO()
    } else if (weeklySlopeKg !== 0 && Math.sign(remaining) === Math.sign(weeklySlopeKg)) {
      onTrack = true
      etaWeeks = remaining / weeklySlopeKg
      etaDateISO = addDaysISO(todayISO(), Math.round(etaWeeks * 7))
    } else {
      onTrack = false // moving away from (or not toward) the goal
    }
  }

  return {
    avgIntake,
    loggedDays,
    onTargetDays,
    adherencePct,
    weeklySlopeKg,
    projWeight4,
    goalWeightKg,
    onTrack,
    etaWeeks: etaWeeks == null ? null : round1(etaWeeks),
    etaDateISO,
  }
}
