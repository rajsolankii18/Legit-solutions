export function removeExtension(fileName: string) {
  return fileName.replace(/\.[^/.]+$/, '')
}

export function ensureExtension(fileName: string, extension: string) {
  const normalizedExtension = extension.startsWith('.') ? extension : `.${extension}`
  return fileName.toLowerCase().endsWith(normalizedExtension.toLowerCase())
    ? fileName
    : `${fileName}${normalizedExtension}`
}

export function sortByLastNumericPart<T>(items: T[], getName: (item: T) => string) {
  return [...items].sort((first, second) => {
    const firstNumber = extractLastNumericPart(removeExtension(getName(first)))
    const secondNumber = extractLastNumericPart(removeExtension(getName(second)))
    if (firstNumber !== secondNumber) return firstNumber - secondNumber
    return getName(first).localeCompare(getName(second), undefined, {
      numeric: true,
      sensitivity: 'base',
    })
  })
}

export function extractLastNumericPart(name: string) {
  const parts = name.split(/[_\-\s]/)
  for (let index = parts.length - 1; index >= 0; index -= 1) {
    const numeric = parts[index].replace(/\D/g, '')
    if (numeric) return Number(numeric)
  }
  return 0
}
