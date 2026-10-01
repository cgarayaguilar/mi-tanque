import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react'
import { sileo } from 'sileo'
import App from '../../App'
import { useFleetStore } from 'store/fleet'
import { useSessionStore } from 'store/session'
import type { Role } from 'utils/roles'
import {
  accountWithRole,
  ORG_ID,
  tank,
  trailer,
  truck,
} from '../../testing/fleetFixtures'

const api = vi.hoisted(() => ({
  readFleet: vi.fn(),
  readMembers: vi.fn(() =>
    Promise.resolve([{ uid: 'luis', displayName: 'Luis', role: 'owner' }])
  ),
  newFleetId: vi.fn(() => 'new-id'),
  createFleetItem: vi.fn(() => Promise.resolve()),
  updateFleetItem: vi.fn(() => Promise.resolve()),
  photoUrl: vi.fn(() => Promise.resolve('blob:new')),
  uploadFleetPhoto: vi.fn(() =>
    Promise.resolve({
      path: 'orgs/org-a/trucks/truck-1/photo.jpg',
      url: 'blob:new',
    })
  ),
}))
vi.mock('services/fleet', () => api)

const signIn = (role: Role = 'owner') => {
  useSessionStore.setState({
    status: 'ready',
    user: { uid: 'luis', displayName: 'Luis', email: null, phoneNumber: null },
    ...accountWithRole(role),
    start: () => Promise.resolve(),
  })
}

const renderAt = (path: string) => {
  window.history.pushState({}, '', path)
  render(<App />)
}

const type = (label: string, value: string) => {
  fireEvent.change(screen.getByLabelText(label), { target: { value } })
}

beforeEach(() => {
  useFleetStore.getState().reset()
  api.readFleet.mockResolvedValue({
    trucks: [truck()],
    trailers: [trailer()],
    tanks: [tank()],
  })
  signIn()
})

afterEach(() => {
  vi.restoreAllMocks()
})

test('a new truck in miles is saved in kilometers and the list opens (CA-2)', async () => {
  renderAt('/flota/camiones/nuevo')

  type(
    await screen
      .findByLabelText('Nombre o número de unidad')
      .then(() => 'Nombre o número de unidad'),
    'Unidad 20'
  )
  type('Unidad de distancia', 'mi')
  type('Rendimiento', '6')
  type('Odómetro', '100000')
  fireEvent.click(screen.getByRole('radio', { name: 'Azul' }))
  fireEvent.click(screen.getByRole('button', { name: 'Guardar camión' }))

  await waitFor(() => {
    expect(api.createFleetItem).toHaveBeenCalledWith(
      'trucks',
      'new-id',
      ORG_ID,
      expect.objectContaining({
        name: 'Unidad 20',
        distanceUnit: 'mi',
        odometerKm: 160934,
        color: { swatch: 'blue', label: 'Azul' },
      })
    )
  })
  expect(sileo.success).toHaveBeenCalledWith({ title: 'Camión guardado' })
  expect(window.location.pathname).toBe('/flota/camiones')
  expect(useFleetStore.getState().trucks.map(t => t.name)).toContain(
    'Unidad 20'
  )
})

test('errors show next to their field and nothing is saved', async () => {
  renderAt('/flota/camiones/nuevo')

  fireEvent.click(await screen.findByRole('button', { name: 'Guardar camión' }))

  expect(
    await screen.findByText('Escribe el nombre o número de unidad')
  ).toBeInTheDocument()
  expect(api.createFleetItem).not.toHaveBeenCalled()
})

test('a rejected save is reported after the fact', async () => {
  vi.spyOn(console, 'error').mockImplementation(() => undefined)
  api.updateFleetItem.mockRejectedValueOnce(new Error('permission-denied'))
  renderAt('/flota/camiones/truck-1')

  fireEvent.click(
    await screen.findByRole('button', { name: 'Guardar cambios' })
  )

  await waitFor(() => {
    expect(sileo.error).toHaveBeenCalledWith({
      title: 'No pudimos guardar el camión Unidad 12',
      description: 'Revisa los datos y vuelve a intentarlo.',
    })
  })
})

