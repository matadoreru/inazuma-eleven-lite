import { useState } from 'react'
import { useCareerStore } from '../store/careerStore'
import GameLayout from '../components/GameLayout'
import type { EquipmentItem } from '../types/equipment'

const DEV_ITEM: EquipmentItem = {
  id: 'dev_item_placeholder',
  slot: 'boots',
  name: 'Botas del Desarrollador',
  statBonuses: { POT: 5, CON: 5, TEC: 5, PRE: 5 },
  tier: 3,
  rarity: 'legendary',
}

function SectionHeader({ icon, label, color = 'text-purple-400' }: { icon: string; label: string; color?: string }) {
  return (
    <h3 className={`${color} text-xs font-semibold uppercase tracking-wide mb-2 flex items-center gap-1.5`}>
      <span className="material-icons text-sm">{icon}</span>
      {label}
    </h3>
  )
}

function CheatBtn({ label, icon, onClick, disabled = false }: {
  label: string; icon: string; onClick: () => void; disabled?: boolean
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`flex items-center gap-1.5 px-3 py-2 rounded-lg border text-sm transition-colors w-full ${
        disabled
          ? 'border-gray-700 text-gray-600 cursor-not-allowed'
          : 'border-purple-600/30 bg-purple-900/20 hover:bg-purple-900/40 text-purple-300'
      }`}
    >
      <span className="material-icons text-sm">{icon}</span>
      {label}
    </button>
  )
}

