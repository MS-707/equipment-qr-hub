export interface ModuleTourStep {
  target: string
  title: string
  body: string
}

export interface ModuleTour {
  id: string
  route: string
  label: string
  steps: ModuleTourStep[]
}

import { dashboardTour } from './dashboard.tour'
import { equipmentDirTour } from './equipment-dir.tour'
import { equipmentDetailTour } from './equipment-detail.tour'
import { ptpTour } from './ptp.tour'
import { inspectionsTour } from './inspections.tour'
import { workOrdersTour } from './work-orders.tour'

export const MODULE_TOURS: ModuleTour[] = [
  dashboardTour,
  equipmentDirTour,
  equipmentDetailTour,
  ptpTour,
  inspectionsTour,
  workOrdersTour,
]

export function findTourForRoute(pathname: string): ModuleTour | undefined {
  return MODULE_TOURS.find((t) => {
    if (t.route.includes('[')) {
      const prefix = t.route.split('[')[0]
      return pathname.startsWith(prefix) && pathname !== prefix.slice(0, -1)
    }
    return pathname === t.route
  })
}
