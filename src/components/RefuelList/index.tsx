import { useEffect, useState } from 'react'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Dialog from '@mui/material/Dialog'
import DialogActions from '@mui/material/DialogActions'
import DialogContent from '@mui/material/DialogContent'
import DialogTitle from '@mui/material/DialogTitle'
import IconButton from '@mui/material/IconButton'
import Menu from '@mui/material/Menu'
import MenuItem from '@mui/material/MenuItem'
import Skeleton from '@mui/material/Skeleton'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import MoreVertIcon from '@mui/icons-material/MoreVert'
import PlaceIcon from '@mui/icons-material/Place'
import ReceiptLongIcon from '@mui/icons-material/ReceiptLong'
import ConfirmDialog from 'components/ConfirmDialog'
import RefuelForm, { levelText, type RefuelResult } from 'components/RefuelForm'
import Stat from 'components/Stat'
import { useLoad } from 'hooks/useLoad'
import { KM_PER_MILE } from 'schemas/fleet'
import { moneyTotal, unitPrices } from 'utils/formatMoney'
import type { RefuelFormValues } from 'schemas/refuelForm'
import { radius } from 'theme/tokens'
import type { RefuelValues } from 'types'
import { formatMeasurementDate } from 'utils/formatDate'
import { formatEditable, formatNumber } from 'utils/formatNumber'
import { refuelAmounts, refuelSummary } from 'utils/refuelMath'
import { reportError } from 'utils/reportError'
import type { TankGeometry } from 'utils/tankVolume'
import { useDistanceUnit } from 'hooks/useDistanceUnit'
import { odometerText } from 'utils/distanceUnit'

/** A refuel as the lists show it, with or without an account. */
export interface RefuelItem extends RefuelValues {
  id: string
  takenAt: Date
  tankName: string
  equipmentName: string | null
  userName: string | null
  place: string | null
  odometerKm: number | null
  /** Loads the invoice's URL; null without one (RF-6). */
  invoice: (() => Promise<string>) | null
}

/** What editing a refuel needs to know about its tank (RF-11). */
export interface RefuelTankContext {
  geometry: TankGeometry
  /** Adjusts a factory tank to its capacity (specs/0015 RF-9). */
  scale: number
  maxInches: number
  capacityGal: number
  odometer: { unit: 'km' | 'mi'; truckName: string } | null
}

export interface TruckEfficiencyRow {
  truckName: string
  km: number
  gallons: number
  unit: 'km' | 'mi'
}

const written = (item: RefuelItem) =>
  item.quantityUnit === 'liter'
    ? `${formatNumber(item.litersAdded, 2)} litros (${formatNumber(item.gallonsAdded, 2)} gal)`
    : `${formatNumber(item.gallonsAdded, 2)} gal (${formatNumber(item.litersAdded, 2)} litros)`

// Quantity and price are stored with 2 decimals: half a cent each way
const ROUNDING = 0.005

/** The stored refuel back in the form, to correct it (RF-11). */
export const toFormValues = (
  item: RefuelItem,
  odometerUnit: 'km' | 'mi'
): RefuelFormValues => {
  const quantity =
    item.quantityUnit === 'gallon' ? item.gallonsAdded : item.litersAdded
  const price =
    item.priceUnit === 'gallon' ? item.pricePerGallon : item.pricePerLiter
  const computed = refuelAmounts({
    quantity,
    quantityUnit: item.quantityUnit,
    price,
    priceUnit: item.priceUnit,
  }).total
  const optional = (value: number | null) =>
    value === null ? '' : formatEditable(value)
  return {
    quantity: formatEditable(quantity),
    quantityUnit: item.quantityUnit,
    price: formatEditable(price),
    priceUnit: item.priceUnit,
    currency: item.currency,
    // A total that differs only by the rounding of the stored quantity and
    // price was computed, not typed: prefilling it as a correction froze it
    // at the old amount when the quantity changed (audit 2026-10-01 #13)
    total:
      Math.abs(item.total - computed) <=
      ROUNDING * (Math.abs(quantity) + Math.abs(price)) + ROUNDING * 2
        ? ''
        : formatEditable(item.total),
    inchesBefore: optional(item.inchesBefore),
    inchesAfter: optional(item.inchesAfter),
    odometer:
      item.odometerKm === null
        ? ''
        : String(
            Math.round(
              item.odometerKm / (odometerUnit === 'mi' ? KM_PER_MILE : 1)
            )
          ),
    stationName: item.stationName ?? '',
  }
}

