import type { Match } from '../types/competition'
import type { Team, TeamSnapshot } from '../types/team'
import type { Player } from '../types/player'
import type { Cup, CupRound, CupRoundName } from '../types/season'
import { simulateCupTiebreak } from './matchSimulator'
import { buildTeamSnapshot } from './formationService'

function addDaysStr(dateStr: string, days: number): string {
  const d = new Date(dateStr)
  d.setDate(d.getDate() + days)
  return d.toISOString().split('T')[0]
}

// When a team has an empty lineup, build a fallback snapshot from reputation
function buildNpcSnapshot(team: Team, players: Player[]): TeamSnapshot {
  const snap = buildTeamSnapshot(team, players)
  if (snap.forwardScore === 0 && snap.defenseScore === 0 && snap.midfieldScore === 0) {
    const base = team.reputation * 0.9
    return { ...snap, forwardScore: base, midfieldScore: base, defenseScore: base, goalkeeperScore: base }
  }
  return snap
}

function makeCupMatch(
  homeTeamId: number,
  awayTeamId: number,
  date: string,
  roundName: CupRoundName,
  matchIndex: number,
): Match {
  return {
    id: `cup-${roundName.replace(/ /g, '_').replace(/\./g, '')}-${matchIndex}-${crypto.randomUUID()}`,
    leagueId: 'cup',
    type: 'cup',
    cupRound: roundName,
    round: matchIndex,
    homeTeamId,
    awayTeamId,
    date,
    played: false,
    homeGoals: 0,
    awayGoals: 0,
    result: null,
  }
}

// Copa del Rey format:
//   17 teams total (9 first_div + 8 second_div)
//   Previa (1 match): 2 weakest second_div teams
//   Octavos (8 matches): 1 previa winner + 6 remaining second_div + 9 first_div = 16 teams
//   Cuartos (4 matches), Semis (2 matches), Final (1 match)
export function initCup(teams: Team[], year: number, seasonStartDate: string): Cup {
  const secondDivTeams = teams
    .filter((t) => t.leagueId === 'second_division')
    .sort((a, b) => a.reputation - b.reputation)  // weakest first

  const firstDivTeams = teams
    .filter((t) => t.leagueId === 'first_division')
    .sort((a, b) => a.reputation - b.reputation)  // weakest first

  const previaTeams = secondDivTeams.slice(0, 2)
  const restSecondDiv = secondDivTeams.slice(2)  // remaining 6 second_div teams

  const previaDate  = addDaysStr(seasonStartDate, 21)
  const octavosDate = addDaysStr(seasonStartDate, 42)
  const cuartosDate = addDaysStr(seasonStartDate, 70)
  const semiDate    = addDaysStr(seasonStartDate, 91)
  const finalDate   = addDaysStr(seasonStartDate, 112)

  // Previa: 1 match, 2 weakest second_div teams
  const previaMatches: Match[] = [
    makeCupMatch(previaTeams[0]?.id ?? -1, previaTeams[1]?.id ?? -1, previaDate, 'Previa', 0),
  ]

  // Octavos: 16 teams → 8 matches, spread 1 per day
  const octavosSeeding: number[] = [
    -1,
    ...restSecondDiv.map((t) => t.id),
    ...firstDivTeams.map((t) => t.id),
  ]
  const octavosMatches: Match[] = []
  for (let i = 0; i < 8; i++) {
    octavosMatches.push(
      makeCupMatch(octavosSeeding[i], octavosSeeding[15 - i], addDaysStr(octavosDate, i), 'Octavos de Final', i),
    )
  }

  // Placeholder rounds (winners filled after previous rounds finish), spread 1 per day
  const cuartosMatches = Array.from({ length: 4 }, (_, i) =>
    makeCupMatch(-1, -1, addDaysStr(cuartosDate, i), 'Cuartos de Final', i),
  )
  const semiMatches = Array.from({ length: 2 }, (_, i) =>
    makeCupMatch(-1, -1, addDaysStr(semiDate, i), 'Semifinal', i),
  )
  const finalMatches = [makeCupMatch(-1, -1, finalDate, 'Final', 0)]

  const rounds: CupRound[] = [
    { name: 'Previa',           matches: previaMatches,  finished: false },
    { name: 'Octavos de Final', matches: octavosMatches, finished: false },
    { name: 'Cuartos de Final', matches: cuartosMatches, finished: false },
    { name: 'Semifinal',        matches: semiMatches,    finished: false },
    { name: 'Final',            matches: finalMatches,   finished: false },
  ]

  return { year, rounds, currentRoundIndex: 0, winnerId: null, finished: false }
}

function getMatchWinner(match: Match): number | null {
  if (!match.played || !match.result) return null
  const r = match.result
  // Check penalties first (definitive)
  if (r.penalties) return r.penalties.winnerId
  // Then extra time
  if (r.extraTime) {
    const totalHome = r.homeGoals + r.extraTime.homeGoals
    const totalAway = r.awayGoals + r.extraTime.awayGoals
    if (totalHome > totalAway) return match.homeTeamId
    if (totalAway > totalHome) return match.awayTeamId
    return null // should never happen after tiebreak
  }
  // Regular time
  if (r.homeGoals > r.awayGoals) return match.homeTeamId
  if (r.awayGoals > r.homeGoals) return match.awayTeamId
  return null
}

