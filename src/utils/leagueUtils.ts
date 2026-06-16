import { leagues } from '../data/leagues'

export function getLeagueName(leagueId: string): string {
  return leagues.find((l) => l.id === leagueId)?.name ?? leagueId
}

export function getLeague(leagueId: string) {
  return leagues.find((l) => l.id === leagueId) ?? null
}
