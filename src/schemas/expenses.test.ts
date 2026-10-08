import {
  categoryWithName,
  duplicateCategoryMessage,
  sortCategories,
} from 'schemas/expenseCategories'
import {
  EMPTY_EXPENSE_FORM,
  expenseFormSchema,
  expenseFromForm,
  expenseLinkText,
  expenseToForm,
  expenseToRow,
  totalsByCategory,
  totalsByCurrency,
  tripExpenseChanges,
  type ExpenseContext,
  type ExpenseFormValues,
} from 'schemas/expenses'
import { toDateTimeValue } from 'utils/dateTimeValue'
import {
  driver,
  expense,
  presetCategories,
  trailer,
  trip,
  truck,
} from '../testing/fleetFixtures'

const context: ExpenseContext = {
  currency: 'NIO',
  categories: presetCategories(),
  trucks: [truck(), truck({ id: 'truck-2', name: 'Unidad 15' })],
  trailers: [trailer()],
  drivers: [driver()],
}

const valid: ExpenseFormValues = {
  ...EMPTY_EXPENSE_FORM(new Date(2026, 9, 6, 10, 30)),
  amount: '1,850',
  categoryId: 'org-a_tolls',
  kind: 'truck',
  truckId: 'truck-1',
}

const issues = (values: ExpenseFormValues) => {
  const result = expenseFormSchema.safeParse(values)
  return result.success
    ? {}
    : Object.fromEntries(
        result.error.issues.map(issue => [issue.path.join('.'), issue.message])
      )
}

// backend specs/0026 RF-10
describe('the form', () => {
  test('each link asks for what it links to', () => {
    expect(issues(valid)).toEqual({})
    expect(issues({ ...valid, truckId: '' })).toEqual({
      truckId: 'Elige el camión',
    })
    expect(issues({ ...valid, kind: 'trip' })).toEqual({
      tripId: 'Elige el viaje',
    })
    expect(issues({ ...valid, kind: 'trailer' })).toEqual({
      trailerId: 'Elige el remolque',
    })
    expect(issues({ ...valid, kind: 'general' })).toEqual({})
  })

  test('amount, category and a date that is not ahead', () => {
    expect(issues({ ...valid, amount: '0', categoryId: '' })).toEqual({
      amount: 'Ingresa un monto mayor que 0',
      categoryId: 'Elige la categoría',
    })
    // The rules take it up to a day ahead (RF-2)
    const later = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000)
    expect(issues({ ...valid, takenAt: toDateTimeValue(later) })).toEqual({
      takenAt: 'La fecha no puede ser futura',
    })
    expect(issues({ ...valid, takenAt: '' })).toEqual({
      takenAt: 'Escribe la fecha y hora',
    })
  })

  test('a truck expense has no trip; one of a trip carries its truck and trailer', () => {
    expect(expenseFromForm(valid, context, null)).toMatchObject({
      kind: 'truck',
      amount: 1850,
      currency: 'NIO',
      categoryName: 'Peajes',
      tripId: null,
      tripRoute: null,
      truckId: 'truck-1',
      truckName: 'Unidad 12',
      trailerId: null,
      driverId: null,
      driverName: null,
    })
    expect(
      expenseFromForm(
        { ...valid, kind: 'trip', tripId: 'trip-1', truckId: '' },
        context,
        trip()
      )
    ).toMatchObject({
      kind: 'trip',
      tripId: 'trip-1',
      tripRoute: 'Managua → San José',
      truckId: 'truck-1',
      trailerId: 'trailer-1',
      trailerName: 'Caja 7',
    })
  })

  // RF-6: what a deleted trip left keeps its trailer while on that truck
  test('a former trip expense keeps its trailer only on the same truck', () => {
    const left = expense({ kind: 'truck', tripId: null, tripRoute: null })
    expect(
      expenseFromForm(expenseToForm(left), context, null, left)
    ).toMatchObject({ trailerId: 'trailer-1', trailerName: 'Caja 7' })
    expect(
      expenseFromForm(
        { ...expenseToForm(left), truckId: 'truck-2' },
        context,
        null,
        left
      )
    ).toMatchObject({ truckId: 'truck-2', trailerId: null, trailerName: null })
  })

  test('the currency and photo saved stay when editing', () => {
    const saved = expense({
      currency: 'USD',
      receiptPhotoPath: 'orgs/org-a/expenses/expense-1/receipt.jpg',
    })
    expect(
      expenseFromForm(expenseToForm(saved), context, trip(), saved)
    ).toMatchObject({
      currency: 'USD',
      receiptPhotoPath: 'orgs/org-a/expenses/expense-1/receipt.jpg',
    })
  })
})

