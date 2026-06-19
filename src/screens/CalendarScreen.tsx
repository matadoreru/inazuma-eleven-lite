import GameLayout from '../components/GameLayout'
import { useState } from 'react'
import { useCareerStore } from '../store/careerStore'
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

function getMatchResult(match: Match, userTeamId: number): 'win' | 'draw' | 'loss' | null {
  if (!match.played) return null
  const isHome = match.homeTeamId === userTeamId
  const isAway = match.awayTeamId === userTeamId
  if (!isHome && !isAway) return null
  const hg = match.homeGoals ?? 0
  const ag = match.awayGoals ?? 0
  if (hg === ag) return 'draw'
  if ((isHome && hg > ag) || (isAway && ag > hg)) return 'win'
  return 'loss'
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
      <div className={`${wh} rounded-md bg-dark-700/60 flex items-center justify-center shrink-0`}>
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

// ─── Result badge ─────────────────────────────────────────────────────────────

function ResultBadge({ result }: { result: 'win' | 'draw' | 'loss' }) {
  const cfg = {
    win: { label: 'V', cls: 'bg-green-600/30 text-green-400 border-green-600/40' },
    draw: { label: 'D', cls: 'bg-gray-700/40 text-gray-400 border-gray-600/40' },
    loss: { label: 'L', cls: 'bg-red-700/30 text-red-400 border-red-600/40' },
  }[result]
  return (
    <span className={`inline-flex items-center justify-center w-5 h-5 rounded-full text-[0.5rem] font-black border ${cfg.cls}`}>
      {cfg.label}
    </span>
  )
}

// ─── Section label ────────────────────────────────────────────────────────────

function SectionLabel({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-[0.5rem] font-black uppercase tracking-widest text-gray-600 shrink-0">{label}</span>
      <div className="flex-1 h-px bg-gold-600/20" />
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
  const [expandedMatchId, setExpandedMatchId] = useState<string | null>(null)
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
  const userResult = userMatch ? getMatchResult(userMatch, userTeamId) : null

  return (
    <div className="flex flex-col h-full overflow-hidden">

      {/* Header */}
      <div className="shrink-0 px-4 py-4 border-b border-gold-600/20">
        <div className="flex items-center gap-2">
          <h2 className="text-white font-black text-xl leading-tight">{fmtLong(selectedDate)}</h2>
          {userResult && <ResultBadge result={userResult} />}
        </div>
        {userMatch ? (
          <p className={`text-xs font-semibold mt-0.5
            ${userMatch.type === 'cup' ? 'text-yellow-400' : 'text-gold-500'}`}>
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
            <div className={`mt-1.5 p-3 rounded-xl border ${
              userResult === 'win' ? 'border-green-600/40 bg-green-900/15'
              : userResult === 'draw' ? 'border-gray-600/30 bg-gray-800/20'
              : userResult === 'loss' ? 'border-red-700/40 bg-red-900/15'
              : 'border-green-700/30 bg-green-900/10'
            }`}>
              {/* Teams row */}
              <div className="flex items-center gap-2 min-w-0">
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <TeamBadge team={teamById(userMatch.homeTeamId)} size="lg" />
                  <span className="text-white text-sm font-bold truncate">
                    {teamById(userMatch.homeTeamId)?.name ?? `Eq. ${userMatch.homeTeamId}`}
                  </span>
                </div>
                <div className="shrink-0 text-center min-w-[44px]">
                  {userMatch.played ? (
                    <span className="text-white font-black text-xl tabular-nums">
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
                    ${isHome ? 'bg-blue-900/40 text-gold-500' : 'bg-orange-900/30 text-orange-400'}`}
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
            <div className="mt-2 rounded-xl border border-gold-600/15 overflow-hidden">
              {dayMatches.map((match, i) => {
                const isUser = match.homeTeamId === userTeamId || match.awayTeamId === userTeamId
                const home = teamById(match.homeTeamId)
                const away = teamById(match.awayTeamId)
                const isExpanded = expandedMatchId === match.id
                const matchResult = isUser ? getMatchResult(match, userTeamId) : null

                return (
                  <div key={match.id}>
                    <button
                      onClick={() => setExpandedMatchId(isExpanded ? null : match.id)}
                      className={`w-full flex items-center gap-2 px-3 py-2.5 text-left transition-colors
                        ${i > 0 ? 'border-t border-gold-600/15' : ''}
                        ${isUser ? 'bg-green-900/15' : 'bg-dark-800/30'}
                        ${isExpanded ? 'bg-dark-700/50' : 'hover:bg-dark-700/30'}`}
                    >
                      <TeamBadge team={home} size="sm" />
                      <span className="text-gray-300 text-xs flex-1 min-w-0 text-left truncate">
                        {home?.name ?? `Eq. ${match.homeTeamId}`}
                      </span>
                      <div className="shrink-0 min-w-[40px] text-center">
                        {match.played ? (
                          <span className="text-white text-sm font-bold tabular-nums">
                            {match.homeGoals}–{match.awayGoals}
                          </span>
                        ) : (
                          <span className="text-gray-500 text-[0.5625rem] font-black">VS</span>
                        )}
                      </div>
                      <span className="text-gray-300 text-xs flex-1 min-w-0 text-right truncate">
                        {away?.name ?? `Eq. ${match.awayTeamId}`}
                      </span>
                      <TeamBadge team={away} size="sm" />
                      {matchResult && (
                        <ResultBadge result={matchResult} />
                      )}
                    </button>

                    {/* Expanded score detail */}
                    {isExpanded && (
                      <div className={`border-t border-gold-600/15 px-4 py-3
                        ${isUser ? 'bg-green-900/10' : 'bg-dark-800/40'}`}>
                        {match.played ? (
                          <div className="flex items-center gap-3">
                            <div className="flex items-center gap-2 flex-1 min-w-0">
                              <TeamBadge team={home} size="md" />
                              <span className="text-white text-xs font-semibold truncate">
                                {home?.name ?? `Eq. ${match.homeTeamId}`}
                              </span>
                            </div>
                            <span className="text-white font-black text-2xl tabular-nums shrink-0">
                              {match.homeGoals}–{match.awayGoals}
                            </span>
                            <div className="flex items-center gap-2 flex-1 min-w-0 justify-end">
                              <span className="text-white text-xs font-semibold truncate text-right">
                                {away?.name ?? `Eq. ${match.awayTeamId}`}
                              </span>
                              <TeamBadge team={away} size="md" />
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-center gap-3">
                            <div className="flex items-center gap-2 flex-1 min-w-0">
                              <TeamBadge team={home} size="md" />
                              <span className="text-white text-xs font-semibold truncate">
                                {home?.name ?? `Eq. ${match.homeTeamId}`}
                              </span>
                            </div>
                            <span className="text-gray-500 text-xs font-black shrink-0">VS</span>
                            <div className="flex items-center gap-2 flex-1 min-w-0 justify-end">
                              <span className="text-white text-xs font-semibold truncate text-right">
                                {away?.name ?? `Eq. ${match.awayTeamId}`}
                              </span>
                              <TeamBadge team={away} size="md" />
                            </div>
                          </div>
                        )}
                        <p className="text-gray-600 text-[0.5625rem] text-center mt-2">
                          {matchLabel(match)}{match.type !== 'cup' && match.round ? ` · J${match.round}` : ''}
                        </p>
                      </div>
                    )}
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

  const initialDate = career?.season.currentDate ?? new Date().toISOString().slice(0, 10)
  const [viewMonth, setViewMonth] = useState(initialDate.slice(0, 7))
  const [selectedDate, setSelectedDate] = useState(initialDate)

  if (!career) {
    return (
      <div className="h-full flex items-center justify-center bg-dark-900/80">
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

  // Navigation bounds: don't go before season start or past last known match
  const minViewMonth = career.season.startDate.slice(0, 7)
  const allKnownDates = [
    ...allMatches.map((m) => m.date),
    ...Object.values(career.allLeagueSeasons).flatMap((ls) => ls.matches.map((m) => m.date)),
  ].filter(Boolean).sort()
  const maxViewMonth = (allKnownDates[allKnownDates.length - 1] ?? career.season.currentDate).slice(0, 7)

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
    <GameLayout>
      <main className="h-full flex flex-col overflow-hidden min-w-0">

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
              onPrevMonth={() => { if (viewMonth > minViewMonth) setViewMonth(prevMonth(viewMonth)) }}
              onNextMonth={() => { if (viewMonth < maxViewMonth) setViewMonth(nextMonth(viewMonth)) }}
              canGoPrev={viewMonth > minViewMonth}
              canGoNext={viewMonth < maxViewMonth}
            />
          </div>

          {/* Right: day detail */}
          <div className="w-80 shrink-0 border-l border-gold-600/20 overflow-hidden bg-dark-900/95">
            <DayDetailPanel
              selectedDate={selectedDate}
              allMatches={allMatches}
              teams={teams}
              userTeamId={career.teamId}
            />
          </div>
        </div>

        {/* ── Bottom: upcoming 4 matches ── */}
        <div className="shrink-0 border-t border-gold-600/20 bg-dark-900/80">
          <div className="flex items-stretch gap-3 px-4 py-3">

            {/* Label */}
            <div className="shrink-0 flex items-center justify-center pr-3 border-r border-gold-600/15">
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
                      ? 'border-gold-500/60 bg-gold-900/15'
                      : 'border-gold-600/20 bg-dark-800/40 hover:bg-dark-700/40 hover:border-gold-600/30'}`}
                >
                  <div className="flex flex-col items-center gap-0.5">
                    <span className={`text-xs font-black tabular-nums ${isSel ? 'text-gold-400' : 'text-gray-400'}`}>
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
                className="flex-1 rounded-xl border border-gold-600/20 flex items-center justify-center"
              >
                <span className="text-gray-700 text-xs">—</span>
              </div>
            ))}
          </div>
        </div>

      </main>
    </GameLayout>
  )
}
