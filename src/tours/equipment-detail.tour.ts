import type { ModuleTour } from '.'

export const equipmentDetailTour: ModuleTour = {
  id: 'equipment-detail',
  route: '/equipment/[id]',
  label: 'Equipment Detail tour',
  steps: [
    {
      target: '[data-tour-module="status-badge"]',
      title: 'Equipment Status',
      body: 'Shows whether this equipment is active, down, or out of service. Admins can tap to update.',
    },
    {
      target: '[data-tour-module="detail-tabs"]',
      title: 'Info Tabs',
      body: 'Swipe or tap to switch between Safety, PM Schedule, Training, and Compliance.',
    },
    {
      target: '[data-tour-module="authorized-users"]',
      title: 'Who Can Operate',
      body: 'Team members cleared to use this equipment are listed here. Talk to your supervisor if your name is missing.',
    },
  ],
}
