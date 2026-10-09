import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react'
import { addDays } from 'date-fns'
import App from '../../App'
import { filterBy } from '../../testing/filterBy'
import { useFleetStore } from 'store/fleet'
import { useSessionStore } from 'store/session'
import { toPlainDate } from 'utils/plainDate'
import type { Role } from 'utils/roles'
import {
  accountWithRole,
  client,
  driver,
  rate,
  tank,
  trailer,
  truck,
} from '../../testing/fleetFixtures'

const api = vi.hoisted(() => ({
  readFleet: vi.fn(),
  readMembers: vi.fn(
    (): Promise<{ uid: string; displayName: string; role: string }[]> =>
      Promise.resolve([])
  ),
  updateFleetItem: vi.fn(() => Promise.resolve()),
  newFleetId: vi.fn(() => 'new-id'),
}))
vi.mock('services/fleet', () => api)
// "Más" counts the expense categories (specs/0034 RF-4)
const expensesApi = vi.hoisted(() => ({
  readCategories: vi.fn(() => Promise.resolve([])),
  seedCategories: vi.fn(() => Promise.resolve([])),
}))
vi.mock('services/expenses', () => expensesApi)

const signIn = (role: Role = 'owner') => {
  useSessionStore.setState({
    status: 'ready',
    user: {
      uid: 'luis',
      displayName: 'Luis',
      email: null,
      phoneNumber: '+50588112233',
    },
    ...accountWithRole(role),
    start: () => Promise.resolve(),
  })
}

const renderAt = (path: string) => {
  window.history.pushState({}, '', path)
  render(<App />)
}

beforeEach(() => {
  useFleetStore.getState().reset()
  api.readFleet.mockResolvedValue({
    rates: [],
    drivers: [],
    clients: [],
    trucks: [
      truck(),
      truck({ id: 'truck-2', name: 'Unidad 15', plate: 'X 999', color: null }),
    ],
    trailers: [trailer()],
    tanks: [tank()],
  })
  signIn()
})

afterEach(() => {
  vi.restoreAllMocks()
})

/** Back to "Más" and into another module (specs/0034 RF-6). */
const openModule = async (label: string) => {
  fireEvent.click(screen.getByRole('button', { name: 'Más' }))
  fireEvent.click(
    await screen.findByRole('link', { name: new RegExp(`^${label},`) })
  )
  expect(
    await screen.findByRole('heading', { level: 1, name: label })
  ).toBeInTheDocument()
}

// backend specs/0034 CA-1: "Más" holds the fleet, active in its modules
test('the bottom navigation has Más, active in the modules', async () => {
  renderAt('/flota/tarifas')
  const nav = await screen.findByRole('navigation', { name: 'Secciones' })
  expect(
    within(nav)
      .getAllByRole('link')
      .map(link => link.textContent)
  ).toEqual(['Historial', 'Medición', 'Viajes', 'Gastos', 'Más'])
  expect(within(nav).getByRole('link', { name: 'Más' })).toHaveAttribute(
    'aria-current',
    'page'
  )
  // No tabs: the module's own title (RF-6)
  expect(
    screen.getByRole('heading', { level: 1, name: 'Tarifas' })
  ).toBeInTheDocument()
  expect(screen.queryByRole('tab')).toBeNull()
})

// RF-7
test('/flota goes to Más', async () => {
  renderAt('/flota')
  expect(
    await screen.findByRole('heading', { level: 1, name: 'Más' })
  ).toBeInTheDocument()
  expect(window.location.pathname).toBe('/mas')
})

test('trucks show their plate, figures and tanks', async () => {
  renderAt('/flota/camiones')

  const card = await screen.findByRole('button', { name: 'Camión Unidad 12' })
  expect(card).toHaveTextContent('Freightliner Cascadia 2019 · M 123-456')
  expect(card).toHaveTextContent('1 tanque · 120,000 km')
  // Saved before specs/0021: its efficiency is the loaded one
  expect(card).toHaveTextContent('Rinde 9.5 km/gal cargado')
})

test('trailers show the truck they are hitched to; tanks their shape and equipment', async () => {
  renderAt('/flota/remolques')
  expect(
    await screen.findByRole('button', { name: 'Remolque Caja 7' })
  ).toHaveTextContent('Enganchado a Unidad 12')

  await openModule('Tanques')
  expect(
    await screen.findByRole('button', { name: 'Tanque Tanque izquierdo' })
  ).toHaveTextContent(
    'En "D" lado plano · 24 × 30 × 48 pulg.135 gal · Unidad 12'
  )
})

