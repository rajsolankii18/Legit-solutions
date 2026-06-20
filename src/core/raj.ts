import { ensureExtension, removeExtension, sortByLastNumericPart } from './fileNames'
import { cleanAndValidatePhoneNumber, cleanPhoneNumber } from './phone'
import type { PhoneCleanMode } from './phone'
import type { GeneratedFile, TextInputFile, VcfOutputFile } from './types'
import { writeVcfContacts } from './vcf'

export type RajFileNaming =
  | { mode: 'manual'; namesByFileName: Record<string, string> }
  | { mode: 'sequential'; baseName: string; startNumber: number }
  | { mode: 'input-name' }

export type RajContactNaming =
  | { mode: 'manual-per-file'; basesByFileName: Record<string, string>; fallbackBaseName: string }
  | { mode: 'sequential'; baseName: string }
  | { mode: 'alphabetic'; length: number; runIndex: number }
  | { mode: 'fixed'; baseName: string }

export type RajConvertOptions = {
  fileNaming: RajFileNaming
  contactNaming: RajContactNaming
  filters?: RajFilterOptions
}

export type RajDuplicatePolicy = 'keep' | 'skip-within-file' | 'skip-across-job'

export type RajFilterOptions = {
  phoneMode: PhoneCleanMode
  duplicatePolicy: RajDuplicatePolicy
  includeReports: boolean
}

type RejectionRow = {
  fileName: string
  lineNumber: number
  input: string
  reason: string
}

type DuplicateRow = {
  fileName: string
  lineNumber: number
  phone: string
  firstSeenFile: string
  firstSeenLineNumber: number
}

type SeenPhone = {
  fileName: string
  lineNumber: number
}

export function convertTxtFilesToRajVcf(files: TextInputFile[], options: RajConvertOptions) {
  const sortedFiles = sortByLastNumericPart(files, (file) => file.fileName)
  return sortedFiles.map((file, index) => {
    const fileIndex = getFileIndex(index, options.fileNaming)
    return convertTxtFileToRajVcf(file, options, fileIndex)
  })
}

export function convertTxtFilesToRajVcfJob(
  files: TextInputFile[],
  options: RajConvertOptions,
): GeneratedFile[] {
  const filters = resolveRajFilters(options.filters)
  const sortedFiles = sortByLastNumericPart(files, (file) => file.fileName)
  const globalSeenPhones = new Map<string, SeenPhone>()
  const rejectedRows: RejectionRow[] = []
  const duplicateRows: DuplicateRow[] = []
  const outputs = sortedFiles.map((file, index) => {
    const fileIndex = getFileIndex(index, options.fileNaming)
    return convertTxtFileToRajVcfWithFilters({
      file,
      options,
      fileIndex,
      filters,
      globalSeenPhones,
      rejectedRows,
      duplicateRows,
    })
  })

  if (!filters.includeReports) return outputs

  return [
    ...outputs,
    buildSummaryReport(outputs, rejectedRows, duplicateRows, filters),
    buildInvalidReport(rejectedRows),
    buildDuplicateReport(duplicateRows),
  ]
}

export function convertTxtFileToRajVcf(
  file: TextInputFile,
  options: RajConvertOptions,
  fileIndex = 1,
): VcfOutputFile {
  const lines = splitTextLines(file.text)
  const base = resolveContactBase(file, options.contactNaming, fileIndex)
  let skippedCount = 0
  let contactCounter = 0

  const contacts = lines.flatMap((line) => {
    const phone = cleanAndValidatePhoneNumber(line)
    if (!phone) {
      skippedCount += 1
      return []
    }

    contactCounter += 1
    return [
      {
        name: `${base}-${String(contactCounter).padStart(3, '0')}`,
        phone,
      },
    ]
  })

  return {
    fileName: resolveOutputFileName(file, options.fileNaming, fileIndex),
    content: writeVcfContacts(contacts),
    kind: 'vcf',
    itemCount: contacts.length,
    contactCount: contacts.length,
    skippedCount,
  }
}

