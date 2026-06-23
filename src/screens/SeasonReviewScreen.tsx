import { useState, useEffect } from 'react'
import { useCareerStore } from '../store/careerStore'
import Icon from '../components/Icon'
import TeamNameInline from '../components/TeamNameInline'
import type { SeasonReview, UserSeasonOutcome } from '../types/season'
import { leagues } from '../data/leagues'
import { playOutcomeSound } from '../services/soundService'
import ObjectivesPanel from '../components/ObjectivesPanel'

function formatOutcome(outcome: UserSeasonOutcome): { label: string; color: string; icon: string } {
  switch (outcome) {
    case 'promoted':  return { label: 'ASCENSO', color: 'text-green-400', icon: 'arrow_upward' }
    case 'relegated': return { label: 'DESCENSO', color: 'text-red-400',   icon: 'arrow_downward' }
    case 'stayed':    return { label: 'PERMANENCIA', color: 'text-gold-500', icon: 'remove' }
  }
}

function StatCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="bg-dark-800/80 rounded-xl border border-gold-600/15 p-4 border border-gold-600/20 flex flex-col gap-1">
      <p className="text-gray-400 text-xs">{label}</p>
      <p className="text-white text-xl font-bold">{value}</p>
      {sub && <p className="text-gray-500 text-xs">{sub}</p>}
    </div>
  )
}

function CupResult({ review, teams, userTeamId }: { review: SeasonReview; teams: import('../types/team').Team[]; userTeamId: number }) {
  const roundNames = ['Previa', 'Octavos', 'Cuartos', 'Semis', 'Final']

  if (review.cupWinnerId === null) {
    return (
      <div className="bg-dark-800/80 rounded-xl border border-gold-600/15 p-4 border border-gold-600/20">
        <p className="text-gray-400 text-xs mb-1">Copa</p>
        <p className="text-gray-500 text-sm">Copa no finalizada</p>
      </div>
    )
  }

  const winner = teams.find((t) => t.id === review.cupWinnerId)
  const userRounds = review.userCupRoundsWon
  const userWonCup = review.cupWinnerId === userTeamId
  const userResult = userRounds === 0
    ? 'No participó / eliminado en Previa'
    : userWonCup
    ? '¡Campeón de Copa!'
    : `Eliminado en ${roundNames[userRounds] ?? `ronda ${userRounds}`}`

  return (
    <div className="bg-dark-800/80 rounded-xl border border-gold-600/15 p-4 border border-gold-600/20 space-y-2">
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
        <p className={`text-sm font-medium ${userWonCup ? 'text-yellow-400' : 'text-gray-300'}`}>
          {userResult}
        </p>
      </div>
    </div>
  )
}

const DIFFICULTY_OPTIONS = [
  { key: 'easy' as const,      label: 'Fácil',       desc: 'Objetivos asequibles, recompensas reducidas.',  color: 'text-green-400',  border: 'border-green-600/40' },
  { key: 'normal' as const,    label: 'Normal',      desc: 'Equilibrio estándar.',                           color: 'text-gold-400',   border: 'border-gold-600/40'  },
  { key: 'hard' as const,      label: 'Difícil',     desc: 'Objetivos exigentes, mejores recompensas.',     color: 'text-orange-400', border: 'border-orange-600/40'},
  { key: 'very_hard' as const, label: 'Muy difícil', desc: 'Objetivos ambiciosos, penalizaciones mayores.', color: 'text-red-400',    border: 'border-red-600/40'   },
]

