export type SoundOutcome = 'champion' | 'promoted' | 'relegated' | 'stayed'

export function playOutcomeSound(outcome: SoundOutcome): void {
  try {
    const AudioCtx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    if (!AudioCtx) return
    const ctx = new AudioCtx()

    type Note = { freq: number; dur: number }
    const sequences: Record<SoundOutcome, Note[]> = {
      champion: [
        { freq: 261.63, dur: 0.15 }, // C4
        { freq: 329.63, dur: 0.15 }, // E4
        { freq: 392.00, dur: 0.15 }, // G4
        { freq: 523.25, dur: 0.50 }, // C5
      ],
      promoted: [
        { freq: 261.63, dur: 0.20 }, // C4
        { freq: 329.63, dur: 0.20 }, // E4
        { freq: 392.00, dur: 0.35 }, // G4
      ],
      relegated: [
        { freq: 261.63, dur: 0.20 }, // C4
        { freq: 233.08, dur: 0.20 }, // Bb3
        { freq: 207.65, dur: 0.45 }, // Ab3
      ],
      stayed: [
        { freq: 329.63, dur: 0.35 }, // E4
      ],
    }

    let t = ctx.currentTime + 0.05
    for (const { freq, dur } of sequences[outcome]) {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.type = 'sine'
      osc.frequency.value = freq
      gain.gain.setValueAtTime(0.3, t)
      gain.gain.exponentialRampToValueAtTime(0.001, t + dur)
      osc.start(t)
      osc.stop(t + dur)
      t += dur
    }
  } catch {
    // AudioContext unavailable (tests, restricted browsers)
  }
}
