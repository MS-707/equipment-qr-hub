/**
 * SDS (Safety Data Sheet) — type definitions.
 *
 * Covers GHS-classified chemical hazard data for construction jobsites.
 * Each SdsRecord corresponds to one product's 16-section Safety Data Sheet.
 */

export type GhsPictogramCode =
  | 'GHS01' | 'GHS02' | 'GHS03' | 'GHS04' | 'GHS05'
  | 'GHS06' | 'GHS07' | 'GHS08' | 'GHS09'

export type SignalWord = 'Danger' | 'Warning' | 'None'

export interface FirstAidByRoute {
  inhalation: string
  skin: string
  eyes: string
  ingestion: string
}

export interface SdsSection {
  number: number
  title: string
  content: string
}

export interface SdsRecord {
  id: string
  productName: string
  manufacturer: string
  casNumbers: string[]
  signalWord: SignalWord
  pictograms: GhsPictogramCode[]
  hazardStatements: string[]
  precautionaryStatements: string[]
  firstAid: FirstAidByRoute
  ppeRequired: string[]
  fireExtinguishing: string
  spillProcedure: string
  storageHandling: string
  emergencyPhone: string
  sections: SdsSection[]
  isFavorite: boolean
  createdAt: string
  updatedAt: string
  notionPageId?: string | null
  syncStatus: 'pending' | 'synced' | 'failed' | 'offline'
  _searchIndex: string
}

// ── Display constants ───────────────────────────────────────

export const GHS_PICTOGRAM_LABELS: Record<GhsPictogramCode, string> = {
  GHS01: 'Explosive',
  GHS02: 'Flammable',
  GHS03: 'Oxidizer',
  GHS04: 'Compressed Gas',
  GHS05: 'Corrosive',
  GHS06: 'Acute Toxicity',
  GHS07: 'Irritant',
  GHS08: 'Health Hazard',
  GHS09: 'Environmental Hazard',
}

export const GHS_SECTION_TITLES: string[] = [
  'Identification',
  'Hazard(s) Identification',
  'Composition / Information on Ingredients',
  'First-Aid Measures',
  'Fire-Fighting Measures',
  'Accidental Release Measures',
  'Handling and Storage',
  'Exposure Controls / Personal Protection',
  'Physical and Chemical Properties',
  'Stability and Reactivity',
  'Toxicological Information',
  'Ecological Information',
  'Disposal Considerations',
  'Transport Information',
  'Regulatory Information',
  'Other Information',
]

export const SIGNAL_WORD_STYLES: Record<SignalWord, string> = {
  Danger: 'var(--danger)',
  Warning: 'var(--warn)',
  None: 'var(--fg-4)',
}
