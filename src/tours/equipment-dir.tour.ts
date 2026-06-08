import type { ModuleTour } from '.'

export const equipmentDirTour: ModuleTour = {
  id: 'equipment-dir',
  route: '/equipment',
  label: 'Equipment Directory tour',
  steps: [
    {
      target: '[data-tour-module="equip-search"]',
      title: 'Search Equipment',
      body: 'Type a name or number to find any piece of equipment on site.',
    },
    {
      target: '[data-tour-module="category-pills"]',
      title: 'Filter by Type',
      body: "Tap a category to show only that type. Tap 'All' to reset.",
    },
    {
      target: '[data-tour-module="equip-card"]',
      title: 'Equipment Cards',
      body: 'Tap any card to see training requirements, PM schedule, and compliance info. QR stickers on equipment bring you here too.',
    },
  ],
}
