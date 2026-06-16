interface Props {
  teamId: number
  teamName: string
  size?: 'sm' | 'md' | 'lg'
}

const HUE_PALETTE = [
  'bg-red-600',
  'bg-orange-500',
  'bg-yellow-500',
  'bg-green-600',
  'bg-teal-500',
  'bg-blue-600',
  'bg-violet-600',
  'bg-pink-600',
]

const sizeMap = {
  sm: { circle: 'w-6 h-6 text-xs', text: 'text-xs' },
  md: { circle: 'w-8 h-8 text-sm', text: 'text-sm' },
  lg: { circle: 'w-12 h-12 text-lg', text: 'text-base' },
}

export default function TeamBadge({ teamId, teamName, size = 'md' }: Props) {
  const hue = HUE_PALETTE[teamId % 8]
  const { circle, text } = sizeMap[size]
  const initial = teamName.charAt(0).toUpperCase()

  return (
    <div className="flex items-center gap-2">
      <div className={`${circle} ${hue} rounded-full flex items-center justify-center font-bold text-white shrink-0`}>
        {initial}
      </div>
      <span className={`${text} text-white font-medium`}>{teamName}</span>
    </div>
  )
}
