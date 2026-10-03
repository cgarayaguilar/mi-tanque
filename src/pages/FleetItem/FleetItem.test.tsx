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
import { choose, chosen } from '../../testing/choose'

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

// The organization reads miles (backend specs/0010 CA-3)

/** Picks a model in the catalog dialog (backend specs/0014 RF-7, RF-8). */
const pickModel = async (
  capacity: number,
  diameter: number,
  length: number
) => {
  fireEvent.click(
    await screen.findByRole('button', {
      name: /^(Elegir modelo|Cambiar modelo)/,
    })
  )
  const dialog = await screen.findByRole('dialog', { name: 'Elige un modelo' })
  // The 15 tanks of before are the "Genérico" brand (specs/0015 RF-6)
  fireEvent.click(within(dialog).getByRole('button', { name: 'Genérico' }))
  fireEvent.click(
    within(dialog).getByRole('button', {
      name: `Elegir: tanque de ${String(capacity)} galones, ${String(diameter)} pulgadas de diámetro y ${String(length)} de largo`,
    })
  )
  await waitFor(() => {
    expect(screen.queryByRole('dialog')).toBeNull()
  })
}

test('a new truck in miles is saved in kilometers and the list opens (CA-2)', async () => {
  useSessionStore.setState(state => ({
    organization: state.organization && {
      ...state.organization,
      distanceUnit: 'mi',
    },
  }))
  renderAt('/flota/camiones/nuevo')

  type(
    await screen
      .findByLabelText('Nombre o número de unidad')
      .then(() => 'Nombre o número de unidad'),
    'Unidad 20'
  )
  await choose('Color (opcional)', 'Azul')
  fireEvent.click(screen.getByRole('button', { name: 'Ver más detalles' }))
  expect(screen.getByText('mi/gal')).toBeInTheDocument()
  type('Rendimiento (opcional)', '6')
  type('Odómetro (opcional)', '100000')
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
  await choose('Tipo de remolque', 'Seco (caja cerrada)')
  expect(
    screen.queryByLabelText('Consumo del equipo de frío (opcional)')
  ).toBeNull()
  await choose('Enganchado a (opcional)', 'Unidad 12')
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
  // A new tank starts from a model (backend specs/0009 RF-9)
  await pickModel(75, 25, 39)
  // specs/0013 RF-9: the model's tank, drawn to scale
  expect(
    screen.getByRole('img', {
      name: /^Cilindro acostado: 25 pulgadas de diámetro, 39 de largo; caben unos \d+ galones$/,
    })
  ).toBeInTheDocument()
  expect(
    screen.getByText('Coincide con la capacidad: al medir, lleno marca 75 gal.')
  ).toBeInTheDocument()

  await choose('¿Cómo lo describes?', 'Con sus medidas')
  expect(screen.getByLabelText('Diámetro')).toHaveValue('25')
  expect(screen.getByLabelText('Capacidad')).toHaveValue('75')

  await choose('Forma', 'En "D", lado plano contra el chasis')
  type('Alto', '24')
  type('Ancho', '30')
  type('Largo', '48')

  // specs/0013 RF-8: the preview compares the measures with the capacity
  expect(
    await screen.findByText('Caben unos 137 gal según las medidas.')
  ).toBeInTheDocument()
  expect(
    screen.getByText(
      'La capacidad dice 75 gal. Revisa las medidas o la capacidad: mientras no cuadren, al medir se usan las medidas.'
    )
  ).toBeInTheDocument()
  expect(
    screen.getByRole('img', { name: /^Tanque en "D" de lado plano acostado/ })
  ).toBeInTheDocument()

  type('Capacidad', '135')
  expect(
    screen.getByText(
      'Coincide con la capacidad: al medir, lleno marca 135 gal.'
    )
  ).toBeInTheDocument()
  await choose('Pertenece a', 'Camión · Unidad 12')
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

// Regression: a driver who left the organization stayed in the form, and the
// rules refused every edit of the truck that kept them
test('a truck whose driver left is saved unassigned', async () => {
  api.readFleet.mockResolvedValue({
    trucks: [truck({ assignedDriverUid: 'gone' })],
    trailers: [trailer()],
    tanks: [tank()],
  })
  renderAt('/flota/camiones/truck-1')
  await waitFor(() => {
    expect(useFleetStore.getState().members).toHaveLength(1)
  })
  fireEvent.click(
    await screen.findByRole('button', { name: 'Guardar cambios' })
  )
  await waitFor(() => {
    expect(api.updateFleetItem).toHaveBeenCalledWith(
      'trucks',
      'truck-1',
      expect.objectContaining({ assignedDriverUid: null })
    )
  })
})

describe('simpler forms (backend specs/0009)', () => {
  // CA-3
  test('a new truck shows the essentials; saving with only the name works', async () => {
    renderAt('/flota/camiones/nuevo')
    const form = await screen.findByRole('form', { name: 'Datos del camión' })

    for (const label of [
      'Nombre o número de unidad',
      'Placa (opcional)',
      'Marca (opcional)',
      'Modelo (opcional)',
      'Año (opcional)',
      'Color (opcional)',
    ]) {
      expect(within(form).getByLabelText(label)).toBeVisible()
    }
    expect(within(form).getByLabelText('Odómetro (opcional)')).not.toBeVisible()
    const more = within(form).getByRole('button', { name: 'Ver más detalles' })
    expect(more).toHaveAttribute('aria-expanded', 'false')

    type('Nombre o número de unidad', 'Unidad 30')
    fireEvent.click(screen.getByRole('button', { name: 'Guardar camión' }))
    await waitFor(() => {
      expect(api.createFleetItem).toHaveBeenCalled()
    })
  })

  // CA-3: what is kept behind the button is counted
  test('editing says how many details it keeps', async () => {
    renderAt('/flota/camiones/truck-1')
    expect(
      await screen.findByRole('button', { name: 'Ver más detalles · 2 datos' })
    ).toBeInTheDocument()
  })

  // CA-4 (RF-6)
  test('an error behind the button opens it and takes the user there', async () => {
    renderAt('/flota/camiones/truck-1')
    await screen.findByRole('button', { name: 'Ver más detalles · 2 datos' })
    type('Odómetro (opcional)', 'mucho')
    fireEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }))

    await waitFor(() => {
      expect(screen.getByLabelText('Odómetro (opcional)')).toHaveFocus()
    })
    expect(
      screen.getByRole('button', { name: 'Ocultar detalles' })
    ).toHaveAttribute('aria-expanded', 'true')
    expect(api.updateFleetItem).not.toHaveBeenCalled()
  })

  // Audit 2026-10-02: the hidden field took the focus from the visible one
  test('a visible error keeps the focus; the details open anyway', async () => {
    renderAt('/flota/camiones/truck-1')
    await screen.findByRole('button', { name: 'Ver más detalles · 2 datos' })
    type('Nombre o número de unidad', '')
    type('Odómetro (opcional)', 'mucho')
    fireEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }))

    await waitFor(() => {
      expect(screen.getByLabelText('Nombre o número de unidad')).toHaveFocus()
    })
    expect(
      screen.getByRole('button', { name: 'Ocultar detalles' })
    ).toBeInTheDocument()
  })

  // CA-2 (RF-3)
  test('a color is found by typing, with "Otro" to write one in', async () => {
    renderAt('/flota/camiones/nuevo')
    const color = await screen.findByLabelText('Color (opcional)')
    color.focus()
    fireEvent.change(color, { target: { value: 'az' } })
    await waitFor(() => {
      expect(
        screen.getAllByRole('option').map(option => option.textContent)
      ).toEqual(['Azul'])
    })
    fireEvent.click(screen.getByRole('option', { name: 'Azul' }))
    expect(color).toHaveValue('Azul')

    await choose('Color (opcional)', 'Otro')
    expect(screen.getByLabelText('¿Qué color?')).toBeInTheDocument()
  })

  // Audit 2026-10-02: a value left in a field that hides blocked the save
  // with no visible error
  test('a reefer consumption left behind does not block a dry trailer', async () => {
    renderAt('/flota/remolques/trailer-1')
    fireEvent.click(
      await screen.findByRole('button', { name: /^Ver más detalles/ })
    )
    type('Consumo del equipo de frío (opcional)', '9')
    await choose('Tipo de remolque', 'Seco (caja cerrada)')
    fireEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }))

    await waitFor(() => {
      expect(api.updateFleetItem).toHaveBeenCalledWith(
        'trailers',
        'trailer-1',
        expect.objectContaining({
          trailerType: 'dry',
          reeferConsumptionGalPerHour: null,
        })
      )
    })
  })

  // Audit 2026-10-02: in miles, saving without touching the odometer moved it
  test('an untouched odometer keeps its stored kilometers in miles', async () => {
    useSessionStore.setState(state => ({
      organization: state.organization && {
        ...state.organization,
        distanceUnit: 'mi',
      },
    }))
    api.readFleet.mockResolvedValue({
      trucks: [truck({ odometerKm: 102, fuelEfficiencyKmPerGal: 9.5 })],
      trailers: [trailer()],
      tanks: [tank()],
    })
    renderAt('/flota/camiones/truck-1')
    type(
      await screen
        .findByLabelText('Placa (opcional)')
        .then(() => 'Placa (opcional)'),
      'M 1'
    )
    fireEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }))

    await waitFor(() => {
      expect(api.updateFleetItem).toHaveBeenCalledWith(
        'trucks',
        'truck-1',
        expect.objectContaining({
          odometerKm: 102,
          fuelEfficiencyKmPerGal: 9.5,
        })
      )
    })
  })

  // CA-5
  test('the reefer consumption is a detail, only for reefers', async () => {
    renderAt('/flota/remolques/trailer-1')
    expect(
      await screen.findByLabelText('Consumo del equipo de frío (opcional)')
    ).not.toBeVisible()
    await choose('Tipo de remolque', 'Seco (caja cerrada)')
    expect(
      screen.queryByLabelText('Consumo del equipo de frío (opcional)')
    ).toBeNull()
    expect(screen.getByLabelText('Largo (opcional)')).toBeVisible()
  })

  // CA-6
  test('a tank opens the way it is described, and a model needs choosing', async () => {
    renderAt('/flota/tanques/nuevo')
    type(
      await screen
        .findByLabelText('Nombre del tanque')
        .then(() => 'Nombre del tanque'),
      'Tanque 3'
    )
    fireEvent.click(screen.getByRole('button', { name: 'Guardar tanque' }))
    expect(await screen.findByText('Elige un modelo')).toBeInTheDocument()
    expect(api.createFleetItem).not.toHaveBeenCalled()
    // specs/0014 CA-6: the focus goes to the button
    await waitFor(() => {
      expect(
        screen.getByRole('button', { name: 'Elegir modelo' })
      ).toHaveFocus()
    })

    await pickModel(75, 25, 39)
    // specs/0014 CA-5: the chosen model, with "Cambiar"
    expect(
      screen.getByRole('button', { name: 'Cambiar modelo: 75 galones' })
    ).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Guardar tanque' }))
    await waitFor(() => {
      expect(api.createFleetItem).toHaveBeenCalledWith(
        'tanks',
        'new-id',
        ORG_ID,
        expect.objectContaining({
          templateId: 'cyl-75-25x39',
          capacityGal: 75,
          dimensions: { diameterIn: 25, lengthIn: 39 },
        })
      )
    })
  })

  // Audit 2026-10-02: a model with a capacity edited by hand opened as the
  // model, and going back to it reset the capacity without a word
  test('a tank whose capacity was edited is no longer its model', async () => {
    api.readFleet.mockResolvedValue({
      trucks: [truck()],
      trailers: [trailer()],
      tanks: [
        tank({
          shape: 'cylinder',
          dimensions: { diameterIn: 25, lengthIn: 39 },
          capacityGal: 70,
          templateId: 'cyl-75-25x39',
        }),
      ],
    })
    renderAt('/flota/tanques/tank-1')
    expect(
      within(
        await screen.findByRole('group', { name: '¿Cómo lo describes?' })
      ).getByRole('button', { name: 'Con sus medidas' })
    ).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByLabelText('Capacidad')).toHaveValue('70')
  })

  // Audit 2026-10-02: the message stayed after choosing a model
  test('"Elige un modelo" goes away once one is chosen', async () => {
    renderAt('/flota/tanques/nuevo')
    type(
      await screen
        .findByLabelText('Nombre del tanque')
        .then(() => 'Nombre del tanque'),
      'Tanque 4'
    )
    fireEvent.click(screen.getByRole('button', { name: 'Guardar tanque' }))
    expect(await screen.findByText('Elige un modelo')).toBeInTheDocument()

    await pickModel(75, 25, 39)
    await waitFor(() => {
      expect(screen.queryByText('Elige un modelo')).toBeNull()
    })
  })

  test('a tank measured by hand opens with its measures', async () => {
    renderAt('/flota/tanques/tank-1')
    expect(
      within(
        await screen.findByRole('group', { name: '¿Cómo lo describes?' })
      ).getByRole('button', { name: 'Con sus medidas' })
    ).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByLabelText('Capacidad')).toBeVisible()
  })
})

