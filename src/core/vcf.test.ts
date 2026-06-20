import { describe, expect, it } from 'vitest'
import { formatVcfNameLines, writeVcfContacts } from './vcf'

describe('VCF writer', () => {
  it('can write compact legacy N-only contacts', () => {
    const content = writeVcfContacts(
      [{ name: 'GL10-001', phone: '573138497058' }],
      { nameLineMode: 'legacy-n-only' },
    )

    expect(content).not.toContain('FN:')
    expect(content).toContain('N:;;GL10-001;;;')
    expect(content).toContain('TEL;TYPE=CELL:573138497058')
  })

  it('can remove FN lines from standard VCF content', () => {
    const standard = writeVcfContacts([{ name: 'GL10-001', phone: '573138497058' }])
    const compact = formatVcfNameLines(standard, 'legacy-n-only')

    expect(compact).not.toContain('FN:')
    expect(compact).toContain('N:;;GL10-001;;;')
  })
})
