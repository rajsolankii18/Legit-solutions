import { removeExtension, sortByLastNumericPart } from './fileNames'
import type { GeneratedFile, TextInputFile } from './types'
import { splitTextLines } from './raj'

export type TxtSplitOptions =
  | { mode: 'fixed'; linesPerFile: number }
  | { mode: 'half' }
  | { mode: 'custom-first'; firstPartLines: number }

export function splitTxtFiles(files: TextInputFile[], options: TxtSplitOptions) {
  return sortByLastNumericPart(files, (file) => file.fileName).flatMap((file) =>
    splitTxtFile(file, options),
  )
}

export function splitTxtFile(file: TextInputFile, options: TxtSplitOptions): GeneratedFile[] {
  const lines = splitTextLines(file.text)
  const base = removeExtension(file.fileName)

  if (options.mode === 'fixed') {
    const linesPerFile = Math.max(1, Math.floor(options.linesPerFile))
    const output: GeneratedFile[] = []

    for (let start = 0, part = 1; start < lines.length; start += linesPerFile, part += 1) {
      const chunk = lines.slice(start, start + linesPerFile)
      output.push(createTxtOutput(`${base}_part${part}.txt`, chunk))
    }

    return output
  }

  if (options.mode === 'half') {
    const half = Math.floor(lines.length / 2)
    return [
      createTxtOutput(`${base}_part1.txt`, lines.slice(0, half)),
      createTxtOutput(`${base}_part2.txt`, lines.slice(half)),
    ]
  }

  const cut = Math.min(Math.max(Math.floor(options.firstPartLines), 0), lines.length)
  return [
    createTxtOutput(`${base}_part1.txt`, lines.slice(0, cut)),
    createTxtOutput(`${base}_part2.txt`, lines.slice(cut)),
  ]
}

export function mergeTxtFiles(files: TextInputFile[], outputFileName: string): GeneratedFile {
  const sortedFiles = sortByLastNumericPart(files, (file) => file.fileName)
  const lines = sortedFiles.flatMap((file) => splitTextLines(file.text))
  const fileName = outputFileName.toLowerCase().endsWith('.txt') ? outputFileName : `${outputFileName}.txt`
  return createTxtOutput(fileName.trim() || 'merged.txt', lines)
}

function createTxtOutput(fileName: string, lines: string[]): GeneratedFile {
  return {
    fileName,
    content: `${lines.join('\n')}${lines.length ? '\n' : ''}`,
    kind: 'txt',
    itemCount: lines.length,
  }
}