// CA-1 (RF-1): no screen opens the system picker
test('no native select is left in the app', () => {
  const sources = import.meta.glob<string>('/src/**/*.tsx', {
    query: '?raw',
    import: 'default',
    eager: true,
  })
  const native = Object.entries(sources)
    .filter(([path]) => !path.includes('.test.'))
    .filter(([, source]) => /NativeSelect|<select[\s>]/.test(source))
    .map(([path]) => path)
  expect(native).toEqual([])
})

// specs/0013 CA-1, CA-2, CA-3: the measures share a row, each one explained
test('each measure has its ⓘ and the guide shows how to measure', async () => {
  renderAt('/flota/tanques/nuevo')
  await choose('¿Cómo lo describes?', 'Con sus medidas')
  await choose('Forma', 'En "D", lado plano contra el chasis')

  // Alto, ancho y largo in one row
  const row = screen.getByLabelText('Alto').closest('.MuiFormControl-root')
    ?.parentElement as HTMLElement
  expect(within(row).getByLabelText('Ancho')).toBeInTheDocument()
  expect(within(row).getByLabelText('Largo')).toBeInTheDocument()

  fireEvent.mouseOver(screen.getByRole('button', { name: '¿Qué es el ancho?' }))
  expect(
    await screen.findByRole('tooltip', {
      name: /Del lado plano al punto más saliente de la curva/,
    })
  ).toBeInTheDocument()

  fireEvent.click(
    screen.getByRole('button', { name: '¿Cómo medir mi tanque?' })
  )
  const guide = await screen.findByRole('dialog', {
    name: 'Cómo medir tu tanque',
  })
  expect(within(guide).getByText(/Usa una cinta métrica/)).toBeInTheDocument()
  fireEvent.click(within(guide).getByRole('button', { name: 'Entendido' }))
  await waitFor(() => {
    expect(screen.queryByRole('dialog')).toBeNull()
  })
})

