export type VcfContact = {
  name: string
  phone: string
  block?: string
}

export type VcfNameLineMode = 'standard' | 'legacy-n-only'

export function writeVcfContacts(
  contacts: VcfContact[],
  options: { nameLineMode?: VcfNameLineMode } = {},
) {
  const lines: string[] = []
  const nameLineMode = options.nameLineMode ?? 'legacy-n-only'

  for (const contact of contacts) {
    const name = escapeVcfText(contact.name)
    lines.push('BEGIN:VCARD', 'VERSION:3.0')
    if (nameLineMode === 'standard') lines.push(`FN:${name}`)
    lines.push(`N:;;${name};;;`, `TEL;TYPE=CELL:${contact.phone}`, 'END:VCARD')
  }

  return `${lines.join('\n')}${lines.length ? '\n' : ''}`
}

export function formatVcfNameLines(text: string, nameLineMode: VcfNameLineMode) {
  if (nameLineMode === 'standard') return text

  return extractVcfBlocks(text)
    .map((block) => {
      const lines = block.trimEnd().split(/\r?\n/)
      return `${lines.filter((line) => !line.toUpperCase().startsWith('FN:')).join('\n')}\n`
    })
    .join('')
}

export function escapeVcfText(value: string) {
  return value.replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/;/g, '\\;').replace(/,/g, '\\,')
}

export function extractVcfBlocks(text: string) {
  const lines = text.replace(/^\uFEFF/, '').split(/\r?\n/)
  const blocks: string[] = []
  let current: string[] = []
  let inBlock = false

  for (const line of lines) {
    if (line.trim().toUpperCase() === 'BEGIN:VCARD') {
      current = [line]
      inBlock = true
      continue
    }

    if (!inBlock) continue

    current.push(line)
    if (line.trim().toUpperCase() === 'END:VCARD') {
      blocks.push(`${current.join('\n')}\n`)
      current = []
      inBlock = false
    }
  }

  return blocks
}

export function extractPhoneNumbersFromVcf(text: string) {
  const phones: string[] = []
  for (const line of text.split(/\r?\n/)) {
    const match = /^TEL[^:]*:(.+)$/i.exec(line.trim())
    if (match?.[1]?.trim()) phones.push(match[1].trim())
  }
  return phones
}

export function getVcfBlockName(block: string) {
  const fn = block.split(/\r?\n/).find((line) => line.toUpperCase().startsWith('FN:'))
  if (fn) return fn.slice(3).trim()

  const n = block.split(/\r?\n/).find((line) => line.startsWith('N:;;'))
  if (!n) return ''
  return n.slice('N:;;'.length).replace(/;+$/, '').trim()
}

export function replaceNameInVcfBlock(block: string, name: string) {
  const escaped = escapeVcfText(name)
  const lines = block.trimEnd().split(/\r?\n/)
  let replacedN = false
  const output: string[] = []

  for (const line of lines) {
    if (line.toUpperCase().startsWith('FN:')) {
      continue
    }
    if (line.startsWith('N:;;')) {
      output.push(`N:;;${escaped};;;`)
      replacedN = true
      continue
    }
    output.push(line)
  }

  if (!replacedN) {
    const endIndex = output.findIndex((line) => line.trim().toUpperCase() === 'END:VCARD')
    const insertAt = endIndex >= 0 ? endIndex : output.length
    output.splice(insertAt, 0, `N:;;${escaped};;;`)
  }

  return `${output.join('\n')}\n`
}
