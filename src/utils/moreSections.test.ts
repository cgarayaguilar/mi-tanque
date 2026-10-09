import { addDays } from 'date-fns'
import { moreGroups, type MoreData } from 'utils/moreSections'
import { toPlainDate } from 'utils/plainDate'
import { client, driver, rate, trailer, truck } from '../testing/fleetFixtures'

const today = new Date(2026, 9, 8)
const fleet = (overrides: Partial<NonNullable<MoreData['fleet']>> = {}) => ({
  trucks: [],
  trailers: [],
  tanks: [],
  clients: [],
  drivers: [],
  rates: [],
  ...overrides,
})
const lines = (data: Partial<MoreData>) =>
  Object.fromEntries(
    moreGroups(
      {
        fleet: null,
        categories: null,
        person: null,
        organization: null,
        ...data,
      },
      today
    ).flatMap(group => group.rows.map(row => [row.key, row.line]))
  )

// backend specs/0034 RF-3
test('the groups and their rows, in order', () => {
  expect(
    moreGroups(
      { fleet: null, categories: null, person: null, organization: null },
      today
    ).map(group => [group.title, group.rows.map(row => row.label)])
  ).toEqual([
    ['Flota', ['Camiones', 'Remolques', 'Tanques', 'Conductores']],
    ['Comercial', ['Clientes', 'Tarifas']],
    ['Gastos', ['Categorías de gasto']],
    ['Cuenta', ['Mi cuenta y equipo']],
  ])
})

// RF-4, CA-2
test('each line counts the active ones and says what is due', () => {
  const due = toPlainDate(addDays(today, 5))
  expect(
    lines({
      fleet: fleet({
        trucks: [
          truck({ insuranceExpiresOn: due }),
          truck({ id: 'b' }),
          truck({ id: 'c' }),
          truck({ id: 'd', archived: true, insuranceExpiresOn: due }),
        ],
        trailers: [trailer({ insuranceExpiresOn: '2020-01-01' })],
        clients: [client()],
        drivers: [
          driver({ licenseExpiresOn: '2020-01-01' }),
          driver({ id: 'e', licenseExpiresOn: '2020-01-01' }),
        ],
        rates: [],
      }),
      categories: 9,
      person: 'Rosa Prueba',
      organization: 'Flota de Prueba',
    })
  ).toEqual({
    camiones: '3 camiones · 1 seguro por vencer',
    remolques: '1 remolque · 1 seguro vencido',
    tanques: 'Ningún tanque',
    conductores: '2 conductores · 2 licencias vencidas',
    clientes: '1 cliente',
    tarifas: 'Ninguna tarifa',
    categorias: '9 categorías',
    cuenta: 'Rosa Prueba · Flota de Prueba',
  })
})

test('while the fleet is read, its lines are not known', () => {
  expect(lines({ organization: 'Flota de Prueba' })).toMatchObject({
    camiones: null,
    tarifas: null,
    categorias: null,
    cuenta: 'Flota de Prueba',
  })
  expect(lines({ fleet: fleet({ rates: [rate()] }) }).tarifas).toBe('1 tarifa')
})
