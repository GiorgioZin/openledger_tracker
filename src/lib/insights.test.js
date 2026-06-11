import { describe, it, expect } from 'vitest'
import { computeInsights, computeStreak, weeklyBudget } from './insights.js'

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

describe('computeStreak', () => {
  it('counts consecutive logged days ending today', () => {
    const r = computeStreak(['2026-03-08', '2026-03-09', '2026-03-10'], '2026-03-10')
    expect(r.current).toBe(3)
    expect(r.longest).toBe(3)
  })

  it('stays alive when today is not logged yet but yesterday was', () => {
    const r = computeStreak(['2026-03-08', '2026-03-09'], '2026-03-10')
    expect(r.current).toBe(2)
  })

  it('breaks the current streak after a gap', () => {
    const r = computeStreak(['2026-03-01', '2026-03-02', '2026-03-09', '2026-03-10'], '2026-03-10')
    expect(r.current).toBe(2)
    expect(r.longest).toBe(2)
  })

  it('is zero with no recent logs', () => {
    expect(computeStreak(['2026-01-01'], '2026-03-10').current).toBe(0)
  })
})

describe('weeklyBudget', () => {
  // 2026-03-09 is a Monday; use 2026-03-11 (Wed) as "today".
  it('banks an earlier deficit into today’s adjusted target', () => {
    const intake = [
      { logged_on: '2026-03-09', kcal: 1800 }, // 200 under
      { logged_on: '2026-03-10', kcal: 1900 }, // 100 under
      { logged_on: '2026-03-11', kcal: 500 }, // today, partial
    ]
    const r = weeklyBudget({ intakeSeries: intake, target: 2000, today: '2026-03-11' })
    expect(r.weeklyTarget).toBe(14000)
    expect(r.bank).toBe(300) // 200 + 100 saved on Mon/Tue
    expect(r.todayAdjusted).toBe(2300) // 2000 + 300 banked
    expect(r.consumed).toBe(4200)
  })

  it('excludes partial/unlogged earlier days from the bank', () => {
    const intake = [
      { logged_on: '2026-03-09', kcal: 0 },
      { logged_on: '2026-03-10', kcal: 1500 },
      { logged_on: '2026-03-11', kcal: 100 },
    ]
    const r = weeklyBudget({
      intakeSeries: intake,
      statusByDate: { '2026-03-09': 'unlogged' },
      target: 2000,
      today: '2026-03-11',
    })
    expect(r.bank).toBe(500) // only Tue (2000-1500) counts; Mon is unlogged
  })
})
