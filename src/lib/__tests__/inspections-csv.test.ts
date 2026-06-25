import { describe, it, expect } from 'vitest'
import { exportInspectionsToCsv } from '@/lib/inspections'
import type { InspectionRecord } from '@/lib/types'

const mockRecord: InspectionRecord = {
  id: 'INS-2026-0001',
  equipmentId: 101,
  inspectorName: 'Alice Smith',
  shift: 'Day',
  hourMeterReading: 1500,
  checklistType: 'electric-forklift',
  items: [
    { id: 'brake', label: 'Brakes', category: 'Brakes', result: 'pass', notes: '', critical: true, photo: null },
    { id: 'lights', label: 'Lights', category: 'Lights', result: 'fail', notes: 'Broken left headlight', critical: false, photo: null },
  ],
  result: 'fail',
  hasCriticalFail: false,
  criticalNaCount: 0,
  workOrderId: 'WO-2026-0001',
  createdAt: '2026-06-23T08:00:00Z',
  syncStatus: 'synced',
  notionPageId: null,
}

describe('exportInspectionsToCsv', () => {
  it('includes correct CSV headers', () => {
    const csv = exportInspectionsToCsv([mockRecord])
    const headers = csv.split('\n')[0]
    expect(headers).toContain('Inspection_ID')
    expect(headers).toContain('Equipment_ID')
    expect(headers).toContain('Inspector')
    expect(headers).toContain('Critical_Fail')
    expect(headers).toContain('Critical_NA')
    expect(headers).toContain('Failed_Items')
    expect(headers).toContain('NA_Critical_Items')
  })

  it('includes record data in CSV row', () => {
    const csv = exportInspectionsToCsv([mockRecord])
    const row = csv.split('\n')[1]
    expect(row).toContain('INS-2026-0001')
    expect(row).toContain('101')
    expect(row).toContain('Alice Smith')
    expect(row).toContain('fail')
  })

  it('lists failed items', () => {
    const csv = exportInspectionsToCsv([mockRecord])
    const row = csv.split('\n')[1]
    expect(row).toContain('Lights')
  })

  it('shows NO for non-critical fail', () => {
    const csv = exportInspectionsToCsv([mockRecord])
    const row = csv.split('\n')[1]
    expect(row).toContain('NO')
  })

  it('shows YES for critical fail', () => {
    const criticalRecord = { ...mockRecord, hasCriticalFail: true }
    const csv = exportInspectionsToCsv([criticalRecord])
    const row = csv.split('\n')[1]
    expect(row).toContain('YES')
  })

  it('handles empty array', () => {
    const csv = exportInspectionsToCsv([])
    const lines = csv.split('\n')
    expect(lines.length).toBe(1)
    expect(lines[0]).toContain('Inspection_ID')
  })

  it('escapes quotes in inspector name', () => {
    const record = { ...mockRecord, inspectorName: 'Alice "Al" Smith' }
    const csv = exportInspectionsToCsv([record])
    expect(csv).toContain('Alice ""Al"" Smith')
  })

  it('sanitizes CSV formula injection in inspector name', () => {
    const record = { ...mockRecord, inspectorName: '=CMD()' }
    const csv = exportInspectionsToCsv([record])
    expect(csv).toContain("\"'=CMD()\"")
  })

  it('shows NO for zero critical N/A', () => {
    const csv = exportInspectionsToCsv([mockRecord])
    const row = csv.split('\n')[1]
    const cols = row.split(',')
    const critNaCol = cols[8]
    expect(critNaCol).toContain('NO')
  })

  it('shows YES with count for critical N/A items', () => {
    const record: InspectionRecord = {
      ...mockRecord,
      criticalNaCount: 2,
      items: [
        { id: 'brake', label: 'Brakes', category: 'Brakes', result: 'na', notes: '', critical: true, photo: null, naReasonCode: 'not-installed', naJustification: 'Unit has no brakes' },
        { id: 'horn', label: 'Horn', category: 'Horn', result: 'na', notes: '', critical: true, photo: null, naReasonCode: 'cannot-access', naJustification: '' },
        { id: 'lights', label: 'Lights', category: 'Lights', result: 'pass', notes: '', critical: false, photo: null },
      ],
    }
    const csv = exportInspectionsToCsv([record])
    const row = csv.split('\n')[1]
    expect(row).toContain('YES (2)')
    expect(row).toContain('Brakes (not-installed')
    expect(row).toContain('Horn (cannot-access)')
  })
})