/** Totals of the period (RF-8, RF-9). */
export function RefuelPeriodSummary({
  items,
  efficiency,
}: {
  items: readonly RefuelItem[]
  efficiency: readonly TruckEfficiencyRow[]
}) {
  const summary = refuelSummary(items)
  return (
    <Box
      component="section"
      aria-label="Resumen del periodo"
      sx={{
        p: 4,
        bgcolor: 'background.paper',
        border: 1,
        borderColor: 'divider',
        borderRadius: `${String(radius.xl)}px`,
      }}
    >
      <Box
        sx={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 3 }}
      >
        <Stat
          size="small"
          label="Combustible"
          value={`${formatNumber(summary.gallons, 2)} gal`}
          caption={`${formatNumber(summary.liters, 2)} litros · ${String(items.length)} ${items.length === 1 ? 'relleno' : 'rellenos'}`}
        />
        {summary.byCurrency.map(group => (
          <Stat
            key={group.currency}
            size="small"
            label={`Gastado en ${group.currency}`}
            value={moneyTotal(group.currency, group.total)}
            caption={unitPrices(
              group.currency,
              group.perGallon,
              group.perLiter
            )}
          />
        ))}
      </Box>
      {efficiency.length > 0 && (
        <Box sx={{ mt: 4 }}>
          <Typography
            variant="overline"
            component="h3"
            sx={{ color: 'text.secondary' }}
          >
            Rendimiento real
          </Typography>
          {efficiency.map(row => {
            const distance = row.unit === 'mi' ? row.km / KM_PER_MILE : row.km
            return (
              <Typography key={row.truckName} variant="body2">
                {row.truckName}: {formatNumber(distance / row.gallons, 1)}{' '}
                {row.unit}/gal ({formatNumber(Math.round(distance))} {row.unit},{' '}
                {formatNumber(Math.round(row.gallons))} gal)
              </Typography>
            )
          })}
        </Box>
      )}
    </Box>
  )
}