test('the trailer hitches to a truck and shows the reefer field only for reefers (CA-3)', async () => {
  renderAt('/flota/remolques/nuevo')

  type(
    await screen
      .findByLabelText('Nombre o número de unidad')
      .then(() => 'Nombre o número de unidad'),
    'Caja 9'
  )
  type('Tipo de remolque', 'dry')
  expect(screen.queryByLabelText('Consumo del equipo de frío')).toBeNull()
  type('Enganchado a', 'truck-1')
  fireEvent.click(screen.getByRole('button', { name: 'Guardar remolque' }))

  await waitFor(() => {
    expect(api.createFleetItem).toHaveBeenCalledWith(
      'trailers',
      'new-id',
      ORG_ID,
      expect.objectContaining({
        trailerType: 'dry',
        hitchedTruckId: 'truck-1',
        reeferConsumptionGalPerHour: null,
      })
    )
  })
})

test('a tank from a template, turned into a D tank, shows the volume and warns about the capacity (CA-4)', async () => {
  renderAt('/flota/tanques/nuevo')

  type(
    await screen
      .findByLabelText('Nombre del tanque')
      .then(() => 'Nombre del tanque'),
    'Tanque derecho'
  )
  type('Partir de un modelo', 'cyl-75-25x39')
  await waitFor(() => {
    expect(screen.getByLabelText('Diámetro')).toHaveValue('25')
  })
  expect(screen.getByLabelText('Capacidad')).toHaveValue('75')

  type('Forma', 'd_flat_side')
  type('Alto', '24')
  type('Ancho', '30')
  type('Largo', '48')

  expect(
    await screen.findByText('Según las medidas caben unos 137 galones.')
  ).toBeInTheDocument()
  expect(
    screen.getByText(
      'Las medidas dan unos 137 galones. Revisa las medidas o la capacidad.'
    )
  ).toBeInTheDocument()

  type('Capacidad', '135')
  type('Pertenece a', 'truck:truck-1')
  fireEvent.click(screen.getByRole('button', { name: 'Guardar tanque' }))

  await waitFor(() => {
    expect(api.createFleetItem).toHaveBeenCalledWith(
      'tanks',
      'new-id',
      ORG_ID,
      expect.objectContaining({
        shape: 'd_flat_side',
        dimensions: { heightIn: 24, widthIn: 30, lengthIn: 48 },
        capacityGal: 135,
        equipment: { kind: 'truck', id: 'truck-1' },
        // No longer the template it started from
        templateId: null,
      })
    )
  })
})

test('archiving asks first, then hides it (CA-6)', async () => {
  renderAt('/flota/camiones/truck-1')

  fireEvent.click(await screen.findByRole('button', { name: 'Archivar' }))
  const dialog = await screen.findByRole('dialog', {
    name: '¿Archivar Unidad 12?',
  })
  fireEvent.click(within(dialog).getByRole('button', { name: 'Archivar' }))

  await waitFor(() => {
    expect(api.updateFleetItem).toHaveBeenCalledWith('trucks', 'truck-1', {
      archived: true,
    })
  })
  expect(sileo.success).toHaveBeenCalledWith({ title: 'Camión archivado' })
  expect(window.location.pathname).toBe('/flota/camiones')
})

test('a photo is uploaded from the item and shown (CA-7)', async () => {
  renderAt('/flota/camiones/truck-1')
  const input = (
    await screen.findByRole('button', { name: 'Agregar foto' })
  ).parentElement?.querySelector('input[type=file]')
  if (!(input instanceof HTMLInputElement)) throw new Error('No file input')

  const file = new File(['x'], 'camion.jpg', { type: 'image/jpeg' })
  fireEvent.change(input, { target: { files: [file] } })

  await waitFor(() => {
    expect(api.uploadFleetPhoto).toHaveBeenCalledWith(
      'trucks',
      ORG_ID,
      'truck-1',
      file
    )
  })
  expect(
    await screen.findByRole('img', { name: 'Foto de Unidad 12' })
  ).toHaveAttribute('src', 'blob:new')
  expect(sileo.success).toHaveBeenCalledWith({ title: 'Foto guardada' })
})

test('a viewer sees the form read-only (CA-9)', async () => {
  signIn('viewer')
  renderAt('/flota/camiones/truck-1')

  expect(
    await screen.findByLabelText('Nombre o número de unidad')
  ).toBeDisabled()
  expect(screen.queryByRole('button', { name: 'Guardar cambios' })).toBeNull()
  expect(screen.queryByRole('button', { name: 'Archivar' })).toBeNull()
  expect(screen.getByRole('button', { name: 'Agregar foto' })).toBeDisabled()
})

test('an unknown item says it was not found', async () => {
  renderAt('/flota/camiones/nope')

  expect(
    await screen.findByRole('heading', { name: 'No encontramos ese camión' })
  ).toBeInTheDocument()
})
