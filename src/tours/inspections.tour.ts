import type { ModuleTour } from '.'

export const inspectionsTour: ModuleTour = {
  id: 'inspections',
  route: '/inspections',
  label: 'Pre-Trip Inspection tour',
  steps: [
    {
      target: '[data-tour-module="equip-dropdown"]',
      title: 'Select Equipment',
      body: 'Pick the vehicle or machine you are about to operate. Your last selection is remembered between sessions.',
    },
    {
      target: '[data-tour-module="inspector-form"]',
      title: 'Identify Yourself',
      body: 'Your name is pre-filled from your login. Select your shift and record the hour meter reading before starting.',
    },
    {
      target: '[data-tour-module="start-inspection"]',
      title: 'Start the Checklist',
      body: 'Once your info is filled in, tap here to begin. If this equipment requires authorization and you are not on the list, the button will be disabled.',
    },
    {
      target: '[data-tour-module="inspection-history"]',
      title: 'Past Inspections',
      body: 'Expand this to see the last 5 inspections for this unit — who inspected, when, and whether issues were found.',
    },
    {
      target: '[data-tour-module="equip-manuals"]',
      title: 'Need the Operator Manual?',
      body: "Go to Assets → tap this equipment → Training tab. You'll find the OEM manual as a downloadable PDF, plus required training topics.",
    },
    {
      target: '[data-tour-module="checklist-items"]',
      title: 'Inspection Checklist',
      body: 'Mark each item Pass, Fail, or N/A. Items tagged "Safety-critical" will take the unit out of service if they fail.',
    },
    {
      target: '[data-tour-module="inspection-photo"]',
      title: 'Capture Photos',
      body: 'When you mark an item as Fail, a camera icon appears. Tap it to photograph the defect — photos are attached to the inspection record.',
    },
    {
      target: '[data-tour-module="inspection-submit"]',
      title: 'Submit & Go',
      body: 'When every item is marked, tap Submit. A passing inspection clears you to operate. Critical failures generate a work order automatically.',
    },
  ],
}