// specs/0014 CA-1, CA-2: the catalog dialog, grouped and filtered
test('the model catalog is grouped by capacity and filters combine', async () => {
  renderAt('/flota/tanques/nuevo')
  fireEvent.click(await screen.findByRole('button', { name: 'Elegir modelo' }))
  const dialog = await screen.findByRole('dialog', { name: 'Elige un modelo' })

  // The 15 "Genérico" and the 194 factory tanks (specs/0015)
  expect(within(dialog).getByText('209 modelos')).toBeInTheDocument()

  fireEvent.click(
    within(within(dialog).getByRole('group', { name: 'Capacidad' })).getByRole(
      'button',
      { name: '100 gal' }
    )
  )
  expect(
    await within(dialog).findByRole('region', { name: '100 galones' })
  ).toHaveTextContent('100 gal · 21 modelos')
  fireEvent.click(
    within(within(dialog).getByRole('group', { name: 'Diámetro' })).getByRole(
      'button',
      { name: '24 pulg.' }
    )
  )
  expect(await within(dialog).findByText('3 modelos')).toBeInTheDocument()

  fireEvent.click(within(dialog).getByRole('button', { name: 'Limpiar' }))
  expect(await within(dialog).findByText('209 modelos')).toBeInTheDocument()
})

// specs/0015 CA-2, CA-3, CA-5: a factory "D" tank of a Volvo, by brand and model
test('a Volvo VNL (2024+) "D" tank is chosen by brand and model and saved as the model', async () => {
  renderAt('/flota/tanques/nuevo')
  type(
    await screen
      .findByLabelText('Nombre del tanque')
      .then(() => 'Nombre del tanque'),
    'Tanque Volvo'
  )
  fireEvent.click(screen.getByRole('button', { name: 'Elegir modelo' }))
  const dialog = await screen.findByRole('dialog', { name: 'Elige un modelo' })
  fireEvent.click(within(dialog).getByRole('button', { name: 'Volvo' }))
  fireEvent.click(
    within(within(dialog).getByRole('group', { name: 'Modelo' })).getByRole(
      'button',
      { name: 'VNL (2024+)' }
    )
  )
  expect(
    within(dialog).getByText(/^Volvo VNL \(2024\+\) · \d+ tanques$/)
  ).toBeInTheDocument()
  // Its width was computed: the card says so
  expect(
    within(dialog).getAllByText('Medidas calculadas: confírmalas con una cinta')
      .length
  ).toBeGreaterThan(0)
  fireEvent.click(
    within(dialog).getByRole('button', {
      name: /tanque de 100 galones, en D, 26 de alto/,
    })
  )
  await waitFor(() => {
    expect(screen.queryByRole('dialog')).toBeNull()
  })
  expect(
    screen.getByRole('img', { name: /^Tanque en "D" de lado plano acostado/ })
  ).toBeInTheDocument()
  // specs/0015 RF-9: measured adjusted to its factory capacity
  expect(
    screen.getByText(
      'Tanque de fábrica: al medir, lleno marca 100 gal, su capacidad.'
    )
  ).toBeInTheDocument()

  fireEvent.click(screen.getByRole('button', { name: 'Guardar tanque' }))
  await waitFor(() => {
    expect(api.createFleetItem).toHaveBeenCalledWith(
      'tanks',
      'new-id',
      ORG_ID,
      expect.objectContaining({
        shape: 'd_flat_side',
        orientation: 'horizontal',
        capacityGal: 100,
        templateId: expect.stringMatching(/^vo-d26x/) as unknown,
      })
    )
  })
})

