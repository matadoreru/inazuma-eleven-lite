import { describe, it, expect } from 'vitest'
import { playOutcomeSound } from '../services/soundService'

describe('playOutcomeSound', () => {
  it('does not throw for any outcome', () => {
    const outcomes = ['champion', 'promoted', 'relegated', 'stayed'] as const
    for (const o of outcomes) {
      expect(() => playOutcomeSound(o)).not.toThrow()
    }
  })
})
