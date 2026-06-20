import { describe, expect, it } from 'vitest'
import {
  autoMergeAdminNavy,
  convertVcfFilesToTxt,
  prependVcfContacts,
  renameStartingContactsInVcfFiles,
  splitVcfFiles,
  splitVcfFilesRough,
} from './vcfTools'

const vcf = [
  'BEGIN:VCARD',
  'VERSION:3.0',
  'FN:ONE',
  'N:;;ONE;;;',
  'TEL;TYPE=CELL:111111111',
  'END:VCARD',
  'BEGIN:VCARD',
  'VERSION:3.0',
  'FN:TWO',
  'N:;;TWO;;;',
  'TEL;TYPE=CELL:222222222',
  'END:VCARD',
].join('\n')

describe('VCF tools', () => {
  it('splits VCF files by contact count', () => {
    const outputs = splitVcfFiles([{ fileName: 'B[].vcf', text: vcf }], 1, 3)
    expect(outputs.map((file) => file.fileName)).toEqual(['B03.vcf', 'B04.vcf'])
    expect(outputs.map((file) => file.itemCount)).toEqual([1, 1])
  })

  it('splits VCF files with ROUGH-style contact renaming', () => {
    const outputs = splitVcfFilesRough([{ fileName: 'B[].vcf', text: vcf }], {
      contactsPerFile: 1,
      startNumber: 3,
      renameContacts: true,
      continuousNumbering: false,
      continuousBaseName: 'B',
      fixedBaseMode: false,
    })

    expect(outputs.map((file) => file.fileName)).toEqual(['B03.vcf', 'B04.vcf'])
    expect(outputs[0].content).toContain('FN:ONE3-001')
    expect(outputs[1].content).toContain('FN:TWO4-001')
    expect(outputs[0].content).not.toContain('N:;;')
    expect(outputs[1].content).not.toContain('N:;;')
  })

  it('converts VCF files to TXT', () => {
    const outputs = convertVcfFilesToTxt([{ fileName: 'B1.vcf', text: vcf }], 'separate', 'merged')
    expect(outputs[0].fileName).toBe('B1.txt')
    expect(outputs[0].content).toBe('111111111\n222222222\n')
  })

  it('prepends contacts from a source VCF', () => {
    const outputs = prependVcfContacts(
      [{ fileName: 'target.vcf', text: vcf }],
      { fileName: 'source.vcf', text: vcf },
    )
    expect(outputs[0].itemCount).toBe(4)
  })

  it('auto merges admin/navy contacts and renumbers normal contacts', () => {
    const base = vcf.replaceAll('ONE', 'ADMIN').replaceAll('TWO', 'NAVY')
    const outputs = autoMergeAdminNavy([{ fileName: 'B7.vcf', text: vcf }], {
      fileName: 'base.vcf',
      text: base,
    }, '')

    expect(outputs[0].content).toContain('ADMIN - B7-001')
    expect(outputs[0].content).toContain('NAVY - B7-001')
    expect(outputs[0].content).toContain('FN:B7-001')
    expect(outputs[0].content).toContain('FN:B7-002')
    expect(outputs[0].content).not.toContain('N:;;')
  })

  it('renames starting contacts with a single base', () => {
    const outputs = renameStartingContactsInVcfFiles(
      [{ fileName: 'target.vcf', text: vcf }],
      { mode: 'single', renameCount: 1, baseName: 'ADMIN' },
    )

    expect(outputs[0].content).toContain('FN:ADMIN-001')
    expect(outputs[0].content).toContain('FN:TWO-001')
    expect(outputs[0].content).not.toContain('N:;;')
  })

  it('renames starting contacts with admin/navy groups', () => {
    const outputs = renameStartingContactsInVcfFiles(
      [{ fileName: 'B1.vcf', text: vcf }],
      { mode: 'admin-navy', adminCount: 1, navyCount: 1 },
    )

    expect(outputs[0].content).toContain('ADMIN - B1-001')
    expect(outputs[0].content).toContain('NAVY - B1-001')
  })
})
