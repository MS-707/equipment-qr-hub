import { describe, it, expect } from 'vitest'
import { getAllTrainingPrograms, getTrainingProgramById, getTrainingProgramsForEquipment } from '../training'

describe('getAllTrainingPrograms', () => {
  it('returns a non-empty array', () => {
    const programs = getAllTrainingPrograms()
    expect(Array.isArray(programs)).toBe(true)
    expect(programs.length).toBeGreaterThan(0)
  })

  it('each program has required fields', () => {
    const programs = getAllTrainingPrograms()
    for (const p of programs) {
      expect(p.programId).toBeTruthy()
      expect(p.title).toBeTruthy()
    }
  })
})

describe('getTrainingProgramById', () => {
  it('finds a program by ID', () => {
    const all = getAllTrainingPrograms()
    const first = all[0]
    const found = getTrainingProgramById(first.programId)
    expect(found?.programId).toBe(first.programId)
    expect(found?.title).toBe(first.title)
  })

  it('returns undefined for unknown ID', () => {
    expect(getTrainingProgramById('NONEXISTENT')).toBeUndefined()
  })
})

describe('getTrainingProgramsForEquipment', () => {
  it('returns empty array for unknown equipment', () => {
    const programs = getTrainingProgramsForEquipment(999999)
    expect(programs).toEqual([])
  })
})
