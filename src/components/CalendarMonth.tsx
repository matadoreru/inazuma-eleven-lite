import type { Match } from '../types/competition'

interface Props {
  year: number
  month: number
  matches: Match[]
  userTeamId: number
  currentDate: string
  selectedDate?: string | null
  onDayClick?: (date: string) => void
  onPrevMonth?: () => void
  onNextMonth?: () => void
  canGoPrev?: boolean
  canGoNext?: boolean
}

const DAY_LABELS = ['Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sa', 'Do']

export const MONTH_NAMES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
]

function dateStr(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

type MatchResult = 'win' | 'draw' | 'loss'

interface DayInfo {
  userLeague: boolean
  userCup: boolean
  other: boolean
  result: MatchResult | null
}

export default function CalendarMonth({
  year, month, matches, userTeamId, currentDate, selectedDate, onDayClick, onPrevMonth, onNextMonth,
  canGoPrev = true, canGoNext = true,
}: Props) {
  const daysInMonth = new Date(year, month, 0).getDate()
  const firstWeekday = new Date(year, month - 1, 1).getDay()
  const startOffset = (firstWeekday + 6) % 7
  const totalCells = Math.ceil((startOffset + daysInMonth) / 7) * 7

  const matchByDate: Record<string, DayInfo> = {}
  for (const m of matches) {
    if (!m.date) continue
    const y = parseInt(m.date.slice(0, 4), 10)
    const mo = parseInt(m.date.slice(5, 7), 10)
    if (y !== year || mo !== month) continue
    const isUser = m.homeTeamId === userTeamId || m.awayTeamId === userTeamId
    if (!matchByDate[m.date]) matchByDate[m.date] = { userLeague: false, userCup: false, other: false, result: null }
    if (isUser) {
      if (m.type === 'cup') matchByDate[m.date].userCup = true
      else matchByDate[m.date].userLeague = true

      if (m.played) {
        const isHome = m.homeTeamId === userTeamId
        const hg = m.homeGoals ?? 0
        const ag = m.awayGoals ?? 0
        if (hg === ag) matchByDate[m.date].result = 'draw'
        else if ((isHome && hg > ag) || (!isHome && ag > hg)) matchByDate[m.date].result = 'win'
        else matchByDate[m.date].result = 'loss'
      }
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
      {/* Month nav */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-gold-600/30 shrink-0 bg-dark-900/50">
        <button
          onClick={onPrevMonth}
          disabled={!canGoPrev}
          className={`flex items-center gap-1 px-3 py-1.5 rounded bg-dark-800/80 border border-gold-600/30 text-gold-500 hover:text-gold-300 hover:border-gold-500 text-[0.45rem] font-pixel uppercase tracking-wide transition-all ${!canGoPrev ? 'opacity-30 cursor-not-allowed pointer-events-none' : ''}`}
        >
          <span className="material-icons select-none leading-none" style={{ fontSize: 14 }}>chevron_left</span>
          Anterior
        </button>

        <h2 className="text-gold-400 font-pixel text-[0.55rem] uppercase tracking-widest select-none">
          {MONTH_NAMES[month - 1]} {year}
        </h2>

        <button
          onClick={onNextMonth}
          disabled={!canGoNext}
          className={`flex items-center gap-1 px-3 py-1.5 rounded bg-dark-800/80 border border-gold-600/30 text-gold-500 hover:text-gold-300 hover:border-gold-500 text-[0.45rem] font-pixel uppercase tracking-wide transition-all ${!canGoNext ? 'opacity-30 cursor-not-allowed pointer-events-none' : ''}`}
        >
          Siguiente
          <span className="material-icons select-none leading-none" style={{ fontSize: 14 }}>chevron_right</span>
        </button>
      </div>

      {/* Day labels */}
      <div className="grid grid-cols-7 shrink-0 border-b border-gold-600/20 bg-dark-900/40">
        {DAY_LABELS.map((d) => (
          <div key={d} className="text-center text-gold-700 text-[0.4rem] font-pixel uppercase tracking-widest py-1.5">
            {d}
          </div>
        ))}
      </div>

      {/* Grid */}
      <div
        className="flex-1 grid grid-cols-7 gap-px bg-gold-600/10 min-h-0"
        style={{ gridTemplateRows: `repeat(${totalCells / 7}, 1fr)` }}
      >
        {cells.map((day, idx) => {
          if (day === null) {
            return <div key={`pad-${idx}`} className="bg-dark-900/70" />
          }

          const date = dateStr(year, month, day)
          const info = matchByDate[date]
          const hasUserLeagueMatch = info?.userLeague ?? false
          const hasUserCupMatch = info?.userCup ?? false
          const hasUserMatch = hasUserLeagueMatch || hasUserCupMatch
          const result = info?.result ?? null
          const isToday = date === currentDate
          const isSelected = date === selectedDate
          const isPast = date < currentDate

          let bgClass = 'bg-dark-800/70'
          let ringClass = ''
          if (isSelected) {
            bgClass = 'bg-gold-600/30'
            ringClass = 'ring-1 ring-inset ring-gold-500'
          } else if (result === 'win') {
            bgClass = 'bg-green-900/50'
          } else if (result === 'draw') {
            bgClass = 'bg-gray-800/60'
          } else if (result === 'loss') {
            bgClass = 'bg-red-900/40'
          } else if (hasUserCupMatch) {
            bgClass = 'bg-yellow-900/50'
          } else if (hasUserLeagueMatch) {
            bgClass = 'bg-green-900/70'
          } else if (isToday) {
            bgClass = 'bg-dark-700/60'
            ringClass = 'ring-1 ring-inset ring-gold-600/50'
          }

          const isClickable = !!onDayClick
          const dimmed = isPast && !hasUserMatch && !isSelected

          const dayNumberColor = isSelected
            ? 'text-gold-300'
            : result === 'win' ? 'text-green-300'
            : result === 'draw' ? 'text-gray-300'
            : result === 'loss' ? 'text-red-300'
            : hasUserMatch ? 'text-green-100'
            : isToday ? 'text-gold-400'
            : 'text-gray-500'

          return (
            <div
              key={date}
              onClick={() => onDayClick?.(date)}
              className={`relative overflow-hidden transition-all select-none
                ${bgClass} ${ringClass}
                ${isClickable ? 'cursor-pointer hover:brightness-110' : ''}
                ${dimmed ? 'opacity-30' : ''}`}
            >
              <span className={`absolute top-1.5 left-2 text-sm font-bold leading-none ${dayNumberColor}`}>
                {day}
              </span>

              {/* Background icon */}
              {hasUserCupMatch && (
                <span className="material-icons absolute bottom-5 right-2 text-yellow-400/20 select-none pointer-events-none" style={{ fontSize: 28 }}>
                  emoji_events
                </span>
              )}
              {hasUserLeagueMatch && !hasUserCupMatch && (
                <span className={`material-icons absolute bottom-5 right-2 select-none pointer-events-none ${result ? 'text-white/10' : 'text-white/15'}`} style={{ fontSize: 28 }}>
                  sports_soccer
                </span>
              )}

              {/* Result badge (played matches) or label (upcoming) */}
              {hasUserMatch && (
                result ? (
                  <div className={`absolute bottom-1 left-1/2 -translate-x-1/2 w-4 h-4 rounded-full flex items-center justify-center text-[0.4rem] font-black text-white
                    ${result === 'win' ? 'bg-green-500' : result === 'draw' ? 'bg-gray-500' : 'bg-red-600'}`}
                  >
                    {result === 'win' ? 'V' : result === 'draw' ? 'D' : 'L'}
                  </div>
                ) : (
                  <span className={`absolute bottom-1.5 left-0 right-0 text-center text-[0.4rem] font-pixel uppercase tracking-wide leading-none
                    ${hasUserCupMatch ? 'text-yellow-300' : 'text-green-300'}`}>
                    {hasUserCupMatch ? 'Copa' : 'Partido'}
                  </span>
                )
              )}

              {!hasUserMatch && !isPast && (
                <span className="absolute bottom-1.5 left-0 right-0 text-center text-[0.35rem] text-gray-700 uppercase tracking-wide leading-none">
                  Libre
                </span>
              )}

              {info?.other && !hasUserMatch && (
                <div className="absolute bottom-6 right-1.5 flex gap-0.5">
                  <div className="w-1 h-1 rounded-full bg-dark-500/80" />
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
