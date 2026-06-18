import type { Match } from '../types/competition'

interface Props {
  year: number
  month: number  // 1-12
  matches: Match[]
  userTeamId: number
  currentDate: string
  selectedDate?: string | null
  onDayClick?: (date: string) => void
  onPrevMonth?: () => void
  onNextMonth?: () => void
}

const DAY_LABELS = ['Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sa', 'Do']

export const MONTH_NAMES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
]

function dateStr(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

export default function CalendarMonth({
  year,
  month,
  matches,
  userTeamId,
  currentDate,
  selectedDate,
  onDayClick,
  onPrevMonth,
  onNextMonth,
}: Props) {
  const daysInMonth = new Date(year, month, 0).getDate()
  const firstWeekday = new Date(year, month - 1, 1).getDay()
  const startOffset = (firstWeekday + 6) % 7

  // Pad end to complete the last grid row
  const totalCells = Math.ceil((startOffset + daysInMonth) / 7) * 7

  // Build match index: track user match type and any-match per date
  const matchByDate: Record<string, { userLeague: boolean; userCup: boolean; other: boolean }> = {}
  for (const m of matches) {
    if (!m.date) continue
    const y = parseInt(m.date.slice(0, 4), 10)
    const mo = parseInt(m.date.slice(5, 7), 10)
    if (y !== year || mo !== month) continue
    const isUser = m.homeTeamId === userTeamId || m.awayTeamId === userTeamId
    if (!matchByDate[m.date]) matchByDate[m.date] = { userLeague: false, userCup: false, other: false }
    if (isUser) {
      if (m.type === 'cup') matchByDate[m.date].userCup = true
      else matchByDate[m.date].userLeague = true
    } else {
      matchByDate[m.date].other = true
    }
  }

  const cells: (number | null)[] = [
    ...Array<null>(startOffset).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
    ...Array<null>(totalCells - startOffset - daysInMonth).fill(null),
  ]

  return (
    <div className="flex flex-col h-full">
      {/* Month navigation header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-700/50 shrink-0">
        <button
          onClick={onPrevMonth}
          className="flex items-center gap-1 px-3 py-1.5 rounded-full bg-gray-800 border border-gray-700/60 text-gray-400 hover:text-white hover:border-gray-600 text-xs transition-all"
        >
          <span className="material-icons select-none leading-none" style={{ fontSize: 14 }}>chevron_left</span>
          Anterior
        </button>

        <h2 className="text-amber-400 font-black text-xl italic tracking-wide select-none">
          {MONTH_NAMES[month - 1]} {year}
        </h2>

        <button
          onClick={onNextMonth}
          className="flex items-center gap-1 px-3 py-1.5 rounded-full bg-gray-800 border border-gray-700/60 text-gray-400 hover:text-white hover:border-gray-600 text-xs transition-all"
        >
          Siguiente
          <span className="material-icons select-none leading-none" style={{ fontSize: 14 }}>chevron_right</span>
        </button>
      </div>

      {/* Day-of-week labels */}
      <div className="grid grid-cols-7 shrink-0 border-b border-gray-700/30">
        {DAY_LABELS.map((d) => (
          <div key={d} className="text-center text-gray-600 text-[0.5625rem] font-bold uppercase tracking-widest py-2">
            {d}
          </div>
        ))}
      </div>

      {/* Grid — fills remaining height */}
      <div
        className="flex-1 grid grid-cols-7 gap-px bg-gray-700/20 min-h-0"
        style={{ gridTemplateRows: `repeat(${totalCells / 7}, 1fr)` }}
      >
        {cells.map((day, idx) => {
          if (day === null) {
            return <div key={`pad-${idx}`} className="bg-gray-900/60" />
          }

          const date = dateStr(year, month, day)
          const info = matchByDate[date]
          const hasUserLeagueMatch = info?.userLeague ?? false
          const hasUserCupMatch = info?.userCup ?? false
          const hasUserMatch = hasUserLeagueMatch || hasUserCupMatch
          const hasOtherMatch = info?.other ?? false
          const isToday = date === currentDate
          const isSelected = date === selectedDate
          const isPast = date < currentDate

          // Background priority: selected > cup > league > today > default
          let bgClass = 'bg-gray-900/80'
          let ringClass = ''
          if (isSelected) {
            bgClass = 'bg-blue-600'
          } else if (hasUserCupMatch) {
            bgClass = 'bg-yellow-900/60'
          } else if (hasUserLeagueMatch) {
            bgClass = 'bg-green-900/80'
          } else if (isToday) {
            bgClass = 'bg-amber-900/25'
            ringClass = 'ring-1 ring-inset ring-amber-500/50'
          }

          const isClickable = !!onDayClick
          const dimmed = isPast && !hasUserMatch && !isSelected

          return (
            <div
              key={date}
              onClick={() => onDayClick?.(date)}
              className={`relative overflow-hidden transition-all select-none
                ${bgClass} ${ringClass}
                ${isClickable ? 'cursor-pointer hover:brightness-110' : ''}
                ${dimmed ? 'opacity-35' : ''}`}
            >
              {/* Day number */}
              <span
                className={`absolute top-1.5 left-2 text-sm font-bold leading-none
                  ${isSelected ? 'text-white' : hasUserMatch ? 'text-green-100' : isToday ? 'text-amber-200' : 'text-gray-400'}`}
              >
                {day}
              </span>

              {/* Match icon — trophy for cup, ball for league */}
              {hasUserCupMatch && (
                <span
                  className="material-icons absolute bottom-5 right-2 text-white/20 select-none pointer-events-none"
                  style={{ fontSize: 28 }}
                >
                  emoji_events
                </span>
              )}
              {hasUserLeagueMatch && !hasUserCupMatch && (
                <span
                  className="material-icons absolute bottom-5 right-2 text-white/20 select-none pointer-events-none"
                  style={{ fontSize: 28 }}
                >
                  sports_soccer
                </span>
              )}

              {/* Other-match dot */}
              {hasOtherMatch && !hasUserMatch && (
                <div className="absolute bottom-2 right-2">
                  <span className="w-1 h-1 rounded-full bg-gray-500/60 block" />
                </div>
              )}

              {/* Bottom label */}
              <span
                className={`absolute bottom-1.5 left-2 text-[0.4rem] font-black uppercase tracking-widest leading-none
                  ${hasUserCupMatch
                    ? isSelected ? 'text-yellow-300/80' : 'text-yellow-400/70'
                    : hasUserLeagueMatch
                    ? isSelected ? 'text-green-300/80' : 'text-green-400/70'
                    : isSelected ? 'text-blue-200/60' : 'text-gray-700'}`}
              >
                {hasUserCupMatch ? 'Copa' : hasUserLeagueMatch ? 'Tu partido' : 'Libre'}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
