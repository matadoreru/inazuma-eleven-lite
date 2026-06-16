import type { Team } from '../types/team'
import TeamBadgeImage from './TeamBadgeImage'

const LEAGUE_LABELS: Record<string, string> = {
  first_division: 'Primera División',
  second_division: 'Segunda División',
}

interface Props {
  team: Team
  isSelected: boolean
  onClick: () => void
}

export default function TeamSelectCard({ team, isSelected, onClick }: Props) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-3 rounded-xl p-3 border-2 text-left transition-all
        ${isSelected
          ? 'border-blue-500 bg-blue-900/20'
          : 'border-gray-700 bg-gray-800 hover:border-gray-500'}`}
    >
      <TeamBadgeImage teamName={team.name} badgeUrl={team.badgeUrl} size="md" />
      <div className="min-w-0">
        <p className="text-white font-semibold text-sm break-words">{team.name}</p>
        <p className="text-gray-400 text-xs">{LEAGUE_LABELS[team.leagueId] ?? team.leagueId}</p>
        <p className="text-gray-500 text-xs">Tier {team.tier} · Rep. {team.reputation}</p>
      </div>
      {isSelected && <span className="ml-auto text-blue-400 text-lg flex-shrink-0">✓</span>}
    </button>
  )
}
