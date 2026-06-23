import type { SaveSlot } from '../types/save'
import { teams } from '../data/teams'

interface Props {
  slot: SaveSlot | null
  slotNumber: number
  onLoad: () => void
  onDelete?: () => void
}

export default function SaveSlotCard({ slot, slotNumber, onLoad, onDelete }: Props) {
  if (!slot) {
    return (
      <div className="flex items-center justify-center border border-dashed border-gold-600/35 bg-dark-800 rounded-xl px-6 py-5 text-gray-400 text-sm">
        Ranura {slotNumber + 1} — vacía
      </div>
    )
  }

  const team = teams.find((t) => t.name === slot.summary.teamName)
  const savedAt = new Date(slot.savedAtUnix).toLocaleDateString('es-ES', {
    day: '2-digit', month: '2-digit', year: 'numeric',
  })

  return (
    <div className="flex items-center gap-4 bg-dark-800 rounded-xl px-5 py-4 border border-gold-600/35 shadow-[0_8px_20px_rgba(0,0,0,0.28)]">
      <img
        src={slot.summary.managerAvatar || '/avatars/avatar-1.svg'}
        alt="Entrenador"
        onError={(e) => { (e.currentTarget as HTMLImageElement).src = '/avatars/avatar-1.svg' }}
        className="w-12 h-12 rounded-full object-cover flex-shrink-0 bg-dark-700 border border-gold-600/25"
      />
      <img
        src={team?.badgeUrl ?? '/teams/default_team_icon.png'}
        alt={slot.summary.teamName}
        onError={(e) => { (e.currentTarget as HTMLImageElement).src = '/teams/default_team_icon.png' }}
        className="w-10 h-10 object-contain flex-shrink-0"
      />
      <div className="flex-1 min-w-0">
        <p className="text-white font-semibold text-sm truncate">{slot.summary.teamName}</p>
        <p className="text-gray-400 text-xs">
          Temp. {slot.summary.seasonNumber} · {slot.summary.leagueName === 'first_division' ? '1ª Div.' : '2ª Div.'} · {slot.summary.leaguePosition}ª posición
        </p>
        <p className="text-gray-400 text-xs">{slot.summary.managerName} · {savedAt}</p>
      </div>
      <div className="flex gap-2 flex-shrink-0">
        <button
          onClick={onLoad}
          className="px-4 py-1.5 bg-gold-500 hover:bg-gold-400 text-dark-900 rounded-lg text-xs font-black transition-colors"
        >
          Cargar
        </button>
        {onDelete && (
          <button
            onClick={onDelete}
            className="px-3 py-1.5 bg-dark-700 hover:bg-red-700 text-gray-300 hover:text-white rounded-lg text-xs font-bold transition-colors"
          >
            ✕
          </button>
        )}
      </div>
    </div>
  )
}
