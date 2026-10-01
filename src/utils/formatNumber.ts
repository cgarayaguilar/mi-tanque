const formatters = new Map<number | undefined, Intl.NumberFormat>()

/**
 * A number as the app's users write it: dot for decimals and comma for
 * thousands ("24.5", "1,500.25"). With `decimals` it always shows that many;
 * without it, up to two and only when needed. Stored values are plain
 * numbers: this is for display only.
 */
export const formatNumber = (value: number | string, decimals?: number) => {
  const number = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(number)) return String(value)

  let formatter = formatters.get(decimals)
  if (!formatter) {
    formatter = new Intl.NumberFormat('en-US', {
      useGrouping: true,
      minimumFractionDigits: decimals ?? 0,
      maximumFractionDigits: decimals ?? 2,
    })
    formatters.set(decimals, formatter)
  }
  return formatter.format(number)
}
