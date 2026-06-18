import type { Player } from '../types/player'
import { getPlayerStatsSummary } from '../types/player'
import type { Team } from '../types/team'
import type { Career, TransferOffer, OutgoingNegotiation, NegotiationPhase, InboxEventType, InboxEvent, IncomingOffer } from '../types/career'
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
    if (getPlayerStatsSummary(p).media < filter.minMedia) return false
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
  // Guard: player must belong to the selling career's team
  if (!player || player.teamId !== career.teamId) return { career, teams, players }
  const sellingTeamId = player.teamId
  const buyingTeam = teams.find((t) => t.id === toTeamId)

  if (safe === null || !buyingTeam) return { career, teams, players }

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
): { offers: IncomingOffer[]; career: Career } {
  const myTeam = teams.find((t) => t.id === career.teamId)
  if (!myTeam) return { offers: [], career }

  const myPlayers = players.filter((p) => p.teamId === career.teamId)
  const aiTeams = teams.filter((t) => t.id !== career.teamId)
  const now = new Date().toISOString().split('T')[0]

  const offers: IncomingOffer[] = []

  for (const aiTeam of aiTeams) {
    if (Math.random() > 0.05) continue
    if (myPlayers.length === 0) break

    const target = myPlayers[Math.floor(Math.random() * myPlayers.length)]
    const value = calcTransferValue(target)
    const offerAmount = Math.round(value * (0.8 + Math.random() * 0.5))

    if (aiTeam.budget < offerAmount) continue

    offers.push({
      id: crypto.randomUUID(),
      fromTeamId: aiTeam.id,
      fromTeamName: aiTeam.name,
      playerId: target.id,
      amount: offerAmount,
      date: now,
      status: 'pending',
    })
  }

  const updatedCareer: Career = {
    ...career,
    incomingOffers: [...(career.incomingOffers ?? []), ...offers],
  }

  return { offers, career: updatedCareer }
}

export function respondToIncomingOffer(
  offerId: string,
  action: 'accept' | 'reject' | 'counter',
  career: Career,
  players: Player[],
  teams: Team[],
  counterAmount?: number,
): { career: Career; players: Player[]; teams: Team[]; error?: string } {
  const offer = (career.incomingOffers ?? []).find((o) => o.id === offerId)
  if (!offer || offer.status !== 'pending') return { career, players, teams }

  const updateOffer = (updates: Partial<IncomingOffer>): Career => ({
    ...career,
    incomingOffers: (career.incomingOffers ?? []).map((o) => o.id === offerId ? { ...o, ...updates } : o),
  })

  if (action === 'reject') {
    return { career: updateOffer({ status: 'rejected' }), players, teams }
  }

  if (action === 'counter') {
    const safe = counterAmount !== undefined ? sanitizeAmount(counterAmount) : null
    if (safe === null) return { career, players, teams, error: 'invalid_amount' }

    const d = new Date(career.season.currentDate)
    d.setDate(d.getDate() + Math.floor(Math.random() * 2) + 1)
    const counterResolutionDate = d.toISOString().split('T')[0]

    return {
      career: updateOffer({ status: 'counter_sent', counterAmount: safe, counterResolutionDate }),
      players,
      teams,
    }
  }

  // accept
  const buyingTeam = teams.find((t) => t.id === offer.fromTeamId)
  if (!buyingTeam || buyingTeam.budget < offer.amount) {
    const updatedCareer = updateOffer({ status: 'budget_failed' })
    return { career: updatedCareer, players, teams, error: 'insufficient_budget' }
  }

  const player = players.find((p) => p.id === offer.playerId)
  if (!player || player.teamId !== career.teamId) {
    return { career: updateOffer({ status: 'rejected' }), players, teams, error: 'player_unavailable' }
  }

  const sold = sellPlayer(offer.playerId, offer.fromTeamId, offer.amount, career, teams, players)
  return {
    career: {
      ...sold.career,
      incomingOffers: (sold.career.incomingOffers ?? []).map((o) =>
        o.id === offerId ? { ...o, status: 'accepted' } : o,
      ),
    },
    players: sold.players,
    teams: sold.teams,
  }
}

