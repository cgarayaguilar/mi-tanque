import { fireEvent, screen, within } from '@testing-library/react'

const escape = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/**
 * The chip of the filter `label` (backend specs/0017): its name is the
 * filter's, and "Marca: Volvo" once a value is chosen.
 */
export const filterChip = (label: string, scope: HTMLElement = document.body) =>
  within(scope).getByRole('button', {
    name: new RegExp(`^${escape(label)}(: .*)?$`),
  })

/** Opens the filter `label` and picks `option` in its menu. */
export const filterBy = async (
  label: string,
  option: string,
  scope: HTMLElement = document.body
) => {
  fireEvent.click(filterChip(label, scope))
  const menu = await screen.findByRole('menu', { name: label })
  fireEvent.click(within(menu).getByRole('menuitemradio', { name: option }))
}

/** The options the filter `label` offers, "Todas" first. */
export const filterOptions = async (
  label: string,
  scope: HTMLElement = document.body
) => {
  fireEvent.click(filterChip(label, scope))
  const menu = await screen.findByRole('menu', { name: label })
  const names = within(menu)
    .getAllByRole('menuitemradio')
    .map(item => item.textContent)
  fireEvent.keyDown(menu, { key: 'Escape' })
  return names
}
