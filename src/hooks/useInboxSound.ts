import { useEffect, useRef } from 'react'
import { useCareerStore } from '../store/careerStore'

function playNotificationSound() {
  try {
    const ctx = new (window.AudioContext || (window as never as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.type = 'sine'
    // Two-tone ascending ding: 660 Hz → 880 Hz
    osc.frequency.setValueAtTime(660, ctx.currentTime)
    osc.frequency.setValueAtTime(880, ctx.currentTime + 0.1)
    gain.gain.setValueAtTime(0.35, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.45)
    osc.start(ctx.currentTime)
    osc.stop(ctx.currentTime + 0.45)
  } catch {
    // Audio not available — silently ignore
  }
}

export function useInboxSound() {
  const inboxLength = useCareerStore((s) => s.career?.inbox.length ?? 0)
  const prevLengthRef = useRef(inboxLength)

  useEffect(() => {
    if (inboxLength > prevLengthRef.current) {
      playNotificationSound()
    }
    prevLengthRef.current = inboxLength
  }, [inboxLength])
}
