import type { Match } from '../types/competition'
import type { Team } from '../types/team'

interface Props {
  year: number
  month: number
  matches: Match[]
  teams: Team[]
  userTeamId: number
  currentDate: string
  selectedDate?: string | null
  onDayClick?: (date: string) => void
  onPrevMonth?: () => void
  onNextMonth?: () => void
  canGoPrev?: boolean
  canGoNext?: boolean
}

const DAY_LABELS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo']

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
  opponentBadgeUrl?: string
  opponentName?: string
}

export default function CalendarMonth({
  year, month, matches, teams, userTeamId, currentDate, selectedDate, onDayClick, onPrevMonth, onNextMonth,
  canGoPrev = true, canGoNext = true,
}: Props) {
  const daysInMonth = new Date(year, month, 0).getDate()
  const firstWeekday = new Date(year, month - 1, 1).getDay()
  const startOffset = (firstWeekday + 6) % 7
  const totalCells = Math.ceil((startOffset + daysInMonth) / 7) * 7

  const teamById = new Map(teams.map((team) => [team.id, team]))
  const matchByDate: Record<string, DayInfo> = {}
  for (const m of matches) {
    if (!m.date) continue
    const y = parseInt(m.date.slice(0, 4), 10)
    const mo = parseInt(m.date.slice(5, 7), 10)
    if (y !== year || mo !== month) continue
    const isUser = m.homeTeamId === userTeamId || m.awayTeamId === userTeamId
    if (!matchByDate[m.date]) matchByDate[m.date] = { userLeague: false, userCup: false, other: false, result: null }
    if (isUser) {
      const opponentId = m.homeTeamId === userTeamId ? m.awayTeamId : m.homeTeamId
      const opponent = teamById.get(opponentId)
      if (m.type === 'cup') matchByDate[m.date].userCup = true
      else matchByDate[m.date].userLeague = true
      matchByDate[m.date].opponentBadgeUrl = opponent?.badgeUrl
      matchByDate[m.date].opponentName = opponent?.name ?? `Equipo ${opponentId}`

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
    <div className="flex flex-col h-full bg-dark-900">
      {/* Month nav */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gold-600/40 shrink-0 bg-[#0d0d15] shadow-[0_8px_24px_rgba(0,0,0,0.25)] z-10">
        <button
          onClick={onPrevMonth}
          disabled={!canGoPrev}
          className={`flex items-center gap-1 px-3 py-2 rounded-md bg-dark-800 border border-gold-600/40 text-gold-400 hover:text-gold-300 hover:border-gold-500 hover:bg-dark-700 text-[0.45rem] font-pixel uppercase tracking-wide transition-all ${!canGoPrev ? 'opacity-30 cursor-not-allowed pointer-events-none' : ''}`}
        >
          <span className="material-icons select-none leading-none" style={{ fontSize: 14 }}>chevron_left</span>
          Anterior
        </button>

        <h2 className="text-gold-300 font-pixel text-[0.6rem] uppercase tracking-[0.18em] select-none">
          {MONTH_NAMES[month - 1]} {year}
        </h2>

        <button
          onClick={onNextMonth}
          disabled={!canGoNext}
          className={`flex items-center gap-1 px-3 py-2 rounded-md bg-dark-800 border border-gold-600/40 text-gold-400 hover:text-gold-300 hover:border-gold-500 hover:bg-dark-700 text-[0.45rem] font-pixel uppercase tracking-wide transition-all ${!canGoNext ? 'opacity-30 cursor-not-allowed pointer-events-none' : ''}`}
        >
          Siguiente
          <span className="material-icons select-none leading-none" style={{ fontSize: 14 }}>chevron_right</span>
        </button>
      </div>

      {/* Day labels */}
      <div className="grid grid-cols-7 shrink-0 border-b border-gold-600/30 bg-dark-800">
        {DAY_LABELS.map((d) => (
          <div key={d} className="text-center text-gray-300 text-[0.4rem] font-pixel uppercase tracking-widest py-2">
            {d}
          </div>
        ))}
      </div>

      {/* Grid */}
      <div
        className="flex-1 grid grid-cols-7 gap-px bg-gold-600/25 min-h-0"
        style={{ gridTemplateRows: `repeat(${totalCells / 7}, 1fr)` }}
      >
        {cells.map((day, idx) => {
          if (day === null) {
             return <div key={`pad-${idx}`} className="bg-[#09090f]" />
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

          let bgClass = 'bg-[#11111a]'
          let ringClass = ''
          if (isSelected) {
            bgClass = 'bg-[#211b13]'
            ringClass = 'ring-2 ring-inset ring-gold-400'
          } else if (isPast) {
            bgClass = 'bg-[#09090f]'
          } else if (result === 'win') {
            bgClass = 'bg-[#13251b]'
          } else if (result === 'draw') {
            bgClass = 'bg-[#242014]'
          } else if (result === 'loss') {
            bgClass = 'bg-[#291519]'
          } else if (hasUserCupMatch) {
            bgClass = 'bg-[#292110]'
          } else if (hasUserLeagueMatch) {
            bgClass = 'bg-[#13231c]'
          } else if (isToday) {
            bgClass = 'bg-[#191721]'
            ringClass = 'ring-1 ring-inset ring-gold-600/70'
          }

          const isClickable = !!onDayClick
          const dayNumberColor = isSelected
            ? 'text-gold-300'
            : result === 'win' ? 'text-green-300'
            : result === 'draw' ? 'text-amber-200'
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
                ${isClickable ? 'cursor-pointer hover:brightness-125 hover:z-[1]' : ''}`}
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

              {hasUserMatch && info?.opponentName && (
                <img
                  src={info.opponentBadgeUrl ?? '/teams/default_team_icon.png'}
                  alt={info.opponentName}
                  className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-[42%] w-11 h-11 object-contain rounded-lg bg-black/30 border border-white/5 p-1 opacity-100 shadow-lg"
                  onError={(e) => { (e.currentTarget as HTMLImageElement).src = '/teams/default_team_icon.png' }}
                />
              )}

              {/* Result badge (played matches) or label (upcoming) */}
              {hasUserMatch && (
                result ? (
                  <div className={`absolute bottom-1 left-1/2 -translate-x-1/2 w-4 h-4 rounded-full flex items-center justify-center text-[0.4rem] font-black text-white
                    ${result === 'win' ? 'bg-green-500' : result === 'draw' ? 'bg-amber-600' : 'bg-red-600'}`}
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
                <span className="absolute bottom-1.5 left-0 right-0 text-center text-[0.6rem] text-gray-600 uppercase tracking-widest leading-none">
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
