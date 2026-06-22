import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import MatchEventText from '../components/MatchEventText'
import type { MatchEvent } from '../types/competition'

describe('MatchEventText', () => {
  it('uses the game colors for every technique type in the sentence', () => {
    const techniques: NonNullable<MatchEvent['techniques']> = [
      { name: 'TIRO TEST', type: 'Tiro' },
      { name: 'BLOQUEO TEST', type: 'Bloqueo' },
      { name: 'PARADA TEST', type: 'Parada' },
      { name: 'REGATE TEST', type: 'Regate' },
    ]
    const event: MatchEvent = {
      minute: 1,
      type: 'MISS',
      teamId: 1,
      isHome: true,
      text: techniques.map((technique) => technique.name).join(' '),
      techniques,
    }

    render(<MatchEventText event={event} />)

    expect(screen.getByText('TIRO TEST')).toHaveClass('text-rose-200')
    expect(screen.getByText('BLOQUEO TEST')).toHaveClass('text-green-200')
    expect(screen.getByText('PARADA TEST')).toHaveClass('text-yellow-200')
    expect(screen.getByText('REGATE TEST')).toHaveClass('text-blue-200')
  })
})
