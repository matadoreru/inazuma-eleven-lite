import { useState } from 'react'
import { useCareerStore } from '../store/careerStore'
import TopNavigation from '../components/TopNavigation'
import SideNavigation from '../components/SideNavigation'
import CalendarMonth, { MONTH_NAMES } from '../components/CalendarMonth'
import Icon from '../components/Icon'
import type { Match } from '../types/competition'
import type { Team } from '../types/team'
import { leagues } from '../data/leagues'

// ─── Date helpers ─────────────────────────────────────────────────────────────

const MONTH_SHORT = ['ENE','FEB','MAR','ABR','MAY','JUN','JUL','AGO','SEP','OCT','NOV','DIC']

function prevMonth(ym: string): string {
  const [y, m] = ym.split('-').map(Number)
  return m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, '0')}`
}

function nextMonth(ym: string): string {
  const [y, m] = ym.split('-').map(Number)
  return m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, '0')}`
}

function fmtLong(d: string): string {
  const [, m, day] = d.split('-').map(Number)
  return `${day} ${MONTH_NAMES[m - 1]}`
}

function fmtShort(d: string): string {
  const [, m, day] = d.split('-').map(Number)
  return `${day} ${MONTH_SHORT[m - 1]}`
}

function matchLabel(match: Match): string {
  if (match.type === 'cup') return match.cupRound ?? 'Copa'
  return leagues.find((l) => l.id === match.leagueId)?.name ?? 'Liga'
}

// ─── Team badge ───────────────────────────────────────────────────────────────

const BADGE_COLORS = [
  '#dc2626','#16a34a','#0ea5e9','#d97706',
  '#7c3aed','#db2777','#ea580c','#0891b2','#65a30d',
]
const teamColor = (id: number) => BADGE_COLORS[id % BADGE_COLORS.length]

function TeamBadge({
  team,
  size = 'sm',
}: {
  team: Pick<Team, 'id' | 'name' | 'badgeUrl'> | undefined
  size?: 'sm' | 'md' | 'lg'
}) {
  const [failed, setFailed] = useState(false)
  const wh = size === 'lg' ? 'w-12 h-12' : size === 'md' ? 'w-9 h-9' : 'w-7 h-7'
  const fs = size === 'lg' ? 'text-xs' : size === 'md' ? 'text-[0.5625rem]' : 'text-[0.4375rem]'

  if (!team) {
    return (
      <div className={`${wh} rounded-md bg-gray-700 flex items-center justify-center shrink-0`}>
        <Icon name="shield" size="xs" className="text-gray-500" />
      </div>
    )
  }

  if (team.badgeUrl && !failed) {
    return (
      <img
        src={team.badgeUrl}
        alt={team.name}
        className={`${wh} object-contain rounded shrink-0`}
        onError={() => setFailed(true)}
      />
    )
  }

  return (
    <div
      className={`${wh} rounded-md flex items-center justify-center font-black text-white shrink-0 ${fs}`}
      style={{ backgroundColor: teamColor(team.id) }}
    >
      {team.name.slice(0, 2).toUpperCase()}
    </div>
  )
}

// ─── Section label ────────────────────────────────────────────────────────────

function SectionLabel({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-[0.5rem] font-black uppercase tracking-widest text-gray-600 shrink-0">{label}</span>
      <div className="flex-1 h-px bg-gray-700/50" />
    </div>
  )
}

// ─── Day detail panel ─────────────────────────────────────────────────────────

