export function formatMoneyInput(value: string): string {
  const digits = value.replace(/\D/g, '').replace(/^0+(?=\d)/, '')
  if (!digits) return ''
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, '.')
}

export function parseMoneyInput(value: string): number {
  const digits = value.replace(/\D/g, '')
  return digits ? Number(digits) : 0
}