describe('truck brand and model from the list (backend specs/0016)', () => {
  const newTruck = async () => {
    renderAt('/flota/camiones/nuevo')
    type(
      await screen
        .findByLabelText('Nombre o número de unidad')
        .then(() => 'Nombre o número de unidad'),
      'Unidad 30'
    )
  }
  const save = () => {
    fireEvent.click(screen.getByRole('button', { name: 'Guardar camión' }))
  }

  // CA-1
  test('a brand and a model of the list are saved by their names', async () => {
    await newTruck()
    await choose('Marca (opcional)', 'Freightliner')
    await choose('Modelo (opcional)', 'Cascadia')
    save()
    await waitFor(() => {
      expect(api.createFleetItem).toHaveBeenCalledWith(
        'trucks',
        'new-id',
        ORG_ID,
        expect.objectContaining({ brand: 'Freightliner', model: 'Cascadia' })
      )
    })
  })

  test('"Otra marca…" asks for it, and the model is typed', async () => {
    await newTruck()
    await choose('Marca (opcional)', 'Otra marca…')
    save()
    expect(await screen.findByText('Escribe la marca')).toBeInTheDocument()
    expect(api.createFleetItem).not.toHaveBeenCalled()

    type('¿Qué marca?', 'Hino')
    type('Modelo (opcional)', '500')
    save()
    await waitFor(() => {
      expect(api.createFleetItem).toHaveBeenCalledWith(
        'trucks',
        'new-id',
        ORG_ID,
        expect.objectContaining({ brand: 'Hino', model: '500' })
      )
    })
  })

  // CA-2
  test('another brand clears a model that is not its own', async () => {
    await newTruck()
    await choose('Marca (opcional)', 'Freightliner')
    await choose('Modelo (opcional)', 'Cascadia')
    await choose('Marca (opcional)', 'Volvo')
    expect(chosen('Modelo (opcional)')).toBe('Sin modelo')
    await choose('Modelo (opcional)', 'VNL')
    expect(chosen('Modelo (opcional)')).toBe('VNL')
  })

  // CA-3
  test('typed names are recognized; others open as "Otra"', async () => {
    api.readFleet.mockResolvedValue({
      trucks: [
        truck({ brand: 'freightliner', model: 'CASCADIA' }),
        truck({
          id: 'truck-2',
          name: 'Unidad 40',
          brand: 'Hino',
          model: '500',
        }),
      ],
      trailers: [],
      tanks: [],
    })
    renderAt('/flota/camiones/truck-1')
    await screen.findByLabelText('Nombre o número de unidad')
    expect(chosen('Marca (opcional)')).toBe('Freightliner')
    expect(chosen('Modelo (opcional)')).toBe('Cascadia')
  })

  test('a brand that is not in the list opens as "Otra marca…"', async () => {
    api.readFleet.mockResolvedValue({
      trucks: [truck({ brand: 'Hino', model: '500' })],
      trailers: [],
      tanks: [],
    })
    renderAt('/flota/camiones/truck-1')
    await screen.findByLabelText('Nombre o número de unidad')
    expect(chosen('Marca (opcional)')).toBe('Otra marca…')
    expect(screen.getByLabelText('¿Qué marca?')).toHaveValue('Hino')
    expect(screen.getByLabelText('Modelo (opcional)')).toHaveValue('500')
  })

  // CA-4: the fixture truck is a Freightliner Cascadia 2019
  test("a truck's tank opens the catalog on that truck", async () => {
    renderAt('/flota/tanques/nuevo')
    await choose('Pertenece a', 'Camión · Unidad 12')
    fireEvent.click(screen.getByRole('button', { name: 'Elegir modelo' }))
    const dialog = await screen.findByRole('dialog', {
      name: 'Elige un modelo',
    })
    expect(
      within(dialog).getByText(
        /Filtrado por tu camión: Freightliner Cascadia \(2018\+\)/
      )
    ).toBeInTheDocument()
    expect(chosen('Modelo', dialog)).toBe('Cascadia (2018+)')
    expect(
      within(dialog).getByText(
        /^Freightliner Cascadia \(2018\+\) · \d+ tanques$/
      )
    ).toBeInTheDocument()
  })
})
