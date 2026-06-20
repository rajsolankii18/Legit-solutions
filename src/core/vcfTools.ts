import { ensureExtension, removeExtension, sortByLastNumericPart } from './fileNames'
import type { GeneratedFile, TextInputFile } from './types'
import {
  extractPhoneNumbersFromVcf,
  extractVcfBlocks,
  getVcfBlockName,
  replaceNameInVcfBlock,
} from './vcf'

export function splitVcfFiles(
  files: TextInputFile[],
  contactsPerFile: number,
  startNumber: number,
): GeneratedFile[] {
  const safeContactsPerFile = Math.max(1, Math.floor(contactsPerFile))
  const safeStart = Math.max(1, Math.floor(startNumber))

  return sortByLastNumericPart(files, (file) => file.fileName).flatMap((file) => {
    const blocks = extractVcfBlocks(file.text)
    const base = removeExtension(file.fileName)
    const output: GeneratedFile[] = []

    for (let start = 0, part = safeStart; start < blocks.length; start += safeContactsPerFile, part += 1) {
      const chunk = blocks.slice(start, start + safeContactsPerFile)
      const splitBase = base.includes('[]')
        ? base.replace('[]', String(part).padStart(2, '0'))
        : `${base}${part}`
      output.push({
        fileName: `${splitBase}.vcf`,
        content: chunk.join(''),
        kind: 'vcf',
        itemCount: chunk.length,
      })
    }

    return output
  })
}

export type RoughSplitOptions = {
  contactsPerFile: number
  startNumber: number
  renameContacts: boolean
  continuousNumbering: boolean
  continuousBaseName: string
  fixedBaseMode: boolean
}

export function splitVcfFilesRough(
  files: TextInputFile[],
  options: RoughSplitOptions,
): GeneratedFile[] {
  const safeContactsPerFile = Math.max(1, Math.floor(options.contactsPerFile))
  const safeStart = Math.max(1, Math.floor(options.startNumber))
  let globalCounter = 1

  return sortByLastNumericPart(files, (file) => file.fileName).flatMap((file) => {
    const blocks = extractVcfBlocks(file.text)
    const base = removeExtension(file.fileName)
    const output: GeneratedFile[] = []

    for (let start = 0, part = safeStart; start < blocks.length; start += safeContactsPerFile, part += 1) {
      const chunk = blocks.slice(start, start + safeContactsPerFile)
      const renamedChunk = options.renameContacts
        ? chunk.map((block, index) => {
            if (options.continuousNumbering) {
              const continuousBase = options.fixedBaseMode
                ? options.continuousBaseName
                : `${options.continuousBaseName}${part}`
              return replaceNameInVcfBlock(
                block,
                `${continuousBase}-${String(globalCounter++).padStart(3, '0')}`,
              )
            }

            return replaceNameInVcfBlock(
              block,
              `${preservePrefix(getVcfBlockName(block))}${part}-${String(index + 1).padStart(3, '0')}`,
            )
          })
        : chunk
      const splitBase = base.includes('[]')
        ? base.replace('[]', String(part).padStart(2, '0'))
        : `${base}${part}`
      output.push({
        fileName: `${splitBase}.vcf`,
        content: renamedChunk.join(''),
        kind: 'vcf',
        itemCount: renamedChunk.length,
      })
    }

    return output
  })
}

export function convertVcfFilesToTxt(
  files: TextInputFile[],
  mode: 'merged' | 'separate',
  mergedFileName: string,
): GeneratedFile[] {
  const sortedFiles = sortByLastNumericPart(files, (file) => file.fileName)

  if (mode === 'merged') {
    const phones = sortedFiles.flatMap((file) => extractPhoneNumbersFromVcf(file.text))
    return [createTxtOutput(ensureExtension(mergedFileName.trim() || 'merged', '.txt'), phones)]
  }

  return sortedFiles.map((file) =>
    createTxtOutput(`${removeExtension(file.fileName)}.txt`, extractPhoneNumbersFromVcf(file.text)),
  )
}

export function prependVcfContacts(
  targetFiles: TextInputFile[],
  mergeSource: TextInputFile,
): GeneratedFile[] {
  const prependBlocks = extractVcfBlocks(mergeSource.text)
  return sortByLastNumericPart(targetFiles, (file) => file.fileName).map((file) => {
    const blocks = extractVcfBlocks(file.text)
    const mergedBlocks = [...prependBlocks, ...blocks]
    return {
      fileName: ensureExtension(file.fileName, '.vcf'),
      content: mergedBlocks.join(''),
      kind: 'vcf',
      itemCount: mergedBlocks.length,
    }
  })
}