test('search filters by name or plate and offers to clear', async () => {
  renderAt('/flota/camiones')
  await screen.findByRole('button', { name: 'Camión Unidad 12' })

  fireEvent.change(screen.getByRole('searchbox', { name: 'Buscar camiones' }), {
    target: { value: 'x 99' },
  })

  await waitFor(() => {
    expect(
      screen.queryByRole('button', { name: 'Camión Unidad 12' })
    ).toBeNull()
  })
  expect(
    screen.getByRole('button', { name: 'Camión Unidad 15' })
  ).toBeInTheDocument()

  fireEvent.change(screen.getByRole('searchbox', { name: 'Buscar camiones' }), {
    target: { value: 'nada' },
  })
  fireEvent.click(
    await screen.findByRole('button', { name: 'Limpiar búsqueda' })
  )
  expect(
    await screen.findByRole('button', { name: 'Camión Unidad 12' })
  ).toBeInTheDocument()
})

test('an empty section invites to add the first one', async () => {
  api.readFleet.mockResolvedValue({
    rates: [],
    drivers: [],
    clients: [],
    trucks: [],
    trailers: [],
    tanks: [],
  })
  renderAt('/flota/camiones')

  fireEvent.click(await screen.findByRole('button', { name: 'Agregar camión' }))

  expect(window.location.pathname).toBe('/flota/camiones/nuevo')
})

test('when everything is archived it says so and shows them (CA-6)', async () => {
  api.readFleet.mockResolvedValue({
    rates: [],
    drivers: [],
    clients: [],
    trucks: [truck({ archived: true })],
    trailers: [],
    tanks: [],
  })
  renderAt('/flota/camiones')

  fireEvent.click(await screen.findByRole('button', { name: 'Ver archivados' }))

  const card = await screen.findByRole('button', { name: 'Camión Unidad 12' })
  expect(within(card).getByText('Archivado')).toBeInTheDocument()
})

test('a failed load can be retried', async () => {
  vi.spyOn(console, 'error').mockImplementation(() => undefined)
  api.readFleet.mockRejectedValueOnce(new Error('unavailable'))
  renderAt('/flota/camiones')

  fireEvent.click(await screen.findByRole('button', { name: 'Reintentar' }))

  expect(
    await screen.findByRole('button', { name: 'Camión Unidad 12' })
  ).toBeInTheDocument()
})

test('a viewer sees the fleet without "Agregar" (CA-9)', async () => {
  signIn('viewer')
  renderAt('/flota/camiones')

  await screen.findByRole('button', { name: 'Camión Unidad 12' })
  expect(screen.queryByRole('button', { name: 'Agregar' })).toBeNull()
})

test('a tank card shows its last measurement (specs/0004 RF-18)', async () => {
  api.readFleet.mockResolvedValue({
    rates: [],
    drivers: [],
    clients: [],
    trucks: [truck()],
    trailers: [],
    tanks: [
      tank({
        lastMeasurement: {
          id: 'm-1',
          takenAt: new Date(Date.now() - 2 * 3_600_000 - 60_000),
          gallons: 84.4,
          fillPercent: 69.6,
        },
      }),
    ],
  })
  renderAt('/flota/tanques')
  expect(
    await screen.findByRole('button', { name: 'Tanque Tanque izquierdo' })
  ).toHaveTextContent('70 % · 84 gal · hace 2 h')
})

// specs/0011 CA-4: the insurance notice on the cards
test('trucks and trailers say when their insurance is due, not when archived', async () => {
  const inFiveDays = toPlainDate(addDays(new Date(), 5))
  api.readFleet.mockResolvedValue({
    rates: [],
    drivers: [],
    clients: [],
    trucks: [
      truck({ id: 't1', name: 'Unidad 1', insuranceExpiresOn: inFiveDays }),
      truck({
        id: 't2',
        name: 'Unidad 2',
        insuranceExpiresOn: '2020-01-01',
        archived: true,
      }),
    ],
    trailers: [trailer({ insuranceExpiresOn: '2020-01-01' })],
    tanks: [],
  })
  renderAt('/flota/camiones')

  expect(
    await screen.findByRole('button', {
      name: 'Camión Unidad 1, Seguro vence en 5 días',
    })
  ).toBeInTheDocument()
  expect(screen.queryByText('Seguro vencido')).toBeNull()

  await openModule('Remolques')
  expect(await screen.findByText('Seguro vencido')).toBeInTheDocument()
})

