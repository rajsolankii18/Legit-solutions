export type VcfContact = {
  name: string
  phone: string
  block?: string
}

export function writeVcfContacts(contacts: VcfContact[]) {
  const lines: string[] = []

  for (const contact of contacts) {
    const name = escapeVcfText(contact.name)
    lines.push(
      'BEGIN:VCARD',
      'VERSION:3.0',
      `FN:${name}`,
      `N:;;${name};;;`,
      `TEL;TYPE=CELL:${contact.phone}`,
      'END:VCARD',
    )
  }

  return `${lines.join('\n')}${lines.length ? '\n' : ''}`
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
  let replacedFn = false
  const output: string[] = []

  for (const line of lines) {
    if (line.toUpperCase().startsWith('FN:')) {
      output.push(`FN:${escaped}`)
      replacedFn = true
      continue
    }
    if (line.startsWith('N:;;')) {
      if (!replacedFn) output.push(`FN:${escaped}`)
      output.push(`N:;;${escaped};;;`)
      replacedN = true
      replacedFn = true
      continue
    }
    output.push(line)
  }

  if (!replacedN) {
    const endIndex = output.findIndex((line) => line.trim().toUpperCase() === 'END:VCARD')
    const insertAt = endIndex >= 0 ? endIndex : output.length
    output.splice(insertAt, 0, `FN:${escaped}`, `N:;;${escaped};;;`)
  }

  return `${output.join('\n')}\n`
}