export function simulateCupMatch(match: Match, teams: Team[], players: Player[]): Match {
  if (match.homeTeamId === -1 || match.awayTeamId === -1) return match
  const homeTeam = teams.find((t) => t.id === match.homeTeamId)
  const awayTeam = teams.find((t) => t.id === match.awayTeamId)
  if (!homeTeam || !awayTeam) return match

  const homeSnap = buildNpcSnapshot(homeTeam, players)
  const awaySnap = buildNpcSnapshot(awayTeam, players)
  const result = simulateCupTiebreak(homeSnap, awaySnap, match)

  return {
    ...match,
    played: true,
    homeGoals: result.homeGoals + (result.extraTime?.homeGoals ?? 0),
    awayGoals: result.awayGoals + (result.extraTime?.awayGoals ?? 0),
    result,
  }
}

// After a round is fully played, fill in the next round's teams from the winners.
// Returns the updated cup (possibly with currentRoundIndex advanced).
export function advanceCupRound(cup: Cup): Cup {
  const currentRound = cup.rounds[cup.currentRoundIndex]
  // All valid matches (skip any with -1 placeholders that were never filled) must be played
  const validMatches = currentRound.matches.filter(
    (m) => m.homeTeamId !== -1 && m.awayTeamId !== -1,
  )
  if (!validMatches.every((m) => m.played)) return cup

  const updatedRounds = cup.rounds.map((r, i) =>
    i === cup.currentRoundIndex ? { ...r, finished: true } : r,
  )

  const nextIdx = cup.currentRoundIndex + 1

  // Final round finished → cup is over
  if (nextIdx >= cup.rounds.length) {
    const winner = getMatchWinner(currentRound.matches[0])
    if (winner === null) {
      // Fallback: home team wins (should never happen after tiebreak)
      return { ...cup, rounds: updatedRounds, finished: true, winnerId: currentRound.matches[0].homeTeamId }
    }
    return { ...cup, rounds: updatedRounds, finished: true, winnerId: winner }
  }

  const winners = validMatches
    .map((m) => getMatchWinner(m))
    .filter((id): id is number => id !== null)

  // Special case: Previa (index 0) → fill the -1 slot in Octavos
  if (cup.currentRoundIndex === 0) {
    const previaWinner = winners[0]
    const octavos = updatedRounds[1]
    const filledOctavos = octavos.matches.map((m) => {
      if (m.homeTeamId === -1) return { ...m, homeTeamId: previaWinner }
      if (m.awayTeamId === -1) return { ...m, awayTeamId: previaWinner }
      return m
    })
    updatedRounds[1] = { ...octavos, matches: filledOctavos }
  } else {
    // Generic: fill next round pairs from winners
    const nextRound = updatedRounds[nextIdx]
    const filledMatches = nextRound.matches.map((m, i) => ({
      ...m,
      homeTeamId: winners[i * 2] ?? -1,
      awayTeamId: winners[i * 2 + 1] ?? -1,
    }))
    updatedRounds[nextIdx] = { ...nextRound, matches: filledMatches }
  }

  return { ...cup, rounds: updatedRounds, currentRoundIndex: nextIdx }
}

// Shift cup match dates so no team plays in 2 competitions on the same day.
// Pass all league matches (user's league + external leagues) as allLeagueMatches.
// Placeholder matches with teamId === -1 are skipped (teams not yet known).
export function deconflictCupSchedule(cup: Cup, allLeagueMatches: Match[]): Cup {
  const busyDates = new Map<number, Set<string>>()

  function markBusy(teamId: number, date: string) {
    if (teamId === -1) return
    const set = busyDates.get(teamId) ?? new Set()
    set.add(date)
    busyDates.set(teamId, set)
  }

  function isBusy(teamId: number, date: string): boolean {
    if (teamId === -1) return false
    return busyDates.get(teamId)?.has(date) ?? false
  }

  for (const m of allLeagueMatches) {
    markBusy(m.homeTeamId, m.date)
    markBusy(m.awayTeamId, m.date)
  }

  const updatedRounds = cup.rounds.map((round) => {
    const updatedMatches = round.matches.map((match) => {
      if (match.homeTeamId === -1 || match.awayTeamId === -1) return match
      let date = match.date
      for (let i = 0; i < 20; i++) {
        if (!isBusy(match.homeTeamId, date) && !isBusy(match.awayTeamId, date)) break
        date = addDaysStr(date, 1)
      }
      markBusy(match.homeTeamId, date)
      markBusy(match.awayTeamId, date)
      return date !== match.date ? { ...match, date } : match
    })
    return { ...round, matches: updatedMatches }
  })

  return { ...cup, rounds: updatedRounds }
}

// Get the user's next unplayed cup match (on or before currentDate)
export function getNextUserCupMatch(
  cup: Cup | null,
  userTeamId: number,
  currentDate: string,
): Match | null {
  if (!cup || cup.finished) return null
  const round = cup.rounds[cup.currentRoundIndex]
  if (round.finished) return null

  return (
    round.matches.find(
      (m) =>
        (m.homeTeamId === userTeamId || m.awayTeamId === userTeamId) &&
        !m.played &&
        m.date <= currentDate &&
        m.homeTeamId !== -1 &&
        m.awayTeamId !== -1,
    ) ?? null
  )
}

// How many cup rounds did the user win (0 = eliminated before first round / didn't participate)
export function getUserCupRoundsWon(cup: Cup | null, userTeamId: number): number {
  if (!cup) return 0
  let count = 0
  for (const round of cup.rounds) {
    const userMatch = round.matches.find(
      (m) => m.homeTeamId === userTeamId || m.awayTeamId === userTeamId,
    )
    if (!userMatch || !userMatch.played) break
    if (getMatchWinner(userMatch) === userTeamId) count++
    else break
  }
  return count
}
