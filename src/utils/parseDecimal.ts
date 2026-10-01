// A dot with optional thousands commas: "12.5", "1,500", "1,500.25"
const DOT_DECIMAL = /^([1-9]\d{0,2}(,\d{3})+|\d+)?(\.\d*)?$/
// A single comma as the decimal mark, from keyboards that offer only a
// comma: "12,5", "0,125". Three digits after a leading 1-9 ("1,500") are
// thousands instead.
const COMMA_DECIMAL = /^\d+,\d*$/

/**
 * The plain dot form of a number typed by the user ("1,500.5" → "1500.5"),
 * or null if it is not a non-negative decimal. The app writes a dot for
 * decimals and a comma for thousands; a lone comma that cannot be thousands
 * is read as decimal.
 */
export const normalizeDecimal = (value: string): string | null => {
  const text = value.trim()
  if (text === '' || text === '.') return null
  if (DOT_DECIMAL.test(text)) return text.replaceAll(',', '')
  if (COMMA_DECIMAL.test(text)) return text.replace(',', '.')
  return null
}

/** A number typed by the user (see normalizeDecimal), or NaN. */
export const parseDecimal = (value: string): number => {
  const normalized = normalizeDecimal(value)
  return normalized === null ? Number.NaN : Number(normalized)
}
