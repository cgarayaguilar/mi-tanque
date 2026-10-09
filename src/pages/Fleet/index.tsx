import {
  useDeferredValue,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { useLocation, useParams } from 'wouter'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import ButtonBase from '@mui/material/ButtonBase'
import Chip from '@mui/material/Chip'
import InputAdornment from '@mui/material/InputAdornment'
import OutlinedInput from '@mui/material/OutlinedInput'
import Skeleton from '@mui/material/Skeleton'
import Stack from '@mui/material/Stack'
import Tab from '@mui/material/Tab'
import Tabs from '@mui/material/Tabs'
import Typography from '@mui/material/Typography'
import AddIcon from '@mui/icons-material/Add'
import RequestQuoteOutlinedIcon from '@mui/icons-material/RequestQuoteOutlined'
import BadgeOutlinedIcon from '@mui/icons-material/BadgeOutlined'
import BusinessOutlinedIcon from '@mui/icons-material/BusinessOutlined'
import CloudOffIcon from '@mui/icons-material/CloudOff'
import LocalShippingIcon from '@mui/icons-material/LocalShipping'
import SearchIcon from '@mui/icons-material/Search'
import SearchOffIcon from '@mui/icons-material/SearchOff'
import ColorDot from 'components/ColorDot'
import EmptyState from 'components/EmptyState'
import NavBar from 'components/NavBar'
import SessionGate from 'components/SessionGate'
import TankShapeIcon from 'components/TankShapeIcon'
import { clientContact, type Client } from 'schemas/clients'
import { driverContact, type Driver } from 'schemas/drivers'
import { ratesByClient, type Rate } from 'schemas/rates'
import { moneyTotal } from 'utils/formatMoney'
import type { FleetTank, LastMeasurement, Trailer, Truck } from 'schemas/fleet'
import { formatTimeAgo } from 'utils/formatDate'
import { useFleetStore } from 'store/fleet'
import { selectActiveRole, useSessionStore } from 'store/session'
import { layout, radius, softShadow, typeScale } from 'theme/tokens'
import {
  tankMeasures,
  tankShapeLabel,
  trailerTypeLabel,
  truckFigures,
  vehicleSubtitle,
} from 'utils/fleetLabels'
import {
  FLEET_SECTIONS,
  sectionBySlug,
  sectionWords,
  type FleetSection,
} from 'utils/fleetSections'
import { foldText } from 'utils/foldText'
import { formatNumber } from 'utils/formatNumber'
import { canWriteFleet } from 'utils/roles'
import { useDistanceUnit } from 'hooks/useDistanceUnit'
import FilterChip, { FilterBar, FilterToggle } from 'components/FilterChip'
import { matchBrand, matchModel } from 'data/truckModels'
import InsuranceChip from 'components/InsuranceChip'
import {
  insuranceNotice,
  licenseNotice,
  type InsuranceNotice,
} from 'utils/insurance'
import { RETRY_HINT } from 'utils/withTimeout'

const CARD_HEIGHT = 88

// The "General" option of the rates' client filter (specs/0024 RF-5)
const GENERAL = '__general'

interface CardProps {
  label: string
  leading: ReactNode
  title: string
  /** A figure under the title, larger: a rate's price (specs/0024 RF-5). */
  figure?: string
  lines: (string | null)[]
  archived: boolean
  /** The insurance's notice, if it is due soon (backend specs/0011 RF-4). */
  notice?: InsuranceNotice | null
  onClick: () => void
}

function FleetCard({
  label,
  leading,
  title,
  figure,
  lines,
  archived,
  notice = null,
  onClick,
}: CardProps) {
  return (
    <ButtonBase
      onClick={onClick}
      aria-label={notice ? `${label}, ${notice.text}` : label}
      sx={{
        width: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'flex-start',
        gap: 3,
        px: 4,
        py: 3,
        textAlign: 'left',
        bgcolor: 'background.paper',
        border: 1,
        borderColor: 'divider',
        borderRadius: `${String(radius.lg)}px`,
        opacity: archived ? 0.7 : 1,
        transition: 'box-shadow 0.15s',
        '&:hover': { boxShadow: softShadow },
      }}
    >
      {leading}
      <Box sx={{ minWidth: 0, flexGrow: 1 }}>
        <Typography
          component="span"
          variant="subtitle1"
          noWrap
          sx={{ display: 'block' }}
        >
          {title}
        </Typography>
        {figure && (
          <Typography
            component="span"
            noWrap
            sx={{ ...typeScale.figureSm, display: 'block', my: 0.5 }}
          >
            {figure}
          </Typography>
        )}
        {lines.filter(Boolean).map(line => (
          <Typography
            key={line}
            component="span"
            variant="caption"
            noWrap
            sx={{ display: 'block', color: 'text.secondary' }}
          >
            {line}
          </Typography>
        ))}
        {notice && (
          <Box sx={{ mt: 1 }}>
            <InsuranceChip notice={notice} />
          </Box>
        )}
      </Box>
      {archived && <Chip label="Archivado" size="small" />}
    </ButtonBase>
  )
}

// "70 % · 84 gal · hace 2 h" (backend specs/0004 RF-18)
const lastMeasurementLine = (last: LastMeasurement) =>
  `${formatNumber(Math.round(last.fillPercent))} % · ${formatNumber(Math.round(last.gallons))} gal · ${formatTimeAgo(last.takenAt)}`

/** The list's brand, or what was typed (specs/0016 RF-8). */
const truckBrand = (truck: Truck) =>
  matchBrand(truck.brand) ?? (truck.brand?.trim() || null)

const truckModel = (truck: Truck) => {
  const brand = matchBrand(truck.brand)
  return matchModel(brand, truck.model) ?? (truck.model?.trim() || null)
}

/** The names for a row of chips, once each, in order. */
const distinctNames = (names: (string | null)[]) =>
  [...new Set(names.flatMap(name => (name ? [name] : [])))].sort((a, b) =>
    a.localeCompare(b, 'es', { numeric: true })
  )

// Without accents or capitals: "perez" finds "Pérez" (specs/0022 RF-5)
const matches = (
  query: string,
  ...fields: (string | number | null | undefined)[]
) => fields.some(field => foldText(String(field ?? '')).includes(query))

function FleetScreen() {
  const params = useParams<{ section?: string }>()
  const section = sectionBySlug(params.section)
  const [, navigate] = useLocation()
  const orgId = useSessionStore(state => state.organization?.id ?? null)
  const role = useSessionStore(selectActiveRole)
  const {
    status,
    trucks,
    trailers,
    tanks,
    clients,
    drivers,
    rates,
    members,
    load,
  } = useFleetStore()
  const distanceUnit = useDistanceUnit()
  const today = new Date()
  const [search, setSearch] = useState('')
  const [showArchived, setShowArchived] = useState(false)
  // Trucks by brand and model, typed names recognized (specs/0016 RF-8)
  const [brand, setBrand] = useState<string | null>(null)
  // Rates by client: an id, GENERAL or all (specs/0024 RF-5)
  const [rateClient, setRateClient] = useState<string | null>(null)
  const [model, setModel] = useState<string | null>(null)
  const query = useDeferredValue(foldText(search.trim()))
  const canWrite = canWriteFleet(role)

  useEffect(() => {
    if (orgId) void load(orgId)
  }, [orgId, load])

  const truckName = useMemo(
    () => new Map(trucks.map(truck => [truck.id, truck.name])),
    [trucks]
  )
  const trailerName = useMemo(
    () => new Map(trailers.map(trailer => [trailer.id, trailer.name])),
    [trailers]
  )
  const clientName = useMemo(
    () => new Map(clients.map(client => [client.id, client.name])),
    [clients]
  )
  // The client's current name; the copy saved with the rate otherwise
  const rateClientNameOf = (clientId: string) =>
    clientName.get(clientId) ?? null
  const rateClientName = (rate: Rate) =>
    rate.clientId === null
      ? null
      : (clientName.get(rate.clientId) ?? rate.clientName)
  const memberName = useMemo(
    () => new Map(members.map(member => [member.uid, member.displayName])),
    [members]
  )
  const tanksPerTruck = useMemo(() => {
    const counts = new Map<string, number>()
    for (const tank of tanks) {
      if (tank.equipment.kind === 'truck' && !tank.archived) {
        counts.set(tank.equipment.id, (counts.get(tank.equipment.id) ?? 0) + 1)
      }
    }
    return counts
  }, [tanks])

  const open = (id: string) => {
    navigate(`/flota/${section.slug}/${id}`)
  }

  const equipmentName = (tank: FleetTank) =>
    tank.equipment.kind === 'truck'
      ? (truckName.get(tank.equipment.id) ?? 'Camión')
      : tank.equipment.kind === 'trailer'
        ? (trailerName.get(tank.equipment.id) ?? 'Remolque')
        : 'Individual'

  const visible = <T extends { archived: boolean }>(
    items: T[],
    match: (item: T) => boolean
  ) => items.filter(item => item.archived === showArchived && match(item))

  const shownTrucks = trucks.filter(truck => truck.archived === showArchived)
  const brandOptions = distinctNames(shownTrucks.map(truckBrand))
  const modelOptions =
    brand === null
      ? []
      : distinctNames(
          shownTrucks
            .filter(truck => truckBrand(truck) === brand)
            .map(truckModel)
        )

  // "General" and the clients that have rates, among those shown
  const shownRates = rates.filter(rate => rate.archived === showArchived)
  const rateClients = new Map<string, string>()
  for (const rate of shownRates) {
    if (rate.clientId !== null && !rateClients.has(rate.clientId)) {
      rateClients.set(rate.clientId, rateClientName(rate) ?? rate.clientId)
    }
  }
  const rateClientOptions = [
    ...(shownRates.some(rate => rate.clientId === null)
      ? [{ value: GENERAL, label: 'General' }]
      : []),
    ...[...rateClients]
      .map(([value, label]) => ({ value, label }))
      .sort((a, b) => a.label.localeCompare(b.label, 'es')),
  ]

  // With a group, the cards go under its subtitle: a rate's client
  // (specs/0033 RF-4)
  const cards: { id: string; card: ReactNode; group?: string }[] =
    section.collection === 'trucks'
      ? visible(
          trucks,
          (t: Truck) =>
            (brand === null || truckBrand(t) === brand) &&
            (model === null || truckModel(t) === model) &&
            matches(query, t.name, t.plate, t.brand, t.model, t.color?.label)
        ).map(truck => {
          const { efficiency, odometer } = truckFigures(truck, distanceUnit)
          const tankCount = tanksPerTruck.get(truck.id) ?? 0
          return {
            id: truck.id,
            card: (
              <FleetCard
                label={`Camión ${truck.name}`}
                leading={<ColorDot swatch={truck.color?.swatch} size={20} />}
                title={truck.name}
                lines={[
                  vehicleSubtitle(truck) || null,
                  [
                    tankCount === 1
                      ? '1 tanque'
                      : `${String(tankCount)} tanques`,
                    odometer,
                  ]
                    .filter(Boolean)
                    .join(' · '),
                  // Its own line: loaded and empty use " · " too (specs/0021)
                  efficiency,
                ]}
                archived={truck.archived}
                notice={insuranceNotice(
                  truck.insuranceExpiresOn,
                  today,
                  truck.archived
                )}
                onClick={() => {
                  open(truck.id)
                }}
              />
            ),
          }
        })
      : section.collection === 'trailers'
        ? visible(trailers, (t: Trailer) =>
            matches(query, t.name, t.plate, trailerTypeLabel(t), t.color?.label)
          ).map(trailer => ({
            id: trailer.id,
            card: (
              <FleetCard
                label={`Remolque ${trailer.name}`}
                leading={<ColorDot swatch={trailer.color?.swatch} size={20} />}
                title={trailer.name}
                lines={[
                  [trailerTypeLabel(trailer), trailer.plate]
                    .filter(Boolean)
                    .join(' · '),
                  trailer.hitchedTruckId
                    ? `Enganchado a ${truckName.get(trailer.hitchedTruckId) ?? 'un camión'}`
                    : 'Sin enganchar',
                ]}
                archived={trailer.archived}
                notice={insuranceNotice(
                  trailer.insuranceExpiresOn,
                  today,
                  trailer.archived
                )}
                onClick={() => {
                  open(trailer.id)
                }}
              />
            ),
          }))
        : section.collection === 'rates'
          ? ratesByClient(
              visible(
                rates,
                (r: Rate) =>
                  (rateClient === null ||
                    (rateClient === GENERAL
                      ? r.clientId === null
                      : r.clientId === rateClient)) &&
                  matches(
                    query,
                    r.origin,
                    r.destination,
                    rateClientName(r),
                    r.description
                  )
              ),
              rateClientNameOf
            ).map(({ rate, group }) => ({
              id: rate.id,
              group,
              card: (
                <FleetCard
                  label={`Tarifa ${rate.name}`}
                  leading={
                    <RequestQuoteOutlinedIcon
                      sx={{ fontSize: 24, color: 'text.secondary' }}
                    />
                  }
                  title={rate.name}
                  figure={moneyTotal(rate.currency, rate.price)}
                  lines={[rate.description]}
                  archived={rate.archived}
                  onClick={() => {
                    open(rate.id)
                  }}
                />
              ),
            }))
          : section.collection === 'drivers'
            ? visible(drivers, (d: Driver) =>
                matches(query, d.name, d.phone, d.licenseNumber)
              ).map(driver => ({
                id: driver.id,
                card: (
                  <FleetCard
                    label={`Conductor ${driver.name}`}
                    leading={
                      <BadgeOutlinedIcon
                        sx={{ fontSize: 24, color: 'text.secondary' }}
                      />
                    }
                    title={driver.name}
                    lines={[
                      driverContact(driver),
                      driver.memberUid
                        ? `Cuenta: ${memberName.get(driver.memberUid) ?? 'un miembro'}`
                        : null,
                    ]}
                    archived={driver.archived}
                    notice={licenseNotice(
                      driver.licenseExpiresOn,
                      today,
                      driver.archived
                    )}
                    onClick={() => {
                      open(driver.id)
                    }}
                  />
                ),
              }))
            : section.collection === 'clients'
              ? visible(clients, (c: Client) =>
                  matches(query, c.name, c.phone, c.email, c.taxId)
                ).map(client => ({
                  id: client.id,
                  card: (
                    <FleetCard
                      label={`Cliente ${client.name}`}
                      leading={
                        <BusinessOutlinedIcon
                          sx={{ fontSize: 24, color: 'text.secondary' }}
                        />
                      }
                      title={client.name}
                      lines={[clientContact(client)]}
                      archived={client.archived}
                      onClick={() => {
                        open(client.id)
                      }}
                    />
                  ),
                }))
              : visible(tanks, (t: FleetTank) =>
                  matches(query, t.name, equipmentName(t), t.capacityGal)
                ).map(tank => ({
                  id: tank.id,
                  card: (
                    <FleetCard
                      label={`Tanque ${tank.name}`}
                      leading={<TankShapeIcon shape={tank.shape} size={36} />}
                      title={tank.name}
                      lines={[
                        `${tankShapeLabel(tank)} · ${tankMeasures(tank)}`,
                        `${formatNumber(tank.capacityGal)} gal · ${equipmentName(tank)}`,
                        tank.lastMeasurement &&
                          lastMeasurementLine(tank.lastMeasurement),
                      ]}
                      archived={tank.archived}
                      onClick={() => {
                        open(tank.id)
                      }}
                    />
                  ),
                }))

  const total =
    section.collection === 'trucks'
      ? trucks.length
      : section.collection === 'trailers'
        ? trailers.length
        : section.collection === 'clients'
          ? clients.length
          : section.collection === 'drivers'
            ? drivers.length
            : section.collection === 'rates'
              ? rates.length
              : tanks.length

  const words = sectionWords(section)
  const sectionIcon =
    section.collection === 'clients' ? (
      <BusinessOutlinedIcon />
    ) : section.collection === 'drivers' ? (
      <BadgeOutlinedIcon />
    ) : section.collection === 'rates' ? (
      <RequestQuoteOutlinedIcon />
    ) : (
      <LocalShippingIcon />
    )

  const renderList = () => {
    if (status === 'error' && total === 0) {
      return (
        <EmptyState
          headingLevel="h2"
          icon={<CloudOffIcon />}
          title="No pudimos cargar tu flota"
          description={RETRY_HINT}
          action={{
            label: 'Reintentar',
            onClick: () => orgId && void load(orgId),
          }}
        />
      )
    }
    if (status !== 'ready' && total === 0) {
      return (
        <Stack
          spacing={2}
          aria-busy="true"
          aria-label={`Cargando ${section.label.toLowerCase()}`}
        >
          {[0, 1, 2].map(index => (
            <Skeleton
              key={index}
              variant="rounded"
              height={CARD_HEIGHT}
              sx={{ borderRadius: `${String(radius.lg)}px` }}
            />
          ))}
        </Stack>
      )
    }
    if (cards.length === 0 && !query && !showArchived && total > 0) {
      // Everything is archived: say so instead of "you have none"
      return (
        <EmptyState
          headingLevel="h2"
          icon={sectionIcon}
          title={`${words.all} ${section.label.toLowerCase()} están archivad${words.them}`}
          description={`Puedes ver${words.thePlural} y restaurar${words.thePlural} cuando ${words.thePlural} necesites.`}
          action={{
            label: 'Ver archivados',
            onClick: () => {
              setShowArchived(true)
            },
          }}
        />
      )
    }
    if (cards.length === 0 && !query && !showArchived) {
      return (
        <EmptyState
          headingLevel="h2"
          icon={sectionIcon}
          title={
            // specs/0022 RF-5
            section.collection === 'clients'
              ? 'Agrega tus clientes'
              : `Aún no tienes ${section.label.toLowerCase()}`
          }
          description={
            canWrite
              ? `Agrega tu ${words.first} ${section.one} para tener su información a mano.`
              : `Cuando tu equipo ${words.thePlural} agregue, aparecerán aquí.`
          }
          {...(canWrite && {
            action: {
              label: section.add,
              onClick: () => {
                navigate(`/flota/${section.slug}/nuevo`)
              },
            },
          })}
        />
      )
    }
    if (cards.length === 0) {
      return (
        <EmptyState
          headingLevel="h2"
          icon={<SearchOffIcon />}
          title={
            showArchived ? `No hay archivad${words.them}` : 'Sin resultados'
          }
          description={
            showArchived
              ? `Aquí aparecen ${words.thePlural} ${section.label.toLowerCase()} que archives.`
              : SEARCH_HINTS[section.collection]
          }
          action={
            showArchived
              ? {
                  label: `Ver activ${words.them}`,
                  onClick: () => {
                    setShowArchived(false)
                  },
                }
              : {
                  label: 'Limpiar búsqueda',
                  onClick: () => {
                    setSearch('')
                  },
                }
          }
        />
      )
    }
    const list = (items: typeof cards, label: string) => (
      <Stack
        component="ul"
        spacing={2}
        aria-label={label}
        sx={{ listStyle: 'none', m: 0, p: 0 }}
      >
        {items.map(({ id, card }) => (
          <li key={id}>{card}</li>
        ))}
      </Stack>
    )
    const groups = [...new Set(cards.map(item => item.group))]
    if (groups.every(group => group === undefined)) {
      return list(cards, section.label)
    }
    return (
      <Stack spacing={5}>
        {groups.map((group = '', index) => (
          <Box
            key={group}
            component="section"
            aria-labelledby={`fleet-group-${String(index)}`}
          >
            <Typography
              id={`fleet-group-${String(index)}`}
              variant="overline"
              component="h2"
              sx={{ display: 'block', color: 'text.secondary', mb: 1 }}
            >
              {group}
            </Typography>
            {list(
              cards.filter(item => item.group === group),
              `${section.label} de ${group}`
            )}
          </Box>
        ))}
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
      <Box sx={{ px: 4, pt: 2, pb: 4, flexGrow: 1 }}>
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 2,
          }}
        >
          <Typography variant="h3" component="h1">
            Flota
          </Typography>
          {canWrite && (
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() => {
                navigate(`/flota/${section.slug}/nuevo`)
              }}
            >
              Agregar
            </Button>
          )}
        </Box>

        <Tabs
          value={section.slug}
          onChange={(_, slug: string) => {
            setSearch('')
            setBrand(null)
            setRateClient(null)
            setModel(null)
            navigate(`/flota/${slug}`)
          }}
          // Four sections and more to come: they slide instead of squeezing
          // (specs/0022 RF-4)
          variant="scrollable"
          scrollButtons={false}
          aria-label="Secciones de la flota"
          sx={{ mt: 3, mb: 4, borderBottom: 1, borderColor: 'divider' }}
        >
          {FLEET_SECTIONS.map(item => (
            <Tab key={item.slug} value={item.slug} label={item.label} />
          ))}
        </Tabs>

        <OutlinedInput
          type="search"
          fullWidth
          placeholder="Buscar"
          value={search}
          onChange={event => {
            setSearch(event.target.value)
          }}
          startAdornment={
            <InputAdornment position="start">
              <SearchIcon />
            </InputAdornment>
          }
          slotProps={{
            input: { 'aria-label': `Buscar ${section.label.toLowerCase()}` },
          }}
        />

        {/* One row of chips (specs/0017 RF-9) */}
        <Box sx={{ my: 3 }}>
          <FilterBar>
            {/* A chosen filter stays visible to clear it (audit 0027) */}
            {section.collection === 'trucks' &&
              (brandOptions.length > 1 || brand !== null) && (
                <FilterChip
                  label="Marca"
                  allLabel="Todas"
                  options={brandOptions.map(value => ({ value, label: value }))}
                  value={brand}
                  onChange={next => {
                    setBrand(next)
                    setModel(null)
                  }}
                />
              )}
            {section.collection === 'trucks' &&
              brand !== null &&
              (modelOptions.length > 1 || model !== null) && (
                <FilterChip
                  label="Modelo"
                  allLabel="Todos"
                  options={modelOptions.map(value => ({
                    value,
                    label: value,
                  }))}
                  value={model}
                  onChange={setModel}
                />
              )}
            {section.collection === 'rates' &&
              (rateClientOptions.length > 1 || rateClient !== null) && (
                <FilterChip
                  label="Cliente"
                  allLabel="Todos"
                  options={rateClientOptions}
                  value={rateClient}
                  onChange={setRateClient}
                />
              )}
            <FilterToggle
              label="Archivados"
              on={showArchived}
              onChange={setShowArchived}
            />
          </FilterBar>
        </Box>

        {renderList()}
      </Box>
      <NavBar />
    </Box>
  )
}

// What the search looks in, per section (audit 0027)
const SEARCH_HINTS: Record<FleetSection['collection'], string> = {
  trucks: 'Prueba con otro nombre, placa o medida.',
  trailers: 'Prueba con otro nombre, placa o medida.',
  tanks: 'Prueba con otro nombre o medida.',
  clients: 'Prueba con otro nombre, teléfono, correo o número fiscal.',
  drivers: 'Prueba con otro nombre, teléfono o licencia.',
  rates: 'Prueba con otro origen, destino o cliente.',
}

export default function Fleet() {
  return (
    <SessionGate needs="ready">
      <FleetScreen />
    </SessionGate>
  )
}
