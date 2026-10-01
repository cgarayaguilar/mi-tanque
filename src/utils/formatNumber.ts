const formatters = new Map<number | undefined, Intl.NumberFormat>()

/**
 * A number as Spanish users write it: decimal comma ("24,5", "26,22") and no
 * thousands separator. With `decimals` it always shows that many; without
 * it, up to two and only when needed. Stored values keep their dot format:
 * this is for display only.
 */
export const formatNumber = (value: number | string, decimals?: number) => {
  const number = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(number)) return String(value)

  let formatter = formatters.get(decimals)
  if (!formatter) {
    formatter = new Intl.NumberFormat('es-ES', {
      useGrouping: false,
      minimumFractionDigits: decimals ?? 0,
      maximumFractionDigits: decimals ?? 2,
    })
    formatters.set(decimals, formatter)
  }
  return formatter.format(number)
}