export function resolveIncomingCounters(
  career: Career,
  currentDate: string,
  players: Player[],
  teams: Team[],
): { career: Career; players: Player[]; teams: Team[] } {
  let c = career
  const p = players
  const t = teams

  for (const offer of (career.incomingOffers ?? [])) {
    if (offer.status !== 'counter_sent') continue
    if (!offer.counterResolutionDate || offer.counterResolutionDate > currentDate) continue

    const buyingTeam = teams.find((tm) => tm.id === offer.fromTeamId)
    if (!buyingTeam) {
      c = { ...c, incomingOffers: (c.incomingOffers ?? []).map((o) => o.id === offer.id ? { ...o, status: 'counter_rejected' } : o) }
      continue
    }

    const marketValue = Math.max(1, calcTransferValue(players.find((pl) => pl.id === offer.playerId) ?? { stats: { TOT: 70 } } as any))
    const ratio = (offer.counterAmount ?? offer.amount) / marketValue
    const pAccept = ratio <= 1.0 ? 0.65 : ratio <= 1.2 ? 0.40 : ratio <= 1.5 ? 0.15 : 0.03

    if (Math.random() < pAccept) {
      // AI accepts counter — set the offer back to pending with the counter amount so respondToIncomingOffer can process it
      const acceptResult = respondToIncomingOffer(offer.id, 'accept',
        { ...c, incomingOffers: (c.incomingOffers ?? []).map((o) => o.id === offer.id ? { ...o, amount: offer.counterAmount!, status: 'pending' } : o) },
        p, t)
      c = acceptResult.career
    } else {
      c = { ...c, incomingOffers: (c.incomingOffers ?? []).map((o) => o.id === offer.id ? { ...o, status: 'counter_rejected' } : o) }
    }
  }

  return { career: c, players: p, teams: t }
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
  targetScreen?: string,
  targetEntityId?: string,
): InboxEvent {
  return { id: crypto.randomUUID(), type, title, body, date, read: false, data, targetScreen, targetEntityId }
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

export function calcFreeAgentRecommendedOffer(player: Player): number {
  // Free agents accept at ~0.80 of market value → recommend 0.78 as a safe starting offer
  return Math.round(calcTransferValue(player) * 0.78)
}

export function evaluatePlayerDecision(
  player: Player,
  buyingTeam: Team,
  offerAmount: number,
  isFreeAgent: boolean,
): 'accept' | 'counter' | 'reject' {
  if (isFreeAgent) {
    const marketValue = Math.max(1, calcTransferValue(player))
    const ratio = offerAmount / marketValue

    let pAccept: number
    let pCounter: number
    if (ratio >= 0.80) {
      pAccept = 0.92; pCounter = 0.06
    } else if (ratio >= 0.65) {
      pAccept = 0.65; pCounter = 0.25
    } else if (ratio >= 0.50) {
      pAccept = 0.25; pCounter = 0.50
    } else {
      pAccept = 0.05; pCounter = 0.25
    }

    // Wider rep range: ±0.15. Very new clubs get small bonus (opportunity factor).
    const repBonus = Math.max(-0.15, Math.min(0.15, (buyingTeam.reputation - 50) / 100))
    const newClubBonus = buyingTeam.reputation < 20 ? 0.05 : 0
    pAccept = Math.max(0, Math.min(1, pAccept + repBonus + newClubBonus))

    const r = Math.random()
    if (r < pAccept) return 'accept'
    if (r < pAccept + pCounter) return 'counter'
    return 'reject'
  }

  // Non-free-agent: reputation-only check (money settled in club phase)
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
  nameStyle: 'western' | 'japanese' = 'western',
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
    playerName: nameStyle === 'japanese' ? player.nameRomaji : player.name,
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
        'transfers',
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
          'transfers',
        ))
      } else if (clubResult.decision === 'counter') {
        c = updateNeg(c, neg.id, { counterAmount: clubResult.counterAmount })
        c = pushEvent(c, makeEvent(
          'OUTGOING_TRANSFER_CLUB_COUNTER',
          `Contra-oferta: ${neg.playerName}`,
          `${sellingTeam.name} propone ${fmtAmt(clubResult.counterAmount)} por ${neg.playerName}.`,
          currentDate, { negotiationId: neg.id, counterAmount: clubResult.counterAmount },
          'transfers',
        ))
      } else {
        c = updateNeg(c, neg.id, { phase: 'failed' })
        c = pushEvent(c, makeEvent(
          'OUTGOING_TRANSFER_CLUB_REJECTED',
          `Oferta rechazada: ${neg.playerName}`,
          `${sellingTeam.name} rechaza tu oferta por ${neg.playerName}.`,
          currentDate, { negotiationId: neg.id },
          'transfers',
        ))
      }
    } else {
      // player_pending
      const buyingTeam = t.find((tm) => tm.id === career.teamId)
      if (!buyingTeam) continue

      const playerDecision = evaluatePlayerDecision(player, buyingTeam, neg.currentOffer, neg.isFreeAgent)

      if (playerDecision === 'accept') {
        if (buyingTeam.budget < neg.currentOffer) {
          c = updateNeg(c, neg.id, { phase: 'failed' })
          c = pushEvent(c, makeEvent(
            'OUTGOING_TRANSFER_PLAYER_REJECTED',
            `Sin presupuesto: ${neg.playerName}`,
            `${neg.playerName} aceptó pero no tienes suficiente presupuesto.`,
            currentDate, { negotiationId: neg.id },
            'transfers',
          ))
          continue
        }

        c = updateNeg(c, neg.id, { phase: 'player_accepted' })
        c = pushEvent(c, makeEvent(
          'OUTGOING_TRANSFER_PLAYER_ACCEPTED',
          `¡El jugador acepta! ${neg.playerName}`,
          `${neg.playerName} ha aceptado tu oferta de ${fmtAmt(neg.currentOffer)}. Ve al ojeador para confirmar el fichaje.`,
          currentDate, { negotiationId: neg.id },
          'transfers',
        ))
      } else if (playerDecision === 'counter') {
        // Player asks for market value (or a bit above if offer was very low)
        const marketValue = calcTransferValue(player)
        const counterAmount = Math.round(marketValue * (neg.currentOffer < marketValue * 0.85 ? 1.0 : 1.05))
        c = updateNeg(c, neg.id, { phase: 'player_counter', counterAmount })
        c = pushEvent(c, makeEvent(
          'OUTGOING_TRANSFER_CLUB_COUNTER',
          `Contraoferta del jugador: ${neg.playerName}`,
          `${neg.playerName} propone ${fmtAmt(counterAmount)} para unirse a tu equipo.`,
          currentDate, { negotiationId: neg.id, counterAmount },
          'transfers',
        ))
      } else {
        c = updateNeg(c, neg.id, { phase: 'failed' })
        c = pushEvent(c, makeEvent(
          'OUTGOING_TRANSFER_PLAYER_REJECTED',
          `Jugador rechaza: ${neg.playerName}`,
          `${neg.playerName} ha decidido no unirse a tu equipo.`,
          currentDate, { negotiationId: neg.id },
          'transfers',
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

// Accept or reject a free agent's counter-offer.
export function respondToPlayerCounter(
  negotiationId: string,
  action: 'accept' | 'reject',
  career: Career,
): Career {
  const neg = career.outgoingNegotiations.find((n) => n.id === negotiationId)
  if (!neg || neg.phase !== 'player_counter' || neg.counterAmount === undefined) return career

  if (action === 'accept') {
    return updateNeg(career, negotiationId, {
      currentOffer: neg.counterAmount,
      counterAmount: undefined,
      phase: 'player_accepted',
    })
  }
  return updateNeg(career, negotiationId, { phase: 'failed' })
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
