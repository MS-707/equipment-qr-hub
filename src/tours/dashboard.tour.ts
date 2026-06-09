import type { ModuleTour } from '.'

export const dashboardTour: ModuleTour = {
  id: 'dashboard',
  route: '/',
  label: 'Safety Dashboard tour',
  steps: [
    {
      target: '[data-tour-module="ptp-status"]',
      title: "Today's PTP",
      body: "Shows whether your team has a Pre-Task Plan for today. If it says 'Not started,' tap Start PTP to begin one.",
    },
    {
      target: '[data-tour-module="quick-actions"]',
      title: 'Quick Actions',
      body: 'Tap any tile to start a Pre-Task Plan, open a permit, or file an incident report.',
    },
    {
      target: '[data-tour-module="active-permits"]',
      title: 'Active Permits',
      body: 'Open permits show up here with a countdown timer. Tap one to view details or close it out.',
    },
    {
      target: '[data-tour-module="recent-activity"]',
      title: 'Recent Activity',
      body: "Your last five safety records appear here. Tap 'View history' to see everything you've filed.",
    },
  ],
}
