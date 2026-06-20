import { removeExtension, sortByLastNumericPart } from './fileNames'
import type { GeneratedFile, TextInputFile } from './types'

const CUTTER_MIN_PHONE_LENGTH = 7

export type CleanTxtOptions = {
  removalListText: string
}

export type ExcelColumnExtraction = {
  sourceFileName: string
  sheetName: string
  columnIndex: number
  values: string[]
  phoneValues?: string[]
}

export type ExcelSheetExtraction = {
  sourceFileName: string
  sheetName: string
  rows: string[][]
  columns: ExcelColumnExtraction[]
}

export function cleanTxtFilesLikeCutter(
  files: TextInputFile[],
  options: CleanTxtOptions,
): GeneratedFile[] {
  const removalSet = buildRemovalSet(options.removalListText)
  const sortedFiles = sortByLastNumericPart(files, (file) => file.fileName)
  let totalKept = 0
  let totalRemovedByList = 0

  const outputs = sortedFiles.map((file) => {
    let removedByList = 0
    const lines = file.text
      .split(/\r?\n/)
      .map(cleanCutterLine)
      .filter((line): line is string => Boolean(line))
      .filter((line) => {
        if (removalSet.has(line)) {
          removedByList += 1
          totalRemovedByList += 1
          return false
        }
        return true
      })

    totalKept += lines.length
    return createTxtOutput(file.fileName, lines, removedByList)
  })

  return [
    ...outputs,
    {
      fileName: 'reports/txt-cleaner-summary.txt',
      content: [
        'TXT cleaner summary',
        '',
        `Files processed: ${sortedFiles.length}`,
        `Numbers kept: ${totalKept}`,
        `Removed by list: ${totalRemovedByList}`,
      ].join('\n') + '\n',
      kind: 'txt',
      itemCount: sortedFiles.length,
    },
  ]
}

export function addPlusPrefixToTxtFiles(files: TextInputFile[], safeMode: boolean) {
  return sortByLastNumericPart(files, (file) => file.fileName).map((file) => {
    const lines = file.text
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => (safeMode && line.startsWith('+') ? line : `+${line}`))

    return createTxtOutput(`${removeExtension(file.fileName)}_plus.txt`, lines)
  })
}

export function removeDuplicateTxtNumbers(files: TextInputFile[]): GeneratedFile[] {
  const sortedFiles = sortByLastNumericPart(files, (file) => file.fileName)
  const seen = new Set<string>()
  const duplicates = new Set<string>()
  const unique: string[] = []

  for (const file of sortedFiles) {
    for (const line of file.text.split(/\r?\n/)) {
      if (!line.trim()) continue
      const number = cleanDigitsOnly(line)
      if (!number) continue

      if (seen.has(number)) {
        duplicates.add(number)
      } else {
        seen.add(number)
        unique.push(number)
      }
    }
  }

  return [
    createTxtOutput('unique-cleaned-numbers.txt', unique),
    createTxtOutput('reports/duplicates-found.txt', Array.from(duplicates)),
    {
      fileName: 'reports/dedup-summary.txt',
      content: [
        'Duplicate remover summary',
        '',
        `Files processed: ${sortedFiles.length}`,
        `Unique numbers: ${unique.length}`,
        `Duplicate values found: ${duplicates.size}`,
      ].join('\n') + '\n',
      kind: 'txt',
      itemCount: sortedFiles.length,
    },
  ]
}

export function buildExcelExtractionOutputs(
  extractions: ExcelSheetExtraction[],
  minimumValuesPerColumn: number,
): GeneratedFile[] {
  const threshold = Math.max(0, Math.floor(minimumValuesPerColumn))
  const outputs = extractions.flatMap((sheet) => buildSheetOutputs(sheet, threshold))
  const columnsScanned = extractions.reduce((sum, sheet) => sum + sheet.columns.length, 0)
  const phoneColumns = extractions.reduce(
    (sum, sheet) =>
      sum +
      sheet.columns.filter((column) => (column.phoneValues ?? []).length > threshold).length,
    0,
  )

  return [
    ...outputs,
    {
      fileName: 'reports/excel-extraction-summary.txt',
      content: [
        'Excel extraction summary',
        '',
        `Workbooks/sheets scanned: ${extractions.length}`,
        `Columns scanned: ${columnsScanned}`,
        `Columns exported: ${outputs.length}`,
        `Phone columns over threshold: ${phoneColumns}`,
        `Phone threshold: more than ${threshold}`,
        '',
        'Exports created:',
        '- One CSV per sheet',
        '- One TSV table per sheet',
        '- One TXT file per non-empty column',
        '- One phone-only TXT file per phone-heavy column',
      ].join('\n') + '\n',
      kind: 'txt',
      itemCount: outputs.length,
    },
  ]
}

