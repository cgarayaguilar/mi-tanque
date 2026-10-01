/**
 * Parses a number typed by the user, with a comma or a dot as the decimal
 * separator ("12,5" or "12.5"), as Spanish keyboards offer both. Returns NaN
 * for anything that is not a plain non-negative decimal.
 */
export const parseDecimal = (value: string): number => {
  const normalized = value.trim().replace(',', '.')

  return /^(\d+\.?\d*|\.\d+)$/.test(normalized)
    ? Number(normalized)
    : Number.NaN
}
