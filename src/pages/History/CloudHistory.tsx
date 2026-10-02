import { lazy, Suspense, useEffect, useId, useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { sileo } from 'sileo'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Collapse from '@mui/material/Collapse'
import Dialog from '@mui/material/Dialog'
import DialogActions from '@mui/material/DialogActions'
import DialogContent from '@mui/material/DialogContent'
import DialogTitle from '@mui/material/DialogTitle'
import FormControl from '@mui/material/FormControl'
import FormLabel from '@mui/material/FormLabel'
import IconButton from '@mui/material/IconButton'
import LinearProgress from '@mui/material/LinearProgress'
import Menu from '@mui/material/Menu'
import MenuItem from '@mui/material/MenuItem'
import NativeSelect from '@mui/material/NativeSelect'
import OutlinedInput from '@mui/material/OutlinedInput'
import Skeleton from '@mui/material/Skeleton'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth'
import CloudOffIcon from '@mui/icons-material/CloudOff'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import HistoryIcon from '@mui/icons-material/History'
import MoreVertIcon from '@mui/icons-material/MoreVert'
import PlaceIcon from '@mui/icons-material/Place'
import ConfirmDialog from 'components/ConfirmDialog'
import EmptyState from 'components/EmptyState'
import ExportButton from 'components/ExportButton'
import HistoryTabs, { type HistoryTab } from 'components/HistoryTabs'
import CloudRefuelHistory from 'pages/History/CloudRefuelHistory'
import NavBar from 'components/NavBar'
import NumberField from 'components/NumberField'
import SelectField from 'components/SelectField'
import Stat from 'components/Stat'
import { KM_PER_MILE, type FleetTank } from 'schemas/fleet'
import {
  cloudMeasurementFormSchema,
  type CloudMeasurementFormValues,
} from 'schemas/measurementForm'
import {
  deleteCloudMeasurement,
  updateCloudMeasurement,
  type CloudMeasurement,
  type MeasurementEdit,
} from 'services/cloudMeasurements'
import { periodOf, useCloudHistoryStore } from 'store/cloudHistory'
import { useFleetStore } from 'store/fleet'
import {
  recoverFromLostPermission,
  selectActiveRole,
  useSessionStore,
} from 'store/session'
import { colorTokens, layout, radius, typeScale } from 'theme/tokens'
import { formatMeasurementDate, formatPeriod } from 'utils/formatDate'
import { formatEditable, formatNumber } from 'utils/formatNumber'
import { maxInchesFor, rangeTruckFor, readingFor } from 'utils/measurementMath'
import { parseDecimal } from 'utils/parseDecimal'
import { reportError } from 'utils/reportError'
import { canChangeReading } from 'utils/roles'
import { equipmentLabel } from 'hooks/equipmentLabel'

const DateModal = lazy(() => import('components/DateModal'))

/** Same rule as firestore.rules (backend specs/0004 RF-14). */
export const canChange = canChangeReading

const placeText = (measurement: CloudMeasurement) => {
  if (measurement.place) {
    return [
      measurement.place.city,
      measurement.place.state,
      measurement.place.country,
    ]
      .filter((part, index, parts) => part && parts.indexOf(part) === index)
      .join(', ')
  }
  if (measurement.legacyPlace) return measurement.legacyPlace
  if (measurement.location && measurement.placeStatus === null)
    return 'Buscando el lugar…'
  return 'Sin ubicación'
}

interface TankGroup {
  tankId: string
  tankName: string
  equipmentName: string | null
  /** Newest first. */
  items: CloudMeasurement[]
}

const groupByTank = (items: CloudMeasurement[]): TankGroup[] => {
  const groups = new Map<string, TankGroup>()
  for (const item of items) {
    const group = groups.get(item.tankId) ?? {
      tankId: item.tankId,
      tankName: item.tankName,
      equipmentName: item.equipment.name,
      items: [],
    }
    group.items.push(item)
    groups.set(item.tankId, group)
  }
  return [...groups.values()]
}

function MeasurementRow({
  measurement,
  editable,
  onEdit,
  onDelete,
}: {
  measurement: CloudMeasurement
  editable: boolean
  onEdit: () => void
  onDelete: () => void
}) {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null)
  const estimate = measurement.estimate
  return (
    <Box sx={{ py: 3 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
        <Typography
          variant="caption"
          sx={{ color: 'text.secondary', flexGrow: 1 }}
        >
          <time dateTime={measurement.takenAt.toISOString()}>
            {formatMeasurementDate(measurement.takenAt)}
          </time>{' '}
          · {measurement.userName}
        </Typography>
        <Typography
          variant="caption"
          sx={{ color: 'text.primary', fontWeight: 600 }}
        >
          {formatNumber(Math.round(measurement.fillPercent))} %
        </Typography>
        {editable && (
          <>
            <IconButton
              size="small"
              aria-label={`Opciones de la medición del ${formatMeasurementDate(measurement.takenAt)}`}
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
      <Box
        sx={{
          display: 'flex',
          alignItems: 'baseline',
          flexWrap: 'wrap',
          columnGap: 2,
          mt: 1,
        }}
      >
        <Typography
          component="span"
          sx={{ ...typeScale.figureSm, color: 'text.primary' }}
        >
          {formatNumber(measurement.gallons, 2)} gal
        </Typography>{' '}
        <Typography variant="caption" sx={{ color: 'text.secondary' }}>
          {formatNumber(measurement.liters, 2)} L ·{' '}
          {formatNumber(measurement.inches)} pulg.
          {estimate
            ? ` · ~${formatNumber(Math.round(estimate.km))} km (${formatNumber(Math.round(estimate.miles))} mi)`
            : ''}
          {measurement.odometerKm !== null
            ? ` · odómetro ${formatNumber(measurement.odometerKm)} km`
            : ''}
        </Typography>
      </Box>
      <LinearProgress
        variant="determinate"
        value={Math.min(100, measurement.fillPercent)}
        aria-label={`Nivel del tanque: ${String(Math.round(measurement.fillPercent))}%`}
        sx={{
          my: 2,
          height: 4,
          borderRadius: `${String(radius.pill)}px`,
          bgcolor: theme => colorTokens[theme.palette.mode].surfaceStrong,
        }}
      />
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
        {placeText(measurement)}
      </Typography>
    </Box>
  )
}

function TankGroupCard({
  group,
  defaultExpanded,
  canEdit,
  onEdit,
  onDelete,
}: {
  group: TankGroup
  defaultExpanded: boolean
  canEdit: (measurement: CloudMeasurement) => boolean
  onEdit: (measurement: CloudMeasurement) => void
  onDelete: (measurement: CloudMeasurement) => void
}) {
  const [expanded, setExpanded] = useState(defaultExpanded)
  const titleId = useId()
  const listId = useId()
  const oldest = group.items.at(-1)
  const newest = group.items[0]
  const change = newest && oldest ? newest.gallons - oldest.gallons : 0
  const count = group.items.length

  return (
    <Box
      component="article"
      aria-labelledby={titleId}
      sx={{
        bgcolor: 'background.paper',
        border: 1,
        borderColor: 'divider',
        borderRadius: `${String(radius.xl)}px`,
        p: 4,
      }}
    >
      <Typography id={titleId} variant="subtitle1" component="h2">
        {group.tankName}
      </Typography>
      <Typography variant="caption" sx={{ color: 'text.secondary' }}>
        {[
          group.equipmentName ?? 'Tanque individual',
          count === 1 ? '1 medición' : `${String(count)} mediciones`,
        ].join(' · ')}
      </Typography>
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: 2,
          mt: 4,
        }}
      >
        <Stat
          size="small"
          label="Al inicio"
          value={formatNumber(oldest?.gallons ?? 0, 2)}
          caption="galones"
        />
        <Stat
          size="small"
          label="Al final"
          value={formatNumber(newest?.gallons ?? 0, 2)}
          caption="galones"
        />
        <Stat
          size="small"
          label="Diferencia"
          value={formatNumber(Math.abs(change), 2)}
          caption={
            change < 0
              ? 'gal. menos'
              : change > 0
                ? 'gal. más'
                : count === 1
                  ? 'una sola medición'
                  : 'sin cambios'
          }
        />
      </Box>
      <Button
        fullWidth
        variant="outlined"
        aria-expanded={expanded}
        aria-controls={listId}
        onClick={() => {
          setExpanded(value => !value)
        }}
        endIcon={
          <ExpandMoreIcon
            sx={{
              transform: expanded ? 'rotate(180deg)' : 'none',
              transition: 'transform 0.15s',
            }}
          />
        }
        sx={{ mt: 4 }}
      >
        {expanded
          ? 'Ocultar mediciones'
          : `Ver ${count === 1 ? '1 medición' : `${String(count)} mediciones`}`}
      </Button>
      <Collapse in={expanded} id={listId}>
        <Box
          component="ul"
          aria-label={`Mediciones de ${group.tankName}`}
          sx={{
            listStyle: 'none',
            m: 0,
            mt: 2,
            p: 0,
            '& > li + li': { borderTop: 1, borderColor: 'divider' },
          }}
        >
          {group.items.map(measurement => (
            <li key={measurement.id}>
              <MeasurementRow
                measurement={measurement}
                editable={canEdit(measurement)}
                onEdit={() => {
                  onEdit(measurement)
                }}
                onDelete={() => {
                  onDelete(measurement)
                }}
              />
            </li>
          ))}
        </Box>
      </Collapse>
    </Box>
  )
}

function EditDialog({
  measurement,
  onClose,
}: {
  measurement: CloudMeasurement
  onClose: () => void
}) {
  const { trucks, trailers, tanks } = useFleetStore()
  const applyEdit = useCloudHistoryStore(state => state.applyEdit)
  const uid = useSessionStore(state => state.user?.uid ?? '')
  const [tankId, setTankId] = useState(measurement.tankId)
  const tank = tanks.find(item => item.id === tankId)
  const options = tanks.filter(
    item => !item.archived || item.id === measurement.tankId
  )
  const truck = tank ? rangeTruckFor(tank, trucks, trailers) : null
  const unit = truck?.distanceUnit ?? 'km'
  const fromKm = unit === 'mi' ? 1 / KM_PER_MILE : 1
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<CloudMeasurementFormValues>({
    resolver: zodResolver(
      cloudMeasurementFormSchema(tank ? maxInchesFor(tank) : 600)
    ),
    defaultValues: {
      inches: formatEditable(measurement.inches),
      odometer:
        measurement.odometerKm === null
          ? ''
          : String(Math.round(measurement.odometerKm * fromKm)),
    },
  })

  const equipmentNameOf = (item: FleetTank) =>
    item.equipment.kind === 'truck'
      ? (trucks.find(t => t.id === item.equipment.id)?.name ?? null)
      : item.equipment.kind === 'trailer'
        ? (trailers.find(t => t.id === item.equipment.id)?.name ?? null)
        : null

  const onSubmit = ({ inches, odometer }: CloudMeasurementFormValues) => {
    if (!tank) {
      // Regression: "Guardar" did nothing while the fleet had not loaded
      sileo.error({
        title: 'Todavía no cargamos el tanque',
        description: 'Espera un momento y vuelve a intentarlo.',
      })
      return
    }
    const edit: MeasurementEdit = {
      tankId: tank.id,
      tankName: tank.name,
      equipment: equipmentLabel(tank, equipmentNameOf(tank)),
      reading: readingFor(
        tank,
        parseDecimal(inches),
        truck?.fuelEfficiencyKmPerGal ?? null
      ),
      // Without a truck the form does not ask it: the same tank keeps the
      // one saved (it was erased); another tank has none
      odometerKm:
        tank.equipment.kind === 'truck'
          ? odometer.trim() !== ''
            ? Math.round(parseDecimal(odometer) / fromKm)
            : null
          : tank.id === measurement.tankId
            ? measurement.odometerKm
            : null,
    }
    applyEdit(measurement.id, edit)
    updateCloudMeasurement(measurement.id, uid, edit).catch(
      (error: unknown) => {
        reportError(error, { operation: 'updateCloudMeasurement' })
        if (recoverFromLostPermission(error)) return
        sileo.error({
          title: 'No pudimos guardar el cambio',
          description: 'Revisa los datos y vuelve a intentarlo.',
        })
      }
    )
    sileo.success({ title: 'Medición corregida' })
    onClose()
  }

  return (
    <Dialog
      open
      onClose={onClose}
      aria-labelledby="edit-measurement-title"
      fullWidth
    >
      <DialogTitle id="edit-measurement-title">Corregir medición</DialogTitle>
      <DialogContent>
        <Box
          component="form"
          id="edit-measurement"
          noValidate
          onSubmit={event => {
            void handleSubmit(onSubmit)(event)
          }}
          sx={{ display: 'flex', flexDirection: 'column', gap: 4, pt: 2 }}
        >
          <FormControl fullWidth>
            <FormLabel htmlFor="editTank">Tanque</FormLabel>
            <NativeSelect
              input={<OutlinedInput />}
              value={tankId}
              inputProps={{ id: 'editTank' }}
              onChange={event => {
                setTankId(event.target.value)
              }}
            >
              {options.map(item => (
                <option key={item.id} value={item.id}>
                  {[item.name, equipmentNameOf(item)]
                    .filter(Boolean)
                    .join(' · ')}
                </option>
              ))}
            </NativeSelect>
          </FormControl>
          <NumberField
            id="editInches"
            label="Pulgadas de combustible"
            unit="pulg."
            placeholder="Ej. 12.5"
            hint={tank ? `Entre 0 y ${formatNumber(maxInchesFor(tank))}.` : ''}
            error={errors.inches?.message}
            registration={register('inches')}
          />
          {tank?.equipment.kind === 'truck' && (
            <NumberField
              id="editOdometer"
              label="Odómetro (opcional)"
              unit={unit}
              placeholder="Ej. 120500"
              hint=""
              error={errors.odometer?.message}
              registration={register('odometer')}
            />
          )}
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancelar</Button>
        <Button type="submit" form="edit-measurement" variant="contained">
          Guardar
        </Button>
      </DialogActions>
    </Dialog>
  )
}

/** History with a session (backend specs/0004 RF-10–RF-14). */
export default function CloudHistory() {
  const orgId = useSessionStore(state => state.organization?.id ?? '')
  const orgName = useSessionStore(state => state.organization?.name ?? '')
  const uid = useSessionStore(state => state.user?.uid)
  const role = useSessionStore(selectActiveRole)
  const history = useCloudHistoryStore()
  const { trucks, trailers, load: loadFleet } = useFleetStore()
  const [pickerIsOpen, setPickerIsOpen] = useState(false)
  const [tab, setTab] = useState<HistoryTab>('measurements')
  const [editing, setEditing] = useState<CloudMeasurement | null>(null)
  const [deleting, setDeleting] = useState<CloudMeasurement | null>(null)
  const { load } = history

  useEffect(() => {
    if (!orgId) return
    void load(orgId)
    void loadFleet(orgId)
  }, [orgId, load, loadFleet])

  const period = periodOf(history)
  const periodText = formatPeriod(period)
  const groups = useMemo(() => groupByTank(history.items), [history.items])

  const equipmentOptions = [
    { value: '', label: 'Todos los equipos' },
    ...trucks.map(truck => ({
      value: truck.id,
      label: `Camión · ${truck.name}`,
    })),
    ...trailers.map(trailer => ({
      value: trailer.id,
      label: `Remolque · ${trailer.name}`,
    })),
  ]

  const confirmDelete = () => {
    if (!deleting) return
    const { id } = deleting
    history.remove(id)
    setDeleting(null)
    deleteCloudMeasurement(id).catch((error: unknown) => {
      reportError(error, { operation: 'deleteCloudMeasurement' })
      if (recoverFromLostPermission(error)) return
      sileo.error({
        title: 'No pudimos borrar la medición',
        description: 'Vuelve a intentarlo.',
      })
    })
    sileo.success({ title: 'Medición borrada' })
  }

  const renderGroups = () => {
    if (history.status === 'error' && history.items.length === 0) {
      return (
        <EmptyState
          headingLevel="h2"
          icon={<CloudOffIcon />}
          title="No pudimos cargar el historial"
          description="Revisa tu conexión y vuelve a intentarlo."
          action={{ label: 'Reintentar', onClick: () => void load(orgId) }}
        />
      )
    }
    if (history.status !== 'ready' && history.items.length === 0) {
      return (
        <Stack spacing={4} aria-busy="true" aria-label="Cargando historial">
          {[0, 1].map(index => (
            <Skeleton
              key={index}
              variant="rounded"
              height={248}
              sx={{ borderRadius: `${String(radius.xl)}px` }}
            />
          ))}
        </Stack>
      )
    }
    if (groups.length === 0) {
      return (
        <EmptyState
          headingLevel="h2"
          icon={<HistoryIcon />}
          title="Sin mediciones en este periodo"
          description="Elige otro periodo u otro equipo, o haz una medición."
          action={{
            label: 'Cambiar periodo',
            onClick: () => {
              setPickerIsOpen(true)
            },
          }}
        />
      )
    }
    return (
      <Stack spacing={4}>
        {groups.map(group => (
          <TankGroupCard
            key={group.tankId}
            group={group}
            defaultExpanded={groups.length === 1}
            canEdit={measurement => canChange(measurement, role, uid)}
            onEdit={setEditing}
            onDelete={setDeleting}
          />
        ))}
        {history.cursor && (
          <Button
            variant="outlined"
            loading={history.loadingMore}
            onClick={() => {
              history.loadMore().catch(() => {
                sileo.error({
                  title: 'No pudimos cargar más mediciones',
                  description: 'Revisa tu conexión.',
                })
              })
            }}
          >
            Ver más
          </Button>
        )}
      </Stack>
    )
  }

  return (
    <Box
      component="main"
      sx={{
        minHeight: `calc(100dvh - ${String(layout.appBarHeight)}px)`,
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <Box sx={{ p: 4, flexGrow: 1 }}>
        <Typography variant="h3" component="h1">
          Historial
        </Typography>
        <Typography variant="body2" sx={{ mt: 1, mb: 4 }}>
          Las mediciones y los rellenos de tu organización.
        </Typography>

        <Typography
          variant="overline"
          component="p"
          sx={{ color: 'text.secondary', mb: 1 }}
        >
          Periodo
        </Typography>
        <Box sx={{ display: 'flex', gap: 2, mb: 4 }}>
          <Button
            variant="outlined"
            fullWidth
            startIcon={<CalendarMonthIcon />}
            onClick={() => {
              setPickerIsOpen(true)
            }}
            aria-label={`Periodo: ${periodText}. Cambiar`}
            sx={{ justifyContent: 'flex-start' }}
          >
            {periodText}
          </Button>
          <ExportButton
            kind={tab}
            run={() =>
              // import(): the CSV code loads only when exporting (specs/0007)
              import('services/exportCloud').then(({ exportCloudHistory }) =>
                exportCloudHistory({
                  kind: tab,
                  period,
                  orgId,
                  orgName,
                  equipmentId: history.equipmentId,
                })
              )
            }
          />
        </Box>
        <Box sx={{ mb: 6 }}>
          <SelectField
            id="historyEquipment"
            label="Equipo"
            options={equipmentOptions}
            registration={{
              name: 'equipment',
              ref: () => undefined,
              onBlur: () => Promise.resolve(),
              onChange: event => {
                const value = (event.target as HTMLSelectElement).value
                return history.chooseEquipment(value || null)
              },
            }}
          />
        </Box>

        <HistoryTabs tab={tab} onChange={setTab} />
        {tab === 'measurements' ? (
          renderGroups()
        ) : (
          <CloudRefuelHistory
            period={period}
            equipmentId={history.equipmentId}
            onChangePeriod={() => {
              setPickerIsOpen(true)
            }}
          />
        )}
      </Box>
      <NavBar />

      {pickerIsOpen && (
        <Suspense fallback={null}>
          <DateModal
            initialRange={{ startDate: period.start, endDate: period.end }}
            onSelect={({ startDate, endDate }) =>
              void history.choosePeriod({ start: startDate, end: endDate })
            }
            onClose={() => {
              setPickerIsOpen(false)
            }}
          />
        </Suspense>
      )}
      {editing && (
        <EditDialog
          measurement={editing}
          onClose={() => {
            setEditing(null)
          }}
        />
      )}
      <ConfirmDialog
        open={deleting !== null}
        title="¿Borrar esta medición?"
        description="Se quita del historial de la organización. No se puede deshacer."
        confirmLabel="Borrar"
        onConfirm={confirmDelete}
        onClose={() => {
          setDeleting(null)
        }}
      />
    </Box>
  )
}
