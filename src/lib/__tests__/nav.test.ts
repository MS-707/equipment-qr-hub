import { describe, it, expect } from 'vitest'
import { isNavItemActive, NAV_ITEMS } from '../nav'

describe('isNavItemActive', () => {
  it('home is active on /', () => {
    expect(isNavItemActive('/', '/')).toBe(true)
  })

  it('home is active on /safety/*', () => {
    expect(isNavItemActive('/', '/safety/ptp')).toBe(true)
    expect(isNavItemActive('/', '/safety/history')).toBe(true)
    expect(isNavItemActive('/', '/safety/incident')).toBe(true)
  })

  it('home is not active on other routes', () => {
    expect(isNavItemActive('/', '/equipment')).toBe(false)
    expect(isNavItemActive('/', '/work-orders')).toBe(false)
  })

  it('prefix routes match correctly', () => {
    expect(isNavItemActive('/equipment', '/equipment')).toBe(true)
    expect(isNavItemActive('/equipment', '/equipment/EQ-001')).toBe(true)
    expect(isNavItemActive('/work-orders', '/work-orders')).toBe(true)
    expect(isNavItemActive('/sds', '/sds/SDS-001')).toBe(true)
  })

  it('prefix routes do not false-positive', () => {
    expect(isNavItemActive('/equipment', '/sds')).toBe(false)
    expect(isNavItemActive('/sds', '/equipment')).toBe(false)
  })
})

describe('NAV_ITEMS', () => {
  it('has home as first item', () => {
    expect(NAV_ITEMS[0].href).toBe('/')
    expect(NAV_ITEMS[0].label).toBe('Home')
  })

  it('all items have required fields', () => {
    for (const item of NAV_ITEMS) {
      expect(item.href).toBeTruthy()
      expect(item.label).toBeTruthy()
      expect(item.longLabel).toBeTruthy()
      expect(item.icon).toBeDefined()
    }
  })

  it('admin-only items are marked', () => {
    const adminItems = NAV_ITEMS.filter((i) => i.adminOnly)
    expect(adminItems.length).toBeGreaterThan(0)
    expect(adminItems[0].href).toBe('/admin/labels')
  })
})
