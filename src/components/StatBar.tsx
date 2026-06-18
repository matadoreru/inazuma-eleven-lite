interface Props {
  label: string
  value: number
  max?: number
  color?: string  // optional Tailwind class override; omit for gradient
}

// Returns an inline HSL color transitioning red → amber → green based on ratio 0–1.
export function statColor(value: number, max: number): string {
  const ratio = Math.min(1, Math.max(0, value / max))
  const hue = Math.round(ratio * 120)   // 0 = red, 60 = amber, 120 = green
  return `hsl(${hue}, 65%, 42%)`
}

export default function StatBar({ label, value, max = 250, color }: Props) {
  const pct = Math.min(100, Math.round((value / max) * 100))
  const barStyle = color
    ? undefined
    : { background: statColor(value, max) }
  return (
    <div className="flex items-center gap-2 w-full">
      <span className="text-gray-400 text-xs w-8 shrink-0">{label}</span>
      <div className="flex-1 h-2 bg-dark-600/80 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full ${color ?? ''}`}
          style={{ width: `${pct}%`, ...barStyle }}
        />
      </div>
      <span className="text-white text-xs w-8 text-right shrink-0">{value}</span>
    </div>
  )
}
