import type { Element } from '../types/player'

interface Props {
  element: Element
  size?: 'xs' | 'sm' | 'md'
}

const imageMap: Record<Element, string> = {
  FIRE: '/elements/fire.webp',
  WOOD: '/elements/wood.webp',
  WIND: '/elements/wind.webp',
  MOUNTAIN: '/elements/mountain.webp',
}

const labelMap: Record<Element, string> = {
  FIRE: 'Fuego',
  WOOD: 'Bosque',
  WIND: 'Aire',
  MOUNTAIN: 'Tierra',
}

const colorMap: Record<Element, string> = {
  FIRE: 'bg-orange-500/20 text-orange-200',
  WOOD: 'bg-green-600/20 text-green-200',
  WIND: 'bg-sky-400/20 text-sky-200',
  MOUNTAIN: 'bg-stone-500/20 text-stone-200',
}

export default function ElementBadge({ element, size = 'md' }: Props) {
  if (size === 'xs') {
    return (
      <span className="inline-flex items-center justify-center w-5 h-5">
        <img src={imageMap[element]} alt={labelMap[element]} className="w-5 h-5 object-contain" />
      </span>
    )
  }

  const sizeClass = size === 'sm' ? 'text-xs px-1.5 py-0.5 gap-1' : 'text-sm px-2 py-0.5 gap-1.5'
  const imgSize = size === 'sm' ? 'w-3.5 h-3.5' : 'w-4 h-4'
  return (
    <span className={`inline-flex items-center font-semibold rounded ${sizeClass} ${colorMap[element]}`}>
      <img src={imageMap[element]} alt="" className={`${imgSize} object-contain`} />
      {labelMap[element]}
    </span>
  )
}