// backend specs/0016 CA-5: trucks by brand and model, typed names recognized
test('trucks filter by brand, then model', async () => {
  api.readFleet.mockResolvedValue({
    rates: [],
    drivers: [],
    clients: [],
    trucks: [
      truck(),
      truck({
        id: 'truck-2',
        name: 'Unidad 15',
        brand: 'freightliner',
        model: 'Columbia',
      }),
      truck({ id: 'truck-3', name: 'Unidad 16', brand: 'Volvo', model: 'VNL' }),
    ],
    trailers: [],
    tanks: [],
  })
  renderAt('/flota/camiones')
  await screen.findByText('Unidad 16')

  // One row of chips: no model until a brand is chosen (specs/0017 CA-4)
  expect(screen.queryByRole('button', { name: /^Modelo/ })).toBeNull()
  await filterBy('Marca', 'Freightliner')
  await waitFor(() => {
    expect(screen.queryByText('Unidad 16')).toBeNull()
  })
  expect(screen.getByText('Unidad 12')).toBeInTheDocument()
  expect(screen.getByText('Unidad 15')).toBeInTheDocument()

  await filterBy('Modelo', 'Cascadia')
  await waitFor(() => {
    expect(screen.queryByText('Unidad 15')).toBeNull()
  })
  expect(screen.getByText('Unidad 12')).toBeInTheDocument()
})

// specs/0017 RF-9, RF-10, CA-4: archived ones are a chip of the same row
test('the archived chip shows the archived ones, in every tab', async () => {
  api.readFleet.mockResolvedValue({
    rates: [],
    drivers: [],
    clients: [],
    trucks: [
      truck(),
      truck({ id: 'truck-2', name: 'Unidad 15', archived: true }),
    ],
    trailers: [],
    tanks: [],
  })
  renderAt('/flota/camiones')
  await screen.findByText('Unidad 12')
  expect(screen.queryByRole('checkbox', { name: 'Ver archivados' })).toBeNull()

  const archived = screen.getByRole('button', { name: 'Archivados' })
  expect(archived).toHaveAttribute('aria-pressed', 'false')
  fireEvent.click(archived)
  expect(archived).toHaveAttribute('aria-pressed', 'true')
  expect(await screen.findByText('Unidad 15')).toBeInTheDocument()
  expect(screen.queryByText('Unidad 12')).toBeNull()

  await openModule('Remolques')
  const filters = await screen.findByRole('group', { name: 'Filtros' })
  expect(
    within(filters)
      .getAllByRole('button')
      .map(button => button.textContent)
  ).toEqual(['Archivados'])
})

// backend specs/0022 CA-3, CA-4
describe('clients', () => {
  beforeEach(() => {
    api.readFleet.mockResolvedValue({
      rates: [],
      drivers: [],
      clients: [
        client(),
        client({
          id: 'client-2',
          name: 'Acarreos del Norte',
          phone: null,
          email: 'pagos@norte.com',
          taxId: null,
        }),
        client({ id: 'client-3', name: 'Fletes Ríos', archived: true }),
      ],
      trucks: [truck()],
      trailers: [],
      tanks: [],
    })
  })

  test('the tab lists them by name with their contact', async () => {
    renderAt('/flota/clientes')

    const list = await screen.findByRole('list', { name: 'Clientes' })
    const cards = within(list).getAllByRole('button')
    expect(cards.map(card => card.getAttribute('aria-label'))).toEqual([
      'Cliente Acarreos del Norte',
      'Cliente Transportes Pérez',
    ])
    expect(cards[1]).toHaveTextContent('8888 7777 · J0310000012345')
  })

  test('search finds by phone, email or a name without accents', async () => {
    renderAt('/flota/clientes')
    const search = await screen.findByRole('searchbox', {
      name: 'Buscar clientes',
    })

    fireEvent.change(search, { target: { value: '8888' } })
    expect(
      await screen.findByRole('button', { name: 'Cliente Transportes Pérez' })
    ).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'Cliente Acarreos del Norte' })
    ).toBeNull()

    fireEvent.change(search, { target: { value: 'PEREZ' } })
    expect(
      await screen.findByRole('button', { name: 'Cliente Transportes Pérez' })
    ).toBeInTheDocument()

    fireEvent.change(search, { target: { value: 'norte.com' } })
    expect(
      await screen.findByRole('button', { name: 'Cliente Acarreos del Norte' })
    ).toBeInTheDocument()
  })

  test('an archived one shows only with the chip', async () => {
    renderAt('/flota/clientes')
    await screen.findByRole('list', { name: 'Clientes' })
    expect(
      screen.queryByRole('button', { name: 'Cliente Fletes Ríos' })
    ).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: 'Archivados' }))
    expect(
      await screen.findByRole('button', { name: 'Cliente Fletes Ríos' })
    ).toBeInTheDocument()
  })

  test('without clients it invites to add one, only to who can write', async () => {
    api.readFleet.mockResolvedValue({
      rates: [],
      drivers: [],
      clients: [],
      trucks: [],
      trailers: [],
      tanks: [],
    })
    renderAt('/flota/clientes')
    fireEvent.click(
      await screen.findByRole('button', { name: 'Agregar cliente' })
    )
    expect(window.location.pathname).toBe('/flota/clientes/nuevo')
  })

  test('a viewer sees them without "Agregar"', async () => {
    signIn('viewer')
    renderAt('/flota/clientes')
    expect(
      await screen.findByRole('button', { name: 'Cliente Transportes Pérez' })
    ).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Agregar' })).toBeNull()
  })
})

