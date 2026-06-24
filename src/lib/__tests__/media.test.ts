import { describe, it, expect } from 'vitest'
import { dataUrlBytes } from '../media'

describe('dataUrlBytes', () => {
  it('estimates byte size of a data URL', () => {
    const b64 = btoa('hello world')
    const dataUrl = `data:text/plain;base64,${b64}`
    const bytes = dataUrlBytes(dataUrl)
    expect(bytes).toBeGreaterThan(0)
    expect(bytes).toBeLessThanOrEqual(b64.length)
  })

  it('handles data URL without comma gracefully', () => {
    const bytes = dataUrlBytes('AAAA')
    expect(bytes).toBe(3)
  })

  it('estimates correctly for known base64 string', () => {
    const b64 = 'AAAA'
    const dataUrl = `data:image/jpeg;base64,${b64}`
    expect(dataUrlBytes(dataUrl)).toBe(3)
  })

  it('handles empty base64', () => {
    const dataUrl = 'data:image/jpeg;base64,'
    expect(dataUrlBytes(dataUrl)).toBe(0)
  })
})
