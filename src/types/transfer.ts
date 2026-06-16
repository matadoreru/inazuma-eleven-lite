import type { Position, Element } from './player'

export interface TransferFilter {
  position: Position | 'ALL'
  element: Element | 'ALL'
  minOverall: number
  maxPrice: number
  nameSearch: string
  page: number
  pageSize: number
}

export const DEFAULT_TRANSFER_FILTER: TransferFilter = {
  position: 'ALL',
  element: 'ALL',
  minOverall: 0,
  maxPrice: 9999999,
  nameSearch: '',
  page: 0,
  pageSize: 15,
}
