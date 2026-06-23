import { describe, it, expect } from 'vitest'
import {
  isPTP,
  isJHA,
  isPermit,
  isIncident,
  SAFETY_TYPE_LABELS,
  RISK_COLORS,
  RISK_LABELS,
  PERMIT_STATUS_COLORS,
  INCIDENT_SEVERITY_COLORS,
  REVIEW_STATUS_COLORS,
  REVIEW_STATUS_LABELS,
} from '@/lib/safety-types'
import type { SafetyRecord, SafetyRecordType, RiskLevel, PermitStatus, ReviewStatus } from '@/lib/safety-types'
import type { IncidentSeverity } from '@/lib/safety-types'

function makeRecord(type: SafetyRecordType): SafetyRecord {
  return {
    id: 'test-001',
    type,
    createdBy: 'Alice',
    createdByEmail: null,
    createdAt: '2026-06-23T00:00:00Z',
    location: 'Site A',
    projectName: 'Test Project',
    syncStatus: 'pending',
    notionPageId: null,
    events: [],
  } as SafetyRecord
}

describe('safety-types', () => {
  describe('type guards', () => {
    it('isPTP identifies pre-task plans', () => {
      expect(isPTP(makeRecord('ptp'))).toBe(true)
      expect(isPTP(makeRecord('jha'))).toBe(false)
    })

    it('isJHA identifies job hazard analyses', () => {
      expect(isJHA(makeRecord('jha'))).toBe(true)
      expect(isJHA(makeRecord('ptp'))).toBe(false)
    })

    it('isPermit identifies all permit types', () => {
      expect(isPermit(makeRecord('height-permit'))).toBe(true)
      expect(isPermit(makeRecord('hot-work-permit'))).toBe(true)
      expect(isPermit(makeRecord('confined-space-permit'))).toBe(true)
      expect(isPermit(makeRecord('ptp'))).toBe(false)
      expect(isPermit(makeRecord('incident-report'))).toBe(false)
    })

    it('isIncident identifies incident reports', () => {
      expect(isIncident(makeRecord('incident-report'))).toBe(true)
      expect(isIncident(makeRecord('ptp'))).toBe(false)
    })
  })

  describe('SAFETY_TYPE_LABELS', () => {
    it('has labels for all 6 record types', () => {
      const types: SafetyRecordType[] = [
        'ptp', 'jha', 'height-permit', 'hot-work-permit',
        'confined-space-permit', 'incident-report',
      ]
      for (const t of types) {
        expect(SAFETY_TYPE_LABELS[t]).toBeTruthy()
      }
    })
  })

  describe('RISK_COLORS and RISK_LABELS', () => {
    it('has entries for all 4 risk levels', () => {
      const levels: RiskLevel[] = ['low', 'medium', 'high', 'critical']
      for (const l of levels) {
        expect(RISK_COLORS[l]).toBeTruthy()
        expect(RISK_LABELS[l]).toBeTruthy()
      }
    })
  })

  describe('PERMIT_STATUS_COLORS', () => {
    it('has colors for all statuses including expired', () => {
      const statuses: (PermitStatus | 'expired')[] = ['active', 'closed', 'revoked', 'expired']
      for (const s of statuses) {
        expect(PERMIT_STATUS_COLORS[s]).toBeTruthy()
      }
    })
  })

  describe('INCIDENT_SEVERITY_COLORS', () => {
    it('has colors for all severity levels', () => {
      const severities: IncidentSeverity[] = ['minor', 'moderate', 'serious', 'critical']
      for (const s of severities) {
        expect(INCIDENT_SEVERITY_COLORS[s]).toBeTruthy()
      }
    })
  })

  describe('REVIEW_STATUS_COLORS and REVIEW_STATUS_LABELS', () => {
    it('has entries for all review statuses', () => {
      const statuses: ReviewStatus[] = ['submitted', 'approved', 'rejected', 'recalled']
      for (const s of statuses) {
        expect(REVIEW_STATUS_COLORS[s]).toBeTruthy()
        expect(REVIEW_STATUS_LABELS[s]).toBeTruthy()
      }
    })
  })
})