export function extractPhoneValuesFromRows(rows: unknown[][]): string[][] {
  if (rows.length === 0) return []
  const maxColumns = Math.max(...rows.map((row) => row.length))
  const columns = Array.from({ length: maxColumns }, () => [] as string[])

  for (const row of rows) {
    for (let columnIndex = 0; columnIndex < maxColumns; columnIndex += 1) {
      const cell = row[columnIndex]
      if (cell == null) continue
      const value = String(cell).trim()
      if (isExcelPhoneNumber(value)) {
        columns[columnIndex].push(value)
      }
    }
  }

  return columns
}

export function buildExcelSheetExtraction(
  sourceFileName: string,
  sheetName: string,
  rows: unknown[][],
): ExcelSheetExtraction {
  const normalizedRows = rows.map((row) => row.map(formatCellValue))
  const maxColumns = normalizedRows.length
    ? Math.max(...normalizedRows.map((row) => row.length))
    : 0
  const columns = Array.from({ length: maxColumns }, (_, index) => {
    const values = normalizedRows
      .map((row) => row[index] ?? '')
      .map((value) => value.trim())
      .filter(Boolean)
    return {
      sourceFileName,
      sheetName,
      columnIndex: index + 1,
      values,
      phoneValues: values.filter(isExcelPhoneNumber),
    }
  })

  return {
    sourceFileName,
    sheetName,
    rows: normalizedRows,
    columns,
  }
}

function buildSheetOutputs(sheet: ExcelSheetExtraction, phoneThreshold: number): GeneratedFile[] {
  const basePath = `excel/${sanitizeFilePart(removeExtension(sheet.sourceFileName))}/${sanitizeFilePart(sheet.sheetName)}`
  const outputs: GeneratedFile[] = [
    createTxtOutput(`${basePath}/sheet.csv`, sheet.rows.map(formatCsvRow)),
    createTxtOutput(`${basePath}/sheet.tsv`, sheet.rows.map((row) => row.join('\t'))),
  ]

  for (const column of sheet.columns) {
    if (column.values.length > 0) {
      outputs.push(
        createTxtOutput(
          `${basePath}/columns/col${String(column.columnIndex).padStart(2, '0')}.txt`,
          column.values,
        ),
      )
    }

    const phoneValues = column.phoneValues ?? []
    if (phoneValues.length > phoneThreshold) {
      outputs.push(
        createTxtOutput(
          `${basePath}/phone-columns/phone_col${String(column.columnIndex).padStart(2, '0')}.txt`,
          phoneValues,
        ),
      )
    }
  }

  return outputs
}

function formatCellValue(value: unknown) {
  if (value == null) return ''
  if (value instanceof Date) return value.toISOString()
  return String(value).trim()
}

function formatCsvRow(row: string[]) {
  return row.map(formatCsvCell).join(',')
}

function formatCsvCell(value: string) {
  if (!/[",\r\n]/.test(value)) return value
  return `"${value.replace(/"/g, '""')}"`
}

function cleanCutterLine(line: string) {
  let cleaned = line.replace(/[^0-9+]/g, '')

  if ((cleaned.match(/\+/g) ?? []).length > 1) {
    cleaned = cleaned.replace(/\+/g, '')
  }

  if (cleaned.includes('+') && !cleaned.startsWith('+')) {
    cleaned = cleaned.replace(/\+/g, '')
  }

  const digitsOnly = cleaned.replace(/\+/g, '')
  return digitsOnly.length < CUTTER_MIN_PHONE_LENGTH ? null : cleaned
}

function buildRemovalSet(text: string) {
  const removalSet = new Set<string>()
  for (const token of text.split(/[\n,]/)) {
    const trimmed = token.trim()
    if (!trimmed) continue
    removalSet.add(trimmed)
    const cleaned = cleanCutterLine(trimmed)
    if (cleaned) removalSet.add(cleaned)
  }
  return removalSet
}

function cleanDigitsOnly(line: string) {
  return line.replace(/\D/g, '')
}

function isExcelPhoneNumber(value: string) {
  const cleanedDigits = cleanDigitsOnly(value)
  return cleanedDigits.length >= CUTTER_MIN_PHONE_LENGTH
}

function sanitizeFilePart(value: string) {
  return value.replace(/[\\/*?:"<>|]/g, '_').trim() || 'Sheet'
}

function createTxtOutput(fileName: string, lines: string[], skippedCount?: number): GeneratedFile {
  return {
    fileName,
    content: `${lines.join('\n')}${lines.length ? '\n' : ''}`,
    kind: 'txt',
    itemCount: lines.length,
    skippedCount,
  }
}
