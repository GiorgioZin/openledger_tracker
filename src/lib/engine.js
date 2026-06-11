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

// Cold-start maintenance estimate (used until enough intake is logged; after
// that the energy-balance figure, which already reflects real activity, wins).
//   estimate = weight * BMR+NEAT/kg  +  training (from activity level)  +  steps
const NEAT_KCAL_PER_KG = 26.4 // ~BMR (22) × a sedentary 1.2 baseline
const KCAL_PER_STEP = 0.04
const TRAINING_KCAL = {
  sedentary: 0,
  light: 100, // ~1–2 sessions/week
  moderate: 200, // ~3–4 sessions/week
  active: 300, // ~5–6 sessions/week
  very_active: 400, // daily / hard training
}

// Maintenance estimate from bodyweight + self-reported activity + steps.
export function estimateMaintenance(weight, activityLevel = 'moderate', dailySteps = 0) {
  const training = TRAINING_KCAL[activityLevel] ?? TRAINING_KCAL.moderate
  return weight * NEAT_KCAL_PER_KG + training + (Number(dailySteps) || 0) * KCAL_PER_STEP
}

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
export function computeTargets({
  weights,
  dailyIntake,
  goalRatePct = 0,
  goalRateKg = 0,
  goalRateUnit = 'pct',
  tdeeMode = 'dynamic',
  custom = null,
  activityLevel = 'moderate',
  dailySteps = 0,
  windowDays = 14,
}) {
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
    tdee = estimateMaintenance(weight, activityLevel, dailySteps)
    tdee_source = 'estimate'
  }

  let target_kcal
  let protein_g
  let fat_g
  let carb_g
  let target_source

  if (tdeeMode === 'custom' && custom) {
    // Fixed targets the user set by hand; macros fall back to bodyweight-based
    // defaults if a field is left blank.
    target_source = 'custom'
    target_kcal = Math.round(Number(custom.kcal) || 0)
    protein_g = custom.protein_g != null ? round1(Number(custom.protein_g)) : round1(2.0 * weight)
    fat_g = custom.fat_g != null ? round1(Number(custom.fat_g)) : round1(0.9 * weight)
    carb_g =
      custom.carb_g != null
        ? round1(Number(custom.carb_g))
        : Math.max(0, round1((target_kcal - protein_g * 4 - fat_g * 9) / 4))
  } else {
    // Adaptive target: TDEE plus the daily energy delta implied by the goal
    // rate, expressed either as %/week of bodyweight or as kg/week.
    target_source = 'dynamic'
    const deltaPerDay =
      goalRateUnit === 'kg'
        ? (goalRateKg * KCAL_PER_KG) / 7
        : ((goalRatePct / 100) * weight * KCAL_PER_KG) / 7
    target_kcal = Math.round(tdee + deltaPerDay)
    protein_g = round1(2.0 * weight)
    fat_g = round1(0.9 * weight)
    carb_g = Math.max(0, round1((target_kcal - protein_g * 4 - fat_g * 9) / 4))
  }

  return {
    weight_kg: round1(weight),
    trend_kg: round2(trendToday),
    weekly_slope_kg: round2(weeklySlope),
    tdee_est: Math.round(tdee),
    tdee_source,
    intake_days: recentIntake.length,
    target_kcal,
    target_source,
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
