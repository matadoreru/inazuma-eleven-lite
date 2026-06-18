interface Props {
  steps: string[]
  current: number  // 0-based index
}

export default function StepperBar({ steps, current }: Props) {
  return (
    <div className="flex items-center justify-center gap-0 px-6 py-4 bg-dark-900/90 border-b border-gold-600/20">
      {steps.map((label, i) => {
        const isDone = i < current
        const isActive = i === current
        return (
          <div key={i} className="flex items-center">
            <div className="flex flex-col items-center gap-1">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-colors
                  ${isDone ? 'bg-gold-500 text-dark-900' : isActive ? 'bg-yellow-500 text-dark-900' : 'bg-dark-700/60 text-gray-400 border border-gold-600/20'}`}
              >
                {isDone ? '✓' : i + 1}
              </div>
              <span className={`text-xs font-medium ${isActive ? 'text-gold-300' : isDone ? 'text-gold-500' : 'text-gray-500'}`}>
                {label}
              </span>
            </div>
            {i < steps.length - 1 && (
              <div className={`h-0.5 w-16 mx-2 mb-4 ${i < current ? 'bg-gold-500' : 'bg-dark-700/60'}`} />
            )}
          </div>
        )
      })}
    </div>
  )
}
