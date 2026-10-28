import { useId, useState, type PointerEvent } from 'react'

export interface TrendPoint {
  label: string
  value: number
}

interface TrendAreaProps {
  points: TrendPoint[]
  formatValue: (value: number) => string
  height?: number
  // Text alternative for screen readers.
  summary: string
}

const W = 320

// Small area chart with a readout on hover, tap or horizontal drag. The line is drawn from
// real points only. Dashed lines mark the highest and lowest values, and the first and last
// dates are labelled, so the scale is readable without an axis.
export function TrendArea({ points, formatValue, height = 96, summary }: TrendAreaProps) {
  const gradientId = useId()
  const [hover, setHover] = useState<number | null>(null)
  if (points.length < 2) return null

  const values = points.map((p) => p.value)
  const min = Math.min(...values)
  const max = Math.max(...values)
  const span = max - min || Math.abs(max) || 1
  const pad = 8
  const x = (i: number) => (i / (points.length - 1)) * W
  const y = (v: number) => pad + (1 - (v - min) / span) * (height - pad * 2)
  const line = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(p.value).toFixed(1)}`).join(' ')
  const area = `${line} L${W},${height} L0,${height} Z`

  function handleMove(e: PointerEvent<HTMLDivElement>) {
    const rect = e.currentTarget.getBoundingClientRect()
    const ratio = Math.min(Math.max((e.clientX - rect.left) / rect.width, 0), 1)
    setHover(Math.round(ratio * (points.length - 1)))
  }

  const active = hover === null ? null : points[hover]

  return (
    <div className="w-full">
      <div
        role="img"
        aria-label={summary}
        // Vertical swipes still scroll the page; taps and sideways drags move the readout.
        className="relative w-full touch-pan-y"
        style={{ height }}
        onPointerDown={handleMove}
        onPointerMove={handleMove}
        onPointerLeave={(e) => e.pointerType === 'mouse' && setHover(null)}
      >
        <svg viewBox={`0 0 ${W} ${height}`} preserveAspectRatio="none" className="size-full overflow-visible" aria-hidden>
          <defs>
            <linearGradient id={gradientId} x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="var(--cico-accent)" stopOpacity="0.28" />
              <stop offset="100%" stopColor="var(--cico-accent)" stopOpacity="0" />
            </linearGradient>
          </defs>
          <path d={area} fill={`url(#${gradientId})`} />
          {max !== min &&
            [max, min].map((v) => (
              <line key={v} x1={0} x2={W} y1={y(v)} y2={y(v)} stroke="var(--cico-border)" strokeWidth="1" strokeDasharray="3 4" vectorEffect="non-scaling-stroke" />
            ))}
          <path d={line} fill="none" stroke="var(--cico-accent)" strokeWidth="2.25" vectorEffect="non-scaling-stroke" strokeLinejoin="round" strokeLinecap="round" />
          {hover !== null && (
            <line x1={x(hover)} x2={x(hover)} y1={0} y2={height} stroke="var(--cico-border)" strokeWidth="1" vectorEffect="non-scaling-stroke" />
          )}
        </svg>
        {active && hover !== null && (
          <>
            <span
              aria-hidden
              className="pointer-events-none absolute size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-surface bg-accent shadow"
              style={{ left: `${(x(hover) / W) * 100}%`, top: y(active.value) }}
            />
            <span
              aria-hidden
              className="pointer-events-none absolute -top-9 -translate-x-1/2 rounded-sm bg-ink px-2 py-1 text-xs whitespace-nowrap text-white tabular-nums"
              style={{ left: `clamp(76px, ${(x(hover) / W) * 100}%, calc(100% - 76px))` }}
            >
              {active.label} · {formatValue(active.value)}
            </span>
          </>
        )}
      </div>
      <div aria-hidden className="mt-2 text-xs text-ink-muted tabular-nums">
        <p className="flex justify-between gap-3">
          <span>{points[0].label}</span>
          <span>{points[points.length - 1].label}</span>
        </p>
        {max !== min && (
          <p className="mt-1">
            Low {formatValue(min)} · High {formatValue(max)}
          </p>
        )}
      </div>
    </div>
  )
}
