import { describe, it, expect } from 'vitest'
import { ewmaTrend, computeTargets } from './engine.js'

function series(startISO, kgs) {
  const out = []
  const d = new Date(`${startISO}T00:00:00`)
  for (const kg of kgs) {
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, '0')
    const dd = String(d.getDate()).padStart(2, '0')
    out.push({ logged_on: `${y}-${m}-${dd}`, kg })
    d.setDate(d.getDate() + 1)
  }
  return out
}

describe('ewmaTrend', () => {
  it('returns the first value unchanged as the seed', () => {
    const t = ewmaTrend([{ logged_on: '2026-01-01', kg: 80 }])
    expect(t[0].trend).toBe(80)
  })

  it('smooths noise (trend lags raw value)', () => {
    const t = ewmaTrend(series('2026-01-01', [80, 82, 80, 82, 80]), 0.1)
    // trend stays close to the seed, not whipsawing with each weigh-in
    expect(t[t.length - 1].trend).toBeGreaterThan(80)
    expect(t[t.length - 1].trend).toBeLessThan(81)
  })
})

describe('computeTargets', () => {
  it('returns null without weight data', () => {
    expect(computeTargets({ weights: [], dailyIntake: [] })).toBeNull()
  })

  it('estimates a higher TDEE when weight trends up at fixed intake', () => {
    // Gaining weight on 3000 kcal/day => TDEE must be below intake.
    const weights = series('2026-01-01', Array.from({ length: 15 }, (_, i) => 80 + i * 0.05))
    const dailyIntake = weights.map((w) => ({ logged_on: w.logged_on, kcal: 3000 }))
    const r = computeTargets({ weights, dailyIntake, goalRatePct: 0 })
    expect(r.weekly_slope_kg).toBeGreaterThan(0)
    expect(r.tdee_est).toBeLessThan(3000)
  })

  it('applies a deficit when goalRatePct is negative', () => {
    const weights = series('2026-01-01', Array.from({ length: 15 }, () => 80))
    const dailyIntake = weights.map((w) => ({ logged_on: w.logged_on, kcal: 2500 }))
    const maintain = computeTargets({ weights, dailyIntake, goalRatePct: 0 })
    const cut = computeTargets({ weights, dailyIntake, goalRatePct: -0.5 })
    expect(cut.target_kcal).toBeLessThan(maintain.target_kcal)
  })

  it('sets protein and fat from bodyweight and balances carbs', () => {
    const weights = series('2026-01-01', Array.from({ length: 15 }, () => 80))
    const dailyIntake = weights.map((w) => ({ logged_on: w.logged_on, kcal: 2400 }))
    const r = computeTargets({ weights, dailyIntake, goalRatePct: 0 })
    expect(r.protein_g).toBeCloseTo(160, 0) // 2.0 g/kg * 80
    expect(r.fat_g).toBeCloseTo(72, 0) // 0.9 g/kg * 80
    const reconstructed = r.protein_g * 4 + r.fat_g * 9 + r.carb_g * 4
    expect(reconstructed).toBeCloseTo(r.target_kcal, -1)
  })

  it('falls back to a maintenance estimate with no intake logged', () => {
    const weights = series('2026-01-01', Array.from({ length: 5 }, () => 80))
    const r = computeTargets({ weights, dailyIntake: [], goalRatePct: 0 })
    expect(r.tdee_est).toBeGreaterThan(2000)
    expect(r.target_kcal).toBeGreaterThan(2000)
  })
})
