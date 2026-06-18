import type { Match } from '../types/competition'
import TeamNameInline from './TeamNameInline'

interface Props {
  match: Match
  homeTeamName: string
  awayTeamName: string
  homeBadgeUrl?: string
  awayBadgeUrl?: string
  isUserTeam: boolean
}

export default function MatchResultCard({ match, homeTeamName, awayTeamName, homeBadgeUrl, awayBadgeUrl, isUserTeam }: Props) {
  if (!match.played || !match.result) {
    return (
      <div className="bg-dark-800/70 rounded-lg px-4 py-3 flex items-center justify-between">
        <div className="flex-1 min-w-0">
          <TeamNameInline teamName={homeTeamName} badgeUrl={homeBadgeUrl} textClassName="text-white" />
        </div>
        <span className="text-gray-400 text-sm">vs</span>
        <div className="flex-1 min-w-0">
          <TeamNameInline teamName={awayTeamName} badgeUrl={awayBadgeUrl} align="right" textClassName="text-white" />
        </div>
      </div>
    )
  }

  const { homeGoals, awayGoals, extraTime, penalties } = match.result
  const isHome = isUserTeam // caller sets isUserTeam based on which side user is
  const userGoals = isHome ? homeGoals : awayGoals
  const oppGoals = isHome ? awayGoals : homeGoals

  let resultColor = 'text-gray-400'
  let borderColor = 'border-gold-600/20'
  if (userGoals > oppGoals) {
    resultColor = 'text-green-400'
    borderColor = 'border-green-600'
  } else if (userGoals < oppGoals) {
    resultColor = 'text-red-400'
    borderColor = 'border-red-600'
  }

  return (
    <div className={`bg-dark-800/70 rounded-lg px-4 py-3 border-l-4 ${borderColor}`}>
      <div className="flex items-center justify-between gap-3">
        <div className="flex-1 min-w-0">
          <TeamNameInline teamName={homeTeamName} badgeUrl={homeBadgeUrl} textClassName="text-white" />
        </div>
        <div className="flex items-center gap-1">
          <span className={`text-xl font-bold ${resultColor}`}>{homeGoals}</span>
          <span className="text-gray-500 mx-1">-</span>
          <span className={`text-xl font-bold ${resultColor}`}>{awayGoals}</span>
        </div>
        <div className="flex-1 min-w-0">
          <TeamNameInline teamName={awayTeamName} badgeUrl={awayBadgeUrl} align="right" textClassName="text-white" />
        </div>
      </div>
      <div className="mt-1 text-xs text-gray-500 text-center">
        Round {match.round} · {match.date}
      </div>
      {extraTime && (
        <div className="mt-2 text-center">
          <span className="text-xs font-bold text-yellow-400 bg-yellow-900/30 border border-yellow-700/40 rounded px-2 py-0.5">
            PRÓRROGA
          </span>
          <p className="text-gray-400 text-xs mt-1">
            ET: {extraTime.homeGoals} – {extraTime.awayGoals}
          </p>
        </div>
      )}
      {penalties && (
        <div className="mt-2 text-center">
          <span className="text-xs font-bold text-orange-400 bg-orange-900/30 border border-orange-700/40 rounded px-2 py-0.5">
            PENALTIS
          </span>
          <p className="text-gray-400 text-xs mt-1">
            {penalties.homeScore} – {penalties.awayScore}
          </p>
        </div>
      )}
    </div>
  )
}
