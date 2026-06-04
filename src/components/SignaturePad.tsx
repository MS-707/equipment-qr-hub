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
  height = 180,
  className = '',
  penColor = '#FFFFFF',
}: SignaturePadProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const wrapRef = useRef<HTMLDivElement>(null)
  const drawing = useRef(false)
  const strokes = useRef<{ x: number; y: number }[][]>([])
  const current = useRef<{ x: number; y: number }[]>([])
  const [isEmpty, setIsEmpty] = useState(true)

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
    ctx.lineJoin = 'round'
    ctx.lineCap = 'round'
    ctx.lineWidth = 2.2
    ctx.strokeStyle = penColor
    ctx.fillStyle = penColor
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
  }, [height, penColor])

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
    const canvas = canvasRef.current
    const empty = strokes.current.length === 0
    setIsEmpty(empty)
    onChange(empty || !canvas ? null : canvas.toDataURL('image/png'), empty)
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
        <button
          type="button"
          onClick={clear}
          className="no-print absolute top-1.5 right-1.5 inline-flex items-center gap-1 text-[10px]
                     text-fg-2 hover:text-fg bg-mytra-bg/70 border border-mytra-border rounded px-1.5 py-0.5
                     transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-mytra-purple"
        >
          <Eraser className="w-3 h-3" /> Clear
        </button>
      </div>
    </div>
  )
}
