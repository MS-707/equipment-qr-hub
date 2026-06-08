import type { ModuleTour } from '.'

export const inspectionsTour: ModuleTour = {
  id: 'inspections',
  route: '/inspections',
  label: 'Pre-Trip Inspection tour',
  steps: [
    {
      target: '[data-tour-module="equip-dropdown"]',
      title: 'Select Equipment',
      body: 'Pick the vehicle or machine you are about to operate. Your last selection is remembered.',
    },
    {
      target: '[data-tour-module="checklist-items"]',
      title: 'Inspection Checklist',
      body: 'Mark each item Pass, Fail, or N/A. Safety-critical failures take the equipment out of service.',
    },
    {
      target: '[data-tour-module="inspection-photo"]',
      title: 'Capture Photos',
      body: 'If something looks wrong, tap the camera icon on that item to attach a photo.',
    },
    {
      target: '[data-tour-module="inspection-submit"]',
      title: 'Submit',
      body: 'When every item is marked, tap Submit to log the inspection. You cannot operate until it is submitted.',
    },
  ],
}
