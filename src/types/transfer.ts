import type { Position, Element } from './player'

export interface TransferFilter {
  position: Position | 'ALL'
  element: Element | 'ALL'
  minMedia: number
  maxPrice: number
  nameSearch: string
  teamSearch: string
  page: number
  pageSize: number
}

export const DEFAULT_TRANSFER_FILTER: TransferFilter = {
  position: 'ALL',
  element: 'ALL',
  minMedia: 0,
  maxPrice: 9999999,
  nameSearch: '',
  teamSearch: '',
  page: 0,
  pageSize: 15,
}
