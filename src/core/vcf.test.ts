import { describe, expect, it } from 'vitest'
import { replaceNameInVcfBlock, writeVcfContacts } from './vcf'

describe('VCF writer', () => {
  it('writes FN-only contacts', () => {
    const content = writeVcfContacts([{ name: 'GL10-001', phone: '573138497058' }])

    expect(content).toContain('FN:GL10-001')
    expect(content).not.toContain('N:;;')
    expect(content).toContain('TEL;TYPE=CELL:573138497058')
  })

  it('renames existing VCF blocks into FN-only contacts', () => {
    const renamed = replaceNameInVcfBlock(
      ['BEGIN:VCARD', 'VERSION:3.0', 'FN:OLD', 'N:;;OLD;;;', 'TEL;TYPE=CELL:1', 'END:VCARD'].join('\n'),
      'NEW',
    )

    expect(renamed).toContain('FN:NEW')
    expect(renamed).not.toContain('N:;;')
  })
})
