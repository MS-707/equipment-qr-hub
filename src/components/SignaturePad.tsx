'use client'

import { useRef, useEffect, useState, useCallback } from 'react'
import { Eraser } from 'lucide-react'

interface SignaturePadProps {
  onChange: (dataUrl: string | null, isEmpty: boolean) => void
  height?: number
  className?: string
  penColor?: string
}

/**
 * Touch/stylus/mouse signature capture on a high-DPI canvas. No external library.
 * Strokes are kept in memory so the drawing survives resize; export is PNG.
 */
export default function SignaturePad({
  onChange,
  height = 200,
  className = '',
  penColor = '#FFFFFF',
}: SignaturePadProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const wrapRef = useRef<HTMLDivElement>(null)
  const drawing = useRef(false)
  const strokes = useRef<{ x: number; y: number }[][]>([])
  const current = useRef<{ x: number; y: number }[]>([])
  const [isEmpty, setIsEmpty] = useState(true)

  const paintStrokes = useCallback((ctx: CanvasRenderingContext2D, color: string) => {
    ctx.lineJoin = 'round'
    ctx.lineCap = 'round'
    ctx.lineWidth = 2.5
    ctx.strokeStyle = color
    ctx.fillStyle = color
    for (const stroke of strokes.current) {
      if (stroke.length === 1) {
        ctx.beginPath()
        ctx.arc(stroke[0].x, stroke[0].y, 1.2, 0, Math.PI * 2)
        ctx.fill()
        continue
      }
      ctx.beginPath()
      ctx.moveTo(stroke[0].x, stroke[0].y)
      for (let i = 1; i < stroke.length; i++) ctx.lineTo(stroke[i].x, stroke[i].y)
      ctx.stroke()
    }
  }, [])

  const redraw = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const dpr = window.devicePixelRatio || 1
    const w = canvas.clientWidth || 1
    const h = height
    const bw = Math.floor(w * dpr)
    const bh = Math.floor(h * dpr)
    if (canvas.width !== bw || canvas.height !== bh) {
      canvas.width = bw
      canvas.height = bh
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.clearRect(0, 0, w, h)
    paintStrokes(ctx, penColor)
  }, [height, penColor, paintStrokes])

  // Exported PNG is dark ink on opaque white so signatures stay legible when
  // records are printed (print CSS forces white paper) or viewed in light theme.
  // The live pad still draws in penColor over the app's dark input background.
  const exportPng = useCallback((): string | null => {
    const canvas = canvasRef.current
    if (!canvas) return null
    const out = document.createElement('canvas')
    out.width = canvas.width
    out.height = canvas.height
    const ctx = out.getContext('2d')
    if (!ctx) return null
    ctx.fillStyle = '#FFFFFF'
    ctx.fillRect(0, 0, out.width, out.height)
    const dpr = window.devicePixelRatio || 1
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    paintStrokes(ctx, '#1A1A1A')
    return out.toDataURL('image/png')
  }, [paintStrokes])

  useEffect(() => {
    redraw()
    const ro = new ResizeObserver(() => redraw())
    if (wrapRef.current) ro.observe(wrapRef.current)
    return () => ro.disconnect()
  }, [redraw])

  function pointFrom(e: React.PointerEvent) {
    const canvas = canvasRef.current!
    const rect = canvas.getBoundingClientRect()
    return { x: e.clientX - rect.left, y: e.clientY - rect.top }
  }

  function emit() {
    const empty = strokes.current.length === 0
    setIsEmpty(empty)
    onChange(empty ? null : exportPng(), empty)
  }

  function handleDown(e: React.PointerEvent) {
    e.preventDefault()
    canvasRef.current?.setPointerCapture(e.pointerId)
    drawing.current = true
    current.current = [pointFrom(e)]
    strokes.current.push(current.current)
    if (isEmpty) setIsEmpty(false)
    redraw()
  }

  function handleMove(e: React.PointerEvent) {
    if (!drawing.current) return
    e.preventDefault()
    current.current.push(pointFrom(e))
    redraw()
  }

  function handleUp() {
    if (!drawing.current) return
    drawing.current = false
    emit()
  }

  function clear() {
    strokes.current = []
    current.current = []
    redraw()
    emit()
  }

  return (
    <div className={className}>
      <div
        ref={wrapRef}
        className="relative bg-mytra-input border border-mytra-border rounded-lg overflow-hidden"
        style={{ height }}
        role="img"
        aria-label="Signature pad — draw your signature with finger or stylus"
      >
        <canvas
          ref={canvasRef}
          className="w-full"
          style={{ touchAction: 'none', height, display: 'block' }}
          onPointerDown={handleDown}
          onPointerMove={handleMove}
          onPointerUp={handleUp}
          onPointerLeave={handleUp}
        />
        {isEmpty && (
          <span className="pointer-events-none absolute inset-0 flex items-center justify-center text-xs text-fg-4">
            Sign here — finger or stylus
          </span>
        )}
      </div>
      {!isEmpty && (
        <button
          type="button"
          onClick={clear}
          className="no-print mt-2 inline-flex items-center gap-1 text-xs
                     text-fg-3 hover:text-fg transition-colors min-h-[44px] px-2 -ml-2"
        >
          <Eraser className="w-3 h-3" /> Clear signature
        </button>
      )}
    </div>
  )
}
