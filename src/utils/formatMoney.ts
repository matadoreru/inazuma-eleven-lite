export function formatMoney(n: number): string {
  return Math.round(n).toLocaleString('de-DE') + '¥'
}
