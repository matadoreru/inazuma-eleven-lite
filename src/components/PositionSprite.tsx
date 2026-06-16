import type { Position } from '../types/player'

const SPRITE: Record<Position, string> = {
  GK: '/positions/PR.webp',
  DF: '/positions/DF.webp',
  MD: '/positions/MD.webp',
  FW: '/positions/DL.webp',
}

interface Props {
  position: Position
  size?: number  // px; default 32
  className?: string
}

export default function PositionSprite({ position, size = 32, className = '' }: Props) {
  return (
    <img
      src={SPRITE[position]}
      alt={position}
      width={size}
      height={size}
      className={`object-contain select-none ${className}`}
      draggable={false}
    />
  )
}
