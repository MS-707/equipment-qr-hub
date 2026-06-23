import { describe, it, expect } from 'vitest'
import {
  GHS_PICTOGRAM_LABELS,
  GHS_SECTION_TITLES,
  SIGNAL_WORD_STYLES,
} from '@/lib/sds-types'
import type { GhsPictogramCode, SignalWord } from '@/lib/sds-types'

describe('GHS_PICTOGRAM_LABELS', () => {
  const codes: GhsPictogramCode[] = ['GHS01', 'GHS02', 'GHS03', 'GHS04', 'GHS05', 'GHS06', 'GHS07', 'GHS08', 'GHS09']

  it('has labels for all 9 GHS codes', () => {
    expect(Object.keys(GHS_PICTOGRAM_LABELS).length).toBe(9)
    for (const code of codes) {
      expect(GHS_PICTOGRAM_LABELS[code]).toBeTruthy()
    }
  })
})

describe('GHS_SECTION_TITLES', () => {
  it('has 16 section titles', () => {
    expect(GHS_SECTION_TITLES.length).toBe(16)
  })

  it('starts with Identification', () => {
    expect(GHS_SECTION_TITLES[0]).toContain('Identification')
  })
})

describe('SIGNAL_WORD_STYLES', () => {
  const words: SignalWord[] = ['Danger', 'Warning', 'None']

  it('has styles for all signal words', () => {
    for (const word of words) {
      expect(SIGNAL_WORD_STYLES[word]).toBeTruthy()
    }
  })
})
