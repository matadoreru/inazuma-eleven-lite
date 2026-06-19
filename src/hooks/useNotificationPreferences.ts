import { useState } from 'react'
import type { InboxEventType } from '../types/career'

const STORAGE_KEY = 'ie_notif_prefs_v1'

export const DEFAULT_PREFS: Record<InboxEventType, boolean> = {
  MATCH_RESULT: false,              // off by default
  SEASON_START: true,
  SEASON_END: true,
  OBJECTIVE_COMPLETE: true,
  OBJECTIVE_FAILED: true,
  TRANSFER_OFFER: true,
  TRANSFER_ACCEPTED: true,
  TRANSFER_REJECTED: true,
  PLAYER_INJURED: true,
  PLAYER_RECOVERED: true,
  PLAYER_GROWTH: true,
  NEWS: true,
  OUTGOING_TRANSFER_CLUB_ACCEPTED: true,
  OUTGOING_TRANSFER_CLUB_REJECTED: true,
  OUTGOING_TRANSFER_CLUB_COUNTER: true,
  OUTGOING_TRANSFER_PLAYER_ACCEPTED: true,
  OUTGOING_TRANSFER_PLAYER_REJECTED: true,
  TRAINING_AVAILABLE: true,
}

export interface NotificationGroup {
  label: string
  types: InboxEventType[]
}

export const NOTIFICATION_GROUPS: NotificationGroup[] = [
  { label: 'Resultados de partido',       types: ['MATCH_RESULT'] },
  { label: 'Temporada',                   types: ['SEASON_START', 'SEASON_END'] },
  { label: 'Objetivos',                   types: ['OBJECTIVE_COMPLETE', 'OBJECTIVE_FAILED'] },
  { label: 'Lesiones y recuperaciones',   types: ['PLAYER_INJURED', 'PLAYER_RECOVERED'] },
  { label: 'Crecimiento de jugadores',    types: ['PLAYER_GROWTH'] },
  { label: 'Ofertas recibidas',           types: ['TRANSFER_OFFER', 'TRANSFER_ACCEPTED', 'TRANSFER_REJECTED'] },
  { label: 'Mis fichajes',               types: ['OUTGOING_TRANSFER_CLUB_ACCEPTED', 'OUTGOING_TRANSFER_CLUB_REJECTED', 'OUTGOING_TRANSFER_CLUB_COUNTER', 'OUTGOING_TRANSFER_PLAYER_ACCEPTED', 'OUTGOING_TRANSFER_PLAYER_REJECTED'] },
  { label: 'Noticias',                    types: ['NEWS'] },
  { label: 'Entrenamiento',               types: ['TRAINING_AVAILABLE'] },
]

function loadPrefs(): Record<InboxEventType, boolean> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return { ...DEFAULT_PREFS, ...JSON.parse(raw) }
  } catch { /* ignore */ }
  return { ...DEFAULT_PREFS }
}

function savePrefs(prefs: Record<InboxEventType, boolean>) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs))
  } catch { /* ignore */ }
}

export function useNotificationPreferences() {
  const [prefs, setPrefs] = useState<Record<InboxEventType, boolean>>(loadPrefs)

  function isGroupEnabled(group: NotificationGroup): boolean {
    return group.types.every((t) => prefs[t])
  }

  function toggleGroup(group: NotificationGroup) {
    const allOn = isGroupEnabled(group)
    const next = { ...prefs }
    for (const t of group.types) next[t] = !allOn
    setPrefs(next)
    savePrefs(next)
  }

  return { prefs, isGroupEnabled, toggleGroup }
}
