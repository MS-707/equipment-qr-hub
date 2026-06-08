'use client'

import { useState, useMemo, useCallback } from 'react'
import { Filter, Download, AlertTriangle } from 'lucide-react'
import { WorkOrderStatus, PmType, STATUS_COLORS } from '@/lib/types'
import {
  getAllWorkOrders,
  getOverdueWorkOrders,
  exportToCsv,
} from '@/lib/work-orders'
import { getAllEquipment } from '@/lib/equipment'
import WorkOrderCard from '@/components/WorkOrderCard'
import PullToRefresh from '@/components/PullToRefresh'

const STATUSES: WorkOrderStatus[] = ['Not Started', 'In Progress', 'Complete']
const PM_TYPES: PmType[] = ['Daily', 'Weekly', 'Monthly', 'Quarterly', 'Semi-Annual', 'Annual']

export default function WorkOrderBoard() {
  const [refreshKey, setRefreshKey] = useState(0)
  const [filterEquipment, setFilterEquipment] = useState<number | 'all'>('all')
  const [filterPmType, setFilterPmType] = useState<PmType | 'all'>('all')
  const [showOverdueOnly, setShowOverdueOnly] = useState(false)

  const refresh = useCallback(() => setRefreshKey((k) => k + 1), [])

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const allOrders = useMemo(() => getAllWorkOrders(), [refreshKey])
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const overdueOrders = useMemo(() => getOverdueWorkOrders(), [refreshKey])
  const equipment = useMemo(() => getAllEquipment(), [])

  const filteredOrders = useMemo(() => {
    let orders = allOrders

    if (filterEquipment !== 'all') {
      orders = orders.filter((wo) => wo.equipmentId === filterEquipment)
    }
    if (filterPmType !== 'all') {
      orders = orders.filter((wo) => wo.pmType === filterPmType)
    }
    if (showOverdueOnly) {
      const overdueIds = new Set(overdueOrders.map((wo) => wo.id))
      orders = orders.filter((wo) => overdueIds.has(wo.id))
    }

    return orders
  }, [allOrders, overdueOrders, filterEquipment, filterPmType, showOverdueOnly])

  const columns = useMemo(() => {
    const grouped: Record<WorkOrderStatus, typeof filteredOrders> = {
      'Not Started': [],
      'In Progress': [],
      'Complete': [],
    }
    for (const wo of filteredOrders) {
      grouped[wo.status].push(wo)
    }
    // Sort each column: overdue first, then by due date
    for (const status of STATUSES) {
      grouped[status].sort((a, b) => {
        const today = new Date().toISOString().split('T')[0]
        const aOverdue = a.status !== 'Complete' && a.dueDate && a.dueDate < today
        const bOverdue = b.status !== 'Complete' && b.dueDate && b.dueDate < today
        if (aOverdue && !bOverdue) return -1
        if (!aOverdue && bOverdue) return 1
        if (a.dueDate && b.dueDate) return a.dueDate.localeCompare(b.dueDate)
        if (a.dueDate) return -1
        if (b.dueDate) return 1
        return 0
      })
    }
    return grouped
  }, [filteredOrders])

  function handleExport() {
    const csv = exportToCsv(allOrders)
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `work-orders-${new Date().toISOString().split('T')[0]}.csv`
    a.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }

  return (
    <PullToRefresh onRefresh={refresh}>
    <div className="space-y-4">
      {/* Filters */}
      <div className="no-print flex flex-wrap items-center gap-2">
        <Filter className="w-4 h-4 text-fg-4 shrink-0" />

        <select
          value={filterEquipment}
          onChange={(e) =>
            setFilterEquipment(e.target.value === 'all' ? 'all' : Number(e.target.value))
          }
          aria-label="Filter by equipment"
          className="bg-mytra-input border border-mytra-border rounded-lg py-2.5 px-2.5
                     text-xs text-fg focus:outline-none focus:ring-1 focus:ring-mytra-purple
                     max-w-[200px] min-h-[44px]"
        >
          <option value="all">All Equipment</option>
          {equipment.map((e) => (
            <option key={e.itemNumber} value={e.itemNumber}>
              {e.name.length > 35 ? e.name.substring(0, 35) + '...' : e.name}
            </option>
          ))}
        </select>

        <select
          value={filterPmType}
          onChange={(e) =>
            setFilterPmType(e.target.value === 'all' ? 'all' : (e.target.value as PmType))
          }
          aria-label="Filter by PM type"
          className="bg-mytra-input border border-mytra-border rounded-lg py-2.5 px-2.5
                     text-xs text-fg focus:outline-none focus:ring-1 focus:ring-mytra-purple
                     min-h-[44px]"
        >
          <option value="all">All PM Types</option>
          {PM_TYPES.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>

        {overdueOrders.length > 0 && (
          <button
            onClick={() => setShowOverdueOnly(!showOverdueOnly)}
            className={`inline-flex items-center gap-1.5 text-xs font-medium px-3 py-2.5
                       rounded-lg transition-colors min-h-[44px] ${
                         showOverdueOnly
                           ? 'bg-danger/20 text-danger border border-danger/50'
                           : 'text-danger border border-mytra-border hover:bg-danger/10'
                       }`}
          >
            <AlertTriangle className="w-3 h-3" />
            {overdueOrders.length} Overdue
          </button>
        )}

        <button
          onClick={handleExport}
          className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-2.5
                     rounded-lg border border-mytra-border text-fg-3 min-h-[44px]
                     hover:text-fg hover:bg-mytra-card-hover transition-colors ml-auto"
        >
          <Download className="w-3 h-3" />
          Export CSV
        </button>
      </div>

      {/* Kanban columns */}
      {allOrders.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-12 h-12 rounded-full bg-mytra-card border border-mytra-border
                          flex items-center justify-center mb-3">
            <Filter className="w-5 h-5 text-fg-4" />
          </div>
          <p className="text-fg-3 text-sm font-medium">No work orders yet</p>
          <p className="text-fg-4 text-xs mt-1 max-w-sm">
            Create work orders from equipment profile pages. Go to any equipment item,
            open the PM Schedule tab, and click &quot;+ Work Order&quot; next to a PM type.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {STATUSES.map((status) => {
            const statusColor = STATUS_COLORS[status]
            const items = columns[status]

            return (
              <div key={status}>
                {/* Column header */}
                <div className="flex items-center gap-2 mb-3 pl-3 border-l-[3px]"
                     style={{ borderColor: statusColor }}>
                  <h2 className="text-sm font-semibold text-fg">{status}</h2>
                  <span
                    className="text-xs font-medium px-2 py-0.5 rounded-full"
                    style={{
                      backgroundColor: `${statusColor}18`,
                      color: statusColor,
                    }}
                  >
                    {items.length}
                  </span>
                </div>

                {/* Cards */}
                <div className="space-y-2">
                  {items.map((wo) => (
                    <WorkOrderCard key={wo.id} workOrder={wo} onUpdate={refresh} />
                  ))}
                  {items.length === 0 && (
                    <div className="bg-mytra-card border border-dashed border-mytra-border
                                    rounded-lg p-6 text-center">
                      <p className="text-fg-4 text-xs">No work orders</p>
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
    </PullToRefresh>
  )
}
