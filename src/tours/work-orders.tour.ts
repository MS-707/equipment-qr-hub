import type { ModuleTour } from '.'

export const workOrdersTour: ModuleTour = {
  id: 'work-orders',
  route: '/work-orders',
  label: 'Work Orders tour',
  steps: [
    {
      target: '[data-tour-module="wo-filters"]',
      title: 'Filter Orders',
      body: "Use filters to narrow by equipment or PM type. Tap 'Overdue' to see what needs attention first.",
    },
    {
      target: '[data-tour-module="wo-card"]',
      title: 'Work Order Card',
      body: 'Each card shows one PM task with its due date. Tap to expand and see the full task list.',
    },
    {
      target: '[data-tour-module="wo-status"]',
      title: 'Update Status',
      body: 'Tap the status chip to move a work order from Not Started to In Progress to Complete.',
    },
  ],
}
