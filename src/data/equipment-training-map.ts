export const equipmentTrainingMap: Record<string, number[]> = {
  'TP-01': [1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,19,28,34,43,44],
  'TP-02': [6,7,8,9,32],
  'TP-03': [28],
  'TP-04': [21,22,23],
  'TP-05': [17,18],
  'TP-06': [29,30,31],
  'TP-07': [45],
  'TP-08': [43,44],
  'TP-09': [37,38],
}

export function getTrainingForEquipment(itemNumber: number): string[] {
  return Object.entries(equipmentTrainingMap)
    .filter(([, items]) => items.includes(itemNumber))
    .map(([programId]) => programId)
}
