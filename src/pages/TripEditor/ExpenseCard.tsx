import Chip from '@mui/material/Chip'
import ReceiptLongIcon from '@mui/icons-material/ReceiptLong'
import { sileo } from 'sileo'
import type { Currency } from 'schemas/account'
import { formatMeasurementDate } from 'utils/formatDate'
import { moneyTotal } from 'utils/formatMoney'
import RowCard from 'components/RowCard'

interface ExpenseCardProps {
  /** Its category's name. */
  category: string
  amount: number
  currency: Currency
  takenAt: Date | null
  description: string | null
  driverName: string | null
  /** It has its receipt's photo (RF-4). */
  hasReceipt: boolean
  issue?: string | null
  /** The expense of a refuel (specs/0027): no edit, no menu. */
  refuel?: boolean
  /** Not saved yet: removing it only drops it. */
  isNew?: boolean
  onEdit?: () => void
  onRemove?: () => void
}

/** An expense of the trip, as a card (backend specs/0029 RF-4, RF-5). */
export default function ExpenseCard({
  category,
  amount,
  currency,
  takenAt,
  description,
  driverName,
  hasReceipt,
  issue = null,
  refuel = false,
  isNew = false,
  onEdit,
  onRemove,
}: ExpenseCardProps) {
  const total = moneyTotal(currency, amount)
  return (
    <RowCard
      label={`${refuel ? 'Relleno' : 'Gasto'} de ${category}, ${total}`}
      title={category}
      amount={total}
      lines={[
        takenAt && formatMeasurementDate(takenAt),
        description,
        driverName && `Conductor: ${driverName}`,
      ]}
      marks={
        <>
          {hasReceipt && (
            <ReceiptLongIcon
              titleAccess="Con foto del comprobante"
              fontSize="small"
              sx={{ color: 'text.secondary' }}
            />
          )}
          {refuel && <Chip label="Relleno" size="small" variant="outlined" />}
        </>
      }
      issue={issue}
      onClick={
        refuel
          ? () => {
              sileo.info({
                title: 'Este gasto viene de un relleno',
                description: 'Se cambia en el relleno, en Historial.',
              })
            }
          : onEdit
      }
      {...(!refuel &&
        onRemove && {
          removal: {
            menuLabel: `Opciones del gasto de ${category}`,
            title: '¿Quitar este gasto del viaje?',
            description: isNew
              ? 'Aún no está guardado: no se guardará con el viaje.'
              : 'Se borra al guardar el viaje.',
            onRemove,
          },
        })}
    />
  )
}