export default function SeasonReviewScreen() {
  const career = useCareerStore((s) => s.career)
  const teams = useCareerStore((s) => s.teams)
  const startNewSeason = useCareerStore((s) => s.startNewSeason)

  // ── All hooks BEFORE early returns ──
  const [showReveal, setShowReveal] = useState(true)
  const [fading, setFading] = useState(false)
  const [showDifficultyModal, setShowDifficultyModal] = useState(false)

  const review = career?.lastSeasonReview ?? null

  const isChampion = review?.finalPosition === 1
  const isCupChampion = review?.cupWinnerId === career?.teamId
  const titleNames = [isChampion ? 'Liga' : null, isCupChampion ? 'Copa' : null].filter((title): title is string => title !== null)
  const hasWonTitle = titleNames.length > 0
  const revealDuration = (isChampion || (review?.userOutcome !== 'stayed')) ? 3500 : 2000

  const currentLeague = leagues.find((l) => l.id === review?.leagueId)
  const promotionTargetName = leagues.find((l) => l.id === currentLeague?.promotionTo)?.name ?? 'División Superior'
  const relegationTargetName = leagues.find((l) => l.id === currentLeague?.relegationTo)?.name ?? 'División Inferior'

  const overlayConfig = hasWonTitle
    ? { bg: 'from-yellow-950 to-yellow-900', icon: 'emoji_events', iconColor: 'text-yellow-400', title: '¡ENHORABUENA!', sub: `Campeón de ${titleNames.join(' y ')}`, titleColor: 'text-yellow-300' }
    : review?.userOutcome === 'promoted'
    ? { bg: 'from-green-950 to-green-900', icon: 'arrow_upward', iconColor: 'text-green-400', title: '¡ASCENSO!', sub: `→ ${promotionTargetName}`, titleColor: 'text-green-300' }
    : review?.userOutcome === 'relegated'
    ? { bg: 'from-red-950 to-red-900', icon: 'arrow_downward', iconColor: 'text-red-400', title: 'DESCENSO', sub: `→ ${relegationTargetName}`, titleColor: 'text-red-300' }
    : { bg: 'from-gray-900 to-gray-800', icon: 'remove', iconColor: 'text-gray-400', title: 'PERMANENCIA', sub: review?.leagueName ?? '', titleColor: 'text-gray-300' }

  useEffect(() => {
    if (!review) return
    playOutcomeSound(hasWonTitle ? 'champion' : review.userOutcome)
    const fadeTimer = setTimeout(() => setFading(true), revealDuration - 600)
    const hideTimer = setTimeout(() => setShowReveal(false), revealDuration)
    return () => { clearTimeout(fadeTimer); clearTimeout(hideTimer) }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Early returns AFTER hooks ──
  if (!career) return null

  if (!review) {
    return (
      <div className="h-full flex items-center justify-center bg-game">
        <div className="absolute inset-0 bg-dark-900/70" />
        <p className="relative text-gray-400">No hay resumen de temporada disponible.</p>
      </div>
    )
  }

  const { label, color, icon } = formatOutcome(review.userOutcome)
  const promotedTeams = review.promotedTeamIds.map((id) => teams.find((t) => t.id === id)).filter(Boolean)
  const relegatedTeams = review.relegatedTeamIds.map((id) => teams.find((t) => t.id === id)).filter(Boolean)
  const stats = review.stats
  const unclaimedObjectives = career.objectives.filter(
    (objective) => objective.completed && !objective.failed && !objective.claimed,
  )
  const hasUnclaimedRewards = unclaimedObjectives.length > 0

  return (
    <div className="h-full flex flex-col bg-game overflow-y-auto">
      {showReveal && (
        <div
          className={`fixed inset-0 z-50 bg-gradient-to-b ${overlayConfig.bg} flex flex-col items-center justify-center gap-6 transition-opacity duration-700`}
          style={{ opacity: fading ? 0 : 1, pointerEvents: fading ? 'none' : 'auto' }}
        >
          <div className="w-28 h-28 rounded-full bg-white/10 flex items-center justify-center">
            <span className={`material-icons ${overlayConfig.iconColor}`} style={{ fontSize: 64 }}>
              {overlayConfig.icon}
            </span>
          </div>
          <div className="text-center px-8">
            <p className={`text-5xl font-black tracking-widest ${overlayConfig.titleColor}`}>
              {overlayConfig.title}
            </p>
            <p className="text-gray-300 text-lg mt-2">{overlayConfig.sub}</p>
          </div>
          <p className="text-gray-500 text-sm">Temporada {review.seasonNumber}</p>
        </div>
      )}
      {/* Header */}
      <div className="bg-dark-800/80 border-b border-gold-600/20 px-6 py-5">
        <p className="text-gray-400 text-sm">Temporada {review.seasonNumber} · {review.year}</p>
        <h1 className="text-white text-2xl font-bold mt-0.5">{review.leagueName}</h1>
      </div>

      <div className="flex-1 p-4 space-y-4 max-w-2xl mx-auto w-full">

        {hasWonTitle && (
          <div className="rounded-xl border-2 border-yellow-500/50 bg-yellow-900/20 p-5 text-center">
            <Icon name="emoji_events" size="lg" className="text-yellow-400" />
            <p className="text-yellow-300 text-2xl font-black mt-2">¡Enhorabuena!</p>
            <p className="text-gray-200 text-sm mt-1">
              Has ganado {titleNames.length === 2 ? 'la Liga y la Copa' : `la ${titleNames[0]}`} esta temporada.
            </p>
          </div>
        )}

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

        {stats && (
          <div className="bg-dark-800/80 rounded-xl border border-gold-600/20 p-4 space-y-3">
            <p className="text-gray-300 text-sm font-semibold">Balance de la temporada</p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <StatCard label="Partidos" value={String(stats.matchesPlayed)} sub={`${stats.wins}V · ${stats.draws}E · ${stats.losses}D`} />
              <StatCard label="Puntos" value={String(stats.points)} sub={`${stats.winRate}% victorias`} />
              <StatCard label="Goles" value={`${stats.goalsFor}–${stats.goalsAgainst}`} sub={`Diferencia ${stats.goalDiff >= 0 ? '+' : ''}${stats.goalDiff}`} />
              <StatCard label="Porterías a cero" value={String(stats.cleanSheets)} sub={`Mejor racha: ${stats.bestWinStreak}V`} />
            </div>
          </div>
        )}

        {/* Cup */}
        <CupResult review={review} teams={teams} userTeamId={career.teamId} />

        {/* Movimientos */}
        {(promotedTeams.length > 0 || relegatedTeams.length > 0) && (
          <div className="bg-dark-800/80 rounded-xl border border-gold-600/15 p-4 border border-gold-600/20 space-y-3">
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

        {/* Objectives must be claimed before advancing */}
        <div className="space-y-2">
          {hasUnclaimedRewards && (
            <div className="flex items-start gap-3 rounded-xl border border-gold-500/50 bg-[#211b12] p-4">
              <Icon name="redeem" size="sm" className="text-gold-400 shrink-0 mt-0.5" />
              <div>
                <p className="text-gold-300 text-sm font-bold">
                  Tienes {unclaimedObjectives.length} recompensa{unclaimedObjectives.length === 1 ? '' : 's'} sin recoger
                </p>
                <p className="text-gray-300 text-xs mt-1">
                  Reclama todas las recompensas de objetivos antes de pasar a la siguiente temporada.
                </p>
              </div>
            </div>
          )}
          <ObjectivesPanel />
        </div>

        {/* Start next season button */}
        <button
          onClick={() => { if (!hasUnclaimedRewards) setShowDifficultyModal(true) }}
          disabled={hasUnclaimedRewards}
          className="w-full bg-gold-500 hover:bg-gold-400 disabled:bg-dark-700 disabled:text-gray-500 disabled:border-gray-700 text-dark-900 font-bold py-4 rounded-xl border border-gold-400 flex items-center justify-center gap-2 transition-colors disabled:cursor-not-allowed"
        >
          <Icon name={hasUnclaimedRewards ? 'lock' : 'play_arrow'} size="sm" />
          {hasUnclaimedRewards
            ? 'Recoge todas las recompensas para continuar'
            : `Pasar a la Temporada ${review.seasonNumber + 1}`}
        </button>
      </div>

      {/* Difficulty modal */}
      {showDifficultyModal && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
          <div className="bg-dark-800 border border-gold-600/30 rounded-2xl p-6 w-full max-w-sm space-y-4">
            <h2 className="text-white font-bold text-lg">Dificultad de objetivos</h2>
            <p className="text-gray-400 text-sm">Elige la dificultad de los objetivos para la temporada {review.seasonNumber + 1}.</p>
            <div className="space-y-2">
              {DIFFICULTY_OPTIONS.map(opt => (
                <button
                  key={opt.key}
                  onClick={() => { startNewSeason(opt.key); setShowDifficultyModal(false) }}
                  className={`w-full text-left p-3 rounded-xl border ${opt.border} bg-dark-700/60 hover:bg-dark-600/60 transition-colors`}
                >
                  <p className={`font-semibold text-sm ${opt.color}`}>{opt.label}</p>
                  <p className="text-gray-500 text-xs mt-0.5">{opt.desc}</p>
                </button>
              ))}
            </div>
            <button
              onClick={() => setShowDifficultyModal(false)}
              className="w-full py-2 text-gray-500 hover:text-gray-300 text-sm transition-colors"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
