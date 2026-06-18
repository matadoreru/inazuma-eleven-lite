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
  match, homeTeam, awayTeam, currentDate, userTeamId, isSimulating, competitionLabel, onQuickSim, onLiveSim,
}: Props) {
  const isAvailable = match.date <= currentDate && !match.played
  const isFuture = match.date > currentDate
  const isUserHome = match.homeTeamId === userTeamId

  return (
    <div className="panel overflow-hidden flex flex-col">
      {/* Header */}
      <div className="panel-header flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Icon name="sports_soccer" size="xs" />
          {competitionLabel ?? `Jornada ${match.round}`}
        </div>
        <div className="flex items-center gap-1.5 text-gray-500">
          <Icon name="calendar_today" size="xs" />
          {match.date}
        </div>
      </div>

      {/* Matchup */}
      <div className="px-6 py-5 flex-1">
        <div className="flex items-center justify-between gap-4">
          {/* Home */}
          <div className="flex flex-col items-center gap-2 flex-1">
            <TeamBadgeImage teamName={homeTeam.name} badgeUrl={homeTeam.badgeUrl} size="lg" />
            <div className="text-center">
              <p className="text-white font-bold text-sm leading-tight">{homeTeam.name}</p>
              <div className="flex items-center justify-center gap-1 mt-1">
                <Icon name="home" size="xs" className="text-gold-500" />
                <span className="text-gold-500 text-xs font-semibold uppercase tracking-wide">Local</span>
                {isUserHome && (
                  <span className="ml-1 text-gold-300 text-[0.5rem] font-pixel bg-gold-500/15 px-1.5 py-0.5 rounded border border-gold-600/40">TÚ</span>
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
                  <span className="text-gray-600 text-xl">-</span>
                  <span className="text-white text-3xl font-extrabold">{match.awayGoals}</span>
                </div>
                <span className="text-gray-500 text-[0.5rem] font-pixel uppercase">Final</span>
              </>
            ) : (
              <>
                <span className="text-gold-500 text-2xl font-pixel">VS</span>
                {isAvailable && (
                  <span className="text-green-400 text-[0.45rem] font-pixel uppercase tracking-wide">Disponible</span>
                )}
                {isFuture && (
                  <span className="text-gray-500 text-[0.45rem] font-pixel uppercase tracking-wide">Pendiente</span>
                )}
              </>
            )}
          </div>

          {/* Away */}
          <div className="flex flex-col items-center gap-2 flex-1">
            <TeamBadgeImage teamName={awayTeam.name} badgeUrl={awayTeam.badgeUrl} size="lg" />
            <div className="text-center">
              <p className="text-white font-bold text-sm leading-tight">{awayTeam.name}</p>
              <div className="flex items-center justify-center gap-1 mt-1">
                <Icon name="flight_takeoff" size="xs" className="text-gray-500" />
                <span className="text-gray-400 text-xs font-semibold uppercase tracking-wide">Visitante</span>
                {!isUserHome && (
                  <span className="ml-1 text-gold-300 text-[0.5rem] font-pixel bg-gold-500/15 px-1.5 py-0.5 rounded border border-gold-600/40">TÚ</span>
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
            className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-dark-700/80 hover:bg-dark-600 disabled:opacity-50 text-gold-400 hover:text-gold-300 rounded border border-gold-600/40 hover:border-gold-500 text-sm font-semibold transition-colors uppercase tracking-wide"
          >
            <Icon name="fast_forward" size="sm" />
            Rápido
          </button>
          <button
            onClick={onLiveSim}
            disabled={isSimulating}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-gold-600/20 hover:bg-gold-500/30 disabled:opacity-50 text-gold-300 rounded border border-gold-500/60 hover:border-gold-400 text-sm font-semibold transition-colors uppercase tracking-wide"
          >
            <Icon name="play_arrow" size="sm" />
            En directo
          </button>
        </div>
      )}
    </div>
  )
}
