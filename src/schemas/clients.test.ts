import {
  clientContact,
  clientFormSchema,
  clientFromForm,
  clientToForm,
  clientWithName,
  duplicateNameMessage,
} from 'schemas/clients'
import { client } from '../testing/fleetFixtures'

const empty = clientToForm(null)

const messages = (values: object) => {
  const result = clientFormSchema.safeParse({ ...empty, ...values })
  return result.success
    ? []
    : result.error.issues.map(issue => [issue.path.join('.'), issue.message])
}

// backend specs/0022 RF-6
describe('the form', () => {
  test('only the name is needed; the rest is stored as null', () => {
    expect(messages({ name: '  Transportes Pérez ' })).toEqual([])
    expect(
      clientFromForm({ ...empty, name: '  Transportes Pérez ', phone: ' ' })
    ).toEqual({
      name: 'Transportes Pérez',
      phone: null,
      email: null,
      taxId: null,
      notes: null,
    })
  })

  test.each([
    [{ name: '' }, 'name', 'Escribe el nombre del cliente'],
    [{ name: 'x'.repeat(61) }, 'name', 'Usa 60 caracteres como máximo'],
    [{ name: 'A', email: 'compras' }, 'email', 'Escribe un correo válido'],
    [
      { name: 'A', phone: '1'.repeat(21) },
      'phone',
      'Usa 20 caracteres como máximo',
    ],
    [
      { name: 'A', taxId: '1'.repeat(31) },
      'taxId',
      'Usa 30 caracteres como máximo',
    ],
    [
      { name: 'A', notes: 'n'.repeat(501) },
      'notes',
      'Usa 500 caracteres como máximo',
    ],
  ])('%o says %s: %s', (values, field, message) => {
    expect(messages(values)).toContainEqual([field, message])
  })

  test('a stored client goes back to the form, nulls as empty', () => {
    expect(clientToForm(client({ email: null }))).toEqual({
      name: 'Transportes Pérez',
      phone: '8888 7777',
      email: '',
      taxId: 'J0310000012345',
      notes: '',
    })
  })
})

// RF-7
describe('a repeated name', () => {
  const clients = [
    client(),
    client({ id: 'client-2', name: 'Fletes Ríos', archived: true }),
  ]

  test('without accents, capitals or extra spaces it is the same', () => {
    expect(clientWithName('  transportes   PEREZ ', clients, 'new')?.id).toBe(
      'client-1'
    )
    expect(clientWithName('Transportes Pérez S.A.', clients, 'new')).toBeNull()
  })

  test('a client does not clash with itself', () => {
    expect(clientWithName('Transportes Pérez', clients, 'client-1')).toBeNull()
  })

  test('an archived one asks to restore it', () => {
    const other = clientWithName('fletes rios', clients, 'new')
    expect(other && duplicateNameMessage(other)).toBe(
      'Ya existe un cliente archivado con ese nombre. Restáuralo en Archivados'
    )
    expect(duplicateNameMessage(client())).toBe(
      'Ya existe un cliente con ese nombre'
    )
  })
})

test('the contact line has what the client has (RF-5)', () => {
  expect(clientContact(client({ email: 'compras@perez.com' }))).toBe(
    '8888 7777 · compras@perez.com · J0310000012345'
  )
  expect(
    clientContact(client({ phone: null, email: null, taxId: null }))
  ).toBeNull()
})
