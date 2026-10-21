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

// Small area chart with a hover readout. The line is drawn from real points only.
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
    <div
      role="img"
      aria-label={summary}
      className="relative w-full touch-none"
      style={{ height }}
      onPointerMove={handleMove}
      onPointerLeave={() => setHover(null)}
    >
      <svg viewBox={`0 0 ${W} ${height}`} preserveAspectRatio="none" className="size-full overflow-visible" aria-hidden>
        <defs>
          <linearGradient id={gradientId} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="var(--cico-accent)" stopOpacity="0.28" />
            <stop offset="100%" stopColor="var(--cico-accent)" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={area} fill={`url(#${gradientId})`} />
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
            style={{ left: `clamp(48px, ${(x(hover) / W) * 100}%, calc(100% - 48px))` }}
          >
            {active.label} · {formatValue(active.value)}
          </span>
        </>
      )}
    </div>
  )
}
