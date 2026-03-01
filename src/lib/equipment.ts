import { equipmentData } from '@/data/equipment'
import { EquipmentItem, EquipmentCategory } from '@/lib/types'

export function getAllEquipment(): EquipmentItem[] {
  return [...equipmentData].sort((a, b) => a.name.localeCompare(b.name))
}

export function getEquipmentById(itemNumber: number): EquipmentItem | undefined {
  return equipmentData.find(e => e.itemNumber === itemNumber)
}

export function getEquipmentByCategory(category: EquipmentCategory): EquipmentItem[] {
  return equipmentData.filter(e => e.category === category).sort((a, b) => a.name.localeCompare(b.name))
}

export function getCategories(): EquipmentCategory[] {
  // Sort by item count descending (largest categories first)
  const counts = new Map<EquipmentCategory, number>()
  for (const e of equipmentData) {
    counts.set(e.category, (counts.get(e.category) || 0) + 1)
  }
  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([cat]) => cat)
}

export function searchEquipment(query: string): EquipmentItem[] {
  const q = query.toLowerCase()
  return equipmentData.filter(e =>
    e.name.toLowerCase().includes(q) ||
    e.category.toLowerCase().includes(q) ||
    e.oemManual.toLowerCase().includes(q)
  ).sort((a, b) => a.name.localeCompare(b.name))
}
