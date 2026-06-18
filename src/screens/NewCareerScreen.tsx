import { useState, useMemo, useRef } from 'react'
import { useCareerStore } from '../store/careerStore'
import { teams } from '../data/teams'
import { players } from '../data/players'
import StepperBar from '../components/StepperBar'
import AvatarPicker from '../components/AvatarPicker'
import TeamSelectCard from '../components/TeamSelectCard'
import TeamBadgeImage from '../components/TeamBadgeImage'
import PositionSprite from '../components/PositionSprite'
import ElementBadge from '../components/ElementBadge'
import type { Team } from '../types/team'
import type { Stats } from '../types/player'
import { getPlayerStatsSummary } from '../types/player'
import { statColor } from '../components/StatBar'
import { DIFFICULTY_PRESETS, DEFAULT_DIFFICULTY } from '../types/career'
import type { DifficultySettings } from '../types/career'
import { assignSquadFromFreeAgents, buildCustomTeam } from '../services/customClubService'
import type { CustomClubConfig, StrengthTier } from '../types/team'

const STAT_KEYS: (keyof Stats)[] = ['POT', 'CON', 'TEC', 'PRE', 'FIS', 'AGI', 'INT']

type CareerMode = 'existing' | 'custom' | null
type DifficultyMode = 'easy' | 'normal' | 'hard' | 'custom'

const STEPS_EXISTING = ['Entrenador', 'Modo equipo', 'Equipo', 'Dificultad', 'Confirmar']
const STEPS_CUSTOM   = ['Entrenador', 'Modo equipo', 'Nombre', 'Emblema', 'Nivel de plantilla', 'Dificultad', 'Confirmar']

const PRESET_BADGES = [
  '/teams/Raimon.webp',
  '/teams/brain.webp',
  '/teams/farm.webp',
  '/teams/Inazuma Kids FC.webp',
  '/teams/Kirkwood.webp',
  '/teams/Occult.webp',
  '/teams/Otaku.webp',
  '/teams/Raimon Veterans.webp',
  '/teams/Royal Academy.webp',
  '/teams/Shuriken.webp',
  "/teams/Street Sally's.webp",
  '/teams/Umbrellla MS.webp',
  '/teams/Wild.webp',
  '/teams/Zeus.png',
  '/teams/default_team_icon.png',
]

const STRENGTH_OPTIONS: Array<{ tier: StrengthTier; label: string; description: string; color: string }> = [
  { tier: 'weak',        label: 'Débil',       description: 'Empieza desde abajo.',        color: 'orange' },
  { tier: 'normal',      label: 'Normal',      description: 'Plantilla equilibrada.',  color: 'blue' },
  { tier: 'strong',      label: 'Fuerte',      description: 'Equipo competitivo.',       color: 'green' },
  { tier: 'very_strong', label: 'Muy fuerte',  description: 'Los mejores agentes libres.',              color: 'purple' },
]

const LEAGUE_LABELS: Record<string, string> = {
  first_division: 'Primera División',
  second_division: 'Segunda División',
}

function DiffSlider({
  label, value, min, max, step, format, onChange,
}: {
  label: string; value: number; min: number; max: number; step: number
  format: (v: number) => string; onChange: (v: number) => void
}) {
  return (
    <div className="flex items-center gap-3">
      <span className="text-gray-300 text-sm flex-1">{label}</span>
      <input
        type="range" min={min} max={max} step={step} value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="w-28 accent-purple-500"
      />
      <span className="text-purple-300 text-sm w-12 text-right tabular-nums">{format(value)}</span>
    </div>
  )
}

function DiffStepper({
  label, value, min, max, onChange,
}: {
  label: string; value: number; min: number; max: number; onChange: (v: number) => void
}) {
  return (
    <div className="flex items-center gap-3">
      <span className="text-gray-300 text-sm flex-1">{label}</span>
      <button
        onClick={() => onChange(Math.max(min, value - 1))}
        className="w-7 h-7 rounded-lg bg-dark-700/80 hover:bg-dark-600/80 text-white text-sm font-bold flex items-center justify-center"
      >−</button>
      <span className="text-purple-300 text-sm w-8 text-center tabular-nums font-medium">{value}</span>
      <button
        onClick={() => onChange(Math.min(max, value + 1))}
        className="w-7 h-7 rounded-lg bg-dark-700/80 hover:bg-dark-600/80 text-white text-sm font-bold flex items-center justify-center"
      >+</button>
    </div>
  )
}