export function autoMergeAdminNavy(
  targetFiles: TextInputFile[],
  baseVcf: TextInputFile,
  customPrefix: string,
): GeneratedFile[] {
  const baseBlocks = extractVcfBlocks(baseVcf.text)
  const adminBlocks = baseBlocks.filter((block) => getVcfBlockName(block).toUpperCase().startsWith('ADMIN'))
  const navyBlocks = baseBlocks.filter((block) => getVcfBlockName(block).toUpperCase().startsWith('NAVY'))
  let autoIndex = 1

  return sortByLastNumericPart(targetFiles, (file) => file.fileName).map((file) => {
    const tag = customPrefix.trim()
      ? `${customPrefix.trim()}${autoIndex++}`
      : deriveTagFromFileName(file.fileName, autoIndex++)

    const renamedAdmin = adminBlocks.map((block, index) =>
      replaceNameInVcfBlock(block, `ADMIN - ${tag}-${String(index + 1).padStart(3, '0')}`),
    )
    const renamedNavy = navyBlocks.map((block, index) =>
      replaceNameInVcfBlock(block, `NAVY - ${tag}-${String(index + 1).padStart(3, '0')}`),
    )
    const renumberedOriginal = extractVcfBlocks(file.text).map((block, index) => {
      const name = getVcfBlockName(block).toUpperCase()
      if (name.startsWith('ADMIN') || name.startsWith('NAVY')) return block
      return replaceNameInVcfBlock(block, `${tag}-${String(index + 1).padStart(3, '0')}`)
    })
    const mergedBlocks = [...renamedAdmin, ...renamedNavy, ...renumberedOriginal]

    return {
      fileName: ensureExtension(file.fileName, '.vcf'),
      content: mergedBlocks.join(''),
      kind: 'vcf',
      itemCount: mergedBlocks.length,
    }
  })
}

export type RenameStartingOptions =
  | { mode: 'single'; renameCount: number; baseName: string }
  | {
      mode: 'split'
      renameCount: number
      firstGroupCount: number
      firstGroupName: string
      secondGroupName: string
    }
  | { mode: 'admin-navy'; adminCount: number; navyCount: number }

export function renameStartingContactsInVcfFiles(
  files: TextInputFile[],
  options: RenameStartingOptions,
): GeneratedFile[] {
  return sortByLastNumericPart(files, (file) => file.fileName).map((file) => {
    const blocks = extractVcfBlocks(file.text)
    const renamed = renameBlocks(blocks, removeExtension(file.fileName), options)

    return {
      fileName: ensureExtension(file.fileName, '.vcf'),
      content: renamed.join(''),
      kind: 'vcf',
      itemCount: renamed.length,
    }
  })
}

function renameBlocks(blocks: string[], fileBase: string, options: RenameStartingOptions) {
  if (options.mode === 'admin-navy') {
    let adminCounter = 1
    let navyCounter = 1
    let remainingCounter = 1

    return blocks.map((block, index) => {
      if (index < options.adminCount) {
        return replaceNameInVcfBlock(block, `ADMIN - ${fileBase}-${String(adminCounter++).padStart(3, '0')}`)
      }
      if (index < options.adminCount + options.navyCount) {
        return replaceNameInVcfBlock(block, `NAVY - ${fileBase}-${String(navyCounter++).padStart(3, '0')}`)
      }
      return replaceNameInVcfBlock(block, `${preservePrefix(getVcfBlockName(block))}-${String(remainingCounter++).padStart(3, '0')}`)
    })
  }

  if (options.mode === 'split') {
    const secondGroupCount = Math.max(0, options.renameCount - options.firstGroupCount)
    let firstCounter = 1
    let secondCounter = 1
    let remainingCounter = 1

    return blocks.map((block, index) => {
      if (index < options.firstGroupCount) {
        return replaceNameInVcfBlock(block, `${options.firstGroupName || 'GROUP1'}-${String(firstCounter++).padStart(3, '0')}`)
      }
      if (index < options.firstGroupCount + secondGroupCount) {
        return replaceNameInVcfBlock(block, `${options.secondGroupName || 'GROUP2'}-${String(secondCounter++).padStart(3, '0')}`)
      }
      return replaceNameInVcfBlock(block, `${preservePrefix(getVcfBlockName(block))}-${String(remainingCounter++).padStart(3, '0')}`)
    })
  }

  let renamedCounter = 1
  let remainingCounter = 1
  return blocks.map((block, index) => {
    if (index < options.renameCount) {
      return replaceNameInVcfBlock(block, `${options.baseName || 'RENAMED'}-${String(renamedCounter++).padStart(3, '0')}`)
    }
    return replaceNameInVcfBlock(block, `${preservePrefix(getVcfBlockName(block))}-${String(remainingCounter++).padStart(3, '0')}`)
  })
}

function preservePrefix(name: string) {
  const cleanName = name.trim()
  const dash = cleanName.indexOf('-')
  return (dash > 0 ? cleanName.slice(0, dash).trim() : cleanName) || 'CONTACT'
}

function deriveTagFromFileName(fileName: string, fallbackIndex: number) {
  const base = removeExtension(fileName)
  const match = /(.*?)(\d+)/.exec(base)
  return match ? `${match[1]}${match[2]}` : `${base}${fallbackIndex}`
}

function createTxtOutput(fileName: string, lines: string[]): GeneratedFile {
  return {
    fileName,
    content: `${lines.join('\n')}${lines.length ? '\n' : ''}`,
    kind: 'txt',
    itemCount: lines.length,
  }
}
