import type { Match } from '../types/competition'
import Icon from './Icon'

interface Props {
  currentDate: string
  teamId: number
  matches: Match[]
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
  currentDate,
  teamId,
  matches,
  onAdvanceDay,
  onAdvanceToNextMatch,
  hasNextMatch,
}: Props) {
  const weekDays = getWeekDays(currentDate)
  const matchDates = new Set(
    matches
      .filter((m) => !m.played && (m.homeTeamId === teamId || m.awayTeamId === teamId))
      .map((m) => m.date),
  )

  const hasMatchToday = matchDates.has(currentDate)

  return (
    <div className="bg-gray-800 rounded-xl border border-gray-700 p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2 text-gray-400 text-xs font-semibold uppercase tracking-wide">
          <Icon name="calendar_today" size="xs" />
          Semana actual
        </div>
        <span className="text-white text-sm font-bold">{currentDate}</span>
      </div>

      {/* Week view */}
      <div className="grid grid-cols-7 gap-1 mb-4">
        {weekDays.map((date, i) => {
          const isPast = date < currentDate
          const isToday = date === currentDate
          const hasMatch = matchDates.has(date)
          const isFuture = date > currentDate

          let cellClass = 'bg-gray-700/40 text-gray-600'
          if (isToday && hasMatch) cellClass = 'bg-amber-500 text-white ring-2 ring-amber-300'
          else if (isToday) cellClass = 'bg-blue-600 text-white ring-2 ring-blue-400'
          else if (isPast) cellClass = 'bg-gray-800 text-gray-700'
          else if (hasMatch) cellClass = 'bg-green-900/60 text-green-300 ring-1 ring-green-600'
          else if (isFuture) cellClass = 'bg-gray-700/40 text-gray-400'

          return (
            <div
              key={date}
              className={`flex flex-col items-center rounded-lg py-2 px-1 ${cellClass}`}
              title={`${DAY_NAMES[i]} ${date}`}
            >
              <span className="text-[0.625rem] font-bold uppercase">{DAY_LABELS[i]}</span>
              <span className="text-[11px] font-medium mt-0.5">{formatShortDate(date)}</span>
              {hasMatch && (
                <Icon
                  name="sports_soccer"
                  size="xs"
                  className={`mt-0.5 ${isToday ? 'text-white' : 'text-green-400'}`}
                />
              )}
              {isToday && !hasMatch && <div className="w-1 h-1 rounded-full bg-white mt-0.5" />}
            </div>
          )
        })}
      </div>

      {/* Match today: blocked state */}
      {hasMatchToday ? (
        <div className="rounded-xl bg-amber-500/10 border border-amber-500/40 px-4 py-3 flex items-center gap-3">
          <Icon name="sports_soccer" size="md" className="text-amber-400 shrink-0" />
          <div>
            <p className="text-amber-300 text-base font-bold leading-tight">Partido pendiente hoy</p>
            <p className="text-amber-400/70 text-sm mt-0.5">Juega el partido antes de continuar</p>
          </div>
        </div>
      ) : (
        /* Advance buttons */
        <div className="flex gap-2">
          <button
            onClick={onAdvanceDay}
            className="flex-1 flex items-center justify-center gap-2 py-3.5 bg-gray-700 hover:bg-gray-600 active:bg-gray-500 text-white rounded-xl text-base font-semibold transition-colors"
          >
            <Icon name="arrow_forward" size="sm" />
            Avanzar día
          </button>
          {hasNextMatch && (
            <button
              onClick={onAdvanceToNextMatch}
              className="flex-1 flex items-center justify-center gap-2 py-3.5 bg-blue-700 hover:bg-blue-600 active:bg-blue-500 text-white rounded-xl text-base font-semibold transition-colors"
            >
              <Icon name="skip_next" size="sm" />
              Ir al partido
            </button>
          )}
        </div>
      )}
    </div>
  )
}
