import TeamBadgeImage from './TeamBadgeImage'

const SIZE_MAP = {
  xs: { badge: 'sm', text: 'text-xs' },
  sm: { badge: 'sm', text: 'text-sm' },
  md: { badge: 'md', text: 'text-sm' },
} as const

interface Props {
  teamName: string
  badgeUrl?: string
  size?: keyof typeof SIZE_MAP
  align?: 'left' | 'right'
  className?: string
  textClassName?: string
}

export default function TeamNameInline({
  teamName,
  badgeUrl,
  size = 'sm',
  align = 'left',
  className = '',
  textClassName = '',
}: Props) {
  const { badge, text } = SIZE_MAP[size]
  const isRight = align === 'right'

  return (
    <div className={`flex items-center gap-2 min-w-0 ${isRight ? 'justify-end' : ''} ${className}`}>
      {!isRight && <TeamBadgeImage teamName={teamName} badgeUrl={badgeUrl} size={badge} className="shrink-0" />}
      <span className={`${text} font-medium truncate ${isRight ? 'text-right' : ''} ${textClassName}`}>
        {teamName}
      </span>
      {isRight && <TeamBadgeImage teamName={teamName} badgeUrl={badgeUrl} size={badge} className="shrink-0" />}
    </div>
  )
}
