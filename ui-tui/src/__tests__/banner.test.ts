import { describe, expect, it } from 'vitest'

import { caduceus } from '../banner.js'
import type { ThemeColors } from '../theme.js'

const colors = {
  primary: '#primary',
  accent: '#accent',
  border: '#border',
  text: '#text',
  muted: '#muted',
  completionBg: '#completionBg',
  completionCurrentBg: '#completionCurrentBg',
  completionMetaBg: '#completionMetaBg',
  completionMetaCurrentBg: '#completionMetaCurrentBg',
  label: '#label',
  ok: '#ok',
  error: '#error',
  warn: '#warn',
  prompt: '#prompt',
  sessionLabel: '#sessionLabel',
  sessionBorder: '#sessionBorder',
  statusBg: '#statusBg',
  statusFg: '#statusFg',
  statusGood: '#statusGood',
  statusWarn: '#statusWarn',
  statusBad: '#statusBad',
  statusCritical: '#statusCritical',
  selectionBg: '#selectionBg',
  diffAdded: '#diffAdded',
  diffRemoved: '#diffRemoved',
  diffAddedWord: '#diffAddedWord',
  diffRemovedWord: '#diffRemovedWord',
  shellDollar: '#shellDollar'
} satisfies ThemeColors

describe('custom hero art', () => {
  it('applies the profile hero gradient to plain custom banner art while preserving caduceus space', () => {
    const lines = caduceus(colors, 'ONLY\nONE\nPROMPT\nAWAY')

    const width = Math.max(...lines.map(([, text]) => text.length))

    expect(lines).toHaveLength(15)
    expect(lines.every(([, text]) => text.length === width)).toBe(true)
    expect(width).toBeLessThanOrEqual(28)
    expect(lines.slice(0, 4).map(([, text]) => text.trim())).toEqual(['ONLY', 'ONE', 'PROMPT', 'AWAY'])
    expect(lines.slice(0, 4).map(([color]) => color)).toEqual(['#border', '#border', '#accent', '#accent'])
  })

  it('preserves plain-art trailing cells so rows can be intentionally biased', () => {
    const lines = caduceus(colors, 'TOP\nLOWER  ')
    const leadingCells = (text: string) => text.match(/^ */)?.[0].length ?? 0

    expect(leadingCells(lines[1]![1])).toBeLessThan(leadingCells(lines[0]![1]))
  })

  it('preserves explicitly rich-colored custom hero art', () => {
    expect(caduceus(colors, '[#123456]ONLY[/]')).toEqual([['#123456', 'ONLY']])
  })
})
