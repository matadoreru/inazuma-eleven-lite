import type { Match } from '../types/competition'
import type { Team } from '../types/team'
import TeamBadgeImage from './TeamBadgeImage'
import Icon from './Icon'

interface Props {
  match: Match
  homeTeam: Team
  awayTeam: Team
  currentDate: string
  userTeamId: number
  isSimulating: boolean
  competitionLabel?: string
  onQuickSim: () => void
  onLiveSim: () => void
}

export default function MatchPreviewPanel({
  match,
  homeTeam,
  awayTeam,
  currentDate,
  userTeamId,
  isSimulating,
  competitionLabel,
  onQuickSim,
  onLiveSim,
}: Props) {
  const isAvailable = match.date <= currentDate && !match.played
  const isFuture = match.date > currentDate
  const isUserHome = match.homeTeamId === userTeamId

  return (
    <div className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden">
      {/* Header bar */}
      <div className="bg-gray-900/60 px-4 py-2 flex items-center justify-between border-b border-gray-700">
        <div className="flex items-center gap-1.5 text-gray-400 text-xs font-semibold uppercase tracking-wide">
          <Icon name="sports_soccer" size="xs" />
          {competitionLabel ?? `Jornada ${match.round}`}
        </div>
        <div className="flex items-center gap-1.5 text-gray-400 text-xs">
          <Icon name="calendar_today" size="xs" />
          {match.date}
        </div>
      </div>

      {/* Match matchup */}
      <div className="px-6 py-5">
        <div className="flex items-center justify-between gap-4">
          {/* Home team */}
          <div className="flex flex-col items-center gap-2 flex-1">
            <TeamBadgeImage teamName={homeTeam.name} badgeUrl={homeTeam.badgeUrl} size="lg" />
            <div className="text-center">
              <p className="text-white font-bold text-sm leading-tight">{homeTeam.name}</p>
              <div className="flex items-center justify-center gap-1 mt-1">
                <Icon name="home" size="xs" className="text-blue-400" />
                <span className="text-blue-400 text-xs font-semibold uppercase tracking-wide">Local</span>
                {isUserHome && (
                  <span className="ml-1 text-yellow-400 text-[0.625rem] font-bold bg-yellow-400/10 px-1.5 py-0.5 rounded">TÚ</span>
                )}
              </div>
            </div>
          </div>

          {/* Score / VS */}
          <div className="flex flex-col items-center gap-1 shrink-0">
            {match.played && match.result ? (
              <>
                <div className="flex items-center gap-2">
                  <span className="text-white text-3xl font-extrabold">{match.homeGoals}</span>
                  <span className="text-gray-500 text-xl">-</span>
                  <span className="text-white text-3xl font-extrabold">{match.awayGoals}</span>
                </div>
                <span className="text-gray-500 text-xs">Final</span>
              </>
            ) : (
              <>
                <span className="text-gray-500 text-2xl font-bold">VS</span>
                {isAvailable && (
                  <span className="text-green-400 text-[0.625rem] font-bold uppercase tracking-wide">Disponible</span>
                )}
                {isFuture && (
                  <span className="text-gray-500 text-[0.625rem] uppercase tracking-wide">Pendiente</span>
                )}
              </>
            )}
          </div>

          {/* Away team */}
          <div className="flex flex-col items-center gap-2 flex-1">
            <TeamBadgeImage teamName={awayTeam.name} badgeUrl={awayTeam.badgeUrl} size="lg" />
            <div className="text-center">
              <p className="text-white font-bold text-sm leading-tight">{awayTeam.name}</p>
              <div className="flex items-center justify-center gap-1 mt-1">
                <Icon name="flight_takeoff" size="xs" className="text-gray-400" />
                <span className="text-gray-400 text-xs font-semibold uppercase tracking-wide">Visitante</span>
                {!isUserHome && (
                  <span className="ml-1 text-yellow-400 text-[0.625rem] font-bold bg-yellow-400/10 px-1.5 py-0.5 rounded">TÚ</span>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Action buttons */}
      {isAvailable && (
        <div className="px-4 pb-4 flex gap-2">
          <button
            onClick={onQuickSim}
            disabled={isSimulating}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:bg-gray-600 text-white rounded-lg font-semibold text-sm transition-colors"
          >
            <Icon name="fast_forward" size="sm" />
            Rápido
          </button>
          <button
            onClick={onLiveSim}
            disabled={isSimulating}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-green-700 hover:bg-green-600 disabled:bg-gray-600 text-white rounded-lg font-semibold text-sm transition-colors"
          >
            <Icon name="play_arrow" size="sm" />
            En directo
          </button>
        </div>
      )}

      {isFuture && (
        <div className="px-4 pb-4">
          <p className="text-center text-gray-500 text-xs">
            Avanza días hasta el {match.date} para jugar este partido
          </p>
        </div>
      )}
    </div>
  )
}
