import { describe, expect, it } from 'vitest'
import { mergeTxtFiles, splitTxtFile } from './txt'

describe('TXT tools', () => {
  it('splits a text file by a fixed number of lines', () => {
    const outputs = splitTxtFile({ fileName: 'nums.txt', text: '1\n2\n3\n4\n5' }, {
      mode: 'fixed',
      linesPerFile: 2,
    })

    expect(outputs.map((file) => file.fileName)).toEqual([
      'nums_part1.txt',
      'nums_part2.txt',
      'nums_part3.txt',
    ])
    expect(outputs.map((file) => file.itemCount)).toEqual([2, 2, 1])
  })

  it('supports exact half and custom first-part splits', () => {
    expect(
      splitTxtFile({ fileName: 'a.txt', text: '1\n2\n3\n4\n5' }, { mode: 'half' }).map(
        (file) => file.itemCount,
      ),
    ).toEqual([2, 3])

    expect(
      splitTxtFile(
        { fileName: 'a.txt', text: '1\n2\n3\n4\n5' },
        { mode: 'custom-first', firstPartLines: 4 },
      ).map((file) => file.itemCount),
    ).toEqual([4, 1])
  })

  it('merges sorted TXT files', () => {
    const output = mergeTxtFiles(
      [
        { fileName: 'A10.txt', text: '10' },
        { fileName: 'A2.txt', text: '2' },
      ],
      'merged',
    )

    expect(output.fileName).toBe('merged.txt')
    expect(output.content).toBe('2\n10\n')
  })
})
