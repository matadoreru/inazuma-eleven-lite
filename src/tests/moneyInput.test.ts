import { describe, expect, it } from 'vitest'
import { formatMoneyInput, parseMoneyInput } from '../utils/moneyInput'

describe('money input', () => {
  it('formats thousands and millions while typing', () => {
    expect(formatMoneyInput('1000')).toBe('1.000')
    expect(formatMoneyInput('1000000')).toBe('1.000.000')
  })

  it('keeps only manually entered digits', () => {
    expect(formatMoneyInput('1.234.abc567')).toBe('1.234.567')
  })

  it('parses the formatted amount for transfer operations', () => {
    expect(parseMoneyInput('1.250.000')).toBe(1_250_000)
  })
})