function InvoiceDialog({
  load,
  onClose,
}: {
  load: () => Promise<string>
  onClose: () => void
}) {
  const invoice = useLoad('invoice', load)
  const url = invoice.value ?? null
  const failed = invoice.error !== undefined
  useEffect(() => {
    if (invoice.error !== undefined) {
      reportError(invoice.error, { operation: 'loadInvoice' })
    }
  }, [invoice.error])
  return (
    <Dialog open onClose={onClose} aria-labelledby="invoice-title" fullWidth>
      <DialogTitle id="invoice-title">Factura</DialogTitle>
      <DialogContent>
        {failed ? (
          <Typography role="alert">
            No pudimos abrir la factura. Revisa tu conexión.
          </Typography>
        ) : url ? (
          <Box
            component="img"
            src={url}
            alt="Factura del relleno"
            sx={{
              display: 'block',
              width: '100%',
              borderRadius: `${String(radius.md)}px`,
            }}
          />
        ) : (
          <Skeleton
            variant="rounded"
            height={240}
            aria-label="Cargando la factura"
          />
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cerrar</Button>
      </DialogActions>
    </Dialog>
  )
}

function RefuelRow({
  item,
  editable,
  onEdit,
  onDelete,
}: {
  item: RefuelItem
  editable: boolean
  onEdit: () => void
  onDelete: () => void
}) {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null)
  const [showInvoice, setShowInvoice] = useState(false)
  const distanceUnit = useDistanceUnit()
  const date = formatMeasurementDate(item.takenAt)
  return (
    <Box component="li" sx={{ py: 3 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
        <Typography
          variant="caption"
          sx={{ color: 'text.secondary', flexGrow: 1 }}
        >
          <time dateTime={item.takenAt.toISOString()}>{date}</time>
          {item.userName && ` · ${item.userName}`}
        </Typography>
        <Typography variant="subtitle2" component="span">
          {moneyTotal(item.currency, item.total)}
        </Typography>
        {editable && (
          <>
            <IconButton
              size="small"
              aria-label={`Opciones del relleno del ${date}`}
              onClick={event => {
                setAnchor(event.currentTarget)
              }}
            >
              <MoreVertIcon fontSize="small" />
            </IconButton>
            <Menu
              anchorEl={anchor}
              open={anchor !== null}
              onClose={() => {
                setAnchor(null)
              }}
            >
              <MenuItem
                onClick={() => {
                  setAnchor(null)
                  onEdit()
                }}
              >
                Editar
              </MenuItem>
              <MenuItem
                onClick={() => {
                  setAnchor(null)
                  onDelete()
                }}
              >
                Borrar
              </MenuItem>
            </Menu>
          </>
        )}
      </Box>
      <Typography variant="subtitle1" component="p" sx={{ mt: 1 }}>
        {written(item)}
      </Typography>
      <Typography
        variant="caption"
        component="p"
        sx={{ color: 'text.secondary' }}
      >
        {[item.tankName, item.equipmentName].filter(Boolean).join(' · ')} ·{' '}
        {unitPrices(item.currency, item.pricePerGallon, item.pricePerLiter)}
      </Typography>
      <Typography
        variant="caption"
        component="p"
        sx={{ color: 'text.secondary' }}
      >
        Antes {levelText(item.gallonsBefore, item.fillPercentBefore)} → Después{' '}
        {levelText(item.gallonsAfter, item.fillPercentAfter)}
        {item.odometerKm !== null &&
          ` · odómetro ${odometerText(item.odometerKm, distanceUnit)}`}
      </Typography>
      {(item.stationName ?? item.place) && (
        <Typography
          variant="caption"
          component="p"
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 1,
            color: 'text.secondary',
            '& svg': { fontSize: 14 },
          }}
        >
          <PlaceIcon aria-hidden="true" />
          {[item.stationName, item.place].filter(Boolean).join(' · ')}
        </Typography>
      )}
      {item.invoice && (
        <Button
          size="small"
          startIcon={<ReceiptLongIcon />}
          onClick={() => {
            setShowInvoice(true)
          }}
          sx={{ mt: 1 }}
        >
          Ver factura
        </Button>
      )}
      {showInvoice && item.invoice && (
        <InvoiceDialog
          load={item.invoice}
          onClose={() => {
            setShowInvoice(false)
          }}
        />
      )}
    </Box>
  )
}

/**
 * The refuels of the period, newest first, with edit and delete where the
 * role allows (backend specs/0006 RF-10, RF-11).
 */
export default function RefuelList({
  items,
  canChange,
  contextFor,
  onEdit,
  onDelete,
}: {
  items: readonly RefuelItem[]
  canChange: (item: RefuelItem) => boolean
  /** The tank of a refuel, for its edit form; null if it is gone. */
  contextFor: (item: RefuelItem) => RefuelTankContext | null
  onEdit: (item: RefuelItem, result: RefuelResult) => void
  onDelete: (item: RefuelItem) => void
}) {
  const [editing, setEditing] = useState<RefuelItem | null>(null)
  const [deleting, setDeleting] = useState<RefuelItem | null>(null)
  const context = editing ? contextFor(editing) : null

  return (
    <>
      <Box
        component="ul"
        aria-label="Rellenos"
        sx={{
          listStyle: 'none',
          m: 0,
          p: 0,
          '& > li + li': { borderTop: 1, borderColor: 'divider' },
        }}
      >
        {items.map(item => (
          <RefuelRow
            key={item.id}
            item={item}
            editable={canChange(item) && contextFor(item) !== null}
            onEdit={() => {
              setEditing(item)
            }}
            onDelete={() => {
              setDeleting(item)
            }}
          />
        ))}
      </Box>
      {editing && context && (
        <Dialog
          open
          onClose={() => {
            setEditing(null)
          }}
          aria-labelledby="edit-refuel-title"
          fullWidth
        >
          <DialogTitle id="edit-refuel-title">Corregir relleno</DialogTitle>
          <DialogContent>
            <Stack>
              <RefuelForm
                geometry={context.geometry}
                scale={context.scale}
                maxInches={context.maxInches}
                capacityGal={context.capacityGal}
                defaultCurrency={editing.currency}
                // "Before" stays what it was when the refuel happened
                lastGallons={editing.gallonsBefore}
                stations={[]}
                odometer={context.odometer}
                allowsPhoto={false}
                canSave
                initial={toFormValues(editing, context.odometer?.unit ?? 'km')}
                submitLabel="Guardar"
                onSave={result => {
                  onEdit(editing, result)
                  setEditing(null)
                }}
              />
            </Stack>
          </DialogContent>
          <DialogActions>
            <Button
              onClick={() => {
                setEditing(null)
              }}
            >
              Cancelar
            </Button>
          </DialogActions>
        </Dialog>
      )}
      <ConfirmDialog
        open={deleting !== null}
        title="¿Borrar este relleno?"
        description="Se quita del historial. No se puede deshacer."
        confirmLabel="Borrar"
        onConfirm={() => {
          if (deleting) onDelete(deleting)
          setDeleting(null)
        }}
        onClose={() => {
          setDeleting(null)
        }}
      />
    </>
  )
}