// backend specs/0023 RF-6
describe('drivers', () => {
  beforeEach(() => {
    api.readMembers.mockResolvedValue([
      { uid: 'ana', displayName: 'Ana López', role: 'driver' },
    ])
    api.readFleet.mockResolvedValue({
      rates: [],
      clients: [],
      drivers: [
        driver({
          memberUid: 'ana',
          licenseExpiresOn: toPlainDate(addDays(new Date(), 5)),
        }),
        driver({
          id: 'driver-2',
          name: 'Marta Gómez',
          phone: null,
          licenseNumber: 'B-998877',
          licenseExpiresOn: '2020-01-01',
          archived: true,
        }),
      ],
      trucks: [],
      trailers: [],
      tanks: [],
    })
  })

  test('a card has the contact, the account and the license notice', async () => {
    renderAt('/flota/conductores')

    const card = await screen.findByRole('button', {
      name: 'Conductor Pedro Ruiz, Licencia vence en 5 días',
    })
    expect(card).toHaveTextContent('8888 7777 · Licencia A-123456')
    expect(card).toHaveTextContent('Cuenta: Ana López')
  })

  test('search finds by license number; an archived one gives no notice', async () => {
    renderAt('/flota/conductores')
    await screen.findByRole('list', { name: 'Conductores' })

    fireEvent.click(screen.getByRole('button', { name: 'Archivados' }))
    fireEvent.change(
      screen.getByRole('searchbox', { name: 'Buscar conductores' }),
      {
        target: { value: 'b-998' },
      }
    )
    expect(
      await screen.findByRole('button', { name: 'Conductor Marta Gómez' })
    ).toBeInTheDocument()
  })
})

