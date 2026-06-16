interface Props {
  name: string
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl'
  className?: string
}

const sizeMap: Record<NonNullable<Props['size']>, string> = {
  xs: 'text-sm',
  sm: 'text-base',
  md: 'text-[20px]',
  lg: 'text-2xl',
  xl: 'text-[32px]',
}

export default function Icon({ name, size = 'md', className = '' }: Props) {
  return (
    <span
      className={`material-icons select-none leading-none ${sizeMap[size]} ${className}`}
      aria-hidden="true"
    >
      {name}
    </span>
  )
}
