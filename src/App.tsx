import {
  Archive,
  BadgeCheck,
  ClipboardList,
  Download,
  Edit3,
  Eye,
  FileArchive,
  FileInput,
  FileOutput,
  Files,
  GitMerge,
  ListChecks,
  ShieldCheck,
  SlidersHorizontal,
  Smartphone,
  Table2,
  Upload,
  X,
  Zap,
} from 'lucide-react'
import JSZip from 'jszip'
import readXlsxFile from 'read-excel-file/browser'
import { useRef, useState } from 'react'
import type { ReactElement, ReactNode } from 'react'
import { convertTxtFilesToRajVcf, convertTxtFilesToRajVcfJob } from './core/raj'
import type { RajContactNaming, RajDuplicatePolicy, RajFileNaming } from './core/raj'
import type { PhoneCleanMode } from './core/phone'
import {
  addPlusPrefixToTxtFiles,
  buildExcelExtractionOutputs,
  buildExcelSheetExtraction,
  cleanTxtFilesLikeCutter,
  removeDuplicateTxtNumbers,
  type ExcelSheetExtraction,
} from './core/numberTools'
import type { GeneratedFile, TextInputFile } from './core/types'
import { mergeTxtFiles, splitTxtFiles, type TxtSplitOptions } from './core/txt'
import {
  autoMergeAdminNavy,
  convertVcfFilesToTxt,
  prependVcfContacts,
  renameStartingContactsInVcfFiles,
  splitVcfFilesRough,
} from './core/vcfTools'

type ToolId =
  | 'raj'
  | 'txt-split'
  | 'vcf-split'
  | 'vcf-to-txt'
  | 'txt-merge'
  | 'vcf-merge'
  | 'admin-navy'
  | 'paste-vcf'
  | 'rename-start'
  | 'txt-cleaner'
  | 'plus-prefix'
  | 'dedupe'
  | 'excel-extract'
  | 'text-editor'

type Tool = {
  id: ToolId
  title: string
  description: string
  details: string
  status: 'Builder' | 'Batch' | 'Power'
}

type ComposerSourceOption = {
  key: string
  fileName: string
  origin: 'uploaded' | 'generated'
}

type ComposerTextSource = ComposerSourceOption & {
  text: string
}

const tools: Tool[] = [
  {
    id: 'raj',
    title: 'Smart VCF Builder',
    description: 'TXT batches to VCF with linked naming, smart filters, duplicate reports, and legacy mode.',
    details: 'Use this for your main RAJ-style conversion. It keeps the old linked file/contact naming logic, supports manual names per file, alphabetic runs, duplicate policy, smart or legacy number cleaning, reports, and optional post-generation contact header renaming.',
    status: 'Builder',
  },
  {
    id: 'vcf-merge',
    title: 'VCF Stack Composer',
    description: 'Attach one source contact stack to many target VCF files with preview-safe export.',
    details: 'Use one VCF as the ADMIN/NAVY/source stack and prepend it into every other selected VCF. Generated VCFs from other tools can also be reused here without downloading and reuploading.',
    status: 'Batch',
  },
  {
    id: 'txt-split',
    title: 'TXT Batch Slicer',
    description: 'Split number lists by fixed size, exact half, or custom first block with clean output names.',
    details: 'Break huge TXT lists into clean numbered parts. The editor changes are respected, so you can correct the list first and then split the edited version.',
    status: 'Builder',
  },
  {
    id: 'text-editor',
    title: 'Text Editor Pro',
    description: 'Edit TXT lists live with counts, selected-count, cleanup actions, and export-ready output.',
    details: 'A dedicated local TXT desk for quick list surgery: count all numbers, count only selected lines, trim blanks, sort, unique, digits-only clean, add or remove plus prefixes, then export the edited files or feed them into any converter.',
    status: 'Power',
  },
  {
    id: 'paste-vcf',
    title: 'Quick VCF Forge',
    description: 'Paste raw numbers, apply power filters, and generate a ready VCF instantly.',
    details: 'Fast path when you do not want to create a TXT file first. Paste numbers, apply the same filters and naming rules, optionally rename starting contacts, then save the generated VCF as a reusable source.',
    status: 'Builder',
  },
  {
    id: 'vcf-split',
    title: 'ROUGH VCF Pipeline',
    description: 'Start from TXT, create named VCFs, split them, then optionally compose/prepend a merge source.',
    details: 'This is the advanced ROUGH workflow: upload TXT, generate VCF using RAJ naming, split into controlled chunks, optionally rename contacts inside every split, and optionally prepend an ADMIN/NAVY source.',
    status: 'Batch',
  },
  {
    id: 'admin-navy',
    title: 'ADMIN/NAVY Composer',
    description: 'Build ADMIN/NAVY contact headers, merge them into targets, and renumber safely.',
    details: 'For jobs where the first contacts must become ADMIN/NAVY-style headers before the remaining contacts continue in order. Originals stay untouched and generated output becomes reusable.',
    status: 'Power',
  },
  {
    id: 'rename-start',
    title: 'Contact Header Rewriter',
    description: 'Rewrite starting contacts with single, split, or ADMIN/NAVY naming plans.',
    details: 'Use this after a VCF already exists. It rewrites only the starting contact names using single-base, two-group, or ADMIN/NAVY rules while preserving the rest of the file.',
    status: 'Power',
  },
  {
    id: 'vcf-to-txt',
    title: 'VCF Number Extractor',
    description: 'Pull TEL numbers into one clean TXT or one extracted TXT per VCF.',
    details: 'Extract phone numbers from VCF TEL fields into either one merged TXT or separate TXT files. Useful before cleaning, dedupe, or rebuilding VCFs with better naming.',
    status: 'Builder',
  },
  {
    id: 'txt-merge',
    title: 'TXT Clean Merge',
    description: 'Sort, combine, and export many TXT files as one clean batch list.',
    details: 'Merge many TXT lists into a single output after applying any edits from Text Editor Pro. Good for preparing one master list before conversion.',
    status: 'Builder',
  },
  {
    id: 'txt-cleaner',
    title: 'TXT Cleaner Lab',
    description: 'Clean messy TXT lists, remove short index junk, and cut specific numbers.',
    details: 'Ported from your Python cleanup utilities. It removes formatting noise, rejects short junk rows, preserves one valid leading plus, and can remove a supplied blocklist.',
    status: 'Power',
  },
  {
    id: 'dedupe',
    title: 'Duplicate Remover',
    description: 'Clean to digits, keep first occurrence, and export duplicate reports.',
    details: 'Normalize lines to digits, keep the first copy across all selected files, and produce both a clean unique list and a duplicates-found report.',
    status: 'Power',
  },
  {
    id: 'plus-prefix',
    title: 'Plus Prefixer',
    description: 'Add international + prefixes to TXT batches with safe no-double-plus mode.',
    details: 'Bulk-add plus prefixes to TXT files. Safe mode prevents double plus symbols when a line already starts with plus.',
    status: 'Batch',
  },
  {
    id: 'excel-extract',
    title: 'Excel Data Extractor',
    description: 'Turn .xlsx sheets into organized CSV, TSV, per-column TXT, and phone-column TXT exports.',
    details: 'Reads every sheet, exports the full table as CSV and TSV, exports every non-empty column as its own TXT, and separately exports phone-heavy columns when they pass your threshold.',
    status: 'Power',
  },
]

const logLines = [
  'Ready: no files selected yet.',
  'Next: build TypeScript converter engine from Java feature map.',
  'Safety rule: originals stay untouched; generated files export as ZIP.',
]

