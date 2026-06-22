import { describe, expect, it } from 'vitest'
import {
  addPlusPrefixToTxtFiles,
  buildExcelExtractionOutputs,
  buildExcelSheetExtraction,
  cleanTxtFilesLikeCutter,
  removeDuplicateTxtNumbers,
} from './numberTools'

describe('Python utility ports', () => {
  it('cleans TXT files like cutter.py and applies a removal list', () => {
    const outputs = cleanTxtFilesLikeCutter(
      [{ fileName: 'a.txt', text: 'index 201\n+91 98765-43210\nabc 7777777\n9999999' }],
      { removalListText: '7777777' },
    )

    expect(outputs[0].fileName).toBe('a.txt')
    expect(outputs[0].content).toBe('+919876543210\n9999999\n')
    expect(outputs[0].skippedCount).toBe(1)
    expect(outputs[1].content).toContain('Numbers kept: 2')
  })

  it('adds plus prefixes with optional safe mode', () => {
    const [output] = addPlusPrefixToTxtFiles(
      [{ fileName: 'list.txt', text: '123\n+456\n' }],
      true,
    )

    expect(output.fileName).toBe('list_plus.txt')
    expect(output.content).toBe('+123\n+456\n')
  })

  it('removes duplicates after digit-only cleaning', () => {
    const outputs = removeDuplicateTxtNumbers([
      { fileName: 'a.txt', text: '+91 99999 99999\n888' },
      { fileName: 'b.txt', text: '919999999999\n777' },
    ])

    expect(outputs[0].content).toBe('919999999999\n888\n777\n')
    expect(outputs[1].content).toBe('919999999999\n')
  })

  it('extracts organized Excel sheets, columns, and strong phone columns', () => {
    const sheet = buildExcelSheetExtraction('book.xlsx', 'Sheet/One', [
      ['name', '9999999'],
      ['bad', '123'],
      ['other', '+91 98765 43210'],
    ])
    const outputs = buildExcelExtractionOutputs([sheet], 1)

    expect(outputs.some((file) => file.fileName === 'excel/book/Sheet_One/sheet.csv')).toBe(true)
    expect(outputs.some((file) => file.fileName === 'excel/book/Sheet_One/sheet.tsv')).toBe(true)
    expect(
      outputs.find((file) => file.fileName === 'excel/book/Sheet_One/columns/col02.txt')?.content,
    ).toBe('9999999\n123\n+91 98765 43210\n')
    expect(
      outputs.find((file) => file.fileName === 'excel/book/Sheet_One/phone-columns/phone_col02.txt')
        ?.content,
    ).toBe('9999999\n+91 98765 43210\n')
    expect(outputs.at(-1)?.content).toContain('One CSV per sheet')
  })
})
