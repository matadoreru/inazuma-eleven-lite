import { useCareerStore } from '../store/careerStore'
import TopNavigation from '../components/TopNavigation'
import SideNavigation from '../components/SideNavigation'
import TeamNameInline from '../components/TeamNameInline'
import { sortStandings } from '../services/standingsService'

export default function StandingsScreen() {
  const career = useCareerStore((s) => s.career)
  const teams = useCareerStore((s) => s.teams)
  const screen = useCareerStore((s) => s.screen)
  const navigate = useCareerStore((s) => s.navigate)

  if (!career) {
    return (
      <div className="h-full flex items-center justify-center bg-gray-900">
        <p className="text-gray-400">No hay carrera activa.</p>
      </div>
    )
  }

  const userTeam = teams.find((t) => t.id === career.teamId)

  const sorted = sortStandings(career.season.standings)

  return (
    <div className="h-full flex flex-col">
      <TopNavigation title="Clasificación" />
      <div className="flex flex-1 overflow-hidden">
        <SideNavigation currentScreen={screen} onNavigate={navigate} />
        <main className="flex-1 overflow-y-auto p-4">
          <h1 className="text-white text-2xl font-bold mb-4">
            Clasificación — Temporada {career.season.year}
          </h1>

          <div className="bg-gray-800 rounded-xl overflow-hidden border border-gray-700">
            {/* Header */}
            <div className="grid grid-cols-[auto_1fr_repeat(8,auto)] gap-0 bg-gray-900 px-3 py-2 text-gray-400 text-xs font-semibold uppercase tracking-wide">
              <span className="w-8 text-center">#</span>
              <span className="px-2">Equipo</span>
              <span className="w-8 text-center">P</span>
              <span className="w-8 text-center">V</span>
              <span className="w-8 text-center">E</span>
              <span className="w-8 text-center">D</span>
              <span className="w-10 text-center">GF</span>
              <span className="w-10 text-center">GC</span>
              <span className="w-10 text-center">DG</span>
              <span className="w-10 text-center font-bold text-white">Pts</span>
            </div>

            {/* Rows */}
            {sorted.map((row, idx) => {
              const isUserTeam = row.teamId === career.teamId
              const team = teams.find((t) => t.id === row.teamId)
              return (
                <div
                  key={row.teamId}
                  className={`grid grid-cols-[auto_1fr_repeat(8,auto)] gap-0 px-3 py-2.5 border-t border-gray-700 text-sm items-center
                    ${isUserTeam ? 'bg-blue-900/40 border-l-2 border-l-blue-500' : 'hover:bg-gray-700/50 transition-colors'}`}
                >
                  <span className={`w-8 text-center font-bold ${isUserTeam ? 'text-blue-300' : 'text-gray-400'}`}>
                    {idx + 1}
                  </span>
                  <div className="px-2 min-w-0">
                    <TeamNameInline
                      teamName={row.teamName}
                      badgeUrl={team?.badgeUrl}
                      textClassName={`${isUserTeam ? 'text-blue-200' : 'text-white'}`}
                    />
                  </div>
                  <span className="w-8 text-center text-gray-300">{row.played}</span>
                  <span className="w-8 text-center text-green-400">{row.won}</span>
                  <span className="w-8 text-center text-yellow-400">{row.drawn}</span>
                  <span className="w-8 text-center text-red-400">{row.lost}</span>
                  <span className="w-10 text-center text-gray-300">{row.goalsFor}</span>
                  <span className="w-10 text-center text-gray-300">{row.goalsAgainst}</span>
                  <span className={`w-10 text-center ${row.goalDiff > 0 ? 'text-green-400' : row.goalDiff < 0 ? 'text-red-400' : 'text-gray-400'}`}>
                    {row.goalDiff > 0 ? `+${row.goalDiff}` : row.goalDiff}
                  </span>
                  <span className={`w-10 text-center font-bold text-lg ${isUserTeam ? 'text-blue-300' : 'text-white'}`}>
                    {row.points}
                  </span>
                </div>
              )
            })}

            {sorted.length === 0 && (
              <div className="py-8 text-center text-gray-500 text-sm border-t border-gray-700">
                No hay datos de clasificación
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  )
}