function App() {
  const [activeTool, setActiveTool] = useState<ToolId>('raj')
  const [selectedFiles, setSelectedFiles] = useState<File[]>([])
  const [vcfNamingMode, setVcfNamingMode] = useState<RajFileNaming['mode']>('input-name')
  const [vcfBaseName, setVcfBaseName] = useState('VCF')
  const [vcfStartNumber, setVcfStartNumber] = useState('1')
  const [manualVcfNames, setManualVcfNames] = useState<Record<string, string>>({})
  const [contactNamingMode, setContactNamingMode] = useState<RajContactNaming['mode']>('sequential')
  const [contactBaseName, setContactBaseName] = useState('TES')
  const [manualContactFallback, setManualContactFallback] = useState('CONTACT')
  const [manualContactBases, setManualContactBases] = useState<Record<string, string>>({})
  const [alphabeticLength, setAlphabeticLength] = useState('2')
  const [alphabeticRunIndex, setAlphabeticRunIndex] = useState('0')
  const [phoneCleanMode, setPhoneCleanMode] = useState<PhoneCleanMode>('smart')
  const [duplicatePolicy, setDuplicatePolicy] = useState<RajDuplicatePolicy>('skip-across-job')
  const [includeReports, setIncludeReports] = useState(true)
  const [txtSplitMode, setTxtSplitMode] = useState<TxtSplitOptions['mode']>('fixed')
  const [txtLinesPerFile, setTxtLinesPerFile] = useState('100')
  const [txtFirstPartLines, setTxtFirstPartLines] = useState('500')
  const [txtMergeName, setTxtMergeName] = useState('merged.txt')
  const [vcfContactsPerFile, setVcfContactsPerFile] = useState('100')
  const [vcfSplitStartNumber, setVcfSplitStartNumber] = useState('1')
  const [roughSourceMode, setRoughSourceMode] = useState<'txt' | 'vcf'>('txt')
  const [roughIncludeMainVcf, setRoughIncludeMainVcf] = useState(true)
  const [roughRenameSplitContacts, setRoughRenameSplitContacts] = useState(true)
  const [roughContinuousNumbering, setRoughContinuousNumbering] = useState(false)
  const [roughComposeAfterSplit, setRoughComposeAfterSplit] = useState(false)
  const [roughMergeSourceFileName, setRoughMergeSourceFileName] = useState('')
  const [vcfToTxtMode, setVcfToTxtMode] = useState<'merged' | 'separate'>('merged')
  const [vcfToTxtMergedName, setVcfToTxtMergedName] = useState('merged.txt')
  const [mergeSourceFileName, setMergeSourceFileName] = useState('')
  const [adminBaseFileName, setAdminBaseFileName] = useState('')
  const [adminCustomPrefix, setAdminCustomPrefix] = useState('')
  const [pastedNumbers, setPastedNumbers] = useState('')
  const [pastedVcfFileName, setPastedVcfFileName] = useState('pasted.vcf')
  const [renameAfterCreate, setRenameAfterCreate] = useState(false)
  const [renameMode, setRenameMode] = useState<'single' | 'split' | 'admin-navy'>('single')
  const [renameCount, setRenameCount] = useState('10')
  const [renameBaseName, setRenameBaseName] = useState('ADMIN')
  const [renameFirstGroupCount, setRenameFirstGroupCount] = useState('5')
  const [renameFirstGroupName, setRenameFirstGroupName] = useState('ADMIN')
  const [renameSecondGroupName, setRenameSecondGroupName] = useState('NAVY')
  const [renameAdminCount, setRenameAdminCount] = useState('5')
  const [renameNavyCount, setRenameNavyCount] = useState('5')
  const [cutterRemovalList, setCutterRemovalList] = useState('')
  const [plusSafeMode, setPlusSafeMode] = useState(true)
  const [excelMinimumValues, setExcelMinimumValues] = useState('50')
  const [outputFiles, setOutputFiles] = useState<GeneratedFile[]>([])
  const [workspaceVcfSources, setWorkspaceVcfSources] = useState<TextInputFile[]>([])
  const [txtFileTexts, setTxtFileTexts] = useState<Record<string, string>>({})
  const [activeTxtEditorKey, setActiveTxtEditorKey] = useState('')
  const [selectedTextCount, setSelectedTextCount] = useState(0)
  const [expandedToolId, setExpandedToolId] = useState<ToolId | null>(null)
  const [previewFileName, setPreviewFileName] = useState('')
  const [jobLines, setJobLines] = useState<string[]>(logLines)
  const [isProcessing, setIsProcessing] = useState(false)
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const txtFiles = selectedFiles.filter((file) => file.name.toLowerCase().endsWith('.txt'))
  const vcfFiles = selectedFiles.filter((file) => file.name.toLowerCase().endsWith('.vcf'))
  const excelFiles = selectedFiles.filter((file) => {
    const lower = file.name.toLowerCase()
    return lower.endsWith('.xlsx') || lower.endsWith('.xls')
  })
  const composerSourceOptions = buildComposerSourceOptions(vcfFiles, workspaceVcfSources)
  const totalSize = selectedFiles.reduce((sum, file) => sum + file.size, 0)
  const totalItems = outputFiles.reduce((sum, file) => sum + file.itemCount, 0)
  const totalSkipped = outputFiles.reduce((sum, file) => sum + (file.skippedCount ?? 0), 0)
  const workspaceVcfCount = workspaceVcfSources.length
  const editableTxtFiles = txtFiles.map((file) => ({
    file,
    key: getFileKey(file),
    text: txtFileTexts[getFileKey(file)] ?? '',
  }))
  const activeTxtFile = editableTxtFiles.find((item) => item.key === activeTxtEditorKey) ?? editableTxtFiles[0]
  const txtLineStats = editableTxtFiles.map((item) => ({
    key: item.key,
    fileName: item.file.name,
    count: countTextNumbers(item.text),
  }))
  const totalTxtNumbers = txtLineStats.reduce((sum, item) => sum + item.count, 0)
  const previewFile = outputFiles.find((file) => file.fileName === previewFileName) ?? outputFiles[0]
  const rajOptions = {
    fileNaming: buildRajFileNaming({
      mode: vcfNamingMode,
      baseName: vcfBaseName,
      startNumber: vcfStartNumber,
      namesByFileName: manualVcfNames,
    }),
    contactNaming: buildRajContactNaming({
      mode: contactNamingMode,
      baseName: contactBaseName,
      fallbackBaseName: manualContactFallback,
      basesByFileName: manualContactBases,
      alphabeticLength,
      alphabeticRunIndex,
    }),
    filters: {
      phoneMode: phoneCleanMode,
      duplicatePolicy,
      includeReports,
    },
  }
  const rajPreviewFiles: TextInputFile[] = txtFiles.slice(0, 5).map((file) => ({
    fileName: file.name,
    text: '9876543210',
  }))
  const rajPreview = rajPreviewFiles.length ? convertTxtFilesToRajVcf(rajPreviewFiles, rajOptions) : []
  const activeToolDefinition = tools.find((tool) => tool.id === activeTool) ?? tools[0]

  async function addFiles(fileList: FileList | null) {
    if (!fileList) return

    const incoming = Array.from(fileList)
    const incomingTxtFiles = incoming.filter((file) => file.name.toLowerCase().endsWith('.txt'))
    setSelectedFiles((current) => {
      const existingKeys = new Set(current.map(getFileKey))
      const uniqueIncoming = incoming.filter((file) => !existingKeys.has(getFileKey(file)))
      return [...current, ...uniqueIncoming]
    })

    if (incomingTxtFiles.length > 0) {
      const loadedTextEntries = await Promise.all(
        incomingTxtFiles.map(async (file) => [getFileKey(file), await file.text()] as const),
      )
      setTxtFileTexts((current) => ({
        ...current,
        ...Object.fromEntries(loadedTextEntries),
      }))
      setActiveTxtEditorKey((current) => current || loadedTextEntries[0]?.[0] || '')
    }

    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  function removeFile(file: File) {
    const removedKey = getFileKey(file)
    setSelectedFiles((current) => current.filter((item) => getFileKey(item) !== removedKey))
    setTxtFileTexts((current) => {
      const next = { ...current }
      delete next[removedKey]
      return next
    })
    if (activeTxtEditorKey === removedKey) {
      setActiveTxtEditorKey('')
      setSelectedTextCount(0)
    }
  }

  function clearFiles() {
    setSelectedFiles([])
    setOutputFiles([])
    setTxtFileTexts({})
    setActiveTxtEditorKey('')
    setSelectedTextCount(0)
    setPreviewFileName('')
    setJobLines(logLines)
  }

  function removeWorkspaceVcfSource(fileName: string) {
    setWorkspaceVcfSources((current) => current.filter((file) => file.fileName !== fileName))
  }

  function updateActiveTxtFileText(transform: (text: string) => string) {
    if (!activeTxtFile) return
    setTxtFileTexts((current) => ({
      ...current,
      [activeTxtFile.key]: transform(activeTxtFile.text),
    }))
    setSelectedTextCount(0)
  }

  function downloadActiveTxtFile() {
    if (!activeTxtFile) return
    downloadBlob(
      new Blob([ensureFinalNewline(activeTxtFile.text)], { type: 'text/plain;charset=utf-8' }),
      activeTxtFile.file.name,
    )
  }

  async function generateCurrentTool() {
    setIsProcessing(true)
    const nextLogs = [`Starting ${getToolTitle(activeTool)}.`]

    try {
      const textTxtFiles = await readEditableTxtFiles(txtFiles, txtFileTexts, nextLogs)
      const textVcfFiles = await readBrowserFiles(vcfFiles, nextLogs)
      const composerSources = buildComposerTextSources(textVcfFiles, workspaceVcfSources)
      let nextOutputs: GeneratedFile[] = []

      if (activeTool === 'raj') {
        if (textTxtFiles.length === 0) throw new Error('No TXT files selected.')
        nextOutputs = convertTxtFilesToRajVcfJob(textTxtFiles, rajOptions)
        if (renameAfterCreate) {
          nextOutputs = renameGeneratedVcfOutputs(nextOutputs, buildRenameStartingOptions({
            mode: renameMode,
            renameCount,
            renameBaseName,
            firstGroupCount: renameFirstGroupCount,
            firstGroupName: renameFirstGroupName,
            secondGroupName: renameSecondGroupName,
            adminCount: renameAdminCount,
            navyCount: renameNavyCount,
          }))
          nextLogs.push('Applied post-generation contact rename to generated VCF files.')
        }
      }

      if (activeTool === 'txt-split') {
        if (textTxtFiles.length === 0) throw new Error('No TXT files selected.')
        nextOutputs = splitTxtFiles(textTxtFiles, buildTxtSplitOptions(txtSplitMode, txtLinesPerFile, txtFirstPartLines))
      }

      if (activeTool === 'txt-merge') {
        if (textTxtFiles.length === 0) throw new Error('No TXT files selected.')
        nextOutputs = [mergeTxtFiles(textTxtFiles, txtMergeName)]
      }

      if (activeTool === 'text-editor') {
        if (textTxtFiles.length === 0) throw new Error('No TXT files selected.')
        nextOutputs = textTxtFiles.map((file) => ({
          fileName: `edited/${file.fileName}`,
          content: ensureFinalNewline(file.text),
          kind: 'txt' as const,
          itemCount: countTextNumbers(file.text),
        }))
        nextLogs.push('Exported the current edited TXT content.')
      }

      if (activeTool === 'txt-cleaner') {
        if (textTxtFiles.length === 0) throw new Error('No TXT files selected.')
        nextOutputs = cleanTxtFilesLikeCutter(textTxtFiles, {
          removalListText: cutterRemovalList,
        })
      }

      if (activeTool === 'dedupe') {
        if (textTxtFiles.length === 0) throw new Error('No TXT files selected.')
        nextOutputs = removeDuplicateTxtNumbers(textTxtFiles)
      }

      if (activeTool === 'plus-prefix') {
        if (textTxtFiles.length === 0) throw new Error('No TXT files selected.')
        nextOutputs = addPlusPrefixToTxtFiles(textTxtFiles, plusSafeMode)
      }

      if (activeTool === 'excel-extract') {
        if (excelFiles.length === 0) throw new Error('No Excel files selected.')
        nextOutputs = await extractExcelFiles(
          excelFiles,
          parseInteger(excelMinimumValues, 50),
          nextLogs,
        )
      }

      if (activeTool === 'paste-vcf') {
        if (!pastedNumbers.trim()) throw new Error('Paste phone numbers first.')
        nextOutputs = convertTxtFilesToRajVcfJob(
          [{ fileName: pastedVcfFileName.replace(/\.vcf$/i, '.txt'), text: pastedNumbers }],
          {
            ...rajOptions,
            fileNaming: { mode: 'manual', namesByFileName: { [pastedVcfFileName.replace(/\.vcf$/i, '.txt')]: pastedVcfFileName } },
          },
        )
        if (renameAfterCreate) {
          nextOutputs = renameGeneratedVcfOutputs(nextOutputs, buildRenameStartingOptions({
            mode: renameMode,
            renameCount,
            renameBaseName,
            firstGroupCount: renameFirstGroupCount,
            firstGroupName: renameFirstGroupName,
            secondGroupName: renameSecondGroupName,
            adminCount: renameAdminCount,
            navyCount: renameNavyCount,
          }))
          nextLogs.push('Applied post-generation contact rename to generated VCF files.')
        }
      }

      if (activeTool === 'vcf-split') {
        const splitOptions = {
          contactsPerFile: parseInteger(vcfContactsPerFile, 100),
          startNumber: parseInteger(vcfSplitStartNumber, 1),
          renameContacts: roughRenameSplitContacts,
          continuousNumbering: roughContinuousNumbering,
          continuousBaseName: contactBaseName.trim() || 'CONTACT',
          fixedBaseMode: contactNamingMode === 'fixed',
        }

        if (roughSourceMode === 'txt') {
          if (textTxtFiles.length === 0) throw new Error('Upload TXT files for the ROUGH pipeline.')
          const createdOutputs = convertTxtFilesToRajVcfJob(textTxtFiles, rajOptions)
          const createdVcfOutputs = createdOutputs.filter((file) => file.kind === 'vcf')
          const reportOutputs = createdOutputs.filter((file) => file.kind === 'txt')
          const splitOutputs = splitVcfFilesRough(
            createdVcfOutputs.map((file) => ({
              fileName: file.fileName,
              text: file.content,
            })),
            splitOptions,
          )
          const composedSplitOutputs = roughComposeAfterSplit
            ? composeSplitOutputsWithSource(splitOutputs, composerSources, roughMergeSourceFileName)
            : splitOutputs

          nextOutputs = [
            ...(roughIncludeMainVcf ? createdVcfOutputs : []),
            ...composedSplitOutputs,
            ...reportOutputs,
          ]
        } else {
          const mergeSource = composerSources.find((file) => file.key === roughMergeSourceFileName)
          const filesToSplit =
            roughComposeAfterSplit && mergeSource?.origin === 'uploaded'
              ? textVcfFiles.filter((file) => file.fileName !== mergeSource.fileName)
              : textVcfFiles
          if (filesToSplit.length === 0) throw new Error('No VCF files selected for splitting.')
          const splitOutputs = splitVcfFilesRough(filesToSplit, splitOptions)
          nextOutputs = roughComposeAfterSplit
            ? composeSplitOutputsWithSource(splitOutputs, composerSources, roughMergeSourceFileName)
            : splitOutputs
        }
      }

      if (activeTool === 'vcf-to-txt') {
        if (textVcfFiles.length === 0) throw new Error('No VCF files selected.')
        nextOutputs = convertVcfFilesToTxt(textVcfFiles, vcfToTxtMode, vcfToTxtMergedName)
      }

      if (activeTool === 'vcf-merge') {
        if (textVcfFiles.length < 2) throw new Error('Select at least two VCF files.')
        const source = textVcfFiles.find((file) => file.fileName === mergeSourceFileName) ?? textVcfFiles[0]
        const targets = textVcfFiles.filter((file) => file.fileName !== source.fileName)
        nextOutputs = prependVcfContacts(targets, source)
      }

      if (activeTool === 'admin-navy') {
        if (textVcfFiles.length < 2) throw new Error('Select a base ADMIN/NAVY VCF and target VCF files.')
        const base = textVcfFiles.find((file) => file.fileName === adminBaseFileName) ?? textVcfFiles[0]
        const targets = textVcfFiles.filter((file) => file.fileName !== base.fileName)
        nextOutputs = autoMergeAdminNavy(targets, base, adminCustomPrefix)
      }

      if (activeTool === 'rename-start') {
        if (textVcfFiles.length === 0) throw new Error('No VCF files selected.')
        nextOutputs = renameStartingContactsInVcfFiles(textVcfFiles, buildRenameStartingOptions({
          mode: renameMode,
          renameCount,
          renameBaseName,
          firstGroupCount: renameFirstGroupCount,
          firstGroupName: renameFirstGroupName,
          secondGroupName: renameSecondGroupName,
          adminCount: renameAdminCount,
          navyCount: renameNavyCount,
        }))
      }

      for (const output of nextOutputs) {
        const skipped = output.skippedCount ? `, ${output.skippedCount} skipped` : ''
        nextLogs.push(`Created: ${output.fileName} (${output.itemCount} ${output.kind.toUpperCase()} item(s)${skipped})`)
      }

      nextLogs.push(`Done: ${nextOutputs.length} output file(s), ${nextOutputs.reduce((sum, file) => sum + file.itemCount, 0)} total item(s).`)
      setOutputFiles(nextOutputs)
      setPreviewFileName(nextOutputs[0]?.fileName ?? '')
      const shouldSaveWorkspaceSources =
        activeTool === 'raj' || activeTool === 'paste-vcf' || activeTool === 'admin-navy'
      const nextWorkspaceSources = shouldSaveWorkspaceSources
        ? generatedFilesToVcfSources(nextOutputs)
        : []
      if (nextWorkspaceSources.length > 0) {
        setWorkspaceVcfSources((current) => mergeWorkspaceVcfSources(current, nextWorkspaceSources))
        nextLogs.push(`Saved ${nextWorkspaceSources.length} generated VCF source(s) for composer use.`)
      }
      setJobLines(nextLogs)
    } catch (error) {
      setOutputFiles([])
      setPreviewFileName('')
      setJobLines([
        ...nextLogs,
        error instanceof Error ? `Error: ${error.message}` : 'Error: conversion failed.',
      ])
    } finally {
      setIsProcessing(false)
    }
  }

  async function downloadZip() {
    if (outputFiles.length === 0) {
      setJobLines(['No generated output yet. Run the selected tool first.'])
      return
    }

    const zip = new JSZip()
    for (const file of outputFiles) {
      zip.file(file.fileName, file.content)
    }

    const blob = await zip.generateAsync({ type: 'blob' })
    downloadBlob(blob, `legit-solutions-output-${formatDateForFileName(new Date())}.zip`)
  }

  return (
    <main className="app-shell min-h-screen text-slate-950">
      <section className="surface-grid border-b border-slate-200 bg-white/90 sm:backdrop-blur">
        <div className="h-1 bg-gradient-to-r from-teal-600 via-sky-500 to-amber-500" />
        <div className="mobile-safe-x mx-auto flex w-full max-w-[96rem] flex-col gap-5 py-4 sm:py-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-start gap-4">
              <div className="hidden h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-teal-200 bg-teal-700 text-white shadow-lg shadow-teal-900/10 sm:flex">
                <Zap className="h-7 w-7" />
              </div>
              <div>
                <div className="flex flex-wrap items-center gap-2 text-sm font-medium text-teal-700">
                  <span className="inline-flex items-center gap-2 rounded-full border border-teal-200 bg-white px-3 py-1">
                    <Smartphone className="h-4 w-4" />
                    Private contact workstation
                  </span>
                  <span className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-amber-800">
                    Active: {activeToolDefinition.title}
                  </span>
                </div>
                <h1 className="mt-3 text-2xl font-semibold tracking-normal text-slate-950 sm:text-4xl">
                  Legit solutions
                </h1>
                <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
                  A private batch desk for TXT and VCF processing with local previews, logs, reports,
                  and ZIP export.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="mobile-safe-x mx-auto grid w-full max-w-[96rem] gap-4 py-4 lg:grid-cols-[0.75fr_1.35fr] xl:grid-cols-[0.7fr_1.5fr]">
        <div className="space-y-4">
          <Panel title="Workflow" icon={<ClipboardList className="h-5 w-5" />}>
            <div className="grid grid-cols-2 gap-2 md:grid-cols-4 md:gap-3">
              <WorkflowStep icon={<FileInput />} title="1. Add files" text="TXT, VCF, or paste numbers." />
              <WorkflowStep icon={<ListChecks />} title="2. Configure" text="Naming, split size, merge mode." />
              <WorkflowStep icon={<Files />} title="3. Preview" text="Counts, skipped lines, output names." />
              <WorkflowStep icon={<FileArchive />} title="4. Export" text="Download ZIP or selected files." />
            </div>
          </Panel>

          <Panel title="Conversion Workbench" icon={<GitMerge className="h-5 w-5" />}>
            <div className="grid gap-3 md:grid-cols-2">
              {tools.map((tool) => {
                const isExpanded = expandedToolId === tool.id
                return (
                  <div
                    key={tool.title}
                    role="button"
                    tabIndex={0}
                    className={getToolButtonClassName(tool, activeTool)}
                    onClick={() => {
                      setActiveTool(tool.id)
                      setOutputFiles([])
                      setPreviewFileName('')
                      setJobLines([`Selected tool: ${tool.title}`])
                    }}
                    onKeyDown={(event) => {
                      if (event.key !== 'Enter' && event.key !== ' ') return
                      event.preventDefault()
                      setActiveTool(tool.id)
                      setOutputFiles([])
                      setPreviewFileName('')
                      setJobLines([`Selected tool: ${tool.title}`])
                    }}
                  >
                    <div className={getToolAccentClassName(tool.status)} />
                    <div className="flex items-start justify-between gap-3">
                      <h2 className="text-sm font-semibold text-slate-950">{tool.title}</h2>
                      <span className={getStatusClassName(tool.status)}>
                        {tool.status}
                      </span>
                    </div>
                    <p className="mt-1.5 text-xs leading-5 text-slate-600">{tool.description}</p>
                    <div className="mt-3 flex items-center justify-between gap-3">
                      <button
                        type="button"
                    className="rounded-full border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-700 transition hover:border-teal-200 hover:bg-teal-50 hover:text-teal-800"
                        onClick={(event) => {
                          event.stopPropagation()
                          setExpandedToolId(isExpanded ? null : tool.id)
                        }}
                      >
                        {isExpanded ? 'Hide details' : 'Read more'}
                      </button>
                    </div>
                    {isExpanded && (
                      <p className="mt-3 rounded-lg border border-slate-200 bg-slate-50/80 px-3 py-2 text-xs leading-5 text-slate-600">
                        {tool.details}
                      </p>
                    )}
                  </div>
                )
              })}
            </div>
          </Panel>
        </div>

        <aside className="space-y-4">
          <Panel title="Batch Preview" icon={<FileOutput className="h-5 w-5" />}>
            <div className="grid grid-cols-2 gap-3">
              <Metric label="Input files" value={String(selectedFiles.length)} />
              <Metric label="Generated" value={String(outputFiles.length)} />
              <Metric label="Output items" value={String(totalItems)} />
              <Metric label="Skipped" value={String(totalSkipped)} />
              <Metric label="TXT numbers" value={String(totalTxtNumbers)} />
              <Metric label="Saved VCF sources" value={String(workspaceVcfCount)} />
            </div>

            <div
              className="mt-4 rounded-2xl border border-dashed border-slate-300 bg-gradient-to-br from-white via-teal-50/40 to-amber-50/40 p-4 text-sm text-slate-600 transition hover:border-teal-300 hover:shadow-md hover:shadow-teal-900/5"
              onDragOver={(event) => event.preventDefault()}
              onDrop={(event) => {
                event.preventDefault()
                void addFiles(event.dataTransfer.files)
              }}
            >
              <input
                ref={fileInputRef}
                className="hidden"
                type="file"
                multiple
                accept=".txt,.vcf,.xlsx,.xls,text/plain,text/vcard,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                onChange={(event) => void addFiles(event.target.files)}
              />
              <div className="flex flex-col gap-3">
                <div className="flex items-start gap-3">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-teal-200 bg-white text-teal-700 shadow-sm">
                    <Upload className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="flex flex-wrap items-center gap-2 font-semibold text-slate-950">
                      Upload TXT / VCF files
                      <span className="rounded-full bg-white px-2 py-0.5 text-xs font-medium text-teal-700 ring-1 ring-teal-200">
                        Local only
                      </span>
                    </div>
                    <p className="mt-1 leading-6">
                      Choose files from your PC or drag them here. The app reads them locally in the
                      browser.
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    className="w-full rounded-md bg-teal-700 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-teal-800 active:scale-[0.98] sm:w-auto"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    Choose files
                  </button>
                  {selectedFiles.length > 0 && (
                    <button
                      type="button"
                      className="w-full rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 active:scale-[0.98] sm:w-auto"
                      onClick={clearFiles}
                    >
                      Clear all
                    </button>
                  )}
                </div>
              </div>
            </div>

            {selectedFiles.length > 0 && (
              <div className="mt-4">
                <div className="mb-2 flex items-center justify-between gap-3 text-sm">
                  <span className="font-semibold text-slate-950">Selected files</span>
                  <span className="text-slate-500">{formatBytes(totalSize)}</span>
                </div>
                <div className="max-h-72 overflow-auto rounded-xl border border-slate-200 bg-white shadow-sm">
                  {selectedFiles.map((file) => (
                    <div
                      key={getFileKey(file)}
                      className="flex items-center justify-between gap-3 border-b border-slate-100 px-3 py-2.5 transition hover:bg-slate-50 last:border-b-0"
                    >
                      <div className="min-w-0">
                        <div className="truncate text-sm font-medium text-slate-950">{file.name}</div>
                        <div className="text-xs text-slate-500">
                          {detectFileKind(file.name)} - {formatBytes(file.size)}
                        </div>
                      </div>
                      <button
                        type="button"
                        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-slate-200 text-slate-500 transition hover:bg-slate-100 hover:text-slate-950"
                        onClick={() => removeFile(file)}
                        aria-label={`Remove ${file.name}`}
                        title={`Remove ${file.name}`}
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {workspaceVcfSources.length > 0 && (
              <div className="mt-4">
                <div className="mb-2 flex items-center justify-between gap-3 text-sm">
                  <span className="font-semibold text-slate-950">Saved VCF sources</span>
                  <button
                    type="button"
                    className="text-xs font-semibold text-slate-500 transition hover:text-slate-950"
                    onClick={() => setWorkspaceVcfSources([])}
                  >
                    Clear saved
                  </button>
                </div>
                <div className="max-h-40 overflow-auto rounded-xl border border-amber-200 bg-amber-50/60 shadow-sm">
                  {workspaceVcfSources.map((file) => (
                    <div
                      key={file.fileName}
                      className="flex items-center justify-between gap-3 border-b border-amber-100 px-3 py-2.5 last:border-b-0"
                    >
                      <div className="min-w-0">
                        <div className="truncate text-sm font-medium text-slate-950">{file.fileName}</div>
                        <div className="text-xs text-amber-800">Generated VCF source</div>
                      </div>
                      <button
                        type="button"
                        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-amber-200 text-amber-700 transition hover:bg-amber-100 hover:text-amber-950"
                        onClick={() => removeWorkspaceVcfSource(file.fileName)}
                        aria-label={`Remove saved VCF source ${file.fileName}`}
                        title={`Remove ${file.fileName}`}
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-md shadow-slate-900/5">
              <div className="mb-4 rounded-xl border border-slate-200 bg-slate-950 px-4 py-3 text-white">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-xs font-medium uppercase text-slate-300">Selected module</div>
                    <div className="mt-1 text-base font-semibold">{activeToolDefinition.title}</div>
                  </div>
                  <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-white ring-1 ring-white/15">
                    {activeToolDefinition.status}
                  </span>
                </div>
              </div>

              <div className="mb-3 flex items-center justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2 font-semibold text-slate-950">
                    <BadgeCheck className="h-4 w-4 text-teal-700" />
                    {getToolTitle(activeTool)}
                  </div>
                  <p className="mt-1 text-sm leading-6 text-slate-600">
                    {getToolDescription(activeTool)}
                  </p>
                </div>
              </div>

              {activeTool === 'raj' && (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700" htmlFor="vcf-naming">
                    VCF file naming
                  </label>
                  <select
                    id="vcf-naming"
                    className="mt-2 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm outline-none transition focus:border-teal-600 focus:ring-2 focus:ring-teal-100"
                    value={vcfNamingMode}
                    onChange={(event) => setVcfNamingMode(event.target.value as RajFileNaming['mode'])}
                  >
                    <option value="input-name">Use input TXT filename</option>
                    <option value="sequential">Base name + number</option>
                    <option value="manual">Manual name per file</option>
                  </select>
                </div>

                {vcfNamingMode === 'sequential' && (
                  <div className="grid gap-3 sm:grid-cols-[1fr_120px]">
                    <TextField
                      label="VCF base name"
                      value={vcfBaseName}
                      onChange={setVcfBaseName}
                      placeholder="VCF"
                    />
                    <TextField
                      label="Start number"
                      value={vcfStartNumber}
                      onChange={setVcfStartNumber}
                      placeholder="1"
                    />
                  </div>
                )}

                {vcfNamingMode === 'manual' && (
                  <PerFileFields
                    files={txtFiles}
                    label="Manual VCF names"
                    values={manualVcfNames}
                    onChange={setManualVcfNames}
                    placeholder={(file) => `${removeClientExtension(file.name)}.vcf`}
                  />
                )}

                <div>
                  <label className="block text-sm font-medium text-slate-700" htmlFor="contact-naming">
                    Contact naming
                  </label>
                  <select
                    id="contact-naming"
                    className="mt-2 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm outline-none transition focus:border-teal-600 focus:ring-2 focus:ring-teal-100"
                    value={contactNamingMode}
                    onChange={(event) =>
                      setContactNamingMode(event.target.value as RajContactNaming['mode'])
                    }
                  >
                    <option value="sequential">Base + same file number + counter</option>
                    <option value="fixed">Fixed base + counter</option>
                    <option value="manual-per-file">Manual base per file</option>
                    <option value="alphabetic">Alphabetic base + counter</option>
                  </select>
                </div>

                {(contactNamingMode === 'fixed' || contactNamingMode === 'sequential') && (
                  <TextField
                    label={
                      contactNamingMode === 'fixed'
                        ? 'Contact base name'
                        : 'Contact base name, linked to VCF number'
                    }
                    value={contactBaseName}
                    onChange={setContactBaseName}
                    placeholder={contactNamingMode === 'sequential' ? 'TES' : 'CONTACT'}
                  />
                )}

                {contactNamingMode === 'manual-per-file' && (
                  <>
                    <TextField
                      label="Fallback contact base"
                      value={manualContactFallback}
                      onChange={setManualContactFallback}
                      placeholder="CONTACT"
                    />
                    <PerFileFields
                      files={txtFiles}
                      label="Manual contact bases"
                      values={manualContactBases}
                      onChange={setManualContactBases}
                      placeholder={(file) => removeClientExtension(file.name)}
                    />
                  </>
                )}

                {contactNamingMode === 'alphabetic' && (
                  <div className="grid gap-3 sm:grid-cols-2">
                    <TextField
                      label="Alphabet length"
                      value={alphabeticLength}
                      onChange={setAlphabeticLength}
                      placeholder="2"
                    />
                    <TextField
                      label="Run index"
                      value={alphabeticRunIndex}
                      onChange={setAlphabeticRunIndex}
                      placeholder="0"
                    />
                  </div>
                )}

                <PowerFilters
                  idPrefix="raj"
                  phoneCleanMode={phoneCleanMode}
                  onPhoneCleanModeChange={setPhoneCleanMode}
                  duplicatePolicy={duplicatePolicy}
                  onDuplicatePolicyChange={setDuplicatePolicy}
                  includeReports={includeReports}
                  onIncludeReportsChange={setIncludeReports}
                />

                <PostGenerationRenameControls
                  enabled={renameAfterCreate}
                  onEnabledChange={setRenameAfterCreate}
                  renameMode={renameMode}
                  onRenameModeChange={setRenameMode}
                  renameCount={renameCount}
                  onRenameCountChange={setRenameCount}
                  renameBaseName={renameBaseName}
                  onRenameBaseNameChange={setRenameBaseName}
                  firstGroupCount={renameFirstGroupCount}
                  onFirstGroupCountChange={setRenameFirstGroupCount}
                  firstGroupName={renameFirstGroupName}
                  onFirstGroupNameChange={setRenameFirstGroupName}
                  secondGroupName={renameSecondGroupName}
                  onSecondGroupNameChange={setRenameSecondGroupName}
                  adminCount={renameAdminCount}
                  onAdminCountChange={setRenameAdminCount}
                  navyCount={renameNavyCount}
                  onNavyCountChange={setRenameNavyCount}
                />

                {rajPreview.length > 0 && (
                  <div className="rounded-md border border-teal-200 bg-teal-50 p-3">
                    <div className="text-sm font-semibold text-teal-950">Naming preview</div>
                    <div className="mt-2 space-y-1 font-mono text-xs text-teal-900">
                      {rajPreview.map((file) => (
                        <div key={file.fileName} className="truncate">
                          {file.fileName} {'->'}{' '}
                          {extractFirstContactName(file.content) || 'No valid contacts'}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              )}

              {activeTool === 'txt-split' && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700" htmlFor="txt-split-mode">
                      TXT split mode
                    </label>
                    <select
                      id="txt-split-mode"
                      className="mt-2 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm outline-none transition focus:border-teal-600 focus:ring-2 focus:ring-teal-100"
                      value={txtSplitMode}
                      onChange={(event) => setTxtSplitMode(event.target.value as TxtSplitOptions['mode'])}
                    >
                      <option value="fixed">Fixed number of lines per file</option>
                      <option value="half">Exact half split</option>
                      <option value="custom-first">Custom first-part size</option>
                    </select>
                  </div>
                  {txtSplitMode === 'fixed' && (
                    <TextField label="Lines per file" value={txtLinesPerFile} onChange={setTxtLinesPerFile} placeholder="100" />
                  )}
                  {txtSplitMode === 'custom-first' && (
                    <TextField label="First part lines" value={txtFirstPartLines} onChange={setTxtFirstPartLines} placeholder="500" />
                  )}
                </div>
              )}

              {activeTool === 'text-editor' && (
                <div className="space-y-4">
                  {editableTxtFiles.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-teal-300 bg-teal-50/70 px-4 py-5 text-sm leading-6 text-teal-950">
                      Upload one or more TXT files, then this editor becomes a full local workspace.
                    </div>
                  ) : (
                    <>
                      <div className="grid grid-cols-3 gap-2 sm:gap-3">
                        <Metric label="TXT files" value={String(editableTxtFiles.length)} />
                        <Metric label="Total numbers" value={String(totalTxtNumbers)} />
                        <Metric label="Selected lines" value={String(selectedTextCount)} />
                      </div>

                      <div className="grid gap-3 xl:grid-cols-[17rem_minmax(0,1fr)]">
                        <div className="space-y-3">
                          <div className="rounded-xl border border-slate-200 bg-white p-2 shadow-sm">
                            <div className="mb-2 px-2 text-xs font-semibold uppercase text-slate-500">
                              TXT files
                            </div>
                            <div className="max-h-72 space-y-2 overflow-auto pr-1">
                              {txtLineStats.map((item) => (
                                <button
                                  key={item.key}
                                  type="button"
                                  className={[
                                    'w-full rounded-lg border px-3 py-2 text-left text-xs transition',
                                    activeTxtFile?.key === item.key
                                      ? 'border-teal-300 bg-teal-50 text-teal-950 shadow-sm'
                                      : 'border-slate-200 bg-white text-slate-600 hover:border-teal-200 hover:bg-slate-50',
                                  ].join(' ')}
                                  onClick={() => {
                                    setActiveTxtEditorKey(item.key)
                                    setSelectedTextCount(0)
                                  }}
                                >
                                  <span className="block truncate font-semibold">{item.fileName}</span>
                                  <span className="mt-1 block text-teal-700">{item.count} number(s)</span>
                                </button>
                              ))}
                            </div>
                          </div>

                          <div className="rounded-xl border border-teal-200 bg-gradient-to-br from-teal-50 to-white p-3">
                            <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-teal-950">
                              <Edit3 className="h-4 w-4 text-teal-700" />
                              Quick actions
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                              <EditorActionButton label="Trim blanks" onClick={() => updateActiveTxtFileText(cleanEditorBlankLines)} />
                              <EditorActionButton label="Sort" onClick={() => updateActiveTxtFileText(sortEditorLines)} />
                              <EditorActionButton label="Unique" onClick={() => updateActiveTxtFileText(uniqueEditorLines)} />
                              <EditorActionButton label="Digits only" onClick={() => updateActiveTxtFileText(digitsOnlyEditorLines)} />
                              <EditorActionButton label="Add +" onClick={() => updateActiveTxtFileText(addPlusEditorLines)} />
                              <EditorActionButton label="Remove +" onClick={() => updateActiveTxtFileText(removePlusEditorLines)} />
                            </div>
                            <button
                              type="button"
                              className="mt-3 w-full rounded-md bg-teal-700 px-3 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-teal-800 active:scale-[0.98]"
                              onClick={downloadActiveTxtFile}
                            >
                              Download active TXT
                            </button>
                          </div>
                        </div>

                        <div className="rounded-2xl border border-slate-200 bg-slate-950 p-3 shadow-inner">
                          <div className="mb-3 flex flex-wrap items-center justify-between gap-2 text-white">
                            <div className="min-w-0">
                              <div className="truncate text-sm font-semibold">
                                {activeTxtFile?.file.name ?? 'No TXT selected'}
                              </div>
                              <div className="mt-1 text-xs text-slate-400">
                                Edit here, then run any TXT-based converter. Your edits are used automatically.
                              </div>
                            </div>
                            <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-semibold ring-1 ring-white/15">
                              {activeTxtFile ? countTextNumbers(activeTxtFile.text) : 0} lines
                            </span>
                          </div>
                          {activeTxtFile && (
                            <textarea
                              className="min-h-[62svh] w-full resize-y rounded-xl border border-white/10 bg-black/30 px-4 py-4 font-mono text-sm leading-6 text-slate-100 outline-none shadow-inner transition placeholder:text-slate-500 focus:border-teal-300 focus:ring-4 focus:ring-teal-300/10 sm:min-h-[40rem]"
                              value={activeTxtFile.text}
                              spellCheck={false}
                              onChange={(event) => {
                                setTxtFileTexts((current) => ({
                                  ...current,
                                  [activeTxtFile.key]: event.target.value,
                                }))
                              }}
                              onSelect={(event) => setSelectedTextCount(countSelectedText(event.currentTarget))}
                              placeholder="Edit TXT numbers here..."
                            />
                          )}
                        </div>
                      </div>
                    </>
                  )}
                </div>
              )}

              {activeTool === 'txt-merge' && (
                <TextField label="Merged TXT filename" value={txtMergeName} onChange={setTxtMergeName} placeholder="merged.txt" />
              )}

              {activeTool === 'txt-cleaner' && (
                <div className="space-y-4">
                  <label className="block text-sm font-medium text-slate-700">
                    Removal list
                    <textarea
                      className="mt-2 min-h-32 w-full rounded-md border border-slate-300 bg-white px-3 py-2 font-mono text-sm font-normal text-slate-950 outline-none transition focus:border-teal-600 focus:ring-2 focus:ring-teal-100"
                      value={cutterRemovalList}
                      onChange={(event) => setCutterRemovalList(event.target.value)}
                      placeholder={'Numbers to remove, one per line or comma separated'}
                    />
                  </label>
                  <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm leading-6 text-slate-600">
                    Keeps digits and one leading +, removes short index junk under 7 digits, and exports a cleaner summary report.
                  </div>
                </div>
              )}

              {activeTool === 'dedupe' && (
                <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm leading-6 text-slate-600">
                  Cleans every line to digits only, keeps the first occurrence across all selected TXT files, and exports duplicate reports.
                </div>
              )}

              {activeTool === 'plus-prefix' && (
                <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-slate-300 text-teal-700 focus:ring-teal-200"
                    checked={plusSafeMode}
                    onChange={(event) => setPlusSafeMode(event.target.checked)}
                  />
                  Safe mode: do not add another + when a line already starts with +
                </label>
              )}

              {activeTool === 'excel-extract' && (
                <div className="space-y-4">
                  <div className="flex items-center gap-2 rounded-md border border-sky-200 bg-sky-50 px-3 py-2 text-sm font-semibold text-sky-950">
                    <Table2 className="h-4 w-4 text-sky-700" />
                    Excel sheets become organized CSV, TSV, column TXT, and phone TXT exports
                  </div>
                  <TextField
                    label="Phone-column threshold"
                    value={excelMinimumValues}
                    onChange={setExcelMinimumValues}
                    placeholder="50"
                  />
                  <div className="rounded-md border border-sky-200 bg-sky-50 px-3 py-2 text-sm leading-6 text-sky-950">
                    Upload .xlsx files. Every sheet is preserved as a table export, every non-empty column becomes TXT, and phone-heavy columns get separate phone-only TXT files. Old .xls files should be saved as .xlsx first for private browser processing.
                  </div>
                </div>
              )}

              {activeTool === 'paste-vcf' && (
                <div className="space-y-4">
                  <TextField label="VCF filename" value={pastedVcfFileName} onChange={setPastedVcfFileName} placeholder="pasted.vcf" />
                  <label className="block text-sm font-medium text-slate-700">
                    Phone numbers
                    <textarea
                      className="mt-2 min-h-40 w-full rounded-md border border-slate-300 bg-white px-3 py-2 font-mono text-sm font-normal text-slate-950 outline-none transition focus:border-teal-600 focus:ring-2 focus:ring-teal-100"
                      value={pastedNumbers}
                      onChange={(event) => setPastedNumbers(event.target.value)}
                      placeholder={'9876543210\n+91 98765-43210'}
                    />
                  </label>
                  <TextField label="Contact base name" value={contactBaseName} onChange={setContactBaseName} placeholder="TES" />
                  <PowerFilters
                    idPrefix="paste"
                    phoneCleanMode={phoneCleanMode}
                    onPhoneCleanModeChange={setPhoneCleanMode}
                    duplicatePolicy={duplicatePolicy}
                    onDuplicatePolicyChange={setDuplicatePolicy}
                    includeReports={includeReports}
                    onIncludeReportsChange={setIncludeReports}
                  />
                  <PostGenerationRenameControls
                    enabled={renameAfterCreate}
                    onEnabledChange={setRenameAfterCreate}
                    renameMode={renameMode}
                    onRenameModeChange={setRenameMode}
                    renameCount={renameCount}
                    onRenameCountChange={setRenameCount}
                    renameBaseName={renameBaseName}
                    onRenameBaseNameChange={setRenameBaseName}
                    firstGroupCount={renameFirstGroupCount}
                    onFirstGroupCountChange={setRenameFirstGroupCount}
                    firstGroupName={renameFirstGroupName}
                    onFirstGroupNameChange={setRenameFirstGroupName}
                    secondGroupName={renameSecondGroupName}
                    onSecondGroupNameChange={setRenameSecondGroupName}
                    adminCount={renameAdminCount}
                    onAdminCountChange={setRenameAdminCount}
                    navyCount={renameNavyCount}
                    onNavyCountChange={setRenameNavyCount}
                  />
                </div>
              )}

              {activeTool === 'vcf-split' && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700" htmlFor="rough-source-mode">
                      Pipeline source
                    </label>
                    <select
                      id="rough-source-mode"
                      className="mt-2 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm outline-none transition focus:border-teal-600 focus:ring-2 focus:ring-teal-100"
                      value={roughSourceMode}
                      onChange={(event) => setRoughSourceMode(event.target.value as 'txt' | 'vcf')}
                    >
                      <option value="txt">TXT files {'->'} create VCF {'->'} split {'->'} optional compose</option>
                      <option value="vcf">Existing VCF files {'->'} split {'->'} optional compose</option>
                    </select>
                  </div>

                  {roughSourceMode === 'txt' && (
                    <div className="space-y-4 rounded-xl border border-teal-200 bg-teal-50/50 p-3">
                      <div className="text-sm font-semibold text-teal-950">VCF creation naming</div>
                      <div>
                        <label className="block text-sm font-medium text-slate-700" htmlFor="rough-vcf-naming">
                          VCF file naming
                        </label>
                        <select
                          id="rough-vcf-naming"
                          className="mt-2 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm outline-none transition focus:border-teal-600 focus:ring-2 focus:ring-teal-100"
                          value={vcfNamingMode}
                          onChange={(event) => setVcfNamingMode(event.target.value as RajFileNaming['mode'])}
                        >
                          <option value="input-name">Use input TXT filename</option>
                          <option value="sequential">Base name + number</option>
                          <option value="manual">Manual name per file</option>
                        </select>
                      </div>

                      {vcfNamingMode === 'sequential' && (
                        <div className="grid gap-3 sm:grid-cols-[1fr_120px]">
                          <TextField label="VCF base name" value={vcfBaseName} onChange={setVcfBaseName} placeholder="VCF" />
                          <TextField label="Start number" value={vcfStartNumber} onChange={setVcfStartNumber} placeholder="1" />
                        </div>
                      )}

                      {vcfNamingMode === 'manual' && (
                        <PerFileFields
                          files={txtFiles}
                          label="Manual VCF names"
                          values={manualVcfNames}
                          onChange={setManualVcfNames}
                          placeholder={(file) => `${removeClientExtension(file.name)}.vcf`}
                        />
                      )}

                      <div>
                        <label className="block text-sm font-medium text-slate-700" htmlFor="rough-contact-naming">
                          Contact naming
                        </label>
                        <select
                          id="rough-contact-naming"
                          className="mt-2 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm outline-none transition focus:border-teal-600 focus:ring-2 focus:ring-teal-100"
                          value={contactNamingMode}
                          onChange={(event) =>
                            setContactNamingMode(event.target.value as RajContactNaming['mode'])
                          }
                        >
                          <option value="sequential">Base + same file number + counter</option>
                          <option value="fixed">Fixed base + counter</option>
                          <option value="manual-per-file">Manual base per file</option>
                          <option value="alphabetic">Alphabetic base + counter</option>
                        </select>
                      </div>

                      {(contactNamingMode === 'fixed' || contactNamingMode === 'sequential') && (
                        <TextField
                          label={
                            contactNamingMode === 'fixed'
                              ? 'Contact base name'
                              : 'Contact base name, linked to VCF number'
                          }
                          value={contactBaseName}
                          onChange={setContactBaseName}
                          placeholder={contactNamingMode === 'sequential' ? 'TES' : 'CONTACT'}
                        />
                      )}

                      {contactNamingMode === 'manual-per-file' && (
                        <>
                          <TextField label="Fallback contact base" value={manualContactFallback} onChange={setManualContactFallback} placeholder="CONTACT" />
                          <PerFileFields
                            files={txtFiles}
                            label="Manual contact bases"
                            values={manualContactBases}
                            onChange={setManualContactBases}
                            placeholder={(file) => removeClientExtension(file.name)}
                          />
                        </>
                      )}

                      {contactNamingMode === 'alphabetic' && (
                        <div className="grid gap-3 sm:grid-cols-2">
                          <TextField label="Alphabet length" value={alphabeticLength} onChange={setAlphabeticLength} placeholder="2" />
                          <TextField label="Run index" value={alphabeticRunIndex} onChange={setAlphabeticRunIndex} placeholder="0" />
                        </div>
                      )}

                      <PowerFilters
                        idPrefix="rough"
                        phoneCleanMode={phoneCleanMode}
                        onPhoneCleanModeChange={setPhoneCleanMode}
                        duplicatePolicy={duplicatePolicy}
                        onDuplicatePolicyChange={setDuplicatePolicy}
                        includeReports={includeReports}
                        onIncludeReportsChange={setIncludeReports}
                      />

                      <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
                        <input
                          type="checkbox"
                          className="h-4 w-4 rounded border-slate-300 text-teal-700 focus:ring-teal-200"
                          checked={roughIncludeMainVcf}
                          onChange={(event) => setRoughIncludeMainVcf(event.target.checked)}
                        />
                        Include the created main VCF files in the ZIP
                      </label>
                    </div>
                  )}

                  <div className="space-y-3 rounded-xl border border-sky-200 bg-sky-50/50 p-3">
                    <div className="text-sm font-semibold text-sky-950">Split settings</div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <TextField label="Contacts per VCF" value={vcfContactsPerFile} onChange={setVcfContactsPerFile} placeholder="100" />
                      <TextField label="Start part number" value={vcfSplitStartNumber} onChange={setVcfSplitStartNumber} placeholder="1" />
                    </div>
                    <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
                      <input
                        type="checkbox"
                        className="h-4 w-4 rounded border-slate-300 text-sky-700 focus:ring-sky-200"
                        checked={roughRenameSplitContacts}
                        onChange={(event) => setRoughRenameSplitContacts(event.target.checked)}
                      />
                      ROUGH-style rename contacts inside split VCF files
                    </label>
                    <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
                      <input
                        type="checkbox"
                        className="h-4 w-4 rounded border-slate-300 text-sky-700 focus:ring-sky-200"
                        checked={roughContinuousNumbering}
                        onChange={(event) => setRoughContinuousNumbering(event.target.checked)}
                      />
                      Global continuous contact numbering across split files
                    </label>
                  </div>

                  <div className="space-y-3 rounded-xl border border-amber-200 bg-amber-50/50 p-3">
                    <label className="flex items-center gap-2 text-sm font-semibold text-amber-950">
                      <input
                        type="checkbox"
                        className="h-4 w-4 rounded border-amber-300 text-amber-700 focus:ring-amber-200"
                        checked={roughComposeAfterSplit}
                        onChange={(event) => setRoughComposeAfterSplit(event.target.checked)}
                      />
                      Compose/prepend a VCF source into every split file
                    </label>
                    {roughComposeAfterSplit && (
                      <ComposerSourceSelect
                        label="Composer VCF source"
                        sources={composerSourceOptions}
                        value={roughMergeSourceFileName}
                        onChange={setRoughMergeSourceFileName}
                      />
                    )}
                  </div>
                </div>
              )}

              {activeTool === 'vcf-to-txt' && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700" htmlFor="vcf-to-txt-mode">
                      VCF to TXT mode
                    </label>
                    <select
                      id="vcf-to-txt-mode"
                      className="mt-2 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm outline-none transition focus:border-teal-600 focus:ring-2 focus:ring-teal-100"
                      value={vcfToTxtMode}
                      onChange={(event) => setVcfToTxtMode(event.target.value as 'merged' | 'separate')}
                    >
                      <option value="merged">Merge all numbers into one TXT</option>
                      <option value="separate">One TXT per VCF</option>
                    </select>
                  </div>
                  {vcfToTxtMode === 'merged' && (
                    <TextField label="Merged TXT filename" value={vcfToTxtMergedName} onChange={setVcfToTxtMergedName} placeholder="merged.txt" />
                  )}
                </div>
              )}

              {activeTool === 'vcf-merge' && (
                <SourceSelect
                  label="VCF source to prepend"
                  files={vcfFiles}
                  value={mergeSourceFileName}
                  onChange={setMergeSourceFileName}
                />
              )}

              {activeTool === 'admin-navy' && (
                <div className="space-y-4">
                  <SourceSelect
                    label="Base ADMIN/NAVY VCF"
                    files={vcfFiles}
                    value={adminBaseFileName}
                    onChange={setAdminBaseFileName}
                  />
                  <TextField label="Optional custom prefix" value={adminCustomPrefix} onChange={setAdminCustomPrefix} placeholder="A" />
                </div>
              )}

              {activeTool === 'rename-start' && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700" htmlFor="rename-mode">
                      Rename mode
                    </label>
                    <select
                      id="rename-mode"
                      className="mt-2 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm outline-none transition focus:border-teal-600 focus:ring-2 focus:ring-teal-100"
                      value={renameMode}
                      onChange={(event) => setRenameMode(event.target.value as 'single' | 'split' | 'admin-navy')}
                    >
                      <option value="single">Single base for first contacts</option>
                      <option value="split">Split first contacts into two groups</option>
                      <option value="admin-navy">ADMIN + NAVY group mode</option>
                    </select>
                  </div>
                  {renameMode === 'single' && (
                    <div className="grid gap-3 sm:grid-cols-2">
                      <TextField label="Rename count" value={renameCount} onChange={setRenameCount} placeholder="10" />
                      <TextField label="New base name" value={renameBaseName} onChange={setRenameBaseName} placeholder="ADMIN" />
                    </div>
                  )}
                  {renameMode === 'split' && (
                    <div className="grid gap-3 sm:grid-cols-2">
                      <TextField label="Total rename count" value={renameCount} onChange={setRenameCount} placeholder="10" />
                      <TextField label="First group count" value={renameFirstGroupCount} onChange={setRenameFirstGroupCount} placeholder="5" />
                      <TextField label="First group name" value={renameFirstGroupName} onChange={setRenameFirstGroupName} placeholder="ADMIN" />
                      <TextField label="Second group name" value={renameSecondGroupName} onChange={setRenameSecondGroupName} placeholder="NAVY" />
                    </div>
                  )}
                  {renameMode === 'admin-navy' && (
                    <div className="grid gap-3 sm:grid-cols-2">
                      <TextField label="ADMIN count" value={renameAdminCount} onChange={setRenameAdminCount} placeholder="5" />
                      <TextField label="NAVY count" value={renameNavyCount} onChange={setRenameNavyCount} placeholder="5" />
                    </div>
                  )}
                </div>
              )}

              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  type="button"
                  className="w-full rounded-md bg-teal-700 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-teal-800 active:scale-[0.98] disabled:cursor-not-allowed disabled:bg-slate-300 disabled:shadow-none disabled:active:scale-100 sm:w-auto"
                  onClick={generateCurrentTool}
                  disabled={isProcessing || (selectedFiles.length === 0 && activeTool !== 'paste-vcf')}
                >
                  {isProcessing ? 'Processing...' : getGenerateButtonLabel(activeTool)}
                </button>
                <button
                  type="button"
                  className="inline-flex w-full items-center justify-center gap-2 rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 active:scale-[0.98] disabled:cursor-not-allowed disabled:text-slate-400 disabled:active:scale-100 sm:w-auto"
                  onClick={downloadZip}
                  disabled={outputFiles.length === 0}
                >
                  <Download className="h-4 w-4" />
                  Download ZIP
                </button>
              </div>
            </div>

            {outputFiles.length > 0 && (
              <div className="mt-4">
                <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-950">
                  <Eye className="h-4 w-4 text-teal-700" />
                  Output inspector
                </div>
                <div className="max-h-80 overflow-auto rounded-xl border border-slate-200 bg-white shadow-sm">
                  {outputFiles.map((file) => (
                    <div
                      key={file.fileName}
                      className={[
                        'flex items-center justify-between gap-3 border-b px-3 py-2.5 transition last:border-b-0',
                        previewFile?.fileName === file.fileName
                          ? 'border-teal-100 bg-teal-50/70'
                          : 'border-slate-100 hover:bg-slate-50',
                      ].join(' ')}
                    >
                      <button
                        type="button"
                        className="min-w-0 flex-1 text-left"
                        onClick={() => setPreviewFileName(file.fileName)}
                      >
                        <div className="truncate text-sm font-medium text-slate-950">{file.fileName}</div>
                        <div className="text-xs text-slate-500">
                          {file.kind.toUpperCase()} - {file.itemCount} item(s)
                          {file.skippedCount ? ` - ${file.skippedCount} skipped` : ''}
                        </div>
                      </button>
                      <button
                        type="button"
                        className="rounded-md border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-100 active:scale-[0.98]"
                        onClick={() =>
                          downloadBlob(
                            new Blob([file.content], { type: getMimeType(file) }),
                            file.fileName,
                          )
                        }
                      >
                        Download
                      </button>
                    </div>
                  ))}
                </div>
                {previewFile && (
                  <div className="mt-3 rounded-2xl border border-slate-200 bg-slate-950 p-3 text-slate-100 shadow-inner">
                    <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                      <div className="min-w-0">
                        <div className="truncate text-sm font-semibold">{previewFile.fileName}</div>
                        <div className="mt-1 text-xs text-slate-400">{getOutputStats(previewFile)}</div>
                      </div>
                      <button
                        type="button"
                        className="rounded-md bg-white/10 px-3 py-2 text-xs font-semibold text-white ring-1 ring-white/15 transition hover:bg-white/15"
                        onClick={() =>
                          downloadBlob(
                            new Blob([previewFile.content], { type: getMimeType(previewFile) }),
                            previewFile.fileName,
                          )
                        }
                      >
                        Download file
                      </button>
                    </div>
                    <pre className="max-h-[32rem] overflow-auto whitespace-pre-wrap rounded-xl bg-black/25 p-3 font-mono text-xs leading-5 text-slate-100 ring-1 ring-white/10">
                      {formatPreviewContent(previewFile.content)}
                    </pre>
                  </div>
                )}
              </div>
            )}
          </Panel>

          <Panel title="Safety Rules" icon={<ShieldCheck className="h-5 w-5" />}>
            <ul className="space-y-3 text-sm leading-6 text-slate-600">
              <li>Original uploaded files are never overwritten.</li>
              <li>All generated TXT/VCF files are created in browser memory.</li>
              <li>Large batches export as one ZIP by default.</li>
              <li>Every destructive desktop behavior becomes preview-first.</li>
            </ul>
          </Panel>

          <Panel title="Processing Log" icon={<Archive className="h-5 w-5" />}>
            <div className="max-h-80 space-y-2 overflow-auto rounded-xl bg-slate-950 p-3 font-mono text-xs text-slate-200 shadow-inner">
              {jobLines.map((line) => (
                <div key={line} className="rounded-md bg-white/5 px-3 py-2 ring-1 ring-white/10">
                  {line}
                </div>
              ))}
            </div>
          </Panel>
        </aside>
      </section>
    </main>
  )
}

function Panel({
  title,
  icon,
  children,
}: {
  title: string
  icon: ReactNode
  children: ReactNode
}) {
  return (
    <section className="motion-card rounded-xl border border-slate-200 bg-white/95 p-2.5 shadow-sm shadow-slate-900/5 sm:p-3 sm:backdrop-blur">
      <div className="mb-3 flex items-center gap-2 text-slate-950">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-teal-50 text-teal-700 ring-1 ring-teal-100">
          {icon}
        </span>
        <h2 className="text-base font-semibold">{title}</h2>
      </div>
      {children}
    </section>
  )
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-2 py-2 shadow-[0_1px_0_rgba(15,23,42,0.03)] transition hover:border-slate-300 sm:px-3 sm:py-2.5">
      <div className="text-base font-semibold text-slate-950 sm:text-lg">{value}</div>
      <div className="mt-1 text-[10px] font-medium uppercase leading-4 text-slate-500 sm:text-xs">{label}</div>
    </div>
  )
}

function WorkflowStep({
  icon,
  title,
  text,
}: {
  icon: ReactElement
  title: string
  text: string
}) {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-2.5 transition hover:-translate-y-0.5 hover:bg-white hover:shadow-md hover:shadow-slate-900/5 sm:p-3">
      <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-lg border border-teal-200 bg-white text-teal-700 shadow-sm">
        {icon}
      </div>
      <h3 className="text-xs font-semibold text-slate-950 sm:text-sm">{title}</h3>
      <p className="mt-1 text-xs leading-5 text-slate-600 sm:text-sm">{text}</p>
    </div>
  )
}

function TextField({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  placeholder: string
}) {
  return (
    <label className="block text-sm font-medium text-slate-700">
      {label}
      <input
        className="mt-2 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-normal text-slate-950 outline-none transition focus:border-teal-600 focus:ring-2 focus:ring-teal-100"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
      />
    </label>
  )
}

function EditorActionButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      className="rounded-md border border-teal-200 bg-white px-3 py-2 text-xs font-semibold text-teal-900 shadow-sm transition hover:-translate-y-0.5 hover:bg-teal-50 hover:shadow-md active:scale-[0.98]"
      onClick={onClick}
    >
      {label}
    </button>
  )
}

function PerFileFields({
  files,
  label,
  values,
  onChange,
  placeholder,
}: {
  files: File[]
  label: string
  values: Record<string, string>
  onChange: (values: Record<string, string>) => void
  placeholder: (file: File) => string
}) {
  if (files.length === 0) {
    return (
      <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">
        Upload TXT files to edit per-file values.
      </div>
    )
  }

  return (
    <div>
      <div className="mb-2 text-sm font-medium text-slate-700">{label}</div>
      <div className="max-h-52 overflow-auto rounded-md border border-slate-200 bg-white">
        {files.map((file) => (
          <div
            key={getFileKey(file)}
            className="grid gap-2 border-b border-slate-100 px-3 py-2.5 last:border-b-0 sm:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]"
          >
            <div className="truncate text-sm font-medium text-slate-700" title={file.name}>
              {file.name}
            </div>
            <input
              className="min-w-0 rounded-md border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-teal-600 focus:ring-2 focus:ring-teal-100"
              value={values[file.name] ?? ''}
              onChange={(event) =>
                onChange({
                  ...values,
                  [file.name]: event.target.value,
                })
              }
              placeholder={placeholder(file)}
            />
          </div>
        ))}
      </div>
    </div>
  )
}

function SourceSelect({
  files,
  label,
  value,
  onChange,
}: {
  files: File[]
  label: string
  value: string
  onChange: (value: string) => void
}) {
  return (
    <label className="block text-sm font-medium text-slate-700">
      {label}
      <select
        className="mt-2 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-normal text-slate-950 outline-none transition focus:border-teal-600 focus:ring-2 focus:ring-teal-100"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      >
        <option value="">Use first selected VCF</option>
        {files.map((file) => (
          <option key={getFileKey(file)} value={file.name}>
            {file.name}
          </option>
        ))}
      </select>
    </label>
  )
}

function ComposerSourceSelect({
  sources,
  label,
  value,
  onChange,
}: {
  sources: ComposerSourceOption[]
  label: string
  value: string
  onChange: (value: string) => void
}) {
  return (
    <label className="block text-sm font-medium text-slate-700">
      {label}
      <select
        className="mt-2 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-normal text-slate-950 outline-none transition focus:border-teal-600 focus:ring-2 focus:ring-teal-100"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      >
        <option value="">Use first available VCF source</option>
        {sources.map((source) => (
          <option key={source.key} value={source.key}>
            {source.fileName} ({source.origin})
          </option>
        ))}
      </select>
      {sources.length === 0 && (
        <span className="mt-2 block text-xs font-normal leading-5 text-amber-700">
          Upload a VCF source or generate one with Smart VCF Builder first.
        </span>
      )}
    </label>
  )
}

function PostGenerationRenameControls({
  enabled,
  onEnabledChange,
  renameMode,
  onRenameModeChange,
  renameCount,
  onRenameCountChange,
  renameBaseName,
  onRenameBaseNameChange,
  firstGroupCount,
  onFirstGroupCountChange,
  firstGroupName,
  onFirstGroupNameChange,
  secondGroupName,
  onSecondGroupNameChange,
  adminCount,
  onAdminCountChange,
  navyCount,
  onNavyCountChange,
}: {
  enabled: boolean
  onEnabledChange: (value: boolean) => void
  renameMode: 'single' | 'split' | 'admin-navy'
  onRenameModeChange: (value: 'single' | 'split' | 'admin-navy') => void
  renameCount: string
  onRenameCountChange: (value: string) => void
  renameBaseName: string
  onRenameBaseNameChange: (value: string) => void
  firstGroupCount: string
  onFirstGroupCountChange: (value: string) => void
  firstGroupName: string
  onFirstGroupNameChange: (value: string) => void
  secondGroupName: string
  onSecondGroupNameChange: (value: string) => void
  adminCount: string
  onAdminCountChange: (value: string) => void
  navyCount: string
  onNavyCountChange: (value: string) => void
}) {
  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-3 ring-1 ring-white">
      <label className="flex items-center gap-2 text-sm font-semibold text-amber-950">
        <input
          type="checkbox"
          className="h-4 w-4 rounded border-amber-300 text-amber-700 focus:ring-amber-200"
          checked={enabled}
          onChange={(event) => onEnabledChange(event.target.checked)}
        />
        Rename contacts after VCF generation
      </label>

      {enabled && (
        <div className="mt-3 space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700" htmlFor="post-create-rename-mode">
              Rename mode
            </label>
            <select
              id="post-create-rename-mode"
              className="mt-2 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm outline-none transition focus:border-amber-600 focus:ring-2 focus:ring-amber-100"
              value={renameMode}
              onChange={(event) =>
                onRenameModeChange(event.target.value as 'single' | 'split' | 'admin-navy')
              }
            >
              <option value="single">Single base for first contacts</option>
              <option value="split">Split first contacts into two groups</option>
              <option value="admin-navy">ADMIN + NAVY group mode</option>
            </select>
          </div>

          {renameMode === 'single' && (
            <div className="grid gap-3 sm:grid-cols-2">
              <TextField label="Rename count" value={renameCount} onChange={onRenameCountChange} placeholder="10" />
              <TextField label="New base name" value={renameBaseName} onChange={onRenameBaseNameChange} placeholder="ADMIN" />
            </div>
          )}

          {renameMode === 'split' && (
            <div className="grid gap-3 sm:grid-cols-2">
              <TextField label="Total rename count" value={renameCount} onChange={onRenameCountChange} placeholder="10" />
              <TextField label="First group count" value={firstGroupCount} onChange={onFirstGroupCountChange} placeholder="5" />
              <TextField label="First group name" value={firstGroupName} onChange={onFirstGroupNameChange} placeholder="ADMIN" />
              <TextField label="Second group name" value={secondGroupName} onChange={onSecondGroupNameChange} placeholder="NAVY" />
            </div>
          )}

          {renameMode === 'admin-navy' && (
            <div className="grid gap-3 sm:grid-cols-2">
              <TextField label="ADMIN count" value={adminCount} onChange={onAdminCountChange} placeholder="5" />
              <TextField label="NAVY count" value={navyCount} onChange={onNavyCountChange} placeholder="5" />
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function PowerFilters({
  idPrefix,
  phoneCleanMode,
  onPhoneCleanModeChange,
  duplicatePolicy,
  onDuplicatePolicyChange,
  includeReports,
  onIncludeReportsChange,
}: {
  idPrefix: string
  phoneCleanMode: PhoneCleanMode
  onPhoneCleanModeChange: (value: PhoneCleanMode) => void
  duplicatePolicy: RajDuplicatePolicy
  onDuplicatePolicyChange: (value: RajDuplicatePolicy) => void
  includeReports: boolean
  onIncludeReportsChange: (value: boolean) => void
}) {
  return (
    <div className="rounded-xl border border-sky-200 bg-sky-50/70 p-3 ring-1 ring-white">
      <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-sky-950">
        <SlidersHorizontal className="h-4 w-4 text-sky-700" />
        Power filters
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block text-sm font-medium text-slate-700" htmlFor={`${idPrefix}-phone-cleaner`}>
          Phone cleaner
          <select
            id={`${idPrefix}-phone-cleaner`}
            className="mt-2 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-normal text-slate-950 outline-none transition focus:border-sky-600 focus:ring-2 focus:ring-sky-100"
            value={phoneCleanMode}
            onChange={(event) => onPhoneCleanModeChange(event.target.value as PhoneCleanMode)}
          >
            <option value="smart">Smart strict: 9-15 digits, Unicode cleanup</option>
            <option value="legacy">Legacy Java forgiving cleaner</option>
          </select>
        </label>
        <label className="block text-sm font-medium text-slate-700" htmlFor={`${idPrefix}-duplicates`}>
          Duplicate handling
          <select
            id={`${idPrefix}-duplicates`}
            className="mt-2 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-normal text-slate-950 outline-none transition focus:border-sky-600 focus:ring-2 focus:ring-sky-100"
            value={duplicatePolicy}
            onChange={(event) =>
              onDuplicatePolicyChange(event.target.value as RajDuplicatePolicy)
            }
          >
            <option value="skip-across-job">Skip duplicates across all files</option>
            <option value="skip-within-file">Skip duplicates only inside same file</option>
            <option value="keep">Keep all duplicates</option>
          </select>
        </label>
      </div>
      <label className="mt-3 flex items-center gap-2 text-sm font-medium text-slate-700">
        <input
          type="checkbox"
          className="h-4 w-4 rounded border-slate-300 text-sky-700 focus:ring-sky-200"
          checked={includeReports}
          onChange={(event) => onIncludeReportsChange(event.target.checked)}
        />
        Add summary, invalid-number, and duplicate reports to ZIP
      </label>
    </div>
  )
}

function getFileKey(file: File) {
  return `${file.name}:${file.size}:${file.lastModified}`
}

function buildComposerSourceOptions(
  uploadedVcfFiles: File[],
  workspaceSources: TextInputFile[],
): ComposerSourceOption[] {
  return [
    ...uploadedVcfFiles.map((file) => ({
      key: getComposerSourceKey('uploaded', file.name),
      fileName: file.name,
      origin: 'uploaded' as const,
    })),
    ...workspaceSources.map((file) => ({
      key: getComposerSourceKey('generated', file.fileName),
      fileName: file.fileName,
      origin: 'generated' as const,
    })),
  ]
}

function buildComposerTextSources(
  uploadedVcfFiles: TextInputFile[],
  workspaceSources: TextInputFile[],
): ComposerTextSource[] {
  return [
    ...uploadedVcfFiles.map((file) => ({
      key: getComposerSourceKey('uploaded', file.fileName),
      fileName: file.fileName,
      text: file.text,
      origin: 'uploaded' as const,
    })),
    ...workspaceSources.map((file) => ({
      key: getComposerSourceKey('generated', file.fileName),
      fileName: file.fileName,
      text: file.text,
      origin: 'generated' as const,
    })),
  ]
}

function getComposerSourceKey(origin: ComposerSourceOption['origin'], fileName: string) {
  return `${origin}:${fileName}`
}

function generatedFilesToVcfSources(files: GeneratedFile[]): TextInputFile[] {
  return files
    .filter((file) => file.kind === 'vcf')
    .map((file) => ({
      fileName: file.fileName,
      text: file.content,
    }))
}

function mergeWorkspaceVcfSources(
  current: TextInputFile[],
  incoming: TextInputFile[],
): TextInputFile[] {
  const merged = new Map(current.map((file) => [file.fileName, file]))
  for (const file of incoming) {
    merged.set(file.fileName, file)
  }
  return Array.from(merged.values())
}

function detectFileKind(name: string) {
  const lower = name.toLowerCase()
  if (lower.endsWith('.vcf')) return 'VCF'
  if (lower.endsWith('.txt')) return 'TXT'
  if (lower.endsWith('.xlsx')) return 'XLSX'
  if (lower.endsWith('.xls')) return 'XLS'
  return 'File'
}

function getStatusClassName(status: Tool['status']) {
  const base = 'shrink-0 rounded-md border px-2 py-1 text-xs font-medium'
  if (status === 'Builder') return `${base} border-teal-200 bg-teal-50 text-teal-800`
  if (status === 'Batch') return `${base} border-sky-200 bg-sky-50 text-sky-800`
  return `${base} border-amber-200 bg-amber-50 text-amber-800`
}

function getToolButtonClassName(tool: Tool, activeTool: ToolId) {
  const active = activeTool === tool.id
  return [
    'group relative cursor-pointer overflow-hidden rounded-lg border bg-white p-3 text-left transition duration-200',
    'hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-lg hover:shadow-slate-900/5',
    active ? 'border-teal-300 shadow-md shadow-teal-900/10 ring-2 ring-teal-100' : 'border-slate-200',
  ].join(' ')
}

function getToolAccentClassName(status: Tool['status']) {
  const color =
    status === 'Builder' ? 'bg-teal-500' : status === 'Batch' ? 'bg-sky-500' : 'bg-amber-500'
  return `absolute inset-x-0 top-0 h-1 ${color}`
}

function getToolTitle(id: ToolId) {
  return tools.find((tool) => tool.id === id)?.title ?? 'Tool'
}

function getToolDescription(id: ToolId) {
  if (id === 'raj') return 'Full TXT to VCF studio with linked naming, smart filters, reports, and legacy mode.'
  if (id === 'txt-split') return 'Split TXT files into fixed, half, or custom first-part outputs.'
  if (id === 'text-editor') return 'Edit TXT files locally with live counts, selection counts, cleanup actions, and export.'
  if (id === 'txt-merge') return 'Merge sorted TXT files into one output.'
  if (id === 'txt-cleaner') return 'Clean TXT batches, remove short junk rows, and cut specific numbers.'
  if (id === 'dedupe') return 'Remove duplicates across selected TXT files with digit-only normalization.'
  if (id === 'plus-prefix') return 'Add + prefixes to selected TXT batches.'
  if (id === 'excel-extract') return 'Extract full Excel sheets, all non-empty columns, and phone-heavy column TXT files.'
  if (id === 'paste-vcf') return 'Paste phone numbers and create a filtered VCF directly.'
  if (id === 'vcf-split') return 'ROUGH-style TXT to VCF pipeline with splitting and optional VCF compose/prepend.'
  if (id === 'vcf-to-txt') return 'Extract TEL numbers from VCF files.'
  if (id === 'vcf-merge') return 'Compose target VCF files by placing one source stack before each target.'
  if (id === 'admin-navy') return 'Build ADMIN/NAVY blocks, merge into target VCF files, and renumber the rest.'
  return 'Rewrite starting contact headers in selected VCF files.'
}

function getGenerateButtonLabel(id: ToolId) {
  if (id === 'raj') return 'Generate VCF'
  if (id === 'txt-split') return 'Split TXT'
  if (id === 'text-editor') return 'Export Edited TXT'
  if (id === 'txt-merge') return 'Merge TXT'
  if (id === 'txt-cleaner') return 'Clean TXT'
  if (id === 'dedupe') return 'Remove Duplicates'
  if (id === 'plus-prefix') return 'Add + Prefix'
  if (id === 'excel-extract') return 'Extract Excel Data'
  if (id === 'paste-vcf') return 'Create VCF'
  if (id === 'vcf-split') return 'Run ROUGH Pipeline'
  if (id === 'vcf-to-txt') return 'Extract TXT'
  if (id === 'vcf-merge') return 'Merge VCF'
  if (id === 'admin-navy') return 'Apply ADMIN/NAVY'
  return 'Rename Contacts'
}

function formatBytes(bytes: number) {
  if (bytes === 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB']
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1)
  const value = bytes / 1024 ** index
  return `${value.toFixed(value >= 10 || index === 0 ? 0 : 1)} ${units[index]}`
}

function getOutputStats(file: GeneratedFile) {
  const lineCount = countTextNumbers(file.content)
  const skipped = file.skippedCount ? `, ${file.skippedCount} skipped` : ''
  return `${file.kind.toUpperCase()} - ${file.itemCount} item(s), ${lineCount} line(s), ${formatBytes(file.content.length)}${skipped}`
}

function formatPreviewContent(content: string) {
  const limit = 50000
  if (content.length <= limit) return content || 'Empty file'
  return `${content.slice(0, limit)}\n\n--- Preview truncated at ${limit.toLocaleString()} characters ---`
}

function buildRajFileNaming({
  mode,
  baseName,
  startNumber,
  namesByFileName,
}: {
  mode: RajFileNaming['mode']
  baseName: string
  startNumber: string
  namesByFileName: Record<string, string>
}): RajFileNaming {
  if (mode === 'manual') return { mode, namesByFileName }
  if (mode === 'sequential') {
    return {
      mode,
      baseName,
      startNumber: parseInteger(startNumber, 1),
    }
  }
  return { mode }
}

function buildRajContactNaming({
  mode,
  baseName,
  fallbackBaseName,
  basesByFileName,
  alphabeticLength,
  alphabeticRunIndex,
}: {
  mode: RajContactNaming['mode']
  baseName: string
  fallbackBaseName: string
  basesByFileName: Record<string, string>
  alphabeticLength: string
  alphabeticRunIndex: string
}): RajContactNaming {
  if (mode === 'manual-per-file') return { mode, basesByFileName, fallbackBaseName }
  if (mode === 'sequential') return { mode, baseName }
  if (mode === 'alphabetic') {
    return {
      mode,
      length: parseInteger(alphabeticLength, 2),
      runIndex: parseInteger(alphabeticRunIndex, 0),
    }
  }
  return { mode, baseName }
}

function parseInteger(value: string, fallback: number) {
  const parsed = Number.parseInt(value, 10)
  return Number.isFinite(parsed) ? parsed : fallback
}

function buildTxtSplitOptions(
  mode: TxtSplitOptions['mode'],
  linesPerFile: string,
  firstPartLines: string,
): TxtSplitOptions {
  if (mode === 'half') return { mode }
  if (mode === 'custom-first') return { mode, firstPartLines: parseInteger(firstPartLines, 0) }
  return { mode, linesPerFile: parseInteger(linesPerFile, 1) }
}

function buildRenameStartingOptions({
  mode,
  renameCount,
  renameBaseName,
  firstGroupCount,
  firstGroupName,
  secondGroupName,
  adminCount,
  navyCount,
}: {
  mode: 'single' | 'split' | 'admin-navy'
  renameCount: string
  renameBaseName: string
  firstGroupCount: string
  firstGroupName: string
  secondGroupName: string
  adminCount: string
  navyCount: string
}) {
  if (mode === 'admin-navy') {
    return {
      mode,
      adminCount: parseInteger(adminCount, 0),
      navyCount: parseInteger(navyCount, 0),
    } as const
  }

  if (mode === 'split') {
    return {
      mode,
      renameCount: parseInteger(renameCount, 0),
      firstGroupCount: parseInteger(firstGroupCount, 0),
      firstGroupName,
      secondGroupName,
    } as const
  }

  return {
    mode,
    renameCount: parseInteger(renameCount, 0),
    baseName: renameBaseName,
  } as const
}

function removeClientExtension(fileName: string) {
  return fileName.replace(/\.[^/.]+$/, '')
}

function extractFirstContactName(vcfContent: string) {
  const fnLine = vcfContent.split('\n').find((line) => line.startsWith('FN:'))
  if (fnLine) return fnLine.slice('FN:'.length)

  const nameLine = vcfContent.split('\n').find((line) => line.startsWith('N:;;'))
  return nameLine?.slice('N:;;'.length).replace(/;+$/, '')
}

function renameGeneratedVcfOutputs(
  outputs: GeneratedFile[],
  options: ReturnType<typeof buildRenameStartingOptions>,
) {
  const vcfOutputs = outputs.filter((file) => file.kind === 'vcf')
  const otherOutputs = outputs.filter((file) => file.kind !== 'vcf')
  const renamedVcfOutputs = renameStartingContactsInVcfFiles(
    vcfOutputs.map((file) => ({
      fileName: file.fileName,
      text: file.content,
    })),
    options,
  )

  return [...renamedVcfOutputs, ...otherOutputs]
}

function composeSplitOutputsWithSource(
  splitOutputs: GeneratedFile[],
  sourceFiles: ComposerTextSource[],
  sourceKey: string,
) {
  const source = sourceFiles.find((file) => file.key === sourceKey) ?? sourceFiles[0]
  if (!source) {
    throw new Error('Select a VCF source to compose into the split files.')
  }

  return prependVcfContacts(
    splitOutputs
      .filter((file) => file.kind === 'vcf')
      .map((file) => ({
        fileName: file.fileName,
        text: file.content,
      })),
    source,
  )
}

async function extractExcelFiles(
  files: File[],
  minimumValuesPerColumn: number,
  logs: string[],
): Promise<GeneratedFile[]> {
  const extractions: ExcelSheetExtraction[] = []

  for (const file of files) {
    if (file.name.toLowerCase().endsWith('.xls')) {
      logs.push(`Skipped: ${file.name} is old .xls format. Save it as .xlsx and upload again.`)
      continue
    }

    logs.push(`Scanning workbook: ${file.name}`)
    const sheets = await readXlsxFile(file)
    for (const sheet of sheets) {
      logs.push(`Scanning sheet: ${sheet.sheet}`)
      const rows = sheet.data as unknown[][]
      extractions.push(buildExcelSheetExtraction(file.name, sheet.sheet, rows))
    }
  }

  if (extractions.length === 0) {
    throw new Error('No readable .xlsx sheets found.')
  }

  return buildExcelExtractionOutputs(extractions, minimumValuesPerColumn)
}

async function readBrowserFiles(files: File[], logs: string[]): Promise<TextInputFile[]> {
  const inputFiles: TextInputFile[] = []
  for (const file of files) {
    logs.push(`Reading: ${file.name}`)
    inputFiles.push({ fileName: file.name, text: await file.text() })
  }
  return inputFiles
}

async function readEditableTxtFiles(
  files: File[],
  edits: Record<string, string>,
  logs: string[],
): Promise<TextInputFile[]> {
  const inputFiles: TextInputFile[] = []
  for (const file of files) {
    const key = getFileKey(file)
    logs.push(edits[key] == null ? `Reading: ${file.name}` : `Using edited TXT: ${file.name}`)
    inputFiles.push({
      fileName: file.name,
      text: edits[key] ?? (await file.text()),
    })
  }
  return inputFiles
}

function countTextNumbers(text: string) {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean).length
}

function countSelectedText(textarea: HTMLTextAreaElement) {
  return countTextNumbers(textarea.value.slice(textarea.selectionStart, textarea.selectionEnd))
}

function splitEditorLines(text: string) {
  return text.split(/\r?\n/)
}

function cleanEditorBlankLines(text: string) {
  return ensureFinalNewline(
    splitEditorLines(text)
      .map((line) => line.trim())
      .filter(Boolean)
      .join('\n'),
  )
}

function sortEditorLines(text: string) {
  return ensureFinalNewline(
    splitEditorLines(text)
      .map((line) => line.trim())
      .filter(Boolean)
      .sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }))
      .join('\n'),
  )
}

function uniqueEditorLines(text: string) {
  const seen = new Set<string>()
  const uniqueLines: string[] = []
  for (const line of splitEditorLines(text).map((item) => item.trim()).filter(Boolean)) {
    if (seen.has(line)) continue
    seen.add(line)
    uniqueLines.push(line)
  }
  return ensureFinalNewline(uniqueLines.join('\n'))
}

function digitsOnlyEditorLines(text: string) {
  return ensureFinalNewline(
    splitEditorLines(text)
      .map((line) => line.replace(/\D/g, ''))
      .filter(Boolean)
      .join('\n'),
  )
}

function addPlusEditorLines(text: string) {
  return ensureFinalNewline(
    splitEditorLines(text)
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => (line.startsWith('+') ? line : `+${line}`))
      .join('\n'),
  )
}

function removePlusEditorLines(text: string) {
  return ensureFinalNewline(
    splitEditorLines(text)
      .map((line) => line.trim().replace(/^\++/, ''))
      .filter(Boolean)
      .join('\n'),
  )
}

function ensureFinalNewline(text: string) {
  if (!text) return ''
  return text.endsWith('\n') ? text : `${text}\n`
}

function getMimeType(file: GeneratedFile) {
  return file.kind === 'vcf' ? 'text/vcard;charset=utf-8' : 'text/plain;charset=utf-8'
}

function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = fileName
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}

function formatDateForFileName(date: Date) {
  return date.toISOString().slice(0, 19).replace(/[:T]/g, '-')
}

export default App
