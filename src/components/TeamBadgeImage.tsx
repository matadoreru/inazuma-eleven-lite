const SIZE_CLASSES = {
  xs: 'w-4 h-4',
  sm: 'w-8 h-8',
  overlay: 'w-9 h-9',
  event: 'w-14 h-14',
  header: 'w-16 h-16',
  md: 'w-12 h-12',
  lg: 'w-20 h-20',
  xl: 'w-28 h-28',
}

interface Props {
  teamName: string
  badgeUrl?: string
  size?: 'xs' | 'sm' | 'overlay' | 'event' | 'header' | 'md' | 'lg' | 'xl'
  className?: string
}

export default function TeamBadgeImage({ teamName, badgeUrl, size = 'md', className = '' }: Props) {
  const src = badgeUrl ?? '/teams/default_team_icon.png'
  return (
    <img
      src={src}
      alt={teamName}
      onError={(e) => { (e.currentTarget as HTMLImageElement).src = '/teams/default_team_icon.png' }}
      className={`${SIZE_CLASSES[size]} object-contain ${className}`}
    />
  )
}