function DayDetailPanel({
  selectedDate,
  allMatches,
  teams,
  userTeamId,
}: {
  selectedDate: string
  allMatches: Match[]
  teams: Team[]
  userTeamId: number
}) {
  const teamById = (id: number) => teams.find((t) => t.id === id)

  const dayMatches = allMatches
    .filter((m) => m.date === selectedDate)
    .sort((a, b) => {
      const au = a.homeTeamId === userTeamId || a.awayTeamId === userTeamId ? 1 : 0
      const bu = b.homeTeamId === userTeamId || b.awayTeamId === userTeamId ? 1 : 0
      return bu - au
    })

  const userMatch = dayMatches.find(
    (m) => m.homeTeamId === userTeamId || m.awayTeamId === userTeamId,
  )
  const isHome = userMatch?.homeTeamId === userTeamId

  return (
    <div className="flex flex-col h-full overflow-hidden">

      {/* Header */}
      <div className="shrink-0 px-4 py-4 border-b border-gray-700/50">
        <h2 className="text-white font-black text-xl leading-tight">{fmtLong(selectedDate)}</h2>
        {userMatch ? (
          <p className={`text-xs font-semibold mt-0.5
            ${userMatch.type === 'cup' ? 'text-yellow-400' : 'text-blue-400'}`}>
            {userMatch.type === 'cup'
              ? `Copa · ${matchLabel(userMatch)}`
              : `${matchLabel(userMatch)} · J${userMatch.round}`}
          </p>
        ) : (
          <p className="text-gray-600 text-xs mt-0.5">Día libre</p>
        )}
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto">

        {/* RESUMEN */}
        <div className="px-3 pt-3 pb-1">
          <SectionLabel label="Resumen" />
        </div>

        {!userMatch ? (
          <div className="flex flex-col items-center justify-center py-10 px-4 text-center">
            <Icon name="sports_soccer" size="lg" className="text-gray-700 mb-2" />
            <p className="text-gray-600 text-sm">Sin partidos este día</p>
          </div>
        ) : (
          <div className="px-3 pb-2">
            <div className="mt-1.5 p-3 rounded-xl border border-green-700/30 bg-green-900/10">
              {/* Teams */}
              <div className="flex items-center gap-2 min-w-0">
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <TeamBadge team={teamById(userMatch.homeTeamId)} size="lg" />
                  <span className="text-white text-sm font-bold truncate">
                    {teamById(userMatch.homeTeamId)?.name ?? `Eq. ${userMatch.homeTeamId}`}
                  </span>
                </div>
                <div className="shrink-0 text-center min-w-[36px]">
                  {userMatch.played ? (
                    <span className="text-white font-black text-base tabular-nums">
                      {userMatch.homeGoals}–{userMatch.awayGoals}
                    </span>
                  ) : (
                    <span className="text-gray-500 text-xs font-black">VS</span>
                  )}
                </div>
                <div className="flex items-center gap-2 flex-1 min-w-0 justify-end">
                  <span className="text-white text-sm font-bold truncate text-right">
                    {teamById(userMatch.awayTeamId)?.name ?? `Eq. ${userMatch.awayTeamId}`}
                  </span>
                  <TeamBadge team={teamById(userMatch.awayTeamId)} size="lg" />
                </div>
              </div>
              {/* Meta */}
              <div className="flex items-center gap-2 mt-2">
                <span className="text-gray-500 text-xs">{matchLabel(userMatch)}</span>
                <span
                  className={`text-[0.5625rem] font-black px-1.5 py-px rounded uppercase tracking-wide
                    ${isHome ? 'bg-blue-900/40 text-blue-400' : 'bg-orange-900/30 text-orange-400'}`}
                >
                  {isHome ? 'Local' : 'Visitante'}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* PARTIDOS list */}
        {dayMatches.length > 0 && (
          <div className="px-3 pt-2 pb-4">
            <SectionLabel label={`Partidos (${dayMatches.length})`} />
            <div className="mt-2 rounded-xl border border-gray-700/40 overflow-hidden">
              {dayMatches.map((match, i) => {
                const isUser = match.homeTeamId === userTeamId || match.awayTeamId === userTeamId
                const home = teamById(match.homeTeamId)
                const away = teamById(match.awayTeamId)
                return (
                  <div
                    key={match.id}
                    className={`flex items-center gap-2 px-2.5 py-2.5
                      ${i > 0 ? 'border-t border-gray-700/30' : ''}
                      ${isUser ? 'bg-green-900/15' : 'bg-gray-800/20'}`}
                  >
                    <TeamBadge team={home} size="md" />
                    <span className="text-gray-300 text-xs truncate flex-1 min-w-0">
                      {home?.name ?? `Eq. ${match.homeTeamId}`}
                    </span>
                    <div className="shrink-0 min-w-[36px] text-center">
                      {match.played ? (
                        <span className="text-white text-sm font-bold tabular-nums">
                          {match.homeGoals}–{match.awayGoals}
                        </span>
                      ) : (
                        <span className="text-gray-500 text-[0.5625rem] font-black">VS</span>
                      )}
                    </div>
                    <span className="text-gray-300 text-xs truncate flex-1 min-w-0 text-right">
                      {away?.name ?? `Eq. ${match.awayTeamId}`}
                    </span>
                    <TeamBadge team={away} size="md" />
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Main screen ──────────────────────────────────────────────────────────────

export default function CalendarScreen() {
  const career = useCareerStore((s) => s.career)
  const teams = useCareerStore((s) => s.teams)
  const screen = useCareerStore((s) => s.screen)
  const navigate = useCareerStore((s) => s.navigate)

  const initialDate = career?.season.currentDate ?? new Date().toISOString().slice(0, 10)
  const [viewMonth, setViewMonth] = useState(initialDate.slice(0, 7))
  const [selectedDate, setSelectedDate] = useState(initialDate)

  if (!career) {
    return (
      <div className="h-full flex items-center justify-center bg-gray-900">
        <p className="text-gray-400">No hay carrera activa.</p>
      </div>
    )
  }

  const [yearStr, monthStr] = viewMonth.split('-')
  const year = parseInt(yearStr, 10)
  const month = parseInt(monthStr, 10)
  const leagueMatches = career.season.matches
  const cupMatches = (career.cup?.rounds.flatMap((r) => r.matches) ?? [])
    .filter((m) => m.homeTeamId !== -1 && m.awayTeamId !== -1)
  const allMatches = [...leagueMatches, ...cupMatches]

  const upcoming = allMatches
    .filter(
      (m) =>
        (m.homeTeamId === career.teamId || m.awayTeamId === career.teamId) &&
        !m.played &&
        m.date >= career.season.currentDate,
    )
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, 4)

  return (
    <div className="h-full flex flex-col">
      <TopNavigation title="Calendario" />
      <div className="flex flex-1 overflow-hidden">
        <SideNavigation currentScreen={screen} onNavigate={navigate} />

        <main className="flex-1 flex flex-col overflow-hidden min-w-0 bg-gray-900">

          {/* ── Top: calendar + detail panel ── */}
          <div className="flex flex-1 overflow-hidden min-h-0">

            {/* Left: calendar grid */}
            <div className="flex-1 overflow-hidden min-w-0">
              <CalendarMonth
                year={year}
                month={month}
                matches={allMatches}
                userTeamId={career.teamId}
                currentDate={career.season.currentDate}
                selectedDate={selectedDate}
                onDayClick={(date) => setSelectedDate(date)}
                onPrevMonth={() => setViewMonth(prevMonth(viewMonth))}
                onNextMonth={() => setViewMonth(nextMonth(viewMonth))}
              />
            </div>

            {/* Right: day detail */}
            <div className="w-72 shrink-0 border-l border-gray-700/60 overflow-hidden">
              <DayDetailPanel
                selectedDate={selectedDate}
                allMatches={allMatches}
                teams={teams}
                userTeamId={career.teamId}
              />
            </div>
          </div>

          {/* ── Bottom: upcoming 4 matches ── */}
          <div className="shrink-0 border-t border-gray-700/60 bg-gray-900/80">
            <div className="flex items-stretch gap-3 px-4 py-3">

              {/* Label */}
              <div className="shrink-0 flex items-center justify-center pr-3 border-r border-gray-700/40">
                <span className="text-gray-600 text-[0.45rem] font-black uppercase tracking-widest leading-snug text-center">
                  Próximos<br />Partidos
                </span>
              </div>

              {/* Match cards */}
              {upcoming.map((match) => {
                const isHome = match.homeTeamId === career.teamId
                const opponent = teams.find(
                  (t) => t.id === (isHome ? match.awayTeamId : match.homeTeamId),
                )
                const isSel = match.date === selectedDate

                return (
                  <button
                    key={match.id}
                    onClick={() => {
                      setSelectedDate(match.date)
                      setViewMonth(match.date.slice(0, 7))
                    }}
                    className={`flex-1 flex flex-col items-center gap-1 px-2 py-2 rounded-xl border transition-all min-w-0
                      ${isSel
                        ? 'border-blue-500/60 bg-blue-900/20'
                        : 'border-gray-700/50 bg-gray-800/40 hover:bg-gray-800 hover:border-gray-600'}`}
                  >
                    <div className="flex flex-col items-center gap-0.5">
                      <span className={`text-xs font-black tabular-nums ${isSel ? 'text-blue-300' : 'text-gray-400'}`}>
                        {fmtShort(match.date)}
                      </span>
                      {match.type === 'cup' && (
                        <span className="text-[0.4rem] font-black uppercase tracking-widest text-yellow-500/80">Copa</span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <TeamBadge team={teams.find((t) => t.id === career.teamId)} size="md" />
                      <span className="text-gray-500 text-[0.5625rem] font-black">VS</span>
                      <TeamBadge team={opponent} size="md" />
                    </div>
                  </button>
                )
              })}

              {/* Empty slots when fewer than 4 */}
              {Array.from({ length: Math.max(0, 4 - upcoming.length) }, (_, i) => (
                <div
                  key={`pad-${i}`}
                  className="flex-1 rounded-xl border border-gray-700/20 flex items-center justify-center"
                >
                  <span className="text-gray-700 text-xs">—</span>
                </div>
              ))}
            </div>
          </div>

        </main>
      </div>
    </div>
  )
}
