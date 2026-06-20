export type TextInputFile = {
  fileName: string
  text: string
}

export type GeneratedFile = {
  fileName: string
  content: string
  kind: 'txt' | 'vcf'
  itemCount: number
  skippedCount?: number
}

export type VcfOutputFile = GeneratedFile & {
  kind: 'vcf'
  contactCount: number
  skippedCount: number
}
