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
      <div className="flex items-center justify-center border border-dashed border-gray-700 rounded-xl px-6 py-5 text-gray-600 text-sm">
        Ranura {slotNumber + 1} — vacía
      </div>
    )
  }

  const team = teams.find((t) => t.name === slot.summary.teamName)
  const savedAt = new Date(slot.savedAtUnix).toLocaleDateString('es-ES', {
    day: '2-digit', month: '2-digit', year: 'numeric',
  })

  return (
    <div className="flex items-center gap-4 bg-gray-800 rounded-xl px-5 py-4 border border-gray-700">
      <img
        src={slot.summary.managerAvatar || '/avatars/avatar-1.svg'}
        alt="Entrenador"
        onError={(e) => { (e.currentTarget as HTMLImageElement).src = '/avatars/avatar-1.svg' }}
        className="w-12 h-12 rounded-full object-cover flex-shrink-0 bg-gray-700"
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
        <p className="text-gray-500 text-xs">{slot.summary.managerName} · {savedAt}</p>
      </div>
      <div className="flex gap-2 flex-shrink-0">
        <button
          onClick={onLoad}
          className="px-4 py-1.5 bg-green-600 hover:bg-green-500 text-white rounded-lg text-xs font-bold transition-colors"
        >
          Cargar
        </button>
        {onDelete && (
          <button
            onClick={onDelete}
            className="px-3 py-1.5 bg-gray-700 hover:bg-red-700 text-gray-400 hover:text-white rounded-lg text-xs font-bold transition-colors"
          >
            ✕
          </button>
        )}
      </div>
    </div>
  )
}
