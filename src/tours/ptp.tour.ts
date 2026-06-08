import type { ModuleTour } from '.'

export const ptpTour: ModuleTour = {
  id: 'ptp',
  route: '/safety/ptp',
  label: 'Pre-Task Plan tour',
  steps: [
    {
      target: '[data-tour-module="scope-of-work"]',
      title: 'Scope & Sage',
      body: "Describe today's job. Be specific — Sage uses this to suggest hazards and controls for you.",
    },
    {
      target: '[data-tour-module="hazard-table"]',
      title: 'Hazard Table',
      body: 'Each row is a hazard with a risk level and control measure. Add your own or keep what Sage suggests.',
    },
    {
      target: '[data-tour-module="ppe-selector"]',
      title: 'PPE Selection',
      body: 'Check off the protective equipment your crew needs for this job.',
    },
    {
      target: '[data-tour-module="crew-signon"]',
      title: 'Crew Sign-On',
      body: 'When the plan is ready, tap here to pass the device around for crew signatures.',
    },
  ],
}
