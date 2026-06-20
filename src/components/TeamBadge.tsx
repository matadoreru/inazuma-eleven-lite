import { useEffect, useState } from 'react'
import type { Team } from '../types/team'
import Icon from './Icon'

type BadgeSize = 'sm' | 'md' | 'calendar' | 'lg'

const SIZE_CLASSES: Record<BadgeSize, string> = {
  sm: 'w-7 h-7',
  md: 'w-9 h-9',
  calendar: 'w-10 h-10',
  lg: 'w-12 h-12',
}

interface TeamBadgeProps {
  team?: Pick<Team, 'id' | 'name' | 'badgeUrl'>
  size?: BadgeSize
  className?: string
}

export default function TeamBadge({
  team,
  size = 'sm',
  className = '',
}: TeamBadgeProps) {
  const [imageFailed, setImageFailed] = useState(false)

  useEffect(() => {
    setImageFailed(false)
  }, [team?.id, team?.badgeUrl])

  const sizeClass = SIZE_CLASSES[size]

  if (!team?.badgeUrl || imageFailed) {
    return (
      <div
        className={`${sizeClass} shrink-0 rounded bg-dark-900 border border-gold-600/20 flex items-center justify-center ${className}`}
        title={team?.name ?? 'Equipo desconocido'}
      >
        <Icon name="shield" size="xs" className="text-gray-500" />
      </div>
    )
  }

  return (
    <img
      src={team.badgeUrl}
      alt={team.name}
      className={`${sizeClass} shrink-0 rounded object-contain ${className}`}
      onError={() => setImageFailed(true)}
    />
  )
}

