import { describe, it, expect } from 'vitest'
import { computeInsights } from './insights.js'

function intake(kcals) {
  // Dates don't matter to the math beyond ordering; build a simple ascending run.
  return kcals.map((kcal, i) => ({ logged_on: `2026-01-${String(i + 1).padStart(2, '0')}`, kcal }))
}

describe('computeInsights', () => {
  it('averages the last 7 logged days and skips empty days', () => {
    const r = computeInsights({ intakeSeries: intake([2000, 0, 2200, 1800]), target: 2000 })
    expect(r.loggedDays).toBe(3)
    expect(r.avgIntake).toBe(2000) // (2000+2200+1800)/3
  })

  it('computes adherence as the share of logged days at/under target', () => {
    const r = computeInsights({ intakeSeries: intake([1900, 2100, 2000, 2500]), target: 2000 })
    expect(r.loggedDays).toBe(4)
    expect(r.onTargetDays).toBe(2) // 1900 and 2000 are at/under target
    expect(r.adherencePct).toBe(50)
  })

  it('projects the trend forward four weeks', () => {
    const r = computeInsights({ intakeSeries: [], trendKg: 80, weeklySlopeKg: -0.25 })
    expect(r.projWeight4).toBe(79) // 80 + (-0.25 * 4)
  })

  it('gives an ETA when the trend moves toward the goal', () => {
    const r = computeInsights({ intakeSeries: [], trendKg: 80, weeklySlopeKg: -0.5, goalWeightKg: 76 })
    expect(r.onTrack).toBe(true)
    expect(r.etaWeeks).toBe(8) // 4 kg to lose at 0.5 kg/week
    expect(r.etaDateISO).toBeTruthy()
  })

  it('flags off-track when the trend moves away from the goal', () => {
    const r = computeInsights({ intakeSeries: [], trendKg: 80, weeklySlopeKg: 0.3, goalWeightKg: 76 })
    expect(r.onTrack).toBe(false)
    expect(r.etaDateISO).toBeNull()
  })
})
