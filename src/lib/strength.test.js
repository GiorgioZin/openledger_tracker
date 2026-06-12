import { describe, it, expect } from 'vitest'
import { epley1RM, caffeineIntakeTime, deloadReadiness } from './strength.js'

describe('epley1RM', () => {
  it('returns the weight unchanged for a single rep', () => {
    expect(epley1RM(100, 1)).toBe(100)
  })

  it('applies the Epley formula for multiple reps', () => {
    // 80 * (1 + 5/30) = 93.333… -> 93.3
    expect(epley1RM(80, 5)).toBe(93.3)
    // 100 * (1 + 10/30) = 133.333… -> 133.3
    expect(epley1RM(100, 10)).toBe(133.3)
  })

  it('returns 0 for non-positive weight or reps', () => {
    expect(epley1RM(0, 5)).toBe(0)
    expect(epley1RM(100, 0)).toBe(0)
    expect(epley1RM(-50, 5)).toBe(0)
    expect(epley1RM(100, -1)).toBe(0)
  })
})

describe('caffeineIntakeTime', () => {
  it('recommends taking caffeine 45 min before by default', () => {
    const setTime = new Date('2026-06-12T18:00:00')
    const take = caffeineIntakeTime(setTime)
    expect(take.getTime()).toBe(new Date('2026-06-12T17:15:00').getTime())
  })

  it('honours a custom lead time', () => {
    const setTime = new Date('2026-06-12T18:00:00')
    const take = caffeineIntakeTime(setTime, 60)
    expect(take.getTime()).toBe(new Date('2026-06-12T17:00:00').getTime())
  })
})

describe('deloadReadiness', () => {
  it('flags a deload when most recent sets are very hard', () => {
    const sessions = [
      [{ rpe: 9 }, { rpe: 9.5 }, { rpe: 8 }],
      [{ rpe: 9 }, { rpe: 10 }],
    ]
    const r = deloadReadiness(sessions)
    expect(r.deload).toBe(true)
    expect(r.hard).toBe(4)
    expect(r.scored).toBe(5)
  })

  it('stays calm when intensity is moderate', () => {
    const sessions = [
      [{ rpe: 7 }, { rpe: 8 }, { rpe: 8 }],
      [{ rpe: 7.5 }, { rpe: 8 }],
    ]
    expect(deloadReadiness(sessions).deload).toBe(false)
  })

  it('ignores sets without an rpe and needs enough data', () => {
    const sessions = [[{ rpe: 9 }, { rpe: null }, {}]]
    expect(deloadReadiness(sessions).deload).toBe(false) // only 1 scored set
  })
})
