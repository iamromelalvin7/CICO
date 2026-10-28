import type { ReactNode } from 'react'

export interface DonutSegment {
  key: string
  label: string
  value: number
  color: string
}

interface DonutChartProps {
  segments: DonutSegment[]
  // Highlights one segment (e.g. while its legend row is hovered); others fade.
  activeKey?: string | null
  onActiveChange?: (key: string | null) => void
  size?: number
  thickness?: number
  // Shown in the hole, e.g. the total.
  children?: ReactNode
}

const GAP = 1.6 // degrees between segments

// Decorative ring; pair it with a legend that lists every value as text.
export function DonutChart({
  segments,
  activeKey = null,
  onActiveChange,
  size = 168,
  thickness = 22,
  children,
}: DonutChartProps) {
  const r = (size - thickness) / 2
  const c = 2 * Math.PI * r
  const total = segments.reduce((sum, s) => sum + Math.max(s.value, 0), 0)
  const visible = segments.filter((s) => s.value > 0)
  const gap = visible.length > 1 ? (GAP / 360) * c : 0

  let offset = 0
  const arcs = visible.map((s) => {
    const length = (s.value / total) * c
    const arc = { ...s, dash: Math.max(length - gap, 0.5), offset }
    offset += length
    return arc
  })

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg aria-hidden width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={thickness} className="stroke-surface-muted" />
        {total > 0 &&
          arcs.map((a) => (
            <circle
              key={a.key}
              cx={size / 2}
              cy={size / 2}
              r={r}
              fill="none"
              stroke={a.color}
              strokeWidth={activeKey === a.key ? thickness + 4 : thickness}
              strokeDasharray={`${a.dash} ${c - a.dash}`}
              strokeDashoffset={-a.offset}
              // Hover follows the mouse; on touch, a tap selects a segment and a second tap clears it.
              onPointerEnter={(e) => e.pointerType === 'mouse' && onActiveChange?.(a.key)}
              onPointerLeave={(e) => e.pointerType === 'mouse' && onActiveChange?.(null)}
              onClick={() => onActiveChange?.(activeKey === a.key ? null : a.key)}
              className="cursor-pointer transition-[opacity,stroke-width] duration-200"
              style={{ opacity: activeKey && activeKey !== a.key ? 0.35 : 1 }}
            />
          ))}
      </svg>
      {children && (
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
          {children}
        </div>
      )}
    </div>
  )
}
