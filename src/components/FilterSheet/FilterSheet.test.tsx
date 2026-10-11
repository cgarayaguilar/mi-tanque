import { fireEvent, render, screen, within } from '@testing-library/react'
import FilterSheet, { sheetFilter } from 'components/FilterSheet'

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
