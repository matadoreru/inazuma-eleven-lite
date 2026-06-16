interface Props {
  budget: number
  spent?: number
}

function formatCurrency(amount: number): string {
  if (Math.abs(amount) >= 1_000_000) {
    return `€${(amount / 1_000_000).toFixed(1)}M`
  }
  if (Math.abs(amount) >= 1_000) {
    return `€${(amount / 1_000).toFixed(0)}K`
  }
  return `€${amount}`
}

export default function BudgetDisplay({ budget, spent }: Props) {
  const remaining = spent !== undefined ? budget - spent : null

  return (
    <div className="flex flex-col">
      <div className="flex items-center gap-2">
        <span className="text-gray-400 text-xs">Budget</span>
        <span className="text-white font-bold">{formatCurrency(budget)}</span>
      </div>
      {spent !== undefined && remaining !== null && (
        <div className="flex items-center gap-2">
          <span className="text-gray-400 text-xs">Spent</span>
          <span className="text-red-400 font-semibold text-sm">{formatCurrency(spent)}</span>
          <span className="text-gray-500 text-xs">|</span>
          <span className="text-gray-400 text-xs">Left</span>
          <span
            className={`font-semibold text-sm ${remaining >= 0 ? 'text-green-400' : 'text-red-500'}`}
          >
            {formatCurrency(remaining)}
          </span>
        </div>
      )}
    </div>
  )
}