export default function NewCareerScreen() {
  const navigate = useCareerStore((s) => s.navigate)
  const startNewCareer = useCareerStore((s) => s.startNewCareer)

  const [step, setStep] = useState(0)
  const [managerName, setManagerName] = useState('')
  const [managerAvatar, setManagerAvatar] = useState('/avatars/avatar-1.svg')
  const [selectedTeamId, setSelectedTeamId] = useState<number | null>(null)
  const [nameStyle, setNameStyle] = useState<'western' | 'japanese'>('western')
  const [difficultyMode, setDifficultyMode] = useState<DifficultyMode>('normal')
  const [difficulty, setDifficulty] = useState<DifficultySettings>(DEFAULT_DIFFICULTY)
  const [careerMode, setCareerMode] = useState<CareerMode>(null)
  const [clubName, setClubName] = useState('')
  const [clubBadgeUrl, setClubBadgeUrl] = useState('/teams/default_team_icon.png')
  const [clubBadgeIsCustom, setClubBadgeIsCustom] = useState(false)
  const [clubStrength, setClubStrength] = useState<StrengthTier | null>(null)
  const [clubLeagueId, setClubLeagueId] = useState<string | null>(null)
  const badgeFileRef = useRef<HTMLInputElement>(null)

  const steps = careerMode === 'custom' ? STEPS_CUSTOM : STEPS_EXISTING

  const customClubPreview = useMemo(() => {
    if (careerMode !== 'custom' || !clubStrength || !clubLeagueId) return null
    const config: CustomClubConfig = {
      name: clubName.trim() || 'Mi Club',
      badgeUrl: clubBadgeUrl,
      badgeIsCustom: clubBadgeIsCustom,
      strengthTier: clubStrength,
      leagueId: clubLeagueId,
    }
    const { playerIds, lineup } = assignSquadFromFreeAgents(config, players)
    const team = buildCustomTeam(config, teams, playerIds, lineup)
    const squadPlayers = players.filter((p) => playerIds.includes(p.id))
    return { team, playerIds, lineup, squadPlayers }
  }, [careerMode, clubName, clubBadgeUrl, clubBadgeIsCustom, clubStrength, clubLeagueId])

  const selectedTeam: Team | undefined = teams.find((t) => t.id === selectedTeamId)
  const squadPlayers = selectedTeam
    ? players.filter((p) => selectedTeam.playerIds.includes(p.id))
    : []
  const starters = squadPlayers.filter((p) => {
    const slot = selectedTeam?.lineup.find((l) => l.playerId === p.id)
    return slot?.isStarter
  })

  function canProceed(): boolean {
    if (step === 0) return managerName.trim().length > 0
    if (step === 1) return careerMode !== null
    if (careerMode === 'existing') {
      if (step === 2) return selectedTeamId !== null
    } else {
      if (step === 2) return clubName.trim().length > 0
      if (step === 3) return true   // badge has default
      if (step === 4) return clubStrength !== null && clubLeagueId !== null
    }
    return true
  }

  function handleCreate() {
    if (!managerName.trim()) return
    if (careerMode === 'existing') {
      if (selectedTeamId === null) return
      startNewCareer(managerName.trim(), selectedTeamId, managerAvatar, difficulty, undefined, nameStyle)
    } else if (customClubPreview) {
      startNewCareer(
        managerName.trim(),
        customClubPreview.team.id,
        managerAvatar,
        difficulty,
        { team: customClubPreview.team, squadPlayerIds: customClubPreview.playerIds },
        nameStyle,
      )
    }
  }

  return (
    <div className="h-full flex flex-col bg-menu">
      <div className="absolute inset-0 bg-dark-900/70 pointer-events-none" />
      <div className="relative flex flex-col h-full overflow-hidden">
      <StepperBar steps={steps} current={step} />

      <div className="flex-1 overflow-y-auto">
        {/* ── STEP 0: Coach ── */}
        {step === 0 && (
          <div className="max-w-xl w-full h-full mx-auto px-6 py-10 flex items-center justify-center">
            <div className="panel overflow-hidden w-full">
              <div className="panel-header text-[0.48rem] md:text-[0.52rem] leading-relaxed">Crear Entrenador</div>
              <div className="p-8 flex flex-col gap-8">
                <div>
                  <label className="block text-gray-300 text-[0.7rem] font-semibold mb-2">
                    Nombre del Entrenador
                  </label>
                  <input
                    type="text"
                    value={managerName}
                    onChange={(e) => setManagerName(e.target.value)}
                    placeholder="Tu nombre..."
                    maxLength={30}
                    className="w-full bg-dark-800/80 border border-gold-600/30 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-gold-500 transition-colors text-sm"
                  />
                </div>

                <div>
                  <label className="block text-gray-300 text-[0.7rem] font-semibold mb-3">
                    Avatar del Entrenador
                  </label>
                  <AvatarPicker value={managerAvatar} onChange={setManagerAvatar} />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── STEP 1: Mode selection ── */}
        {step === 1 && (
          <div className="max-w-xl w-full h-full mx-auto px-6 py-10 flex items-center justify-center">
            <div className="panel overflow-hidden w-full">
              <div className="panel-header text-[0.48rem] md:text-[0.52rem] leading-relaxed">Modo</div>
              <div className="p-8 flex flex-col gap-8">
                <div className="flex flex-col gap-4">
                  <button
                    onClick={() => setCareerMode('existing')}
                    className={`text-left p-5 rounded-2xl border-2 transition-colors ${careerMode === 'existing' ? 'border-gold-500 bg-gold-900/20' : 'border-gold-600/20 bg-dark-800/60 hover:border-gold-500/60'}`}
                  >
                    <div className="flex items-center gap-3 mb-2">
                      <span className="material-icons text-gold-500 text-3xl">sports_soccer</span>
                      <p className="text-white text-sm font-bold">Equipo existente</p>
                    </div>
                    <p className="text-gray-400 text-[0.7rem]">Elige uno de los equipos existentes.</p>
                  </button>
                  <button
                    onClick={() => setCareerMode('custom')}
                    className={`text-left p-5 rounded-2xl border-2 transition-colors ${careerMode === 'custom' ? 'border-gold-500 bg-gold-900/20' : 'border-gold-600/20 bg-dark-800/60 hover:border-gold-500/60'}`}
                  >
                    <div className="flex items-center gap-3 mb-2">
                      <span className="material-icons text-gold-500 text-3xl">add_circle</span>
                      <p className="text-white text-sm font-bold">Crear club propio</p>
                    </div>
                    <p className="text-gray-400 text-[0.7rem]">Diseña tu club desde cero</p>
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── STEP 2b: Club name ── */}
        {step === 2 && careerMode === 'custom' && (
          <div className="max-w-lg w-full h-full mx-auto px-6 py-8 flex items-center justify-center">
            <div className="panel overflow-hidden w-full">
              <div className="panel-header text-[0.48rem] md:text-[0.52rem] leading-relaxed">Nombre</div>
              <div className="p-6 flex flex-col gap-6">
                <div>
                  <p className="text-gray-400 text-sm">¿Cómo se llamará tu club?</p>
                </div>
                <div>
                  <label className="block text-gray-300 text-sm font-semibold mb-2">
                    Nombre del club
                  </label>
                  <input
                    type="text"
                    value={clubName}
                    onChange={(e) => setClubName(e.target.value)}
                    placeholder="Nombre del club..."
                    maxLength={25}
                    className="w-full bg-dark-800/80 border border-gold-600/30 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-gold-500 transition-colors text-lg"
                  />
                  <p className={`text-xs mt-1 text-right ${clubName.length >= 25 ? 'text-red-400' : 'text-gray-500'}`}>
                    {clubName.length}/25
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── STEP 3b: Badge picker ── */}
        {step === 3 && careerMode === 'custom' && (
          <div className="max-w-2xl w-full h-full mx-auto px-6 py-8 flex items-center justify-center">
            <div className="panel overflow-hidden w-full">
              <div className="panel-header text-[0.48rem] md:text-[0.52rem] leading-relaxed">Emblema</div>
              <div className="p-6 flex flex-col gap-6">
              <div>
              <p className="text-gray-400 text-sm">Elige el emblema que representará a tu club.</p>
            </div>
            <div className="flex gap-6">
              {/* Left: preset grid */}
              <div className="flex-1">
                <p className="text-gray-400 text-xs font-semibold uppercase tracking-wide mb-3">Emblemas predeterminados</p>
                <div className="grid grid-cols-5 gap-2">
                  {PRESET_BADGES.map((url) => (
                    <button
                      key={url}
                      type="button"
                      onClick={() => { setClubBadgeUrl(url); setClubBadgeIsCustom(false) }}
                      className={`p-1 rounded-xl border-2 transition-all ${clubBadgeUrl === url && !clubBadgeIsCustom ? 'border-gold-400/60 bg-dark-700/60' : 'border-gold-600/20 bg-dark-800/60 hover:border-gold-500/60'}`}
                    >
                      <img src={url} alt="" className="w-10 h-10 object-contain mx-auto" />
                    </button>
                  ))}
                </div>
                <div className="mt-4">
                  <button
                    type="button"
                    onClick={() => badgeFileRef.current?.click()}
                    className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border-2 text-sm font-semibold transition-colors ${clubBadgeIsCustom ? 'border-gold-400/60 bg-dark-700/60 text-purple-300' : 'border-gold-600/20 bg-dark-800/60 text-gray-300 hover:border-gold-500/50'}`}
                  >
                    <span className="material-icons text-lg">upload</span>
                    {clubBadgeIsCustom ? 'Imagen personalizada seleccionada' : 'Subir imagen propia'}
                  </button>
                  <input
                    ref={badgeFileRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0]
                      if (!file) return
                      const reader = new FileReader()
                      reader.onload = (ev) => {
                        const result = ev.target?.result
                        if (typeof result === 'string') {
                          setClubBadgeUrl(result)
                          setClubBadgeIsCustom(true)
                        }
                      }
                      reader.readAsDataURL(file)
                    }}
                  />
                </div>
              </div>
              {/* Right: preview */}
              <div className="w-48 flex-shrink-0 flex flex-col items-center gap-3 pt-6">
                <TeamBadgeImage teamName={clubName || 'Mi Club'} badgeUrl={clubBadgeUrl} size="xl" />
                <p className="text-white font-bold text-center text-sm leading-tight">{clubName || 'Mi Club'}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
        )}

        {/* ── STEP 4b: Strength + League ── */}
        {step === 4 && careerMode === 'custom' && (
          <div className="max-w-lg w-full h-full mx-auto px-6 py-8 flex items-center justify-center">
            <div className="panel overflow-hidden w-full">
              <div className="panel-header text-[0.48rem] md:text-[0.52rem] leading-relaxed">Nivel de plantilla</div>
              <div className="p-6 flex flex-col gap-8">
                <div>
                  <p className="text-gray-400 text-sm">Elige el nivel de tu plantilla inicial y la liga donde empezarás.</p>
                </div>

                {/* Strength */}
                <div>
                  <p className="text-gray-400 text-xs font-semibold uppercase tracking-wide mb-3">Nivel de la plantilla</p>
                  <div className="grid grid-cols-2 gap-3">
                    {STRENGTH_OPTIONS.map(({ tier, label, description, color }) => {
                      const colorMap: Record<string, string> = {
                        orange: 'border-orange-500 bg-orange-900/20',
                        blue: 'border-gold-500 bg-gold-900/20',
                        green: 'border-green-500 bg-green-900/20',
                        purple: 'border-gold-400/60 bg-dark-700/60',
                      }
                      const labelColorMap: Record<string, string> = {
                        orange: 'text-orange-400', blue: 'text-gold-500',
                        green: 'text-green-400', purple: 'text-purple-400',
                      }
                      const isSelected = clubStrength === tier
                      return (
                        <button
                          key={tier}
                          onClick={() => setClubStrength(tier)}
                          className={`text-left p-4 rounded-2xl border-2 transition-colors ${isSelected ? colorMap[color] : 'border-gold-600/20 bg-dark-800/60 hover:border-gold-500/60'}`}
                        >
                          <p className={`text-lg font-bold mb-1 ${isSelected ? labelColorMap[color] : 'text-gray-300'}`}>{label}</p>
                          <p className="text-gray-400 text-xs">{description}</p>
                        </button>
                      )
                    })}
                  </div>
                </div>

                {/* League */}
                <div>
                  <p className="text-gray-400 text-xs font-semibold uppercase tracking-wide mb-3">Liga inicial</p>
                  <div className="flex flex-col gap-3">
                    {[
                      { id: 'first_division',  label: 'Primera División' },
                      { id: 'second_division', label: 'Segunda División' },
                    ].map(({ id, label }) => (
                      <button
                        key={id}
                        onClick={() => setClubLeagueId(id)}
                        className={`text-left p-4 rounded-2xl border-2 transition-colors ${clubLeagueId === id ? 'border-yellow-500 bg-yellow-900/20' : 'border-gold-600/20 bg-dark-800/60 hover:border-gold-500/60'}`}
                      >
                        <p className={`font-bold mb-0.5 ${clubLeagueId === id ? 'text-yellow-300' : 'text-gray-300'}`}>{label}</p>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── STEP 2: Team ── */}
        {step === 2 && careerMode === 'existing' && (
          <div className="max-w-7xl w-full mx-auto px-6 py-8 h-full">
            <div className="panel overflow-hidden h-full">
              <div className="grid h-full grid-cols-1 lg:grid-cols-[320px_minmax(0,1fr)]">
                <div className="border-b lg:border-b-0 lg:border-r border-gold-600/20 flex flex-col min-h-0">
                  <div className="panel-header text-[0.48rem] md:text-[0.52rem] leading-relaxed">Selecciona tu equipo</div>
                  <div className="overflow-y-auto p-4 flex flex-col gap-2 min-h-0">
                    {teams.map((team) => (
                      <TeamSelectCard
                        key={team.id}
                        team={team}
                        isSelected={selectedTeamId === team.id}
                        onClick={() => setSelectedTeamId(team.id)}
                      />
                    ))}
                  </div>
                </div>

                <div className="overflow-y-auto min-h-0">
                  {selectedTeam ? (
                    <div className="flex flex-col h-full">
                      <div className="panel-header text-[0.48rem] md:text-[0.52rem] leading-relaxed">Equipo</div>
                      <div className="p-6 flex flex-col gap-6">
                        <div className="bg-dark-900/40 rounded-2xl border border-gold-600/20 p-5 flex items-center gap-5">
                          <TeamBadgeImage teamName={selectedTeam.name} badgeUrl={selectedTeam.badgeUrl} size="lg" />
                          <div>
                            <h2 className="text-white text-xl font-bold">{selectedTeam.name}</h2>
                            <p className="text-gray-400 text-sm">{LEAGUE_LABELS[selectedTeam.leagueId]}</p>
                            <p className="text-gray-500 text-xs">Tier {selectedTeam.tier} · Reputación {selectedTeam.reputation}</p>
                          </div>
                        </div>

                        <div>
                          <p className="text-gray-400 text-xs font-semibold uppercase tracking-wide mb-3">
                            Plantilla titular ({starters.length} jugadores)
                          </p>
                          <div className="flex flex-col gap-2">
                            {starters.map((p) => (
                              <div key={p.id} className="flex items-center gap-3 bg-dark-900/40 rounded-xl border border-gold-600/15 px-3 py-2.5">
                                <img
                                  src={p.spriteUrl}
                                  alt={p.name}
                                  onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none' }}
                                  className="w-16 h-16 object-contain rounded flex-shrink-0"
                                />
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 mb-1.5">
                                    <span className="text-white text-sm font-semibold truncate">{p.name}</span>
                                    <PositionSprite position={p.position} size={25} />
                                    <ElementBadge element={p.element} size="xs" />
                                  </div>
                                  <div className="flex items-end gap-3">
                                    {STAT_KEYS.map((stat) => (
                                      <div key={stat} className="flex flex-col items-center">
                                        <span className="text-gray-500 text-[0.5625rem] uppercase leading-none mb-0.5">{stat}</span>
                                        <span className="text-gray-300 text-xs font-medium">{p.stats[stat]}</span>
                                      </div>
                                    ))}
                                    <div className="ml-auto flex flex-col items-center">
                                      <span className="text-gray-500 text-[0.5625rem] uppercase leading-none mb-0.5">Media</span>
                                      <span className="text-sm font-bold" style={{ color: statColor(getPlayerStatsSummary(p).media, 250) }}>{getPlayerStatsSummary(p).media}</span>
                                      <span className="text-gray-500 text-[0.5625rem] tabular-nums">{getPlayerStatsSummary(p).total}</span>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="h-full flex items-center justify-center text-gray-600 p-8">
                      <p>Selecciona un equipo para ver su plantilla</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── STEP 2: Difficulty ── */}
        {((step === 3 && careerMode === 'existing') || (step === 5 && careerMode === 'custom')) && (
          <div className="max-w-2xl w-full h-full mx-auto px-6 py-8 flex items-center justify-center">
            <div className="panel overflow-hidden w-full">
              <div className="panel-header text-[0.48rem] md:text-[0.52rem] leading-relaxed">Dificultad</div>
              <div className="p-6 flex flex-col gap-6">
                <div>
                  <p className="text-gray-400 text-[0.7rem]">Elige el nivel de desafío de tu carrera.</p>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => { setDifficultyMode('easy'); setDifficulty(DIFFICULTY_PRESETS.easy) }}
                    className={`text-left p-4 rounded-2xl border-2 transition-colors ${difficultyMode === 'easy' ? 'border-green-500 bg-green-900/20' : 'border-gold-600/20 bg-dark-800/60 hover:border-gold-500/60'}`}
                  >
                    <p className="text-green-400 text-sm font-bold mb-1">Fácil</p>
                    <p className="text-gray-400 text-xs">Más presupuesto, rivales más débiles...</p>
                  </button>

                  <button
                    onClick={() => { setDifficultyMode('normal'); setDifficulty(DIFFICULTY_PRESETS.normal) }}
                    className={`text-left p-4 rounded-2xl border-2 transition-colors ${difficultyMode === 'normal' ? 'border-gold-500 bg-gold-900/20' : 'border-gold-600/20 bg-dark-800/60 hover:border-gold-500/60'}`}
                  >
                    <p className="text-gold-500 text-sm font-bold mb-1">Normal</p>
                    <p className="text-gray-400 text-xs">Experiencia equilibrada.</p>
                  </button>

                  <button
                    onClick={() => { setDifficultyMode('hard'); setDifficulty(DIFFICULTY_PRESETS.hard) }}
                    className={`text-left p-4 rounded-2xl border-2 transition-colors ${difficultyMode === 'hard' ? 'border-red-500 bg-red-900/20' : 'border-gold-600/20 bg-dark-800/60 hover:border-gold-500/60'}`}
                  >
                    <p className="text-red-400 text-sm font-bold mb-1">Difícil</p>
                    <p className="text-gray-400 text-xs">Solo para los más exigentes.</p>
                  </button>

                  <button
                    onClick={() => setDifficultyMode('custom')}
                    className={`text-left p-4 rounded-2xl border-2 transition-colors ${difficultyMode === 'custom' ? 'border-gold-400/60 bg-dark-700/60' : 'border-gold-600/20 bg-dark-800/60 hover:border-gold-500/60'}`}
                  >
                    <p className="text-purple-400 text-sm font-bold mb-1">Custom</p>
                    <p className="text-gray-400 text-xs">Configura manualmente cada parámetro.</p>
                  </button>
                </div>

                {difficultyMode === 'custom' && (
                  <div className="bg-dark-800/80 rounded-2xl border border-gold-600/20 p-5 flex flex-col gap-5">
                    <p className="text-white font-semibold text-sm uppercase tracking-wide">Configuración avanzada</p>

                    <div>
                      <p className="text-gray-400 text-xs font-semibold uppercase tracking-wide mb-3">Partidos</p>
                      <DiffSlider label="Fuerza rivales" value={difficulty.aiStrengthMultiplier} min={0.7} max={1.3} step={0.05} format={(v) => `×${v.toFixed(2)}`} onChange={(v) => setDifficulty((d) => ({ ...d, aiStrengthMultiplier: v }))} />
                    </div>

                    <div>
                      <p className="text-gray-400 text-xs font-semibold uppercase tracking-wide mb-3">Energía</p>
                      <div className="flex flex-col gap-3">
                        <DiffStepper label="Stamina recuperada/día" value={difficulty.staminaRecoveryPerDay} min={3} max={15} onChange={(v) => setDifficulty((d) => ({ ...d, staminaRecoveryPerDay: v }))} />
                        <DiffStepper label="Desgaste titular/partido" value={difficulty.starterStaminaDrain} min={15} max={35} onChange={(v) => setDifficulty((d) => ({ ...d, starterStaminaDrain: v }))} />
                        <DiffStepper label="Desgaste banquillo/partido" value={difficulty.benchStaminaDrain} min={4} max={15} onChange={(v) => setDifficulty((d) => ({ ...d, benchStaminaDrain: v }))} />
                      </div>
                    </div>

                    <div>
                      <p className="text-gray-400 text-xs font-semibold uppercase tracking-wide mb-3">Entrenamiento</p>
                      <DiffSlider label="Ganancia de entrenamiento" value={difficulty.trainingGainMultiplier} min={0.5} max={2.0} step={0.05} format={(v) => `×${v.toFixed(2)}`} onChange={(v) => setDifficulty((d) => ({ ...d, trainingGainMultiplier: v }))} />
                    </div>

                    <div>
                      <p className="text-gray-400 text-xs font-semibold uppercase tracking-wide mb-3">Crecimiento</p>
                      <div className="flex flex-col gap-3">
                        <DiffSlider label="Crecimiento temporal" value={difficulty.seasonGrowthMultiplier} min={0.5} max={2.0} step={0.05} format={(v) => `×${v.toFixed(2)}`} onChange={(v) => setDifficulty((d) => ({ ...d, seasonGrowthMultiplier: v }))} />
                        <DiffSlider label="Velocidad cambio de posición" value={difficulty.positionChangeDaysMultiplier} min={0.5} max={2.0} step={0.05} format={(v) => `×${v.toFixed(2)}`} onChange={(v) => setDifficulty((d) => ({ ...d, positionChangeDaysMultiplier: v }))} />
                      </div>
                    </div>

                    <div>
                      <p className="text-gray-400 text-xs font-semibold uppercase tracking-wide mb-3">Finanzas</p>
                      <div className="flex flex-col gap-3">
                        <DiffSlider label="Coste de fichajes" value={difficulty.transferCostMultiplier} min={0.5} max={2.0} step={0.05} format={(v) => `×${v.toFixed(2)}`} onChange={(v) => setDifficulty((d) => ({ ...d, transferCostMultiplier: v }))} />
                        <DiffSlider label="Presupuesto inicial" value={difficulty.budgetMultiplier} min={0.5} max={2.0} step={0.05} format={(v) => `×${v.toFixed(2)}`} onChange={(v) => setDifficulty((d) => ({ ...d, budgetMultiplier: v }))} />
                      </div>
                    </div>

                    <div>
                      <p className="text-gray-400 text-xs font-semibold uppercase tracking-wide mb-3">Recompensas por partido</p>
                      <div className="flex gap-2">
                        {([1, 2, 3] as const).map((n) => (
                          <button
                            key={n}
                            onClick={() => setDifficulty((d) => ({ ...d, rewardChoices: n }))}
                            className={`w-12 h-10 rounded-lg font-bold text-sm transition-colors border ${difficulty.rewardChoices === n ? 'bg-gold-600 text-dark-900' : 'bg-dark-700/80 text-gray-300 hover:bg-dark-600/80 border border-gold-600/15'}`}
                          >
                            {n}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                <div className="bg-dark-900/40 rounded-2xl border border-gold-600/20 p-4">
                  <p className="text-white text-[0.7rem] font-semibold mb-1">Nombres de jugadores</p>
                  <p className="text-gray-400 text-xs mb-3">Elige cómo se muestran los nombres en todo el juego.</p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setNameStyle('western')}
                      className={`flex-1 py-2 rounded-xl text-[0.7rem] font-semibold transition-colors ${nameStyle === 'western' ? 'bg-gold-600/25 text-gold-300 border border-gold-500/60' : 'bg-dark-700/80 text-gray-300 hover:bg-dark-600/80 border border-gold-600/15'}`}
                    >
                      Occidentales <span className="text-xs opacity-70">(Mark Evans)</span>
                    </button>
                    <button
                      onClick={() => setNameStyle('japanese')}
                      className={`flex-1 py-2 rounded-xl text-[0.7rem] font-semibold transition-colors ${nameStyle === 'japanese' ? 'bg-gold-600/25 text-gold-300 border border-gold-500/60' : 'bg-dark-700/80 text-gray-300 hover:bg-dark-600/80 border border-gold-600/15'}`}
                    >
                      Japoneses <span className="text-xs opacity-70">(Mamoru Endo)</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── STEP 3: Confirm (existing team) ── */}
        {step === 4 && careerMode === 'existing' && selectedTeam && (
          <div className="max-w-3xl w-full h-full mx-auto px-6 py-8 flex items-center justify-center">
            <div className="panel overflow-hidden w-full max-w-5xl">
              <div className="panel-header text-[0.48rem] md:text-[0.52rem] leading-relaxed">Confirmar</div>
              <div className="p-4 space-y-4">
                <div className="grid grid-cols-[minmax(0,1fr)_18rem] gap-4">
                  <div className="bg-dark-900/40 rounded-xl border border-gold-600/20 overflow-hidden">
                    <div className="panel-header flex items-center justify-between border-b border-gold-600/20">
                      <span>Plantilla titular</span>
                      <span className="text-gray-500">{starters.length}</span>
                    </div>
                    <div className="p-3 space-y-2 max-h-[29rem] overflow-y-auto">
                      {starters.map((p) => (
                        <div key={p.id} className="bg-dark-800/40 rounded-xl border border-gold-600/15 px-3 py-2 flex items-center gap-3">
                          <img
                            src={p.spriteUrl}
                            alt={p.name}
                            onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none' }}
                            className="w-14 h-14 object-contain rounded shrink-0"
                          />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-white text-sm font-semibold truncate">{p.name}</span>
                              <PositionSprite position={p.position} size={25} />
                              <ElementBadge element={p.element} size="xs" />
                            </div>
                            <div className="flex items-end gap-3">
                              {STAT_KEYS.map((stat) => (
                                <div key={stat} className="flex flex-col items-center">
                                  <span className="text-gray-500 text-[0.5625rem] uppercase leading-none mb-0.5">{stat}</span>
                                  <span className="text-gray-300 text-xs font-medium">{p.stats[stat]}</span>
                                </div>
                              ))}
                              <div className="ml-auto flex flex-col items-center">
                                <span className="text-gray-500 text-[0.5625rem] uppercase leading-none mb-0.5">Media</span>
                                <span className="text-sm font-bold" style={{ color: statColor(getPlayerStatsSummary(p).media, 250) }}>{getPlayerStatsSummary(p).media}</span>
                                <span className="text-gray-500 text-[0.5625rem] tabular-nums">{getPlayerStatsSummary(p).total}</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div className="bg-dark-900/40 rounded-xl border border-gold-600/20 p-4 flex items-center gap-3">
                      <img
                        src={managerAvatar}
                        alt="Entrenador"
                        onError={(e) => { (e.currentTarget as HTMLImageElement).src = '/avatars/avatar-1.svg' }}
                        className="w-14 h-14 rounded-full object-cover bg-dark-700/60 shrink-0"
                      />
                      <div className="min-w-0">
                        <p className="text-gray-400 text-xs uppercase tracking-wide mb-0.5">Entrenador</p>
                        <p className="text-white text-lg font-bold truncate">{managerName}</p>
                      </div>
                    </div>

                    <div className="bg-dark-900/40 rounded-xl border border-gold-600/20 p-4 flex items-center gap-3">
                      <TeamBadgeImage teamName={selectedTeam.name} badgeUrl={selectedTeam.badgeUrl} size="md" />
                      <div className="min-w-0">
                        <p className="text-gray-400 text-xs uppercase tracking-wide mb-0.5">Equipo</p>
                        <p className="text-white text-lg font-bold truncate">{selectedTeam.name}</p>
                        <p className="text-gray-400 text-xs">{LEAGUE_LABELS[selectedTeam.leagueId]}</p>
                        <p className="text-gray-500 text-xs truncate">Tier {selectedTeam.tier} · Reputación {selectedTeam.reputation}</p>
                      </div>
                    </div>

                    <div className="bg-dark-900/40 rounded-xl border border-gold-600/20 p-4">
                      <p className="text-gray-400 text-xs uppercase tracking-wide mb-2">Dificultad</p>
                      <div className="flex items-center gap-3 flex-wrap">
                        {difficultyMode === 'easy' && <span className="text-green-400 font-bold text-lg">Fácil</span>}
                        {difficultyMode === 'normal' && <span className="text-gold-500 font-bold text-lg">Normal</span>}
                        {difficultyMode === 'hard' && <span className="text-red-400 font-bold text-lg">Difícil</span>}
                        {difficultyMode === 'custom' && <span className="text-purple-400 font-bold text-lg">Custom</span>}
                      </div>
                      {difficultyMode === 'custom' && (
                        <div className="mt-3 space-y-1">
                          {[
                            ['Fuerza rivales', `×${difficulty.aiStrengthMultiplier.toFixed(2)}`],
                            ['Stamina/día', `${difficulty.staminaRecoveryPerDay} pts`],
                            ['Desgaste titular', `${difficulty.starterStaminaDrain} pts`],
                            ['Desgaste banquillo', `${difficulty.benchStaminaDrain} pts`],
                            ['Entrenamiento', `×${difficulty.trainingGainMultiplier.toFixed(2)}`],
                            ['Crecimiento temporal', `×${difficulty.seasonGrowthMultiplier.toFixed(2)}`],
                            ['Cambio posición', `×${difficulty.positionChangeDaysMultiplier.toFixed(2)}`],
                            ['Coste fichajes', `×${difficulty.transferCostMultiplier.toFixed(2)}`],
                            ['Presupuesto inicial', `×${difficulty.budgetMultiplier.toFixed(2)}`],
                            ['Recompensas/partido', `${difficulty.rewardChoices}`],
                          ].map(([key, val]) => (
                            <div key={key} className="flex justify-between text-xs py-0.5 gap-3">
                              <span className="text-gray-500">{key}</span>
                              <span className="text-gray-300 font-medium tabular-nums text-right">{val}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
        {/* ── STEP 6: Confirm (custom club) ── */}
        {step === 6 && careerMode === 'custom' && customClubPreview && (
          <div className="max-w-3xl w-full h-full mx-auto px-6 py-8 flex items-center justify-center">
            <div className="panel overflow-hidden w-full max-w-5xl">
              <div className="panel-header text-[0.48rem] md:text-[0.52rem] leading-relaxed">Confirmar</div>
              <div className="p-4 space-y-4">
                <div className="grid grid-cols-[minmax(0,1fr)_18rem] gap-4">
                  <div className="bg-dark-900/40 rounded-xl border border-gold-600/20 overflow-hidden">
                    <div className="panel-header flex items-center justify-between border-b border-gold-600/20">
                      <span>Plantilla inicial</span>
                      <span className="text-gray-500">{customClubPreview.squadPlayers.filter(p => customClubPreview.lineup.find(l => l.playerId === p.id && l.isStarter)).length}</span>
                    </div>
                    <div className="p-3 space-y-2 max-h-[29rem] overflow-y-auto">
                      {customClubPreview.squadPlayers
                        .filter((p) => customClubPreview.lineup.find((l) => l.playerId === p.id && l.isStarter))
                        .map((p) => (
                          <div key={p.id} className="bg-dark-800/40 rounded-xl border border-gold-600/15 px-3 py-2 flex items-center gap-3">
                            <img
                              src={p.spriteUrl}
                              alt={p.name}
                              onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none' }}
                              className="w-14 h-14 object-contain rounded shrink-0"
                            />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <span className="text-white text-sm font-semibold truncate">{p.name}</span>
                                <PositionSprite position={p.position} size={25} />
                                <ElementBadge element={p.element} size="xs" />
                              </div>
                              <div className="flex items-end gap-3">
                                {STAT_KEYS.map((stat) => (
                                  <div key={stat} className="flex flex-col items-center">
                                    <span className="text-gray-500 text-[0.5625rem] uppercase leading-none mb-0.5">{stat}</span>
                                    <span className="text-gray-300 text-xs font-medium">{p.stats[stat]}</span>
                                  </div>
                                ))}
                                <div className="ml-auto flex flex-col items-center">
                                  <span className="text-gray-500 text-[0.5625rem] uppercase leading-none mb-0.5">Media</span>
                                  <span className="text-sm font-bold" style={{ color: statColor(getPlayerStatsSummary(p).media, 250) }}>{getPlayerStatsSummary(p).media}</span>
                                  <span className="text-gray-500 text-[0.5625rem] tabular-nums">{getPlayerStatsSummary(p).total}</span>
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div className="bg-dark-900/40 rounded-xl border border-gold-600/20 p-4 flex items-center gap-3">
                      <img
                        src={managerAvatar}
                        alt="Entrenador"
                        onError={(e) => { (e.currentTarget as HTMLImageElement).src = '/avatars/avatar-1.svg' }}
                        className="w-14 h-14 rounded-full object-cover bg-dark-700/60 shrink-0"
                      />
                      <div className="min-w-0">
                        <p className="text-gray-400 text-xs uppercase tracking-wide mb-0.5">Entrenador</p>
                        <p className="text-white text-lg font-bold truncate">{managerName}</p>
                      </div>
                    </div>

                    <div className="bg-dark-900/40 rounded-xl border border-gold-600/20 p-4 flex items-center gap-3">
                      <TeamBadgeImage teamName={customClubPreview.team.name} badgeUrl={customClubPreview.team.badgeUrl} size="md" />
                      <div className="min-w-0">
                        <p className="text-gray-400 text-xs uppercase tracking-wide mb-0.5">Club creado</p>
                        <p className="text-white text-lg font-bold truncate">{customClubPreview.team.name}</p>
                        <p className="text-gray-400 text-xs">{LEAGUE_LABELS[customClubPreview.team.leagueId]}</p>
                        <p className="text-gray-500 text-xs truncate">{STRENGTH_OPTIONS.find(s => s.tier === clubStrength)?.label} · Reputación {customClubPreview.team.reputation}</p>
                      </div>
                    </div>

                    <div className="bg-dark-900/40 rounded-xl border border-gold-600/20 p-4">
                      <p className="text-gray-400 text-xs uppercase tracking-wide mb-2">Dificultad</p>
                      <div className="flex items-center gap-3 flex-wrap">
                        {difficultyMode === 'easy'   && <span className="text-green-400 font-bold text-lg">Fácil</span>}
                        {difficultyMode === 'normal' && <span className="text-gold-500 font-bold text-lg">Normal</span>}
                        {difficultyMode === 'hard'   && <span className="text-red-400 font-bold text-lg">Difícil</span>}
                        {difficultyMode === 'custom' && <span className="text-purple-400 font-bold text-lg">Custom</span>}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            </div>
        )}
      </div>

      {/* ── Bottom nav bar ── */}
      <div className="flex-shrink-0 border-t border-gold-600/20 px-6 py-4 flex gap-3 bg-dark-900/80">
        <button
          onClick={() => {
            if (step === 0) navigate('main_menu')
            else setStep((s) => s - 1)
          }}
          className="px-6 py-2.5 bg-dark-700/80 hover:bg-dark-600/80 text-white rounded-xl font-semibold transition-colors"
        >
          Atras
        </button>
        {step < steps.length - 1 ? (
          <button
            onClick={() => { if (canProceed()) setStep((s) => s + 1) }}
            disabled={!canProceed()}
            className="ml-auto px-8 py-2.5 bg-gold-600 hover:bg-gold-500 disabled:bg-dark-700 disabled:cursor-not-allowed text-white rounded-xl font-bold transition-colors"
          >
            Continuar
          </button>
        ) : (
          <button
            onClick={handleCreate}
            className="ml-auto px-8 py-2.5 bg-green-600 hover:bg-green-500 text-white rounded-xl font-bold transition-colors"
          >
            Crear Carrera
          </button>
        )}
      </div>
      </div>
    </div>
  )
}