function convertTxtFileToRajVcfWithFilters({
  file,
  options,
  fileIndex,
  filters,
  globalSeenPhones,
  rejectedRows,
  duplicateRows,
}: {
  file: TextInputFile
  options: RajConvertOptions
  fileIndex: number
  filters: RajFilterOptions
  globalSeenPhones: Map<string, SeenPhone>
  rejectedRows: RejectionRow[]
  duplicateRows: DuplicateRow[]
}): VcfOutputFile {
  const lines = splitTextLinesWithNumbers(file.text)
  const base = resolveContactBase(file, options.contactNaming, fileIndex)
  const fileSeenPhones = new Map<string, SeenPhone>()
  let skippedCount = 0
  let contactCounter = 0

  const contacts = lines.flatMap((line) => {
    const phoneResult = cleanPhoneNumber(line.text, filters.phoneMode)
    if (!phoneResult.ok || !phoneResult.cleaned) {
      skippedCount += 1
      rejectedRows.push({
        fileName: file.fileName,
        lineNumber: line.lineNumber,
        input: line.text,
        reason: phoneResult.reason ?? 'invalid number',
      })
      return []
    }

    const localMatch = fileSeenPhones.get(phoneResult.cleaned)
    const globalMatch = globalSeenPhones.get(phoneResult.cleaned)
    const duplicateMatch =
      filters.duplicatePolicy === 'skip-within-file' ? localMatch : globalMatch

    if (filters.duplicatePolicy !== 'keep' && duplicateMatch) {
      skippedCount += 1
      duplicateRows.push({
        fileName: file.fileName,
        lineNumber: line.lineNumber,
        phone: phoneResult.cleaned,
        firstSeenFile: duplicateMatch.fileName,
        firstSeenLineNumber: duplicateMatch.lineNumber,
      })
      return []
    }

    const seenAt = { fileName: file.fileName, lineNumber: line.lineNumber }
    fileSeenPhones.set(phoneResult.cleaned, seenAt)
    if (!globalSeenPhones.has(phoneResult.cleaned)) {
      globalSeenPhones.set(phoneResult.cleaned, seenAt)
    }

    contactCounter += 1
    return [
      {
        name: `${base}-${String(contactCounter).padStart(3, '0')}`,
        phone: phoneResult.cleaned,
      },
    ]
  })

  return {
    fileName: resolveOutputFileName(file, options.fileNaming, fileIndex),
    content: writeVcfContacts(contacts),
    kind: 'vcf',
    itemCount: contacts.length,
    contactCount: contacts.length,
    skippedCount,
  }
}

