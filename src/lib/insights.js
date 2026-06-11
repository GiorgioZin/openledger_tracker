// Derived weekly insights — pure arithmetic over the same series the dashboard
// already has. Kept separate from the adaptive engine so it stays easy to test.
import { todayISO, addDaysISO } from './dates.js'

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
