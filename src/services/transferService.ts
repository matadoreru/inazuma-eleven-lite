import type { Player } from '../types/player'
import type { Team } from '../types/team'
import type { Career, TransferOffer, OutgoingNegotiation, NegotiationPhase, InboxEventType, InboxEvent } from '../types/career'
import type { TransferFilter } from '../types/transfer'

export const MAX_TRANSFER_VALUE = 10_000_000

export function sanitizeAmount(amount: unknown): number | null {
  const n = Number(amount)
  if (!Number.isFinite(n) || Number.isNaN(n)) return null
  if (n <= 0) return null
  if (n > MAX_TRANSFER_VALUE) return null
  return Math.round(n)
}

export function calcTransferValue(
  player: Player,
  ctx?: { lineupStatus?: 'starter' | 'bench' | 'uncalled'; teamReputation?: number },
): number {
  const ageFactor =
    player.age <= 22 ? 1.4 :
    player.age <= 26 ? 1.2 :
    player.age <= 30 ? 1.0 : 0.7

  const potentialFactor =
    player.career.potential > 80 ? 1.3 :
    player.career.potential > 60 ? 1.1 : 1.0

  const canonFactor =
    player.canonTier === 'legendary' ? 2.2 :
    player.canonTier === 'epic'      ? 1.6 :
    player.canonTier === 'rare'      ? 1.3 : 1.0

  const { goals, assists, cleanSheets } = player.seasonStats
  const rawPerf = goals * 0.01 + assists * 0.005 + cleanSheets * 0.008
  const performanceFactor = 1 + Math.min(rawPerf, 0.30)

  const injuryFactor = player.isInjured ? 0.85 : 1.0

  const importanceFactor =
    ctx?.lineupStatus === 'starter'  ? 1.1 :
    ctx?.lineupStatus === 'uncalled' ? 0.95 : 1.0

  const divisionFactor = ctx?.teamReputation !== undefined
    ? 0.85 + (Math.min(Math.max(ctx.teamReputation, 0), 100) / 100) * 0.30
    : 1.0

  const raw = player.stats.TOT * 1000
    * ageFactor
    * potentialFactor
    * canonFactor
    * performanceFactor
    * injuryFactor
    * importanceFactor
    * divisionFactor

  return Math.min(Math.round(raw), MAX_TRANSFER_VALUE)
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
  const safe = sanitizeAmount(amount)
  const player = players.find((p) => p.id === playerId)
  const buyingTeam = teams.find((t) => t.id === teamId)

  if (safe === null || !player || !buyingTeam) return { career, teams, players }
  if (buyingTeam.budget < safe) return { career, teams, players }

  const now = new Date().toISOString().split('T')[0]
  const previousTeamId = player.teamId

  const updatedPlayers = players.map((p) =>
    p.id === playerId ? { ...p, teamId } : p,
  )

  const updatedTeams = teams.map((t) => {
    if (t.id === teamId) {
      return {
        ...t,
        budget: t.budget - safe,
        playerIds: [...t.playerIds, playerId],
      }
    }
    if (t.id === previousTeamId) {
      return {
        ...t,
        budget: t.budget + safe,
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
    amount: safe,
    date: now,
    status: 'accepted',
  }

  const updatedCareer: Career = {
    ...career,
    totalBudgetSpent: career.teamId === teamId ? career.totalBudgetSpent + safe : career.totalBudgetSpent,
    totalBudgetEarned: career.teamId === previousTeamId ? career.totalBudgetEarned + safe : career.totalBudgetEarned,
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
  const safe = sanitizeAmount(amount)
  const player = players.find((p) => p.id === playerId)
  const sellingTeamId = player?.teamId ?? null
  const buyingTeam = teams.find((t) => t.id === toTeamId)

  if (safe === null || !player || !buyingTeam || sellingTeamId === null) return { career, teams, players }

  const now = new Date().toISOString().split('T')[0]

  const updatedPlayers = players.map((p) =>
    p.id === playerId ? { ...p, teamId: toTeamId } : p,
  )

  const updatedTeams = teams.map((t) => {
    if (t.id === toTeamId) {
      return {
        ...t,
        budget: t.budget - safe,
        playerIds: [...t.playerIds, playerId],
      }
    }
    if (t.id === sellingTeamId) {
      return {
        ...t,
        budget: t.budget + safe,
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
    amount: safe,
    date: now,
    status: 'accepted',
  }

  const updatedCareer: Career = {
    ...career,
    totalBudgetSpent: career.teamId === toTeamId ? career.totalBudgetSpent + safe : career.totalBudgetSpent,
    totalBudgetEarned: career.teamId === sellingTeamId ? career.totalBudgetEarned + safe : career.totalBudgetEarned,
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

// ─── Private helpers ─────────────────────────────────────────────────────────

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr)
  d.setDate(d.getDate() + days)
  return d.toISOString().split('T')[0]
}

function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

function updateNeg(career: Career, id: string, updates: Partial<OutgoingNegotiation>): Career {
  return {
    ...career,
    outgoingNegotiations: career.outgoingNegotiations.map((n) =>
      n.id === id ? { ...n, ...updates } : n,
    ),
  }
}

function makeEvent(
  type: InboxEventType,
  title: string,
  body: string,
  date: string,
  data?: Record<string, unknown>,
): InboxEvent {
  return { id: crypto.randomUUID(), type, title, body, date, read: false, data }
}

function pushEvent(career: Career, event: InboxEvent): Career {
  return { ...career, inbox: [event, ...career.inbox] }
}

// ─── Evaluation ──────────────────────────────────────────────────────────────

export type ClubDecision =
  | { decision: 'accept' }
  | { decision: 'counter'; counterAmount: number }
  | { decision: 'reject' }

export function evaluateClubOffer(
  offer: number,
  player: Player,
  sellingTeam: Team,
  allPlayers: Player[],
  _teams: Team[],
): ClubDecision {
  const marketValue = calcTransferValue(player)

  if (offer < marketValue * 0.7) return { decision: 'reject' }

  // Replacement capacity: count same-position players in the selling team excluding this player
  const replacements = allPlayers.filter(
    (p) => p.teamId === sellingTeam.id && p.id !== player.id && p.position === player.position,
  ).length

  const isCritical = player.position === 'GK' || player.position === 'DF'
  if (isCritical && replacements < 1) return { decision: 'reject' }

  const replacementPenalty = replacements < 2 ? 1.15 : 1.0
  const reputationFactor = 1.0 + sellingTeam.reputation / 200

  const threshold = Math.round(marketValue * reputationFactor * replacementPenalty)

  if (offer >= threshold) return { decision: 'accept' }
  if (offer >= Math.round(threshold * 0.85)) {
    return { decision: 'counter', counterAmount: Math.round(threshold * 1.05) }
  }
  return { decision: 'reject' }
}

export function evaluatePlayerDecision(player: Player, buyingTeam: Team): 'accept' | 'reject' {
  const tot = player.stats.TOT
  if (tot < 65) return 'accept'
  if (tot < 75) return buyingTeam.reputation >= 30 ? 'accept' : 'reject'
  if (tot < 85) return buyingTeam.reputation >= 50 ? 'accept' : 'reject'
  return buyingTeam.reputation >= 70 ? 'accept' : 'reject'
}

// ─── Mutation functions ───────────────────────────────────────────────────────

export function initiateNegotiation(
  playerId: number,
  amount: number,
  career: Career,
  players: Player[],
  teams: Team[],
): Career | null {
  const player = players.find((p) => p.id === playerId)
  if (!player || player.teamId === career.teamId) return null

  const alreadyActive = career.outgoingNegotiations.some(
    (n) => n.playerId === playerId && (n.phase === 'club_pending' || n.phase === 'player_pending'),
  )
  if (alreadyActive) return null

  const safe = sanitizeAmount(amount)
  if (safe === null) return null

  const isFreeAgent = player.teamId === null || player.teamId === 0
  const targetClub = isFreeAgent ? null : teams.find((t) => t.id === player.teamId)

  const negotiation: OutgoingNegotiation = {
    id: crypto.randomUUID(),
    playerId,
    playerName: player.nameRomaji,
    targetClubId: isFreeAgent ? null : player.teamId,
    targetClubName: isFreeAgent ? 'Agente Libre' : (targetClub?.name ?? 'Desconocido'),
    phase: isFreeAgent ? 'player_pending' : 'club_pending',
    currentOffer: safe,
    offerRound: 1,
    isFreeAgent,
    resolutionDate: addDays(career.season.currentDate, randInt(2, 3)),
  }

  return { ...career, outgoingNegotiations: [...career.outgoingNegotiations, negotiation] }
}

export function cancelNegotiation(negotiationId: string, career: Career): Career {
  return updateNeg(career, negotiationId, { phase: 'cancelled' })
}

export function resolveNegotiations(
  career: Career,
  currentDate: string,
  players: Player[],
  teams: Team[],
): { career: Career; players: Player[]; teams: Team[] } {
  let c = career
  let p = players
  let t = teams

  const fmtAmt = (n: number) =>
    n >= 1_000_000 ? `€${(n / 1_000_000).toFixed(1)}M` : n >= 1_000 ? `€${(n / 1_000).toFixed(0)}K` : `€${n}`

  for (const neg of career.outgoingNegotiations) {
    if (neg.phase !== 'club_pending' && neg.phase !== 'player_pending') continue
    if (neg.phase === 'club_pending' && neg.counterAmount !== undefined) continue
    if (neg.resolutionDate > currentDate) continue

    const player = p.find((pl) => pl.id === neg.playerId)

    // Player no longer exists or moved to a different club
    if (!player || (neg.targetClubId !== null && player.teamId !== neg.targetClubId) || (neg.targetClubId === null && player.teamId !== null && player.teamId !== 0)) {
      c = updateNeg(c, neg.id, { phase: 'failed' })
      const eventType = neg.phase === 'player_pending'
        ? 'OUTGOING_TRANSFER_PLAYER_REJECTED' as const
        : 'OUTGOING_TRANSFER_CLUB_REJECTED' as const
      c = pushEvent(c, makeEvent(
        eventType,
        `Negociación fallida: ${neg.playerName}`,
        `${neg.playerName} ya no está disponible.`,
        currentDate, { negotiationId: neg.id },
      ))
      continue
    }

    if (neg.phase === 'club_pending') {
      const sellingTeam = t.find((tm) => tm.id === neg.targetClubId)
      if (!sellingTeam) { c = updateNeg(c, neg.id, { phase: 'failed' }); continue }

      const clubResult = evaluateClubOffer(neg.currentOffer, player, sellingTeam, p, t)

      if (clubResult.decision === 'accept') {
        c = updateNeg(c, neg.id, {
          phase: 'player_pending',
          resolutionDate: addDays(currentDate, randInt(2, 3)),
        })
        c = pushEvent(c, makeEvent(
          'OUTGOING_TRANSFER_CLUB_ACCEPTED',
          `Club acepta: ${neg.playerName}`,
          `${sellingTeam.name} acepta tu oferta de ${fmtAmt(neg.currentOffer)} por ${neg.playerName}. El jugador decidirá en breve.`,
          currentDate, { negotiationId: neg.id },
        ))
      } else if (clubResult.decision === 'counter') {
        c = updateNeg(c, neg.id, { counterAmount: clubResult.counterAmount })
        c = pushEvent(c, makeEvent(
          'OUTGOING_TRANSFER_CLUB_COUNTER',
          `Contra-oferta: ${neg.playerName}`,
          `${sellingTeam.name} propone ${fmtAmt(clubResult.counterAmount)} por ${neg.playerName}.`,
          currentDate, { negotiationId: neg.id, counterAmount: clubResult.counterAmount },
        ))
      } else {
        c = updateNeg(c, neg.id, { phase: 'failed' })
        c = pushEvent(c, makeEvent(
          'OUTGOING_TRANSFER_CLUB_REJECTED',
          `Oferta rechazada: ${neg.playerName}`,
          `${sellingTeam.name} rechaza tu oferta por ${neg.playerName}.`,
          currentDate, { negotiationId: neg.id },
        ))
      }
    } else {
      // player_pending
      const buyingTeam = t.find((tm) => tm.id === career.teamId)
      if (!buyingTeam) continue

      const playerDecision = evaluatePlayerDecision(player, buyingTeam)

      if (playerDecision === 'accept') {
        if (buyingTeam.budget < neg.currentOffer) {
          c = updateNeg(c, neg.id, { phase: 'failed' })
          c = pushEvent(c, makeEvent(
            'OUTGOING_TRANSFER_PLAYER_REJECTED',
            `Sin presupuesto: ${neg.playerName}`,
            `${neg.playerName} aceptó pero no tienes suficiente presupuesto.`,
            currentDate, { negotiationId: neg.id },
          ))
          continue
        }

        c = updateNeg(c, neg.id, { phase: 'player_accepted' })
        c = pushEvent(c, makeEvent(
          'OUTGOING_TRANSFER_PLAYER_ACCEPTED',
          `¡El jugador acepta! ${neg.playerName}`,
          `${neg.playerName} ha aceptado tu oferta de ${fmtAmt(neg.currentOffer)}. Ve al ojeador para confirmar el fichaje.`,
          currentDate, { negotiationId: neg.id },
        ))
      } else {
        c = updateNeg(c, neg.id, { phase: 'failed' })
        c = pushEvent(c, makeEvent(
          'OUTGOING_TRANSFER_PLAYER_REJECTED',
          `Jugador rechaza: ${neg.playerName}`,
          `${neg.playerName} ha decidido no unirse a tu equipo.`,
          currentDate, { negotiationId: neg.id },
        ))
      }
    }
  }

  return { career: c, players: p, teams: t }
}

export function respondToCounter(
  negotiationId: string,
  action: 'accept_counter' | 'reject' | 'counter',
  career: Career,
  newAmount?: number,
): Career {
  const neg = career.outgoingNegotiations.find((n) => n.id === negotiationId)
  if (!neg || neg.phase !== 'club_pending' || neg.counterAmount === undefined) return career

  if (action === 'accept_counter') {
    return updateNeg(career, negotiationId, {
      currentOffer: neg.counterAmount,
      counterAmount: undefined,
      phase: 'player_pending',
      resolutionDate: addDays(career.season.currentDate, randInt(2, 3)),
    })
  }

  if (action === 'reject') {
    return updateNeg(career, negotiationId, { phase: 'failed' })
  }

  // counter
  if (neg.offerRound >= 3 || newAmount === undefined) return career
  const safe = sanitizeAmount(newAmount)
  if (safe === null) return career
  return updateNeg(career, negotiationId, {
    currentOffer: safe,
    counterAmount: undefined,
    offerRound: neg.offerRound + 1,
    resolutionDate: addDays(career.season.currentDate, randInt(2, 3)),
  })
}

export function confirmTransfer(
  negotiationId: string,
  career: Career,
  players: Player[],
  teams: Team[],
): { career: Career; players: Player[]; teams: Team[] } {
  const neg = career.outgoingNegotiations.find((n) => n.id === negotiationId)
  if (!neg || neg.phase !== 'player_accepted') return { career, players, teams }

  const buyingTeam = teams.find((t) => t.id === career.teamId)
  if (!buyingTeam || buyingTeam.budget < neg.currentOffer) {
    return {
      career: updateNeg(career, negotiationId, { phase: 'failed' }),
      players,
      teams,
    }
  }

  const result = buyPlayer(neg.playerId, career.teamId, neg.currentOffer, career, teams, players)
  return {
    career: updateNeg(result.career, negotiationId, { phase: 'completed' }),
    players: result.players,
    teams: result.teams,
  }
}
