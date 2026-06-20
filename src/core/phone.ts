export type PhoneCleanMode = 'legacy' | 'smart'

export type PhoneCleanResult = {
  ok: boolean
  input: string
  cleaned: string | null
  reason?: string
}

export function cleanAndValidatePhoneNumber(
  phoneNumber: string | null | undefined,
  mode: PhoneCleanMode = 'legacy',
) {
  return cleanPhoneNumber(phoneNumber, mode).cleaned
}

export function cleanPhoneNumber(
  phoneNumber: string | null | undefined,
  mode: PhoneCleanMode = 'legacy',
): PhoneCleanResult {
  if (phoneNumber == null) {
    return { ok: false, input: '', cleaned: null, reason: 'empty' }
  }

  if (mode === 'legacy') {
    const cleaned = cleanLegacy(phoneNumber)
    return cleaned
      ? { ok: true, input: phoneNumber, cleaned }
      : { ok: false, input: phoneNumber, cleaned: null, reason: 'too short after legacy cleanup' }
  }

  return cleanSmart(phoneNumber)
}

function cleanLegacy(phoneNumber: string) {
  let cleaned = normalizeInput(phoneNumber)
  cleaned = cleaned.replace(/[\s\-()]/g, '')

  if (cleaned.startsWith('+')) {
    cleaned = `+${cleaned.slice(1).replace(/[^0-9]/g, '')}`
  } else {
    cleaned = cleaned.replace(/[^0-9]/g, '')
  }

  return cleaned.length >= 9 ? cleaned : null
}

function cleanSmart(phoneNumber: string): PhoneCleanResult {
  const normalized = normalizeInput(phoneNumber)
  const withoutExtension = normalized.replace(/\b(?:ext|extension|x)\.?\s*\d+$/i, '')
  const startsWithPlus = withoutExtension.trim().startsWith('+')
  const digits = withoutExtension.replace(/[^0-9]/g, '')

  if (digits.length < 9) {
    return {
      ok: false,
      input: phoneNumber,
      cleaned: null,
      reason: 'fewer than 9 digits',
    }
  }

  if (digits.length > 15) {
    return {
      ok: false,
      input: phoneNumber,
      cleaned: null,
      reason: 'more than 15 digits',
    }
  }

  return {
    ok: true,
    input: phoneNumber,
    cleaned: startsWithPlus ? `+${digits}` : digits,
  }
}

function normalizeInput(phoneNumber: string) {
  let cleaned = phoneNumber
  if (cleaned.startsWith('\uFEFF')) {
    cleaned = cleaned.slice(1)
  }

  return cleaned.normalize('NFKC').replace(/\p{Cf}/gu, '').replace(/\p{Cc}/gu, '')
}
