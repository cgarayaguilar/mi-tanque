import type { Currency } from 'schemas/account'
import type { ExtraValues } from 'schemas/trips'
import { moneyTotal } from 'utils/formatMoney'
import { parseDecimal } from 'utils/parseDecimal'
import RowCard from 'components/RowCard'

/**
 * The trip's price, the first of its income (backend specs/0029 RF-3): it
 * changes in "Cliente y precio", not here.
 */
export function PriceCard({
  price,
  route,
  currency,
}: {
  /** null until a rate is chosen or a price written. */
  price: number | null
  /** "Managua → San José" */
  route: string | null
  currency: Currency
}) {
  const amount =
    price === null
      ? 'Elige una tarifa o escribe el precio'
      : moneyTotal(currency, price)
  return (
    <RowCard
      label={`Precio del viaje, ${amount}`}
      title="Precio del viaje"
      amount={amount}
      lines={[route, 'Se cambia en Cliente y precio.']}
    />
  )
}

/** An extra income of the trip (RF-3, RF-5). */
export default function IncomeCard({
  extra,
  currency,
  issue,
  onEdit,
  onRemove,
}: {
  extra: ExtraValues
  currency: Currency
  issue: string | null
  onEdit: () => void
  onRemove: () => void
}) {
  const value = parseDecimal(extra.amount)
  const amount = Number.isNaN(value)
    ? extra.amount
    : moneyTotal(currency, value)
  const title = extra.description.trim() || 'Ingreso'
  return (
    <RowCard
      label={`Ingreso de ${title}, ${amount}`}
      title={title}
      amount={amount}
      issue={issue}
      onClick={onEdit}
      removal={{
        menuLabel: `Opciones del ingreso de ${title}`,
        title: '¿Quitar este ingreso del viaje?',
        description: 'Deja de contar al guardar el viaje.',
        onRemove,
      }}
    />
  )
}
