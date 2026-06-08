import type { ModuleTour } from '.'

export const jhaTour: ModuleTour = {
  id: 'jha',
  route: '/safety/jha',
  label: 'Job Hazard Analysis tour',
  steps: [
    {
      target: '[data-tour-module="jha-info"]',
      title: 'Job Information',
      body: 'Start by naming the job and where it happens. A JHA is a deeper, step-by-step breakdown of a task — distinct from the daily Pre-Task Plan.',
    },
    {
      target: '[data-tour-module="jha-steps"]',
      title: 'Break Down the Steps',
      body: 'List the job in the order you will actually do it — one step per row. Get all the steps down first; you can reorder and add more anytime.',
    },
    {
      target: '[data-tour-module="jha-steps"]',
      title: 'Let Sage Help',
      body: 'Once your steps are listed, tap "Ask Sage to analyze steps". Sage suggests the hazards, a risk rating, and controls for each step — then you review and edit before submitting to EHS.',
    },
  ],
}
