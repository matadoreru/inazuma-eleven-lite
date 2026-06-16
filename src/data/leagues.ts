import type { League } from '../types/competition'

export const leagues: League[] = [
  {
    id: "first_division",
    name: "Primera División",
    level: 1,
    promotionTo: null,
    relegationTo: "second_division",
    promotionSlots: 0,
    relegationSlots: 1,
    teamsCount: 9,
    rounds: 2
  },
  {
    id: "second_division",
    name: "Segunda División",
    level: 2,
    promotionTo: "first_division",
    relegationTo: null,
    promotionSlots: 1,
    relegationSlots: 0,
    teamsCount: 8,
    rounds: 2
  }
]
