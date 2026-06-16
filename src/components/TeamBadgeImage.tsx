const SIZE_CLASSES = {
  sm: 'w-8 h-8',
  md: 'w-12 h-12',
  lg: 'w-20 h-20',
  xl: 'w-28 h-28',
}

interface Props {
  teamName: string
  badgeUrl?: string
  size?: 'sm' | 'md' | 'lg' | 'xl'
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
