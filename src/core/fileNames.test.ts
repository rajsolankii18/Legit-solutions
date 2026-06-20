import { describe, expect, it } from 'vitest'
import { extractLastNumericPart, removeExtension, sortByLastNumericPart } from './fileNames'

describe('file name helpers', () => {
  it('removes the final extension', () => {
    expect(removeExtension('contacts.part1.txt')).toBe('contacts.part1')
  })

  it('extracts the last numeric part from common separators', () => {
    expect(extractLastNumericPart('A 10 B 2')).toBe(2)
    expect(extractLastNumericPart('batch-final')).toBe(0)
  })

  it('sorts by the last numeric part with a stable name tie-breaker', () => {
    const sorted = sortByLastNumericPart(['A10.txt', 'A2.txt', 'notes.txt'], (name) => name)
    expect(sorted).toEqual(['notes.txt', 'A2.txt', 'A10.txt'])
  })
})
