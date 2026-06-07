import { equipmentData } from '@/data/equipment'
import { EquipmentItem, EquipmentCategory, EquipmentStatus } from '@/lib/types'

const STATUS_OVERRIDES_KEY = 'eqr-status-overrides'

function readStatusOverrides(): Record<number, EquipmentStatus> {
  if (typeof window === 'undefined') return {}
  try {
    const raw = localStorage.getItem(STATUS_OVERRIDES_KEY)
    return raw ? JSON.parse(raw) : {}
  } catch {
    return {}
  }
}

function applyOverrides(items: EquipmentItem[]): EquipmentItem[] {
  const overrides = readStatusOverrides()
  if (Object.keys(overrides).length === 0) return items
  return items.map((e) => {
    const override = overrides[e.itemNumber]
    return override ? { ...e, status: override } : e
  })
}

export function getAllEquipment(): EquipmentItem[] {
  return applyOverrides([...equipmentData]).sort((a, b) => a.name.localeCompare(b.name))
}

export function getEquipmentById(itemNumber: number): EquipmentItem | undefined {
  const item = equipmentData.find(e => e.itemNumber === itemNumber)
  if (!item) return undefined
  const overrides = readStatusOverrides()
  const override = overrides[itemNumber]
  return override ? { ...item, status: override } : item
}

export function updateEquipmentStatus(itemNumber: number, status: EquipmentStatus): void {
  if (typeof window === 'undefined') return
  const overrides = readStatusOverrides()
  // If setting back to the original baked-in status, remove the override
  const original = equipmentData.find(e => e.itemNumber === itemNumber)
  if (original && original.status === status) {
    delete overrides[itemNumber]
  } else {
    overrides[itemNumber] = status
  }
  try { localStorage.setItem(STATUS_OVERRIDES_KEY, JSON.stringify(overrides)) } catch { /* non-fatal */ }
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