// RF-9, RF-13
describe('totals and texts', () => {
  test('by category, largest first, each currency apart', () => {
    expect(
      totalsByCategory(
        [
          expense({ amount: 100.1 }),
          expense({ amount: 200.2 }),
          expense({
            categoryId: 'org-a_fuel',
            categoryName: 'Combustible',
            amount: 5000,
          }),
          expense({ currency: 'USD', amount: 40 }),
        ],
        id => (id === 'org-a_tolls' ? 'Peajes y puentes' : null)
      )
    ).toEqual([
      { name: 'Combustible', currency: 'NIO', amount: 5000 },
      { name: 'Peajes y puentes', currency: 'NIO', amount: 300.3 },
      { name: 'Peajes y puentes', currency: 'USD', amount: 40 },
    ])
    expect(
      totalsByCurrency([
        expense({ amount: 0.1 }),
        expense({ amount: 0.2 }),
        expense({ currency: 'USD', amount: 5 }),
      ])
    ).toEqual([
      { currency: 'NIO', amount: 0.3 },
      { currency: 'USD', amount: 5 },
    ])
  })

  test('what each one belongs to', () => {
    expect(expenseLinkText(expense())).toBe('Viaje Managua → San José')
    expect(expenseLinkText(expense({ kind: 'truck' }))).toBe('Camión Unidad 12')
    expect(expenseLinkText(expense({ kind: 'trailer' }))).toBe(
      'Remolque Caja 7'
    )
    expect(expenseLinkText(expense({ kind: 'general' }))).toBe('General')
  })
})

// RF-12, CA-3, CA-4
describe("a trip's rows", () => {
  const first = expense()
  const second = expense({
    id: 'expense-2',
    amount: 1350,
    driverId: 'driver-1',
    driverName: 'Pedro Ruiz',
  })
  const previous = [first, second, expense({ id: 'expense-3', amount: 500 })]

  test('new rows are created, changed ones updated, missing ones removed', () => {
    const moved = trip({ truckId: 'truck-2', truckName: 'Unidad 15' })
    const rows = [
      // Unchanged, but its trip changed truck: it follows the trip
      expenseToRow(first),
      { ...expenseToRow(second), amount: '1,500' },
      {
        id: 'new-1',
        categoryId: 'org-a_per_diem',
        amount: '800',
        takenAt: '2026-10-06T12:00',
        description: ' Almuerzo ',
      },
    ]
    const changes = tripExpenseChanges(rows, moved, previous, context, 'ana')

    expect(changes.remove).toEqual(['expense-3'])
    expect(changes.create).toMatchObject([
      {
        id: 'new-1',
        fields: {
          kind: 'trip',
          tripId: 'trip-1',
          truckId: 'truck-2',
          categoryName: 'Viáticos',
          amount: 800,
          description: 'Almuerzo',
          driverId: null,
        },
      },
    ])
    expect(changes.update.map(item => item.id)).toEqual([
      'expense-1',
      'expense-2',
    ])
    expect(changes.update[1]?.fields).toMatchObject({
      amount: 1500,
      driverId: 'driver-1',
      driverName: 'Pedro Ruiz',
    })
    expect(changes.saved.map(item => [item.id, item.createdBy])).toEqual([
      ['expense-1', 'luis'],
      ['expense-2', 'luis'],
      ['new-1', 'ana'],
    ])
  })

  test('rows left as they were write nothing', () => {
    const changes = tripExpenseChanges(
      previous.map(expenseToRow),
      trip(),
      previous,
      context,
      'luis'
    )
    expect(changes).toMatchObject({ create: [], update: [], remove: [] })
  })
})

// RF-11
describe('categories', () => {
  test('fuel first, then by name; a name is not taken twice', () => {
    const categories = sortCategories([
      ...presetCategories().reverse(),
      {
        id: 'own',
        orgId: 'org-a',
        name: 'Lavado',
        system: null,
        archived: true,
      },
    ])
    expect(categories.slice(0, 3).map(category => category.name)).toEqual([
      'Combustible',
      'Lavado',
      'Llantas',
    ])
    expect(categoryWithName('  peajes ', categories, 'x')?.id).toBe(
      'org-a_tolls'
    )
    expect(categoryWithName('Peajes', categories, 'org-a_tolls')).toBeNull()
    const archived = categoryWithName('LAVADO', categories, 'x')
    expect(archived && duplicateCategoryMessage(archived)).toBe(
      'Ya existe una categoría archivada con ese nombre. Restáurala en Archivadas'
    )
  })
})
