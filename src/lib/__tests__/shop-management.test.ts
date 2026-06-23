import { describe, it, expect, vi, beforeEach } from 'vitest'

const storage: Record<string, string> = {}
vi.stubGlobal('localStorage', {
  getItem: (k: string) => storage[k] ?? null,
  setItem: (k: string, v: string) => { storage[k] = v },
  removeItem: (k: string) => { delete storage[k] },
  clear: () => { for (const k in storage) delete storage[k] },
  get length() { return Object.keys(storage).length },
  key: (_i: number) => null as string | null,
})
vi.stubGlobal('window', globalThis)

beforeEach(() => {
  for (const k in storage) delete storage[k]
})

import {
  getAuthorization,
  getAllRestricted,
  setRestricted,
  addAuthorizedUser,
  removeAuthorizedUser,
  isUserAuthorized,
  getPmAssignment,
  getAllPmAssignments,
  setPmAssignment,
  removePmAssignment,
  getPmCompletions,
  getLatestPmCompletion,
  recordPmCompletion,
  isPmOverdue,
  getAllTrainingRecords,
  getTrainingForEmployee,
  addTrainingRecord,
  isTrainingCurrent,
  onShopMgmtChange,
  EMAIL_RE,
} from '@/lib/shop-management'

describe('shop-management', () => {
  describe('authorization', () => {
    it('returns unrestricted by default', () => {
      const auth = getAuthorization(101)
      expect(auth.restricted).toBe(false)
      expect(auth.authorizedUsers).toEqual([])
    })

    it('restricts equipment', () => {
      setRestricted(101, true)
      const auth = getAuthorization(101)
      expect(auth.restricted).toBe(true)
    })

    it('adds authorized user', () => {
      setRestricted(101, true)
      addAuthorizedUser(101, { email: 'worker@x.com', name: 'Worker' }, 'Admin')
      const auth = getAuthorization(101)
      expect(auth.authorizedUsers.length).toBe(1)
      expect(auth.authorizedUsers[0].email).toBe('worker@x.com')
      expect(auth.authorizedUsers[0].authorizedBy).toBe('Admin')
    })

    it('deduplicates authorized users by email', () => {
      setRestricted(101, true)
      addAuthorizedUser(101, { email: 'worker@x.com', name: 'Worker' }, 'Admin')
      addAuthorizedUser(101, { email: 'worker@x.com', name: 'Worker' }, 'Admin')
      const auth = getAuthorization(101)
      expect(auth.authorizedUsers.length).toBe(1)
    })

    it('removes authorized user', () => {
      setRestricted(101, true)
      addAuthorizedUser(101, { email: 'worker@x.com', name: 'Worker' }, 'Admin')
      removeAuthorizedUser(101, 'worker@x.com')
      const auth = getAuthorization(101)
      expect(auth.authorizedUsers.length).toBe(0)
    })

    it('isUserAuthorized returns true for unrestricted', () => {
      expect(isUserAuthorized(101, 'anyone@x.com')).toBe(true)
    })

    it('isUserAuthorized returns false for restricted + unauthorized', () => {
      setRestricted(101, true)
      expect(isUserAuthorized(101, 'random@x.com')).toBe(false)
    })

    it('isUserAuthorized returns true for restricted + authorized', () => {
      setRestricted(101, true)
      addAuthorizedUser(101, { email: 'worker@x.com', name: 'Worker' }, 'Admin')
      expect(isUserAuthorized(101, 'worker@x.com')).toBe(true)
    })

    it('isUserAuthorized returns false when email is null', () => {
      setRestricted(101, true)
      expect(isUserAuthorized(101, null)).toBe(false)
    })

    it('getAllRestricted returns only restricted items', () => {
      setRestricted(101, true)
      setRestricted(102, false)
      setRestricted(103, true)
      const restricted = getAllRestricted()
      expect(restricted.length).toBe(2)
      expect(restricted.map(r => r.itemNumber).sort()).toEqual([101, 103])
    })
  })

  describe('PM assignments', () => {
    it('returns null for unassigned equipment', () => {
      expect(getPmAssignment(101)).toBeNull()
    })

    it('sets and retrieves PM assignment', () => {
      setPmAssignment(101, { name: 'Alice', email: 'alice@x.com' })
      const a = getPmAssignment(101)
      expect(a).not.toBeNull()
      expect(a!.driName).toBe('Alice')
      expect(a!.driEmail).toBe('alice@x.com')
    })

    it('removes PM assignment', () => {
      setPmAssignment(101, { name: 'Alice', email: 'alice@x.com' })
      removePmAssignment(101)
      expect(getPmAssignment(101)).toBeNull()
    })

    it('getAllPmAssignments returns all', () => {
      setPmAssignment(101, { name: 'Alice', email: 'alice@x.com' })
      setPmAssignment(102, { name: 'Bob', email: null })
      const all = getAllPmAssignments()
      expect(Object.keys(all).length).toBe(2)
    })
  })

  describe('PM completions', () => {
    it('returns empty for no completions', () => {
      expect(getPmCompletions(101)).toEqual([])
    })

    it('records and retrieves PM completion', () => {
      recordPmCompletion({
        itemNumber: 101,
        frequency: 'Daily',
        completedBy: 'Alice',
        completedByEmail: 'alice@x.com',
        notes: 'All good',
      })
      const completions = getPmCompletions(101)
      expect(completions.length).toBe(1)
      expect(completions[0].completedBy).toBe('Alice')
    })

    it('getLatestPmCompletion filters by frequency', () => {
      recordPmCompletion({ itemNumber: 101, frequency: 'Daily', completedBy: 'A', completedByEmail: null, notes: '' })
      recordPmCompletion({ itemNumber: 101, frequency: 'Weekly', completedBy: 'B', completedByEmail: null, notes: '' })
      const daily = getLatestPmCompletion(101, 'Daily')
      expect(daily).not.toBeNull()
      expect(daily!.completedBy).toBe('A')
    })

    it('isPmOverdue returns true when no completions', () => {
      expect(isPmOverdue(101, 'Daily')).toBe(true)
    })

    it('isPmOverdue returns false when recently completed', () => {
      recordPmCompletion({ itemNumber: 101, frequency: 'Daily', completedBy: 'A', completedByEmail: null, notes: '' })
      expect(isPmOverdue(101, 'Daily')).toBe(false)
    })
  })

  describe('training records', () => {
    it('starts empty', () => {
      expect(getAllTrainingRecords()).toEqual([])
    })

    it('adds and retrieves training record', () => {
      addTrainingRecord({ employeeEmail: 'a@x.com', employeeName: 'Alice', topic: 'Forklift' })
      const records = getAllTrainingRecords()
      expect(records.length).toBe(1)
      expect(records[0].topic).toBe('Forklift')
    })

    it('filters training by employee', () => {
      addTrainingRecord({ employeeEmail: 'a@x.com', employeeName: 'Alice', topic: 'Forklift' })
      addTrainingRecord({ employeeEmail: 'b@x.com', employeeName: 'Bob', topic: 'Crane' })
      const forAlice = getTrainingForEmployee('a@x.com')
      expect(forAlice.length).toBe(1)
      expect(forAlice[0].topic).toBe('Forklift')
    })

    it('isTrainingCurrent returns false for no records', () => {
      expect(isTrainingCurrent('a@x.com', 'Forklift')).toBe(false)
    })

    it('isTrainingCurrent returns true for non-expiring', () => {
      addTrainingRecord({ employeeEmail: 'a@x.com', employeeName: 'Alice', topic: 'Forklift' })
      expect(isTrainingCurrent('a@x.com', 'Forklift')).toBe(true)
    })

    it('isTrainingCurrent returns false for expired', () => {
      addTrainingRecord({
        employeeEmail: 'a@x.com',
        employeeName: 'Alice',
        topic: 'Forklift',
        expiresAt: '2020-01-01T00:00:00Z',
      })
      expect(isTrainingCurrent('a@x.com', 'Forklift')).toBe(false)
    })

    it('isTrainingCurrent returns true for future expiry', () => {
      addTrainingRecord({
        employeeEmail: 'a@x.com',
        employeeName: 'Alice',
        topic: 'Forklift',
        expiresAt: '2099-01-01T00:00:00Z',
      })
      expect(isTrainingCurrent('a@x.com', 'Forklift')).toBe(true)
    })
  })

  describe('change notification', () => {
    it('notifies listeners on changes', () => {
      const listener = vi.fn()
      const unsub = onShopMgmtChange(listener)
      setRestricted(101, true)
      expect(listener).toHaveBeenCalledTimes(1)
      setPmAssignment(101, { name: 'A', email: null })
      expect(listener).toHaveBeenCalledTimes(2)
      unsub()
      setRestricted(102, true)
      expect(listener).toHaveBeenCalledTimes(2)
    })
  })

  describe('EMAIL_RE', () => {
    it('validates correct emails', () => {
      expect(EMAIL_RE.test('a@b.com')).toBe(true)
      expect(EMAIL_RE.test('user@domain.co.uk')).toBe(true)
    })

    it('rejects invalid emails', () => {
      expect(EMAIL_RE.test('not-an-email')).toBe(false)
      expect(EMAIL_RE.test('@missing.local')).toBe(false)
    })
  })
})
