// The adaptive engine — pure arithmetic over logged data.
// Carried from the prototype; manual weigh-ins are all it needs.
//
//   trend_kg     = EWMA(daily weigh-ins, alpha ~= 0.1)        # smooths noise
//   weekly_slope = (trend_today - trend_14d_ago) / 14 * 7
//   tdee_est     = mean_intake_14d - (delta_trend_kg * 7700) / days
//   target_kcal  = tdee_est + (goal_rate_pct/100 * weight * 7700) / 7
//   protein_g    = 2.0 * weight     # g/kg
//   fat_g        = 0.9 * weight     # g/kg
//   carb_g       = (target_kcal - protein_g*4 - fat_g*9) / 4

const KCAL_PER_KG = 7700

// Energy-balance TDEE needs a few days of intake to mean anything; one partial
// day would otherwise drag the estimate (and the calorie target) absurdly low.
// Below this many logged days in the window we fall back to a maintenance guess.
const MIN_INTAKE_DAYS = 5
// Rough maintenance multiplier (kcal per kg) used only as a cold-start fallback.
const MAINTENANCE_KCAL_PER_KG = 31

/**
 * Exponentially-weighted moving average over a date-ordered weight series.
 * Returns a parallel array of { logged_on, kg, trend } points.
 *
 * @param {{logged_on: string, kg: number}[]} weights  ascending by date
 * @param {number} alpha  smoothing factor (~0.1)
 */
export function ewmaTrend(weights, alpha = 0.1) {
  const out = []
  let trend = null
  for (const w of weights) {
    const kg = Number(w.kg)
    trend = trend === null ? kg : alpha * kg + (1 - alpha) * trend
    out.push({ logged_on: w.logged_on, kg, trend })
  }
  return out
}

/** Mean of an array, or null when empty. */
function mean(xs) {
  if (!xs.length) return null
  return xs.reduce((a, b) => a + b, 0) / xs.length
}

/**
 * Compute the adaptive daily targets.
 *
 * @param {object} args
 * @param {{logged_on: string, kg: number}[]} args.weights  ascending by date
 * @param {{logged_on: string, kcal: number}[]} args.dailyIntake  per-day kcal totals, ascending
 * @param {number} args.goalRatePct  weekly bodyweight change target, % (negative = cut)
 * @param {number} [args.windowDays]  lookback window (default 14)
 * @returns {null | {
 *   trend_kg:number, weekly_slope_kg:number, tdee_est:number,
 *   target_kcal:number, protein_g:number, carb_g:number, fat_g:number,
 *   weight_kg:number
 * }}
 */
export function computeTargets({ weights, dailyIntake, goalRatePct = 0, windowDays = 14 }) {
  if (!weights || weights.length === 0) return null

  const trendSeries = ewmaTrend(weights)
  const last = trendSeries[trendSeries.length - 1]
  const trendToday = last.trend
  const weight = last.trend // use smoothed weight for macro targets

  // Find the trend `windowDays` ago (closest point at-or-before that date).
  const targetDate = isoMinusDays(last.logged_on, windowDays)
  let past = trendSeries[0]
  for (const p of trendSeries) {
    if (p.logged_on <= targetDate) past = p
    else break
  }
  const spanDays = Math.max(1, daysBetweenISO(past.logged_on, last.logged_on))
  const deltaTrend = trendToday - past.trend
  const weeklySlope = (deltaTrend / spanDays) * 7

  // Mean intake over the window.
  const windowStart = isoMinusDays(last.logged_on, windowDays)
  const recentIntake = (dailyIntake || [])
    .filter((d) => d.logged_on >= windowStart && Number(d.kcal) > 0)
    .map((d) => Number(d.kcal))
  const meanIntake = mean(recentIntake)

  // TDEE from energy balance: intake minus the energy implied by trend change.
  // Until enough days of intake are logged the estimate is unreliable, so we
  // fall back to a maintenance guess — this keeps day-one (and sparse) targets
  // sane instead of collapsing to a few hundred calories.
  let tdee
  let tdee_source
  if (meanIntake !== null && recentIntake.length >= MIN_INTAKE_DAYS) {
    tdee = meanIntake - (deltaTrend * KCAL_PER_KG) / spanDays
    tdee_source = 'balance'
  } else {
    tdee = weight * MAINTENANCE_KCAL_PER_KG
    tdee_source = 'estimate'
  }

  const targetKcal = tdee + (goalRatePct / 100) * weight * KCAL_PER_KG / 7

  const protein_g = round1(2.0 * weight)
  const fat_g = round1(0.9 * weight)
  const carb_g = Math.max(0, round1((targetKcal - protein_g * 4 - fat_g * 9) / 4))

  return {
    weight_kg: round1(weight),
    trend_kg: round2(trendToday),
    weekly_slope_kg: round2(weeklySlope),
    tdee_est: Math.round(tdee),
    tdee_source,
    intake_days: recentIntake.length,
    target_kcal: Math.round(targetKcal),
    protein_g,
    carb_g,
    fat_g,
  }
}

// --- small local date helpers (kept here so the engine stays import-free) ---
function isoMinusDays(iso, days) {
  const d = new Date(`${iso}T00:00:00`)
  d.setDate(d.getDate() - days)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${dd}`
}
function daysBetweenISO(aISO, bISO) {
  const a = new Date(`${aISO}T00:00:00`)
  const b = new Date(`${bISO}T00:00:00`)
  return Math.round((b - a) / 86400000)
}
function round1(n) {
  return Math.round(n * 10) / 10
}
function round2(n) {
  return Math.round(n * 100) / 100
}
