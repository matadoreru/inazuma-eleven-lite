import { useEffect, useRef } from 'react'
import { useCareerStore } from '../store/careerStore'
import { DEFAULT_PREFS } from './useNotificationPreferences'
import type { InboxEventType } from '../types/career'

const STORAGE_KEY = 'ie_notif_prefs_v1'

function isTypeEnabled(type: InboxEventType): boolean {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const stored = JSON.parse(raw) as Partial<Record<InboxEventType, boolean>>
      return stored[type] ?? DEFAULT_PREFS[type]
    }
  } catch { /* ignore */ }
  return DEFAULT_PREFS[type]
}

function playNotificationSound() {
  try {
    const ctx = new (window.AudioContext || (window as never as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.type = 'sine'
    osc.frequency.setValueAtTime(660, ctx.currentTime)
    osc.frequency.setValueAtTime(880, ctx.currentTime + 0.1)
    gain.gain.setValueAtTime(0.35, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.45)
    osc.start(ctx.currentTime)
    osc.stop(ctx.currentTime + 0.45)
  } catch { /* Audio not available */ }
}

export function useInboxSound() {
  const inbox = useCareerStore((s) => s.career?.inbox ?? [])
  const prevLengthRef = useRef(inbox.length)

  useEffect(() => {
    if (inbox.length > prevLengthRef.current) {
      // inbox[0] is the newest event (prepended)
      const newestType = inbox[0]?.type
      if (newestType && isTypeEnabled(newestType)) {
        playNotificationSound()
      }
    }
    prevLengthRef.current = inbox.length
  }, [inbox.length])
}
