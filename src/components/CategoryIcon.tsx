import { createElement } from 'react'
import { categoryIcon } from '../lib/category-icons'

const SIZES = {
  sm: { box: 'size-8', icon: 'size-4' },
  md: { box: 'size-10', icon: 'size-[18px]' },
  lg: { box: 'size-12', icon: 'size-5' },
}

interface CategoryIconProps {
  id: string
  name: string
  color: string
  size?: keyof typeof SIZES
}

// Category icon on a soft tint of the category colour. Decorative: the name is always
// shown as text beside it.
export function CategoryIcon({ id, name, color, size = 'md' }: CategoryIconProps) {
  const s = SIZES[size]
  return (
    <span
      aria-hidden
      className={`flex ${s.box} shrink-0 items-center justify-center rounded-full`}
      style={{ backgroundColor: `color-mix(in srgb, ${color} 14%, white)`, color }}
    >
      {createElement(categoryIcon(id, name), { className: s.icon, strokeWidth: 2 })}
    </span>
  )
}
