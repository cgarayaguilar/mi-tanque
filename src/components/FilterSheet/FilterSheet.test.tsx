import { fireEvent, render, screen, within } from '@testing-library/react'
import FilterSheet, {
  appliedFilters,
  sheetFilter,
} from 'components/FilterSheet'
import { ANY_AMOUNT, type AmountQuery } from 'utils/amountQuery'

// backend specs/0039, and the owner's review of 2026-10-11
const renderSheet = () => {
  const onClient = vi.fn()
  render(
    <FilterSheet
      resultLabel="Ver 3 viajes"
      filters={[
        // Two clients today, many tomorrow: a list all the same
        sheetFilter({
          label: 'Cliente',
          list: true,
          allLabel: 'Todos',
          options: [{ value: 'c1', label: 'Walmart' }],
          value: null,
          onChange: onClient,
        }),
        sheetFilter({
          label: 'Dueño del camión',
          allLabel: 'Todos',
          options: [
            { value: 'own', label: 'Propio' },
            { value: 'third_party', label: 'De un tercero' },
          ],
          value: 'own',
          onChange: () => undefined,
        }),
      ]}
    />
  )
  fireEvent.click(screen.getByRole('button', { name: 'Filtros, 1 activo' }))
  return { sheet: screen.getByRole('dialog', { name: 'Filtros' }), onClient }
}

test('a growing list is a list with search, a short choice is buttons', () => {
  const { sheet } = renderSheet()

  expect(
    within(sheet).getByRole('combobox', { name: /^Cliente/ })
  ).toBeInTheDocument()
  expect(
    within(sheet).getByRole('group', { name: 'Dueño del camión' })
  ).toBeInTheDocument()
})

test('its buttons stay fixed below the fields that scroll', () => {
  const { sheet } = renderSheet()

  expect(
    within(sheet).getByRole('button', { name: 'Ver 3 viajes' })
  ).toBeInTheDocument()
  expect(
    within(sheet).getByRole('button', { name: 'Limpiar filtros' })
  ).toBeEnabled()
})

// A wider screen: from the right, up to 350 px (jsdom matches no phone)
test('on a wide screen it opens from the right, 350 px at most', () => {
  const { sheet } = renderSheet()

  expect(sheet.className).toMatch(/MuiDrawer-paperAnchorRight/)
  expect(getComputedStyle(sheet).maxWidth).toBe('350px')
})

describe('several values and an amount (backend specs/0043)', () => {
  const CATEGORIES = [
    { value: 'tolls', label: 'Peajes' },
    { value: 'fuel', label: 'Combustible' },
    { value: 'tires', label: 'Llantas' },
  ]

  const renderWith = (
    values: string[],
    amount: AmountQuery,
    onCategories = vi.fn(),
    onAmount = vi.fn()
  ) => {
    render(
      <FilterSheet
        resultLabel="Ver 2 gastos"
        filters={[
          {
            kind: 'many',
            label: 'Categorías',
            allLabel: 'Todas',
            options: CATEGORIES,
            values,
            onChange: onCategories,
          },
          {
            kind: 'amount',
            label: 'Monto',
            symbol: 'C$',
            money: value => `C$${String(value)}`,
            value: amount,
            onChange: onAmount,
          },
        ]}
      />
    )
    return { onCategories, onAmount }
  }

  test('several categories count as one filter; another is checked in the list', () => {
    const { onCategories } = renderWith(['tolls', 'fuel'], ANY_AMOUNT)
    fireEvent.click(screen.getByRole('button', { name: 'Filtros, 1 activo' }))
    const sheet = screen.getByRole('dialog', { name: 'Filtros' })
    expect(within(sheet).getByText('Peajes')).toBeInTheDocument()
    expect(within(sheet).getByText('Combustible')).toBeInTheDocument()

    const field = within(sheet).getByRole('combobox', { name: 'Categorías' })
    fireEvent.mouseDown(field)
    fireEvent.click(screen.getByRole('option', { name: 'Llantas' }))
    expect(onCategories).toHaveBeenLastCalledWith(['tolls', 'fuel', 'tires'])
  })

  test('a condition asks for its amount; "Entre" for both', () => {
    const { onAmount } = renderWith([], { op: 'between', from: '500', to: '' })
    fireEvent.click(screen.getByRole('button', { name: 'Filtros' }))
    const amount = screen.getByRole('group', { name: 'Monto' })
    expect(within(amount).getByLabelText('Desde')).toHaveValue('500')
    fireEvent.change(within(amount).getByLabelText('Hasta'), {
      target: { value: '2,000' },
    })
    expect(onAmount).toHaveBeenLastCalledWith({
      op: 'between',
      from: '500',
      to: '2,000',
    })
    // Not valid yet: not on, but "Limpiar filtros" takes it away
    fireEvent.click(screen.getByRole('button', { name: 'Limpiar filtros' }))
    expect(onAmount).toHaveBeenLastCalledWith(ANY_AMOUNT)
  })

  test('a wrong amount says why and is not counted', () => {
    renderWith([], { op: 'between', from: '2,000', to: '500' })
    expect(screen.getByRole('button', { name: 'Filtros' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Filtros' }))
    expect(
      screen.getByText('Tiene que ser igual o mayor que "Desde"')
    ).toBeInTheDocument()
  })

  test('a valid amount is on, and says itself', () => {
    renderWith([], { op: 'gt', from: '1,000', to: '' })
    expect(
      screen.getByRole('button', { name: 'Filtros, 1 activo' })
    ).toBeInTheDocument()
    expect(
      appliedFilters([
        {
          kind: 'amount',
          label: 'Monto',
          symbol: 'C$',
          money: value => `C$${String(value)}`,
          value: { op: 'gt', from: '1,000', to: '' },
          onChange: () => undefined,
        },
        {
          kind: 'many',
          label: 'Categorías',
          allLabel: 'Todas',
          options: CATEGORIES,
          values: ['tolls', 'tires'],
          onChange: () => undefined,
        },
      ])
    ).toEqual(['Monto: mayor a C$1000', 'Categorías: Peajes, Llantas'])
  })
})
