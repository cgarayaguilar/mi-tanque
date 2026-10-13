import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { choose } from './choose'

const escape = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/**
 * The chip of the filter `label` (backend specs/0017): its name is the
 * filter's, and "Marca: Volvo" once a value is chosen.
 */
export const filterChip = (label: string, scope: HTMLElement = document.body) =>
  within(scope).getByRole('button', {
    name: new RegExp(`^${escape(label)}(: .*)?$`),
  })

const chipOf = (label: string, scope: HTMLElement) =>
  within(scope).queryByRole('button', {
    name: new RegExp(`^${escape(label)}(: .*)?$`),
  })

/** "Filtros", with how many are on (backend specs/0039 RF-2). */
export const filtersButton = (scope: HTMLElement = document.body) =>
  within(scope).getByRole('button', { name: /^Filtros(, \d+ activos?)?$/ })

/** Opens the sheet of filters (specs/0039) and gives it. */
export const openFilters = async (scope: HTMLElement = document.body) => {
  fireEvent.click(filtersButton(scope))
  return screen.findByRole('dialog', { name: 'Filtros' })
}

/** Closes the sheet of filters, and waits until it is gone. */
export const closeFilters = async () => {
  fireEvent.click(screen.getByRole('button', { name: 'Cerrar filtros' }))
  await waitFor(() => {
    expect(
      screen.queryByRole('dialog', { name: 'Filtros', hidden: true })
    ).toBeNull()
  })
}

/**
 * Picks `option` in the filter `label`: in its chip ("Agrupar", "Ordenar",
 * the tank catalog) or, for a list's filters, in the sheet (specs/0039),
 * which is closed again.
 */
export const filterBy = async (
  label: string,
  option: string,
  scope: HTMLElement = document.body
) => {
  if (chipOf(label, scope)) {
    fireEvent.click(filterChip(label, scope))
    const menu = await screen.findByRole('menu', { name: label })
    fireEvent.click(within(menu).getByRole('menuitemradio', { name: option }))
    return
  }
  const sheet = await openFilters(scope)
  await choose(label, option, sheet)
  await closeFilters()
}

/** The options the filter `label` offers, "Todas" first. */
export const filterOptions = async (
  label: string,
  scope: HTMLElement = document.body
) => {
  if (chipOf(label, scope)) {
    fireEvent.click(filterChip(label, scope))
    const menu = await screen.findByRole('menu', { name: label })
    const names = within(menu)
      .getAllByRole('menuitemradio')
      .map(item => item.textContent)
    fireEvent.keyDown(menu, { key: 'Escape' })
    return names
  }
  const sheet = await openFilters(scope)
  const group = within(sheet).queryByRole('group', { name: label })
  let names: (string | null)[]
  if (group) {
    names = within(group)
      .getAllByRole('button')
      .map(button => button.textContent)
  } else {
    fireEvent.mouseDown(
      within(sheet).getByRole('combobox', {
        name: new RegExp(`^${escape(label)}`),
      })
    )
    names = (await screen.findAllByRole('option')).map(
      option => option.textContent
    )
  }
  await closeFilters()
  return names
}

/** The filters the sheet offers now, by their names. */
export const sheetFilterNames = async (scope: HTMLElement = document.body) => {
  const sheet = await openFilters(scope)
  // In the order shown: buttons are a group, a list is a combobox
  // A field inside another, as the amount's condition, is part of it
  const names = [...sheet.querySelectorAll('[role="group"], [role="combobox"]')]
    .filter(field => !field.parentElement?.closest('[role="group"]'))
    .map(field =>
      field instanceof HTMLInputElement
        ? (field.labels?.[0]?.textContent ?? null)
        : document.getElementById(field.getAttribute('aria-labelledby') ?? '')
            ?.textContent
    )
  await closeFilters()
  return names
}
