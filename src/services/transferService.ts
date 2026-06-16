import type { Player } from '../types/player'
import type { Team } from '../types/team'
import type { Career, TransferOffer } from '../types/career'
import type { TransferFilter } from '../types/transfer'

export function calcTransferValue(player: Player): number {
  const base = player.stats.TOT * 1000
  const ageFactor = player.age <= 22 ? 1.4 : player.age <= 26 ? 1.2 : player.age <= 30 ? 1.0 : 0.7
  const potentialFactor = player.career.potential > 80 ? 1.3 : player.career.potential > 60 ? 1.1 : 1.0
  return Math.round(base * ageFactor * potentialFactor)
}

export function filterPlayers(players: Player[], filter: TransferFilter): Player[] {
  return players.filter((p) => {
    if (filter.position !== 'ALL' && p.position !== filter.position) return false
    if (filter.element !== 'ALL' && p.element !== filter.element) return false
    if (p.stats.TOT < filter.minOverall) return false
    if (calcTransferValue(p) > filter.maxPrice) return false
    if (
      filter.nameSearch &&
      !p.name.toLowerCase().includes(filter.nameSearch.toLowerCase()) &&
      !p.nameRomaji.toLowerCase().includes(filter.nameSearch.toLowerCase())
    ) return false
    return true
  })
}

export function buyPlayer(
  playerId: number,
  teamId: number,
  amount: number,
  career: Career,
  teams: Team[],
  players: Player[],
): { career: Career; teams: Team[]; players: Player[] } {
  const player = players.find((p) => p.id === playerId)
  const buyingTeam = teams.find((t) => t.id === teamId)

  if (!player || !buyingTeam) return { career, teams, players }
  if (buyingTeam.budget < amount) return { career, teams, players }

  const now = new Date().toISOString().split('T')[0]
  const previousTeamId = player.teamId

  const updatedPlayers = players.map((p) =>
    p.id === playerId ? { ...p, teamId } : p,
  )

  const updatedTeams = teams.map((t) => {
    if (t.id === teamId) {
      return {
        ...t,
        budget: t.budget - amount,
        playerIds: [...t.playerIds, playerId],
      }
    }
    if (t.id === previousTeamId) {
      return {
        ...t,
        budget: t.budget + amount,
        playerIds: t.playerIds.filter((id) => id !== playerId),
      }
    }
    return t
  })

  const offer: TransferOffer = {
    id: crypto.randomUUID(),
    fromTeamId: teamId,
    fromTeamName: buyingTeam.name,
    playerId,
    playerName: player.name,
    amount,
    date: now,
    status: 'accepted',
  }

  const updatedCareer: Career = {
    ...career,
    totalBudgetSpent: career.teamId === teamId ? career.totalBudgetSpent + amount : career.totalBudgetSpent,
    totalBudgetEarned: career.teamId === previousTeamId ? career.totalBudgetEarned + amount : career.totalBudgetEarned,
    transferHistory: [...career.transferHistory, offer],
  }

  return { career: updatedCareer, teams: updatedTeams, players: updatedPlayers }
}

export function sellPlayer(
  playerId: number,
  toTeamId: number,
  amount: number,
  career: Career,
  teams: Team[],
  players: Player[],
): { career: Career; teams: Team[]; players: Player[] } {
  const player = players.find((p) => p.id === playerId)
  const sellingTeamId = player?.teamId ?? null
  const buyingTeam = teams.find((t) => t.id === toTeamId)

  if (!player || !buyingTeam || sellingTeamId === null) return { career, teams, players }

  const now = new Date().toISOString().split('T')[0]

  const updatedPlayers = players.map((p) =>
    p.id === playerId ? { ...p, teamId: toTeamId } : p,
  )

  const updatedTeams = teams.map((t) => {
    if (t.id === toTeamId) {
      return {
        ...t,
        budget: t.budget - amount,
        playerIds: [...t.playerIds, playerId],
      }
    }
    if (t.id === sellingTeamId) {
      return {
        ...t,
        budget: t.budget + amount,
        playerIds: t.playerIds.filter((id) => id !== playerId),
      }
    }
    return t
  })

  const offer: TransferOffer = {
    id: crypto.randomUUID(),
    fromTeamId: toTeamId,
    fromTeamName: buyingTeam.name,
    playerId,
    playerName: player.name,
    amount,
    date: now,
    status: 'accepted',
  }

  const updatedCareer: Career = {
    ...career,
    totalBudgetSpent: career.teamId === toTeamId ? career.totalBudgetSpent + amount : career.totalBudgetSpent,
    totalBudgetEarned: career.teamId === sellingTeamId ? career.totalBudgetEarned + amount : career.totalBudgetEarned,
    transferHistory: [...career.transferHistory, offer],
  }

  return { career: updatedCareer, teams: updatedTeams, players: updatedPlayers }
}

export function generateAIOffers(
  career: Career,
  teams: Team[],
  players: Player[],
): TransferOffer[] {
  const myTeam = teams.find((t) => t.id === career.teamId)
  if (!myTeam) return []

  const myPlayers = players.filter((p) => p.teamId === career.teamId)
  const aiTeams = teams.filter((t) => t.id !== career.teamId)
  const now = new Date().toISOString().split('T')[0]

  const offers: TransferOffer[] = []

  // Each AI team may bid on a random player from the manager's squad
  for (const aiTeam of aiTeams) {
    if (Math.random() > 0.05) continue // 5% chance per AI team
    if (myPlayers.length === 0) break

    const target = myPlayers[Math.floor(Math.random() * myPlayers.length)]
    const value = calcTransferValue(target)
    const offerAmount = Math.round(value * (0.8 + Math.random() * 0.5)) // 80–130% of value

    if (aiTeam.budget < offerAmount) continue

    offers.push({
      id: crypto.randomUUID(),
      fromTeamId: aiTeam.id,
      fromTeamName: aiTeam.name,
      playerId: target.id,
      playerName: target.name,
      amount: offerAmount,
      date: now,
      status: 'pending',
    })
  }

  return offers
}
