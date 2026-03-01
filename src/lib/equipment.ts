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
  return Array.from(new Set(equipmentData.map(e => e.category)))
}

export function searchEquipment(query: string): EquipmentItem[] {
  const q = query.toLowerCase()
  return equipmentData.filter(e =>
    e.name.toLowerCase().includes(q) ||
    e.category.toLowerCase().includes(q) ||
    e.oemManual.toLowerCase().includes(q)
  ).sort((a, b) => a.name.localeCompare(b.name))
}
