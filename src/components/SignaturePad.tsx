'use client'

import { useRef, useEffect, useState, useCallback } from 'react'
import { Eraser, Maximize2, X } from 'lucide-react'
import { btnPrimaryCls } from '@/lib/form-styles'

interface SignaturePadProps {
  onChange: (dataUrl: string | null, isEmpty: boolean) => void
  height?: number
  className?: string
  penColor?: string
  signerName?: string
}

type Point = { x: number; y: number }

export default function SignaturePad({
  onChange,
  height = 200,
  className = '',
  penColor = '#FFFFFF',
  signerName,
}: SignaturePadProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const wrapRef = useRef<HTMLDivElement>(null)
  const drawing = useRef(false)
  const strokes = useRef<Point[][]>([])
  const current = useRef<Point[]>([])
  const [isEmpty, setIsEmpty] = useState(true)

  const dialogRef = useRef<HTMLDialogElement>(null)
  const expandedCanvasRef = useRef<HTMLCanvasElement>(null)
  const expandedWrapRef = useRef<HTMLDivElement>(null)
  const expandedDrawing = useRef(false)
  const expandedStrokes = useRef<Point[][]>([])
  const expandedCurrent = useRef<Point[]>([])
  const [expandedOpen, setExpandedOpen] = useState(false)
  const [expandedIsEmpty, setExpandedIsEmpty] = useState(true)

  const paintStrokesTo = useCallback(
    (ctx: CanvasRenderingContext2D, color: string, src: Point[][]) => {
      ctx.lineJoin = 'round'
      ctx.lineCap = 'round'
      ctx.lineWidth = 2.5
      ctx.strokeStyle = color
      ctx.fillStyle = color
      for (const stroke of src) {
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
    },
    [],
  )

  // Incremental drawing for the active stroke: pointermove strokes ONLY the
  // new segment instead of clearRect + replaying every stroke — a long
  // signature on a 3x-DPR canvas was O(points²) work and visibly stuttered
  // on older iPads. Full redraws remain for resize/clear/restore. Round
  // caps/joins at the same width make per-segment strokes visually identical
  // to a single stroked polyline.
  const drawSegment = useCallback(
    (canvas: HTMLCanvasElement | null, from: Point, to: Point) => {
      if (!canvas) return
      const ctx = canvas.getContext('2d')
      if (!ctx) return
      const dpr = window.devicePixelRatio || 1
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.lineJoin = 'round'
      ctx.lineCap = 'round'
      ctx.lineWidth = 2.5
      ctx.strokeStyle = penColor
      ctx.beginPath()
      ctx.moveTo(from.x, from.y)
      ctx.lineTo(to.x, to.y)
      ctx.stroke()
    },
    [penColor],
  )

  const drawDot = useCallback(
    (canvas: HTMLCanvasElement | null, p: Point) => {
      if (!canvas) return
      const ctx = canvas.getContext('2d')
      if (!ctx) return
      const dpr = window.devicePixelRatio || 1
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.fillStyle = penColor
      ctx.beginPath()
      ctx.arc(p.x, p.y, 1.2, 0, Math.PI * 2)
      ctx.fill()
    },
    [penColor],
  )

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
    paintStrokesTo(ctx, penColor, strokes.current)
  }, [height, penColor, paintStrokesTo])

  const redrawExpanded = useCallback(() => {
    const canvas = expandedCanvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const dpr = window.devicePixelRatio || 1
    const w = canvas.clientWidth || 1
    const h = canvas.clientHeight || 1
    const bw = Math.floor(w * dpr)
    const bh = Math.floor(h * dpr)
    if (canvas.width !== bw || canvas.height !== bh) {
      canvas.width = bw
      canvas.height = bh
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.clearRect(0, 0, w, h)
    paintStrokesTo(ctx, penColor, expandedStrokes.current)
  }, [penColor, paintStrokesTo])

  const exportPng = useCallback(
    (sourceStrokes: Point[][], sourceCanvas: HTMLCanvasElement | null): string | null => {
      if (!sourceCanvas) return null
      const out = document.createElement('canvas')
      out.width = sourceCanvas.width
      out.height = sourceCanvas.height
      const ctx = out.getContext('2d')
      if (!ctx) return null
      ctx.fillStyle = '#FFFFFF'
      ctx.fillRect(0, 0, out.width, out.height)
      const dpr = window.devicePixelRatio || 1
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      paintStrokesTo(ctx, '#1A1A1A', sourceStrokes)
      return out.toDataURL('image/png')
    },
    [paintStrokesTo],
  )

  useEffect(() => {
    redraw()
    const ro = new ResizeObserver(() => redraw())
    if (wrapRef.current) ro.observe(wrapRef.current)
    return () => ro.disconnect()
  }, [redraw])

  useEffect(() => {
    if (!expandedOpen) return
    const raf = requestAnimationFrame(() => redrawExpanded())
    const ro = new ResizeObserver(() => redrawExpanded())
    if (expandedWrapRef.current) ro.observe(expandedWrapRef.current)
    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
    }
  }, [expandedOpen, redrawExpanded])

  function pointFrom(e: React.PointerEvent, canvas: HTMLCanvasElement) {
    const rect = canvas.getBoundingClientRect()
    return { x: e.clientX - rect.left, y: e.clientY - rect.top }
  }

  function emit() {
    const empty = strokes.current.length === 0
    setIsEmpty(empty)
    onChange(empty ? null : exportPng(strokes.current, canvasRef.current), empty)
  }

  function handleDown(e: React.PointerEvent) {
    e.preventDefault()
    canvasRef.current?.setPointerCapture(e.pointerId)
    drawing.current = true
    const p = pointFrom(e, canvasRef.current!)
    current.current = [p]
    strokes.current.push(current.current)
    if (isEmpty) setIsEmpty(false)
    drawDot(canvasRef.current, p)
  }

  function handleMove(e: React.PointerEvent) {
    if (!drawing.current) return
    e.preventDefault()
    const p = pointFrom(e, canvasRef.current!)
    const prev = current.current[current.current.length - 1]
    current.current.push(p)
    drawSegment(canvasRef.current, prev, p)
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

  function scaleStrokes(src: Point[][], fromCanvas: HTMLCanvasElement, toCanvas: HTMLCanvasElement): Point[][] {
    const fw = fromCanvas.clientWidth || 1
    const fh = fromCanvas.clientHeight || 1
    const tw = toCanvas.clientWidth || 1
    const th = toCanvas.clientHeight || 1
    const sx = tw / fw
    const sy = th / fh
    return src.map((stroke) => stroke.map((p) => ({ x: p.x * sx, y: p.y * sy })))
  }

  function openExpanded() {
    const el = dialogRef.current
    if (!el) return
    if (canvasRef.current && expandedCanvasRef.current && strokes.current.length > 0) {
      expandedStrokes.current = scaleStrokes(strokes.current, canvasRef.current, expandedCanvasRef.current)
    } else {
      expandedStrokes.current = []
    }
    expandedCurrent.current = []
    setExpandedIsEmpty(expandedStrokes.current.length === 0)
    setExpandedOpen(true)
    el.showModal()
  }

  useEffect(() => {
    if (!expandedOpen) return
    if (
      canvasRef.current &&
      expandedCanvasRef.current &&
      strokes.current.length > 0 &&
      expandedStrokes.current.length === 0
    ) {
      expandedStrokes.current = scaleStrokes(strokes.current, canvasRef.current, expandedCanvasRef.current)
      setExpandedIsEmpty(false)
      redrawExpanded()
    }
  }, [expandedOpen, redrawExpanded])

  function closeExpanded() {
    dialogRef.current?.close()
    setExpandedOpen(false)
  }

  function clearExpanded() {
    expandedStrokes.current = []
    expandedCurrent.current = []
    setExpandedIsEmpty(true)
    redrawExpanded()
  }

  function saveExpanded() {
    if (expandedCanvasRef.current && canvasRef.current) {
      strokes.current = scaleStrokes(expandedStrokes.current, expandedCanvasRef.current, canvasRef.current)
      current.current = []
      redraw()
      const empty = strokes.current.length === 0
      setIsEmpty(empty)
      onChange(empty ? null : exportPng(strokes.current, canvasRef.current), empty)
    }
    closeExpanded()
  }

  function handleExpandedDown(e: React.PointerEvent) {
    e.preventDefault()
    expandedCanvasRef.current?.setPointerCapture(e.pointerId)
    expandedDrawing.current = true
    const p = pointFrom(e, expandedCanvasRef.current!)
    expandedCurrent.current = [p]
    expandedStrokes.current.push(expandedCurrent.current)
    if (expandedIsEmpty) setExpandedIsEmpty(false)
    drawDot(expandedCanvasRef.current, p)
  }

  function handleExpandedMove(e: React.PointerEvent) {
    if (!expandedDrawing.current) return
    e.preventDefault()
    const p = pointFrom(e, expandedCanvasRef.current!)
    const prev = expandedCurrent.current[expandedCurrent.current.length - 1]
    expandedCurrent.current.push(p)
    drawSegment(expandedCanvasRef.current, prev, p)
  }

  function handleExpandedUp() {
    if (!expandedDrawing.current) return
    expandedDrawing.current = false
  }

  useEffect(() => {
    const el = dialogRef.current
    if (!el) return
    function handleCancel(e: Event) {
      e.preventDefault()
      closeExpanded()
    }
    el.addEventListener('cancel', handleCancel)
    return () => el.removeEventListener('cancel', handleCancel)
  }, [])

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
          onClick={openExpanded}
          className="absolute top-2 right-2 p-1.5 rounded-md text-fg-3 hover:text-fg
                     hover:bg-white/10 transition-colors min-h-[44px] min-w-[44px]
                     flex items-center justify-center"
          aria-label="Expand signature pad"
        >
          <Maximize2 className="w-4 h-4" />
        </button>
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

      <dialog
        ref={dialogRef}
        className="backdrop:bg-black/70 bg-mytra-card border border-mytra-border rounded-2xl
                   shadow-pop w-[95vw] max-w-2xl animate-scaleIn
                   text-fg outline-none p-0 m-auto"
      >
        <div className="flex flex-col h-full">
          <div className="flex items-center justify-between px-4 pt-4 pb-2">
            <div>
              <h2 className="text-sm font-semibold text-fg">
                {signerName ? `Signature — ${signerName}` : 'Signature'}
              </h2>
            </div>
            <button
              type="button"
              onClick={closeExpanded}
              className="p-1.5 rounded-md text-fg-3 hover:text-fg
                         hover:bg-white/10 transition-colors min-h-[44px] min-w-[44px]
                         flex items-center justify-center"
              aria-label="Close without saving"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div
            ref={expandedWrapRef}
            className="relative mx-4 bg-mytra-input border border-mytra-border rounded-lg overflow-hidden"
            style={{ height: '50vh' }}
          >
            <canvas
              ref={expandedCanvasRef}
              className="w-full h-full"
              style={{ touchAction: 'none', display: 'block' }}
              onPointerDown={handleExpandedDown}
              onPointerMove={handleExpandedMove}
              onPointerUp={handleExpandedUp}
              onPointerLeave={handleExpandedUp}
            />
            {expandedIsEmpty && (
              <span className="pointer-events-none absolute inset-0 flex items-center justify-center text-sm text-fg-4">
                Sign here — finger or stylus
              </span>
            )}
          </div>

          <div className="flex gap-2 px-4 pt-3 pb-4">
            <button
              type="button"
              onClick={clearExpanded}
              className="flex-1 py-2.5 rounded-lg text-sm font-medium min-h-[44px]
                         bg-mytra-bg border border-mytra-border text-fg-2
                         hover:text-fg hover:bg-mytra-card-hover transition-colors
                         inline-flex items-center justify-center gap-1.5"
            >
              <Eraser className="w-4 h-4" /> Clear
            </button>
            <button
              type="button"
              onClick={saveExpanded}
              className={`${btnPrimaryCls} flex-1 py-2.5 text-sm font-medium min-h-[44px]`}
            >
              Save
            </button>
          </div>
        </div>
      </dialog>
    </div>
  )
}
