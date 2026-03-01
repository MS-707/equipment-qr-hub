import { trainingProgramsData } from '@/data/training-programs'
import { getTrainingForEquipment } from '@/data/equipment-training-map'
import { TrainingProgram } from '@/lib/types'

export function getAllTrainingPrograms(): TrainingProgram[] {
  return trainingProgramsData
}

export function getTrainingProgramById(programId: string): TrainingProgram | undefined {
  return trainingProgramsData.find(p => p.programId === programId)
}

export function getTrainingProgramsForEquipment(itemNumber: number): TrainingProgram[] {
  const programIds = getTrainingForEquipment(itemNumber)
  return programIds
    .map(id => getTrainingProgramById(id))
    .filter((p): p is TrainingProgram => p !== undefined)
}
