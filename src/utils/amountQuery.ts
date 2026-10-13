import { toCents } from 'schemas/trips'
import { parseDecimal } from 'utils/parseDecimal'

// A filter by amount (backend specs/0043 RF-7): a condition and what was
// typed, kept as text so the field shows it as it was written

export const AMOUNT_OPS = ['any', 'gt', 'lt', 'eq', 'between'] as const
export type AmountOp = (typeof AMOUNT_OPS)[number]

export const AMOUNT_OP_LABELS: Record<AmountOp, string> = {
  any: 'Cualquiera',
  gt: 'Mayor a',
  lt: 'Menor a',
  eq: 'Igual a',
  between: 'Entre',
}

export interface AmountQuery {
  op: AmountOp
  /** The amount, or "Desde" with "Entre". */
  from: string
  /** "Hasta", only with "Entre". */
  to: string
}

export const ANY_AMOUNT: AmountQuery = { op: 'any', from: '', to: '' }

export interface AmountIssues {
  from?: string
  to?: string
}

const NOT_A_NUMBER = 'Escribe un monto, como 1,500.25'

const amountOf = (text: string) => {
  const value = parseDecimal(text)
  return Number.isFinite(value) ? toCents(value) : null
}

/** What to fix in what was typed; nothing for an empty field. */
export const amountIssues = (query: AmountQuery): AmountIssues => {
  if (query.op === 'any') return {}
  const issues: AmountIssues = {}
  const from = amountOf(query.from)
  if (query.from.trim() !== '' && from === null) issues.from = NOT_A_NUMBER
  if (query.op !== 'between') return issues
  const to = amountOf(query.to)
  if (query.to.trim() !== '' && to === null) issues.to = NOT_A_NUMBER
  else if (from !== null && to !== null && to < from)
    issues.to = 'Tiene que ser igual o mayor que "Desde"'
  return issues
}

/**
 * Whether an amount passes, or null when the query filters nothing: no
 * condition, an empty or wrong amount (RF-7). "Igual a" is to the cent, and
 * "Entre" includes both ends.
 */
export const amountMatcher = (
  query: AmountQuery
): ((amount: number) => boolean) | null => {
  if (query.op === 'any') return null
  const from = amountOf(query.from)
  if (from === null) return null
  switch (query.op) {
    case 'gt':
      return amount => toCents(amount) > from
    case 'lt':
      return amount => toCents(amount) < from
    case 'eq':
      return amount => toCents(amount) === from
    case 'between': {
      const to = amountOf(query.to)
      if (to === null || to < from) return null
      return amount => toCents(amount) >= from && toCents(amount) <= to
    }
  }
}

/** "mayor a C$1,000.00", "entre C$500.00 y C$2,000.00", for the filter's text. */
export const amountText = (
  query: AmountQuery,
  money: (amount: number) => string
): string | null => {
  if (amountMatcher(query) === null) return null
  const from = money(amountOf(query.from) ?? 0)
  return query.op === 'between'
    ? `entre ${from} y ${money(amountOf(query.to) ?? 0)}`
    : `${AMOUNT_OP_LABELS[query.op].toLowerCase()} ${from}`
}