// backend specs/0024 RF-5, CA-4
describe('rates', () => {
  beforeEach(() => {
    api.readFleet.mockResolvedValue({
      rates: [
        rate(),
        rate({
          id: 'rate-2',
          name: 'León → Managua',
          origin: 'León',
          destination: 'Managua',
          clientId: null,
          clientName: null,
          price: 1250000,
          description: 'Contenedor de 40 pies',
        }),
      ],
      drivers: [],
      // Renamed since the rate was saved: the current name shows
      clients: [client({ name: 'Transportes Pérez S.A.' })],
      trucks: [],
      trailers: [],
      tanks: [],
    })
  })

  // specs/0033 RF-4, CA-4: under "General" first, then each client
  test('the cards go under their client, "General" first', async () => {
    renderAt('/flota/tarifas')

    await screen.findByRole('list', { name: 'Tarifas de General' })
    expect(
      screen
        .getAllByRole('heading', { level: 2 })
        .map(heading => heading.textContent)
    ).toEqual(['General', 'Transportes Pérez S.A.'])
    const [general] = within(
      screen.getByRole('list', { name: 'Tarifas de General' })
    ).getAllByRole('button')
    expect(general).toHaveAccessibleName('Tarifa León → Managua')
    expect(general).toHaveTextContent('C$1,250,000.00 NIO')
    expect(general).toHaveTextContent('Contenedor de 40 pies')
    expect(
      within(
        screen.getByRole('list', { name: 'Tarifas de Transportes Pérez S.A.' })
      ).getByRole('button')
    ).toHaveAccessibleName('Tarifa Managua → San José')
  })

  test('the client filter and the search narrow them', async () => {
    renderAt('/flota/tarifas')
    await screen.findByRole('list', { name: 'Tarifas de General' })

    await filterBy('Cliente', 'General')
    expect(
      screen.queryByRole('button', { name: 'Tarifa Managua → San José' })
    ).toBeNull()
    expect(
      screen.getByRole('button', { name: 'Tarifa León → Managua' })
    ).toBeInTheDocument()

    await filterBy('Cliente', 'Todos')
    fireEvent.change(
      screen.getByRole('searchbox', { name: 'Buscar tarifas' }),
      {
        target: { value: 'jose' },
      }
    )
    expect(
      await screen.findByRole('button', { name: 'Tarifa Managua → San José' })
    ).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'Tarifa León → Managua' })
    ).toBeNull()
  })

  test('without rates it invites to add the first one, in feminine', async () => {
    api.readFleet.mockResolvedValue({
      rates: [],
      drivers: [],
      clients: [],
      trucks: [],
      trailers: [],
      tanks: [],
    })
    renderAt('/flota/tarifas')
    expect(
      await screen.findByText(
        'Agrega tu primera tarifa para tener su información a mano.'
      )
    ).toBeInTheDocument()
  })
})

// backend specs/0034: "Más", every module as a settings list
describe('Más', () => {
  // CA-2, CA-3
  test('its rows say what each module has, and open it', async () => {
    renderAt('/mas')
    const fleetGroup = await screen.findByRole('list', { name: 'Flota' })
    expect(
      await within(fleetGroup).findByRole('link', {
        name: /^Camiones, \d+ camion/,
      })
    ).toHaveAttribute('href', '/flota/camiones')
    expect(
      within(screen.getByRole('list', { name: 'Comercial' }))
        .getAllByRole('link')
        .map(link => link.getAttribute('href'))
    ).toEqual(['/flota/clientes', '/flota/tarifas'])
    expect(
      within(screen.getByRole('list', { name: 'Cuenta' })).getByRole('link')
    ).toHaveAttribute('href', '/cuenta')

    fireEvent.click(screen.getByRole('link', { name: /^Tarifas,/ }))
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Tarifas' })
    ).toBeInTheDocument()
    expect(window.location.pathname).toBe('/flota/tarifas')
  })

  // Regression: a phone sign-in has no name; the profile has it
  test("the account's row says who and which organization", async () => {
    useSessionStore.setState(state => ({
      user: state.user && { ...state.user, displayName: null },
    }))
    renderAt('/mas')
    expect(
      await screen.findByRole('link', {
        name: 'Mi cuenta y equipo, Luis · Flota de Luis',
      })
    ).toBeInTheDocument()
  })

  // CA-5
  test('a viewer goes into the modules without "Agregar"', async () => {
    signIn('viewer')
    renderAt('/mas')
    fireEvent.click(await screen.findByRole('link', { name: /^Camiones,/ }))
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Camiones' })
    ).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Agregar' })).toBeNull()
  })
})

// backend specs/0035 CA-3: the "Dueño" filter, the card and the search
test("a third party's truck is found by owner, filter and search", async () => {
  api.readFleet.mockResolvedValue({
    rates: [],
    drivers: [],
    clients: [],
    trucks: [
      truck(),
      truck({
        id: 'truck-50',
        name: 'Unidad 50',
        ownership: 'third_party',
        ownerName: 'Transportes López',
      }),
    ],
    trailers: [],
    tanks: [],
  })
  renderAt('/flota/camiones')
  expect(
    await screen.findByRole('button', { name: 'Camión Unidad 50' })
  ).toHaveTextContent('De un tercero · Transportes López')

  await filterBy('Dueño', 'De un tercero')
  expect(screen.queryByRole('button', { name: 'Camión Unidad 12' })).toBeNull()
  await filterBy('Dueño', 'Todos')

  fireEvent.change(screen.getByRole('searchbox', { name: 'Buscar camiones' }), {
    target: { value: 'lopez' },
  })
  expect(
    await screen.findByRole('button', { name: 'Camión Unidad 50' })
  ).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Camión Unidad 12' })).toBeNull()
})
