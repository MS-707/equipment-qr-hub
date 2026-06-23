import { describe, it, expect } from 'vitest'
import { labelCls, inputCls, textareaCls } from '@/lib/form-styles'

describe('form-styles', () => {
  it('labelCls includes text-sm', () => {
    expect(labelCls).toContain('text-sm')
  })

  it('inputCls includes focus ring', () => {
    expect(inputCls).toContain('focus-visible:ring-2')
  })

  it('textareaCls extends inputCls', () => {
    expect(textareaCls).toContain('resize-none')
    expect(textareaCls).toContain('w-full')
  })
})
