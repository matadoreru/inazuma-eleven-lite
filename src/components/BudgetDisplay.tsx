import { formatMoney } from '../utils/formatMoney'

interface Props {
  budget: number
  spent?: number
}

export default function BudgetDisplay({ budget, spent }: Props) {
  const remaining = spent !== undefined ? budget - spent : null

  return (
    <div className="flex flex-col">
      <div className="flex items-center gap-2">
        <span className="text-gray-400 text-xs">Budget</span>
        <span className="text-white font-bold">{formatMoney(budget)}</span>
      </div>
      {spent !== undefined && remaining !== null && (
        <div className="flex items-center gap-2">
          <span className="text-gray-400 text-xs">Spent</span>
          <span className="text-red-400 font-semibold text-sm">{formatMoney(spent)}</span>
          <span className="text-gray-500 text-xs">|</span>
          <span className="text-gray-400 text-xs">Left</span>
          <span
            className={`font-semibold text-sm ${remaining >= 0 ? 'text-green-400' : 'text-red-500'}`}
          >
            {formatMoney(remaining)}
          </span>
        </div>
      )}
    </div>
  )
}
