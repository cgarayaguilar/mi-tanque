import {
  equipmentFromValue,
  equipmentToValue,
  tankFormSchema,
  tankFromForm,
  tankToForm,
  trailerFormSchema,
  trailerFromForm,
  truckFormSchema,
  truckFromForm,
  truckToForm,
  type FleetTank,
  type TankFormValues,
  type Truck,
} from 'schemas/fleet'

const truckForm = truckToForm(null)

describe('trucks (backend specs/0003 RF-4, RF-5)', () => {
  test('miles are stored as kilometers and shown again in miles (CA-2)', () => {
    const fields = truckFromForm({
      ...truckForm,
      name: 'Unidad 12',
      distanceUnit: 'mi',
      efficiency: '6',
      odometer: '100000',
    })

    expect(fields.fuelEfficiencyKmPerGal).toBeCloseTo(9.656, 3)
    expect(fields.odometerKm).toBe(160934)

    const truck: Truck = {
      id: 't1',
      orgId: 'org',
      archived: false,
      photoPath: null,
      ...fields,
    }
    expect(truckToForm(truck)).toMatchObject({
      distanceUnit: 'mi',
      efficiency: '6',
      odometer: '100,000',
    })
  })

  test('empty optional fields are stored as null', () => {
    expect(truckFromForm({ ...truckForm, name: '  Unidad 3 ' })).toMatchObject({
      name: 'Unidad 3',
      plate: null,
      year: null,
      color: null,
      fuelEfficiencyKmPerGal: null,
      odometerKm: null,
      assignedDriverUid: null,
    })
  })

  test('a palette color keeps its name; "other" keeps what was written', () => {
    expect(
      truckFromForm({ ...truckForm, name: 'U', colorSwatch: 'red' }).color
    ).toEqual({ swatch: 'red', label: 'Rojo' })
    expect(
      truckFromForm({
        ...truckForm,
        name: 'U',
        colorSwatch: 'other',
        colorOther: 'Rojo vino',
      }).color
    ).toEqual({ swatch: 'other', label: 'Rojo vino' })
  })

  const messages = (values: object) =>
    truckFormSchema
      .safeParse({ ...truckForm, name: 'Unidad', ...values })
      .error?.issues.map(issue => [issue.path.join('.'), issue.message])

  test.each([
    [{ name: '' }, 'name', 'Escribe el nombre o número de unidad'],
    [{ year: '19' }, 'year', 'Escribe un año de 4 números, por ejemplo 2019'],
    [{ efficiency: '80' }, 'efficiency', 'Debe estar entre 0.5 y 50 por galón'],
    [
      { efficiency: 'mucho' },
      'efficiency',
      'Escribe solo números, por ejemplo 12.5',
    ],
    [{ colorSwatch: 'other' }, 'colorOther', 'Escribe el color'],
  ])('explains %j next to %s', (values, path, message) => {
    expect(messages(values)).toEqual([[path, message]])
  })
})

describe('trailers (RF-6)', () => {
  const trailerForm = {
    name: 'Caja 7',
    plate: '',
    brand: '',
    model: '',
    year: '',
    vin: '',
    description: '',
    colorSwatch: '',
    colorOther: '',
    trailerType: 'reefer' as const,
    trailerTypeOther: '',
    lengthFt: '53',
    reeferConsumption: '0,8',
    hitchedTruckId: 'truck-1',
  }

  test('only a reefer keeps its cold unit consumption', () => {
    expect(trailerFromForm(trailerForm)).toMatchObject({
      reeferConsumptionGalPerHour: 0.8,
      hitchedTruckId: 'truck-1',
      lengthFt: 53,
    })
    expect(
      trailerFromForm({ ...trailerForm, trailerType: 'dry' })
        .reeferConsumptionGalPerHour
    ).toBeNull()
  })

  test('"other" needs its own name', () => {
    expect(
      trailerFormSchema
        .safeParse({ ...trailerForm, trailerType: 'other' })
        .error?.issues.map(issue => issue.message)
    ).toEqual(['Escribe el tipo de remolque'])
  })
})

describe('tanks (RF-8)', () => {
  const tankForm = (values: Partial<TankFormValues>): TankFormValues => ({
    ...tankToForm(null),
    name: 'Tanque',
    capacity: '120',
    ...values,
  })
  const tankMessages = (values: Partial<TankFormValues>) =>
    tankFormSchema
      .safeParse(tankForm(values))
      .error?.issues.map(issue => [issue.path.join('.'), issue.message])

  test('a cylinder asks for diameter and length', () => {
    expect(tankMessages({ diameter: '25', length: '' })).toEqual([
      ['length', 'Escribe el largo entre 5 y 600 pulgadas'],
    ])
    expect(tankMessages({ diameter: '25', length: '40' })).toBeUndefined()
  })

  test('a D tank asks for height and width, and the round side must fit', () => {
    expect(
      tankMessages({
        shape: 'd_flat_side',
        height: '',
        width: '30',
        length: '48',
      })
    ).toEqual([['height', 'Escribe el alto entre 5 y 200 pulgadas']])
    expect(
      tankMessages({
        shape: 'd_flat_side',
        height: '40',
        width: '10',
        length: '48',
      })
    ).toEqual([['width', 'El ancho debe ser al menos la mitad del alto']])
    expect(
      tankMessages({
        shape: 'd_flat_bottom',
        height: '10',
        width: '40',
        length: '48',
      })
    ).toEqual([['height', 'El alto debe ser al menos la mitad del ancho']])
  })

  test('builds the stored tank with the dimensions of its shape', () => {
    expect(
      tankFromForm(
        tankForm({
          shape: 'rectangular',
          height: '20',
          width: '24,5',
          length: '48',
          equipment: 'trailer:tr1',
        })
      )
    ).toMatchObject({
      shape: 'rectangular',
      dimensions: { heightIn: 20, widthIn: 24.5, lengthIn: 48 },
      capacityGal: 120,
      equipment: { kind: 'trailer', id: 'tr1' },
    })
  })

  test('a stored tank goes back to the form as the app shows numbers', () => {
    const tank: FleetTank = {
      id: 't',
      orgId: 'o',
      name: 'T',
      lastMeasurement: null,
      description: null,
      photoPath: null,
      archived: false,
      capacityGal: 75.5,
      templateId: null,
      equipment: { kind: 'none', id: null },
      shape: 'cylinder',
      orientation: 'horizontal',
      dimensions: { diameterIn: 24.5, lengthIn: 41 },
    }
    expect(tankToForm(tank)).toMatchObject({
      diameter: '24.5',
      length: '41',
      capacity: '75.5',
      equipment: 'none',
    })
  })

  test('the equipment select value round-trips', () => {
    expect(
      equipmentFromValue(equipmentToValue({ kind: 'truck', id: 'x' }))
    ).toEqual({
      kind: 'truck',
      id: 'x',
    })
    expect(equipmentFromValue('none')).toEqual({ kind: 'none', id: null })
    expect(equipmentFromValue('garbage')).toEqual({ kind: 'none', id: null })
  })
})
