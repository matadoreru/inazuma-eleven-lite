import type { Match } from '../types/competition'
import Icon from './Icon'

interface Props {
  currentDate: string
  teamId: number
  matches: Match[]
  cupMatches?: Match[]
  onAdvanceDay: () => void
  onAdvanceToNextMatch: () => void
  hasNextMatch: boolean
}

const DAY_LABELS = ['L', 'M', 'X', 'J', 'V', 'S', 'D']
const DAY_NAMES = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo']

function getWeekDays(dateStr: string): string[] {
  const date = new Date(dateStr)
  const day = date.getDay()
  const monday = new Date(date)
  monday.setDate(date.getDate() - (day === 0 ? 6 : day - 1))
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday)
    d.setDate(monday.getDate() + i)
    return d.toISOString().split('T')[0]
  })
}

function formatShortDate(dateStr: string): string {
  const [, month, day] = dateStr.split('-')
  return `${day}/${month}`
}

export default function DayAdvancePanel({
  currentDate, teamId, matches, cupMatches = [], onAdvanceDay, onAdvanceToNextMatch, hasNextMatch,
}: Props) {
  const weekDays = getWeekDays(currentDate)
  const allMatches = [...matches, ...cupMatches]
  const matchDates = new Set(
    allMatches
      .filter((m) => !m.played && (m.homeTeamId === teamId || m.awayTeamId === teamId))
      .map((m) => m.date),
  )
  const cupMatchDates = new Set(
    cupMatches
      .filter((m) => !m.played && (m.homeTeamId === teamId || m.awayTeamId === teamId))
      .map((m) => m.date),
  )
  const hasMatchToday = matchDates.has(currentDate)
  const hasCupMatchToday = cupMatchDates.has(currentDate)

  return (
    <div className="panel overflow-hidden">
      <div className="panel-header flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Icon name="calendar_today" size="xs" />
          Semana actual
        </div>
        <span className="text-gold-400 font-pixel text-[0.4rem]">{currentDate}</span>
      </div>

      <div className="p-4">
        {/* Week view */}
        <div className="grid grid-cols-7 gap-1 mb-4">
          {weekDays.map((date, i) => {
            const isPast = date < currentDate
            const isToday = date === currentDate
            const hasMatch = matchDates.has(date)
            const isFuture = date > currentDate

            let cellClass = 'bg-dark-700/40 text-gray-600'
            if (isToday && hasMatch) cellClass = 'bg-gold-600/80 text-dark-900 ring-1 ring-gold-400'
            else if (isToday) cellClass = 'bg-dark-600 text-gold-400 ring-1 ring-gold-600/60'
            else if (isPast) cellClass = 'bg-dark-800/60 text-gray-700'
            else if (hasMatch) cellClass = 'bg-green-900/50 text-green-300 ring-1 ring-green-600/60'
            else if (isFuture) cellClass = 'bg-dark-700/30 text-gray-500'

            return (
              <div
                key={date}
                className={`flex flex-col items-center rounded py-2 px-1 ${cellClass}`}
                title={`${DAY_NAMES[i]} ${date}`}
              >
                <span className="text-[0.5rem] font-pixel">{DAY_LABELS[i]}</span>
                <span className="text-[0.55rem] font-medium mt-0.5">{formatShortDate(date)}</span>
                {hasMatch && (
                  <Icon
                    name={cupMatchDates.has(date) ? 'emoji_events' : 'sports_soccer'}
                    size="xs"
                    className={`mt-0.5 ${isToday ? 'text-dark-900' : cupMatchDates.has(date) ? 'text-yellow-400' : 'text-green-400'}`}
                  />
                )}
                {isToday && !hasMatch && <div className="w-1 h-1 rounded-full bg-gold-500 mt-0.5" />}
              </div>
            )
          })}
        </div>

        {hasMatchToday ? (
          <div className={`rounded px-4 py-3 flex items-center gap-3 ${
            hasCupMatchToday
              ? 'bg-yellow-900/15 border border-yellow-600/40'
              : 'bg-gold-600/10 border border-gold-600/40'
          }`}>
            <Icon name={hasCupMatchToday ? 'emoji_events' : 'sports_soccer'} size="md" className={hasCupMatchToday ? 'text-yellow-400 shrink-0' : 'text-gold-400 shrink-0'} />
            <div>
              <p className={`text-sm font-bold leading-tight ${hasCupMatchToday ? 'text-yellow-300' : 'text-gold-300'}`}>
                {hasCupMatchToday ? 'Partido de Copa hoy' : 'Partido pendiente hoy'}
              </p>
              <p className="text-gold-500/70 text-xs mt-0.5">Juega el partido antes de continuar</p>
            </div>
          </div>
        ) : (
          <div className="flex gap-2">
            <button
              onClick={onAdvanceDay}
              className="flex-1 flex items-center justify-center gap-2 py-3 btn-secondary rounded"
            >
              <Icon name="arrow_forward" size="sm" />
              Avanzar día
            </button>
            {hasNextMatch && (
              <button
                onClick={onAdvanceToNextMatch}
                className="flex-1 flex items-center justify-center gap-2 py-3 btn-primary rounded"
              >
                <Icon name="skip_next" size="sm" />
                Ir al partido
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