export default function DevDebugScreen() {
  const career = useCareerStore((s) => s.career)
  const teams = useCareerStore((s) => s.teams)
  const leagues = useCareerStore((s) => s.leagues)
  const navigate = useCareerStore((s) => s.navigate)

  const [toast, setToast] = useState<string | null>(null)

  function flash(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(null), 1500)
  }

  if (!career) {
    return (
      <GameLayout>
        <div className="h-full flex items-center justify-center">
          <p className="text-gray-500 text-sm">No hay carrera activa.</p>
        </div>
      </GameLayout>
    )
  }

  const userTeam = teams.find((t) => t.id === career.teamId)!
  const currentLeague = leagues.find((l) => l.id === userTeam.leagueId)
  const promotionLeague = currentLeague?.promotionTo
    ? leagues.find((l) => l.id === currentLeague.promotionTo)
    : null
  const relegationLeague = currentLeague?.relegationTo
    ? leagues.find((l) => l.id === currentLeague.relegationTo)
    : null

  // ── Economía ──────────────────────────────────────────────
  function addBudget(delta: number) {
    const { career: c, teams: ts } = useCareerStore.getState()
    if (!c) return
    useCareerStore.setState({
      teams: ts.map((t) =>
        t.id === c.teamId ? { ...t, budget: Math.max(0, t.budget + delta) } : t
      ),
    })
    flash(`${delta > 0 ? '+' : ''}${(delta / 1000).toFixed(0)}k€`)
  }

  // ── Club ──────────────────────────────────────────────────
  function addReputation(delta: number) {
    const { career: c, teams: ts } = useCareerStore.getState()
    if (!c) return
    useCareerStore.setState({
      teams: ts.map((t) =>
        t.id === c.teamId
          ? { ...t, reputation: Math.min(100, Math.max(0, t.reputation + delta)) }
          : t
      ),
    })
    flash(`${delta > 0 ? '+' : ''}${delta} Reputación`)
  }

  // ── Plantilla ─────────────────────────────────────────────
  function fullEnergy() {
    const { career: c, players } = useCareerStore.getState()
    if (!c) return
    useCareerStore.setState({
      players: players.map((p) =>
        p.teamId === c.teamId ? { ...p, stamina: 100 } : p
      ),
    })
    flash('Energía completa')
  }

  function cureInjuries() {
    const { career: c, players } = useCareerStore.getState()
    if (!c) return
    useCareerStore.setState({
      players: players.map((p) =>
        p.teamId === c.teamId
          ? { ...p, isInjured: false, injuryDaysRemaining: 0 }
          : p
      ),
    })
    flash('Lesiones curadas')
  }

  function boostStats() {
    const { career: c, players } = useCareerStore.getState()
    if (!c) return
    useCareerStore.setState({
      players: players.map((p) => {
        if (p.teamId !== c.teamId) return p
        const s = p.stats
        const POT = Math.min(99, s.POT + 10)
        const CON = Math.min(99, s.CON + 10)
        const TEC = Math.min(99, s.TEC + 10)
        const PRE = Math.min(99, s.PRE + 10)
        const FIS = Math.min(99, s.FIS + 10)
        const AGI = Math.min(99, s.AGI + 10)
        const INT = Math.min(99, s.INT + 10)
        const TOT = Math.round((POT + CON + TEC + PRE + FIS + AGI + INT) / 7)
        return { ...p, stats: { POT, CON, TEC, PRE, FIS, AGI, INT, TOT } }
      }),
    })
    flash('+10 stats plantilla')
  }

  // ── Inventario ────────────────────────────────────────────
  function addItem() {
    const { career: c } = useCareerStore.getState()
    if (!c) return
    const item: EquipmentItem = { ...DEV_ITEM, id: `dev_item_${Date.now()}` }
    useCareerStore.setState({
      career: {
        ...c,
        inventory: {
          ...c.inventory,
          equipmentItems: [...c.inventory.equipmentItems, item],
        },
      },
    })
    flash('Objeto añadido')
  }

  // ── Liga ──────────────────────────────────────────────────
  function changeLeague(targetLeague: typeof promotionLeague) {
    if (!targetLeague) return
    const { career: c, teams: ts } = useCareerStore.getState()
    if (!c) return
    useCareerStore.setState({
      teams: ts.map((t) =>
        t.id === c.teamId
          ? { ...t, leagueId: targetLeague.id, tier: targetLeague.level }
          : t
      ),
    })
    flash(`Liga → ${targetLeague.name} (próxima temporada)`)
  }

  return (
    <GameLayout>
      <main className="h-full overflow-y-auto p-4 space-y-5">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="material-icons text-purple-400 text-lg">bug_report</span>
            <h1 className="text-white font-bold text-base">Panel de Debug</h1>
          </div>
          <span className="text-[0.6rem] text-purple-500 uppercase tracking-widest font-semibold bg-purple-900/30 border border-purple-700/40 px-2 py-0.5 rounded-full">
            Dev Mode
          </span>
        </div>

        {/* Toast */}
        {toast && (
          <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-50 px-4 py-2 bg-purple-800 border border-purple-500/60 text-purple-100 text-sm font-semibold rounded-full shadow-lg">
            ✓ {toast}
          </div>
        )}

        {/* Economía */}
        <section>
          <SectionHeader icon="payments" label="Economía" />
          <div className="grid grid-cols-2 gap-2">
            <CheatBtn label="+100.000€" icon="add" onClick={() => addBudget(100_000)} />
            <CheatBtn label="+500.000€" icon="add_circle" onClick={() => addBudget(500_000)} />
            <CheatBtn label="−100.000€" icon="remove" onClick={() => addBudget(-100_000)} />
            <CheatBtn label="−500.000€" icon="remove_circle" onClick={() => addBudget(-500_000)} />
          </div>
        </section>

        {/* Club */}
        <section>
          <SectionHeader icon="shield" label="Club" />
          <div className="grid grid-cols-2 gap-2">
            <CheatBtn label="+5 Reputación" icon="star" onClick={() => addReputation(5)} />
            <CheatBtn label="+10 Reputación" icon="star_rate" onClick={() => addReputation(10)} />
            <CheatBtn label="−10 Reputación" icon="star_border" onClick={() => addReputation(-10)} />
          </div>
        </section>

        {/* Plantilla */}
        <section>
          <SectionHeader icon="groups" label="Plantilla" />
          <div className="grid grid-cols-2 gap-2">
            <CheatBtn label="Energía completa" icon="bolt" onClick={fullEnergy} />
            <CheatBtn label="Curar lesiones" icon="healing" onClick={cureInjuries} />
            <CheatBtn label="+10 stats" icon="trending_up" onClick={boostStats} />
          </div>
        </section>

        {/* Inventario */}
        <section>
          <SectionHeader icon="backpack" label="Inventario" />
          <div className="grid grid-cols-2 gap-2">
            <CheatBtn label="Objeto legendario" icon="sprint" onClick={addItem} />
          </div>
        </section>

        {/* Liga */}
        <section>
          <SectionHeader icon="leaderboard" label="Liga" />
          <p className="text-gray-500 text-[0.625rem] mb-2">
            El cambio afecta a la siguiente temporada.
            Liga actual: <span className="text-gray-300">{currentLeague?.name ?? userTeam.leagueId}</span>
          </p>
          <div className="grid grid-cols-2 gap-2">
            <CheatBtn
              label={promotionLeague ? `↑ ${promotionLeague.name}` : 'Sin ascenso'}
              icon="arrow_upward"
              onClick={() => changeLeague(promotionLeague)}
              disabled={!promotionLeague}
            />
            <CheatBtn
              label={relegationLeague ? `↓ ${relegationLeague.name}` : 'Sin descenso'}
              icon="arrow_downward"
              onClick={() => changeLeague(relegationLeague)}
              disabled={!relegationLeague}
            />
          </div>
        </section>

        {/* Dev Menu link */}
        <section>
          <SectionHeader icon="edit_note" label="Editor de datos" />
          <button
            onClick={() => navigate('dev_menu')}
            className="flex items-center gap-2 px-3 py-2 rounded-lg border border-purple-600/30 bg-purple-900/20 hover:bg-purple-900/40 text-purple-300 text-sm transition-colors w-full"
          >
            <span className="material-icons text-sm">database</span>
            Abrir DevMenu (jugadores, equipos, ligas)
          </button>
        </section>

      </main>
    </GameLayout>
  )
}