export function splitTextLines(text: string) {
  return text
    .replace(/^\uFEFF/, '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
}

function splitTextLinesWithNumbers(text: string) {
  return text
    .replace(/^\uFEFF/, '')
    .split(/\r?\n/)
    .map((line, index) => ({
      lineNumber: index + 1,
      text: line.trim(),
    }))
    .filter((line) => line.text)
}

export function getAlphabeticBase(index: number, length: number) {
  const safeLength = Math.max(1, Math.floor(length))
  let remaining = Math.max(0, Math.floor(index))
  let base = ''

  for (let position = 0; position < safeLength; position += 1) {
    base += String.fromCharCode('A'.charCodeAt(0) + (remaining % 26))
    remaining = Math.floor(remaining / 26)
  }

  return base.split('').reverse().join('')
}

function getFileIndex(sortedIndex: number, fileNaming: RajFileNaming) {
  if (fileNaming.mode === 'sequential') return fileNaming.startNumber + sortedIndex
  return sortedIndex + 1
}

function resolveOutputFileName(file: TextInputFile, fileNaming: RajFileNaming, fileIndex: number) {
  if (fileNaming.mode === 'manual') {
    const manualName = fileNaming.namesByFileName[file.fileName]?.trim()
    return ensureExtension(manualName || removeExtension(file.fileName), '.vcf')
  }

  if (fileNaming.mode === 'sequential') {
    const base = fileNaming.baseName.trim() || 'output'
    return `${base}${fileIndex}.vcf`
  }

  return `${removeExtension(file.fileName)}.vcf`
}

function resolveContactBase(
  file: TextInputFile,
  contactNaming: RajContactNaming,
  fileIndex: number,
) {
  if (contactNaming.mode === 'manual-per-file') {
    return (
      contactNaming.basesByFileName[file.fileName]?.trim() ||
      contactNaming.fallbackBaseName.trim() ||
      removeExtension(file.fileName)
    )
  }

  if (contactNaming.mode === 'sequential') {
    const base = contactNaming.baseName.trim() || 'CONTACT'
    return `${base}${fileIndex}`
  }

  if (contactNaming.mode === 'alphabetic') {
    return getAlphabeticBase(fileIndex - 1 + contactNaming.runIndex * 1000, contactNaming.length)
  }

  return contactNaming.baseName.trim() || 'CONTACT'
}

function resolveRajFilters(filters: RajConvertOptions['filters']): RajFilterOptions {
  return {
    phoneMode: filters?.phoneMode ?? 'legacy',
    duplicatePolicy: filters?.duplicatePolicy ?? 'keep',
    includeReports: filters?.includeReports ?? false,
  }
}

function buildSummaryReport(
  outputs: VcfOutputFile[],
  rejectedRows: RejectionRow[],
  duplicateRows: DuplicateRow[],
  filters: RajFilterOptions,
): GeneratedFile {
  const validCount = outputs.reduce((sum, output) => sum + output.contactCount, 0)
  const skippedCount = outputs.reduce((sum, output) => sum + output.skippedCount, 0)
  const lines = [
    'Legit solutions conversion summary',
    '',
    `Phone cleaner: ${filters.phoneMode}`,
    `Duplicate policy: ${filters.duplicatePolicy}`,
    `VCF output files: ${outputs.length}`,
    `Valid contacts: ${validCount}`,
    `Skipped rows: ${skippedCount}`,
    `Invalid rows: ${rejectedRows.length}`,
    `Duplicate rows: ${duplicateRows.length}`,
    '',
    'Outputs:',
    ...outputs.map(
      (output) =>
        `- ${output.fileName}: ${output.contactCount} contacts, ${output.skippedCount} skipped`,
    ),
  ]

  return {
    fileName: 'reports/summary.txt',
    content: `${lines.join('\n')}\n`,
    kind: 'txt',
    itemCount: outputs.length,
  }
}

function buildInvalidReport(rows: RejectionRow[]): GeneratedFile {
  const content =
    rows.length === 0
      ? 'No invalid rows skipped.\n'
      : [
          'file\tline\treason\tinput',
          ...rows.map((row) =>
            [row.fileName, row.lineNumber, row.reason, row.input].map(formatReportCell).join('\t'),
          ),
        ].join('\n') + '\n'

  return {
    fileName: 'reports/invalid-numbers.txt',
    content,
    kind: 'txt',
    itemCount: rows.length,
  }
}

function buildDuplicateReport(rows: DuplicateRow[]): GeneratedFile {
  const content =
    rows.length === 0
      ? 'No duplicate rows skipped.\n'
      : [
          'file\tline\tphone\tfirst_seen_file\tfirst_seen_line',
          ...rows.map((row) =>
            [
              row.fileName,
              row.lineNumber,
              row.phone,
              row.firstSeenFile,
              row.firstSeenLineNumber,
            ]
              .map(formatReportCell)
              .join('\t'),
          ),
        ].join('\n') + '\n'

  return {
    fileName: 'reports/duplicates.txt',
    content,
    kind: 'txt',
    itemCount: rows.length,
  }
}

function formatReportCell(value: string | number) {
  return String(value).replace(/\t/g, ' ').replace(/\r?\n/g, ' ')
}
