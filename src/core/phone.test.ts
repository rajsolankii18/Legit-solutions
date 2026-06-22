import { describe, expect, it } from 'vitest'
import { cleanAndValidatePhoneNumber, cleanPhoneNumber } from './phone'

describe('cleanAndValidatePhoneNumber', () => {
  it('keeps a leading plus and strips spaces, dashes, and parentheses', () => {
    expect(cleanAndValidatePhoneNumber('+91 98765-43210')).toBe('+919876543210')
    expect(cleanAndValidatePhoneNumber('(987) 654-3210')).toBe('9876543210')
  })

  it('matches the legacy forgiving behavior for text with enough digits', () => {
    expect(cleanAndValidatePhoneNumber('abc123456789')).toBe('123456789')
  })

  it('rejects values shorter than 9 characters after cleaning', () => {
    expect(cleanAndValidatePhoneNumber('1234-5678')).toBeNull()
  })

  it('supports stricter smart cleaning for mobile-style data', () => {
    expect(cleanAndValidatePhoneNumber('＋91 98765 43210 ext. 55', 'smart')).toBe(
      '+919876543210',
    )
    expect(cleanPhoneNumber('1234567890123456', 'smart')).toMatchObject({
      ok: false,
      reason: 'more than 15 digits',
    })
  })
})
