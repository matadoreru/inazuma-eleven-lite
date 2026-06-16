import { useCareerStore } from '../store/careerStore'
import Icon from '../components/Icon'
import TeamNameInline from '../components/TeamNameInline'
import type { SeasonReview, UserSeasonOutcome } from '../types/season'

function formatOutcome(outcome: UserSeasonOutcome): { label: string; color: string; icon: string } {
  switch (outcome) {
    case 'promoted':  return { label: 'ASCENSO', color: 'text-green-400', icon: 'arrow_upward' }
    case 'relegated': return { label: 'DESCENSO', color: 'text-red-400',   icon: 'arrow_downward' }
    case 'stayed':    return { label: 'PERMANENCIA', color: 'text-blue-400', icon: 'remove' }
  }
}

function StatCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="bg-gray-800 rounded-xl p-4 border border-gray-700 flex flex-col gap-1">
      <p className="text-gray-400 text-xs">{label}</p>
      <p className="text-white text-xl font-bold">{value}</p>
      {sub && <p className="text-gray-500 text-xs">{sub}</p>}
    </div>
  )
}

function CupResult({ review, teams }: { review: SeasonReview; teams: import('../types/team').Team[] }) {
  const roundNames = ['Previa', 'Octavos', 'Cuartos', 'Semis', 'Final']

  if (review.cupWinnerId === null) {
    return (
      <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
        <p className="text-gray-400 text-xs mb-1">Copa</p>
        <p className="text-gray-500 text-sm">Copa no finalizada</p>
      </div>
    )
  }

  const winner = teams.find((t) => t.id === review.cupWinnerId)
  const userRounds = review.userCupRoundsWon
  const userResult = userRounds === 0
    ? 'No participó / eliminado en Previa'
    : userRounds === 5
    ? '¡Campeón de Copa!'
    : `Eliminado en ${roundNames[userRounds] ?? `ronda ${userRounds}`}`

  return (
    <div className="bg-gray-800 rounded-xl p-4 border border-gray-700 space-y-2">
      <div className="flex items-center gap-2">
        <Icon name="emoji_events" size="sm" className="text-yellow-400" />
        <p className="text-gray-300 text-sm font-semibold">Copa</p>
      </div>
      <div>
        <p className="text-gray-400 text-xs">Campeón</p>
        <TeamNameInline teamName={winner?.name ?? `Equipo ${review.cupWinnerId}`} badgeUrl={winner?.badgeUrl} textClassName="text-white font-bold" />
      </div>
      <div>
        <p className="text-gray-400 text-xs">Tu resultado</p>
        <p className={`text-sm font-medium ${userRounds === 5 ? 'text-yellow-400' : 'text-gray-300'}`}>
          {userResult}
        </p>
      </div>
    </div>
  )
}

export default function SeasonReviewScreen() {
  const career = useCareerStore((s) => s.career)
  const teams = useCareerStore((s) => s.teams)
  const startNewSeason = useCareerStore((s) => s.startNewSeason)

  if (!career) return null

  const review = career.lastSeasonReview
  if (!review) {
    return (
      <div className="h-full flex items-center justify-center bg-gray-900">
        <p className="text-gray-400">No hay resumen de temporada disponible.</p>
      </div>
    )
  }

  const { label, color, icon } = formatOutcome(review.userOutcome)
  const promotedTeams = review.promotedTeamIds.map((id) => teams.find((t) => t.id === id)).filter(Boolean)
  const relegatedTeams = review.relegatedTeamIds.map((id) => teams.find((t) => t.id === id)).filter(Boolean)

  return (
    <div className="h-full flex flex-col bg-gray-900 overflow-y-auto">
      {/* Header */}
      <div className="bg-gray-800 border-b border-gray-700 px-6 py-5">
        <p className="text-gray-400 text-sm">Temporada {review.seasonNumber} · {review.year}</p>
        <h1 className="text-white text-2xl font-bold mt-0.5">{review.leagueName}</h1>
      </div>

      <div className="flex-1 p-4 space-y-4 max-w-2xl mx-auto w-full">

        {/* Outcome banner */}
        <div className={`rounded-xl border-2 p-5 flex items-center gap-4 ${
          review.userOutcome === 'promoted'
            ? 'border-green-500/50 bg-green-900/20'
            : review.userOutcome === 'relegated'
            ? 'border-red-500/50 bg-red-900/20'
            : 'border-blue-500/50 bg-blue-900/20'
        }`}>
          <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
            review.userOutcome === 'promoted' ? 'bg-green-500/20' :
            review.userOutcome === 'relegated' ? 'bg-red-500/20' : 'bg-blue-500/20'
          }`}>
            <Icon name={icon} size="lg" className={color} />
          </div>
          <div>
            <p className={`text-xl font-extrabold tracking-wide ${color}`}>{label}</p>
            <p className="text-gray-300 text-sm mt-0.5">
              Posición final: <span className="font-bold text-white">#{review.finalPosition}</span>
              {' '}de {review.totalTeams} equipos
            </p>
          </div>
        </div>

        {/* Stats grid */}
        <div className="grid grid-cols-2 gap-3">
          <StatCard
            label="Posición final"
            value={`#${review.finalPosition}`}
            sub={`de ${review.totalTeams} equipos`}
          />
          <StatCard
            label="Objetivos completados"
            value={`${review.objectives.completed} / ${review.objectives.total}`}
            sub="objetivos conseguidos"
          />
        </div>

        {/* Cup */}
        <CupResult review={review} teams={teams} />

        {/* Movimientos */}
        {(promotedTeams.length > 0 || relegatedTeams.length > 0) && (
          <div className="bg-gray-800 rounded-xl p-4 border border-gray-700 space-y-3">
            <p className="text-gray-300 text-sm font-semibold">Movimientos de liga</p>

            {promotedTeams.length > 0 && (
              <div>
                <div className="flex items-center gap-1.5 mb-1">
                  <Icon name="arrow_upward" size="xs" className="text-green-400" />
                  <p className="text-green-400 text-xs font-semibold">Ascienden</p>
                </div>
                {promotedTeams.map((team) => (
                  <div key={team!.id} className="pl-5">
                    <TeamNameInline teamName={team!.name} badgeUrl={team!.badgeUrl} textClassName="text-gray-300" />
                  </div>
                ))}
              </div>
            )}

            {relegatedTeams.length > 0 && (
              <div>
                <div className="flex items-center gap-1.5 mb-1">
                  <Icon name="arrow_downward" size="xs" className="text-red-400" />
                  <p className="text-red-400 text-xs font-semibold">Descienden</p>
                </div>
                {relegatedTeams.map((team) => (
                  <div key={team!.id} className="pl-5">
                    <TeamNameInline teamName={team!.name} badgeUrl={team!.badgeUrl} textClassName="text-gray-300" />
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Start next season button */}
        <button
          onClick={startNewSeason}
          className="w-full bg-blue-600 hover:bg-blue-500 text-white font-semibold py-4 rounded-xl flex items-center justify-center gap-2 transition-colors"
        >
          <Icon name="play_arrow" size="sm" />
          Iniciar Temporada {review.seasonNumber + 1}
        </button>
      </div>
    </div>
  )
}
