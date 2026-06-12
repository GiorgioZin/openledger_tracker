import { describe, it, expect } from 'vitest'
import { epley1RM } from './strength.js'

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
