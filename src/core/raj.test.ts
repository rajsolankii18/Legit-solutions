import { describe, expect, it } from 'vitest'
import {
  convertTxtFileToRajVcf,
  convertTxtFilesToRajVcf,
  convertTxtFilesToRajVcfJob,
  getAlphabeticBase,
} from './raj'

const fixedOptions = {
  fileNaming: { mode: 'input-name' as const },
  contactNaming: { mode: 'fixed' as const, baseName: 'RAJ' },
}

describe('RAJ conversion', () => {
  it('creates one VCF per TXT file with fixed base names and counts skipped lines', () => {
    const output = convertTxtFileToRajVcf(
      {
        fileName: '404.txt',
        text: '+91 98765-43210\nbad\n9876543210',
      },
      fixedOptions,
    )

    expect(output.fileName).toBe('404.vcf')
    expect(output.contactCount).toBe(2)
    expect(output.skippedCount).toBe(1)
    expect(output.content).toContain('FN:RAJ-001')
    expect(output.content).toContain('FN:RAJ-002')
    expect(output.content).not.toContain('N:;;')
    expect(output.content).toContain('TEL;TYPE=CELL:9876543210')
  })

  it('sorts multiple files by the legacy numeric filename rule', () => {
    const outputs = convertTxtFilesToRajVcf(
      [
        { fileName: 'A10.txt', text: '9876543210' },
        { fileName: 'A2.txt', text: '9876543210' },
      ],
      fixedOptions,
    )

    expect(outputs.map((file) => file.fileName)).toEqual(['A2.vcf', 'A10.vcf'])
  })

  it('supports manual VCF file names per input file', () => {
    const outputs = convertTxtFilesToRajVcf(
      [{ fileName: 'A1.txt', text: '9876543210' }],
      {
        fileNaming: { mode: 'manual', namesByFileName: { 'A1.txt': 'custom-name' } },
        contactNaming: { mode: 'fixed', baseName: 'C' },
      },
    )

    expect(outputs[0].fileName).toBe('custom-name.vcf')
  })

  it('supports sequential VCF file names with a custom start number', () => {
    const outputs = convertTxtFilesToRajVcf(
      [
        { fileName: 'A1.txt', text: '9876543210' },
        { fileName: 'A2.txt', text: '9876543210' },
      ],
      {
        fileNaming: { mode: 'sequential', baseName: 'batch-', startNumber: 7 },
        contactNaming: { mode: 'fixed', baseName: 'C' },
      },
    )

    expect(outputs.map((file) => file.fileName)).toEqual(['batch-7.vcf', 'batch-8.vcf'])
  })

  it('supports manual contact bases per input file', () => {
    const output = convertTxtFileToRajVcf(
      { fileName: 'A1.txt', text: '9876543210' },
      {
        fileNaming: { mode: 'input-name' },
        contactNaming: {
          mode: 'manual-per-file',
          basesByFileName: { 'A1.txt': 'MANUAL' },
          fallbackBaseName: 'FALLBACK',
        },
      },
    )

    expect(output.content).toContain('FN:MANUAL-001')
    expect(output.content).not.toContain('N:;;')
  })

  it('supports sequential contact bases using the file index', () => {
    const outputs = convertTxtFilesToRajVcf(
      [
        { fileName: 'A1.txt', text: '9876543210' },
        { fileName: 'A2.txt', text: '9876543210' },
      ],
      {
        fileNaming: { mode: 'sequential', baseName: 'file-', startNumber: 5 },
        contactNaming: { mode: 'sequential', baseName: 'BASE' },
      },
    )

    expect(outputs[0].content).toContain('FN:BASE5-001')
    expect(outputs[1].content).toContain('FN:BASE6-001')
    expect(outputs[0].content).not.toContain('N:;;')
    expect(outputs[1].content).not.toContain('N:;;')
  })

  it('supports a custom linked contact start number for input-name files', () => {
    const outputs = convertTxtFilesToRajVcf(
      [
        { fileName: 'GL10_11.txt', text: '9876543210' },
        { fileName: 'GL10_12.txt', text: '9876543211' },
      ],
      {
        fileNaming: { mode: 'input-name' },
        contactNaming: { mode: 'sequential', baseName: 'GLA', startNumber: 11 },
      },
    )

    expect(outputs[0].fileName).toBe('GL10_11.vcf')
    expect(outputs[1].fileName).toBe('GL10_12.vcf')
    expect(outputs[0].content).toContain('FN:GLA11-001')
    expect(outputs[1].content).toContain('FN:GLA12-001')
    expect(outputs[0].content).not.toContain('FN:GLA1-001')
  })

  it('keeps numeric identity separate from the contact counter with fixed bases', () => {
    const outputs = convertTxtFilesToRajVcfJob(
      [{ fileName: 'GLA10_NAVY.txt', text: '573138497058\n573136994187' }],
      {
        fileNaming: { mode: 'manual', namesByFileName: { 'GLA10_NAVY.txt': 'GLA10_NAVY.vcf' } },
        contactNaming: { mode: 'fixed', baseName: 'NAVY_GLA10' },
        filters: {
          phoneMode: 'smart',
          duplicatePolicy: 'keep',
          includeReports: false,
        },
      },
    )

    expect(outputs[0].fileName).toBe('GLA10_NAVY.vcf')
    expect(outputs[0].content).toContain('FN:NAVY_GLA10-001')
    expect(outputs[0].content).toContain('FN:NAVY_GLA10-002')
    expect(outputs[0].content).not.toContain('FN:NAVY_GLA101')
    expect(outputs[0].content).not.toContain('N:;;')
  })

  it('supports alphabetic contact bases', () => {
    const outputs = convertTxtFilesToRajVcf(
      [
        { fileName: 'A1.txt', text: '9876543210' },
        { fileName: 'A2.txt', text: '9876543210' },
      ],
      {
        fileNaming: { mode: 'input-name' },
        contactNaming: { mode: 'alphabetic', length: 2, runIndex: 0 },
      },
    )

    expect(outputs[0].content).toContain('FN:AA-001')
    expect(outputs[1].content).toContain('FN:AB-001')
    expect(outputs[0].content).not.toContain('N:;;')
    expect(outputs[1].content).not.toContain('N:;;')
  })

  it('matches the legacy alphabetic generator shape', () => {
    expect(getAlphabeticBase(0, 2)).toBe('AA')
    expect(getAlphabeticBase(25, 2)).toBe('AZ')
    expect(getAlphabeticBase(26, 2)).toBe('BA')
  })

  it('can skip duplicates across a whole job and export audit reports', () => {
    const outputs = convertTxtFilesToRajVcfJob(
      [
        { fileName: 'A1.txt', text: '9876543210\nbad\n9876543210' },
        { fileName: 'A2.txt', text: '+91 98765 43210\n123456789' },
      ],
      {
        fileNaming: { mode: 'input-name' },
        contactNaming: { mode: 'fixed', baseName: 'RAJ' },
        filters: {
          phoneMode: 'smart',
          duplicatePolicy: 'skip-across-job',
          includeReports: true,
        },
      },
    )

    const vcfOutputs = outputs.filter((file) => file.kind === 'vcf')
    const summary = outputs.find((file) => file.fileName === 'reports/summary.txt')
    const invalid = outputs.find((file) => file.fileName === 'reports/invalid-numbers.txt')
    const duplicates = outputs.find((file) => file.fileName === 'reports/duplicates.txt')

    expect(vcfOutputs).toHaveLength(2)
    expect(vcfOutputs[0].itemCount).toBe(1)
    expect(vcfOutputs[0].skippedCount).toBe(2)
    expect(vcfOutputs[1].itemCount).toBe(2)
    expect(summary?.content).toContain('Duplicate rows: 1')
    expect(invalid?.content).toContain('A1.txt\t2\tfewer than 9 digits\tbad')
    expect(duplicates?.content).toContain('A1.txt\t3\t9876543210\tA1.txt\t1')
  })
})
