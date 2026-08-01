import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'

/**
 * ES-M2-T7: "dark means invisible" as an asserted invariant, not a claim.
 *
 * Every converted call site carries the PRE-conversion English string as its
 * defaultEn argument. If the en catalog value ever drifts from that literal,
 * English output changed — the dark guarantee broke. This test diffs every
 * t('key', ..., 'literal') call and every label/labelKey data pair against
 * the catalog, so a drift fails `npm test` before it can ship.
 * (The rendered-DOM half of the invariant is e2e/en-pin.spec.ts.)
 */

import en from '@/messages/en.json'
import { NAV_ITEMS } from '@/lib/nav'

type Tree = { [k: string]: string | Tree }

function resolve(tree: Tree, key: string): string | undefined {
  let node: Tree | string | undefined = tree
  for (const part of key.split('.')) {
    if (typeof node !== 'object' || node === null) return undefined
    node = node[part]
  }
  return typeof node === 'string' ? node : undefined
}

const CONVERTED_FILES = [
  'src/components/BottomTabBar.tsx',
  'src/components/NavHeader.tsx',
  'src/components/UserMenu.tsx',
  'src/components/AuthGate.tsx',
  'src/components/SwUpdateBanner.tsx',
  'src/components/SyncToast.tsx',
  'src/components/StorageAlert.tsx',
  'src/components/ConfirmDialog.tsx',
  'src/components/safety/SafetyDashboard.tsx',
  'src/app/error.tsx',
  'src/app/not-found.tsx',
  'src/app/~offline/page.tsx',
  'src/lib/safety-sync.ts',
  'src/components/safety/ChipMultiSelect.tsx',
  'src/components/safety/PPESelector.tsx',
  'src/components/safety/HazardTable.tsx',
  'src/components/safety/PermitChecklist.tsx',
  'src/components/safety/PermitTimer.tsx',
  'src/components/safety/PermitStatusBadge.tsx',
  'src/components/safety/FormSuccess.tsx',
  'src/components/safety/ValidationSummary.tsx',
  'src/components/safety/CrewSignatureBlock.tsx',
  'src/components/SignaturePad.tsx',
  'src/components/safety/PreTaskPlanForm.tsx',
  'src/components/safety/JhaForm.tsx',
  'src/components/safety/IncidentReportForm.tsx',
  'src/components/safety/HeightPermitForm.tsx',
  'src/components/safety/HotWorkPermitForm.tsx',
  'src/components/safety/ConfinedSpaceForm.tsx',
  'src/components/PreTripInspection.tsx',
  'src/components/InspectLanding.tsx',
  'src/components/safety/RecordView.tsx',
  'src/components/safety/SafetyHistory.tsx',
  'src/components/safety/SafetyRecordCard.tsx',
  'src/components/safety/ReviewStatusSection.tsx',
  'src/components/safety/SyncQueuePanel.tsx',
  'src/lib/record-share.ts',
  'src/components/EquipmentProfile.tsx',
  'src/components/EquipmentCard.tsx',
  'src/components/PMSchedule.tsx',
  'src/components/PmTracker.tsx',
  'src/components/StatusToggle.tsx',
  'src/components/WorkOrderBoard.tsx',
  'src/components/WorkOrderCard.tsx',
  'src/components/TrainingTracker.tsx',
  'src/components/TrainingInfo.tsx',
  'src/components/ComplianceInfo.tsx',
  'src/components/QRLabel.tsx',
  'src/components/WorkOrdersHeader.tsx',
  'src/app/inspections/page.tsx',
]

// t('key', undefined|{...}, 'literal') / t('key', undefined, "literal")
const CALL_RE = /\bt\(\s*'([a-zA-Z0-9_.]+)'\s*,\s*(?:undefined|\{[^}]*\})\s*,\s*(['"])((?:\\.|(?!\2).)*)\2\s*\)/g

function unescape(s: string, quote: string): string {
  return s.split(`\\${quote}`).join(quote).split('\\\\').join('\\')
}

describe('defaultEn literals match the catalog byte-for-byte', () => {
  for (const file of CONVERTED_FILES) {
    it(file, () => {
      const src = readFileSync(file, 'utf8')
      const drift: string[] = []
      let m: RegExpExecArray | null
      while ((m = CALL_RE.exec(src)) !== null) {
        const [, key, quote, rawLiteral] = m
        const literal = unescape(rawLiteral, quote)
        const catalogValue = resolve(en as Tree, key)
        if (catalogValue !== literal) {
          drift.push(`${key}: catalog=${JSON.stringify(catalogValue)} defaultEn=${JSON.stringify(literal)}`)
        }
      }
      expect(drift).toEqual([])
    })
  }

  it('found a meaningful number of pinned call sites (regex not silently broken)', () => {
    let count = 0
    for (const file of CONVERTED_FILES) {
      const src = readFileSync(file, 'utf8')
      count += Array.from(src.matchAll(CALL_RE)).length
    }
    expect(count).toBeGreaterThan(40)
  })
})

describe('data-driven labels match their labelKey catalog values', () => {
  it('every NAV_ITEMS label/longLabel equals its catalog key value', () => {
    const drift = NAV_ITEMS.flatMap((item) => {
      const out: string[] = []
      if (resolve(en as Tree, item.labelKey) !== item.label) out.push(`${item.labelKey} != ${item.label}`)
      if (resolve(en as Tree, item.longLabelKey) !== item.longLabel) out.push(`${item.longLabelKey} != ${item.longLabel}`)
      return out
    })
    expect(drift).toEqual([])
  })

  it('every QUICK_ACTIONS label equals its catalog key value', () => {
    const src = readFileSync('src/components/safety/SafetyDashboard.tsx', 'utf8')
    const pairs = Array.from(src.matchAll(/label:\s*'([^']*)',\s*labelKey:\s*'([^']*)'/g), (m) => ({ label: m[1], key: m[2] }))
    expect(pairs.length).toBeGreaterThanOrEqual(8)
    const drift = pairs.filter((p) => resolve(en as Tree, p.key) !== p.label)
    expect(drift).toEqual([])
  })
})
