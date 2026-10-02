import { fireEvent, screen, within } from '@testing-library/react'

const escape = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/**
 * Picks `option` in the field labelled `label`, whatever the control
 * (backend specs/0009): buttons side by side, Material's menu, or an
 * Autocomplete. `scope` limits the search, e.g. to a dialog.
 */
export const choose = async (
  label: string,
  option: string,
  scope: HTMLElement = document.body
) => {
  const area = within(scope)
  const group = area.queryByRole('group', { name: label })
  if (group) {
    fireEvent.click(within(group).getByRole('button', { name: option }))
    return
  }
  // A menu's name also says the chosen value: match its start
  const field = await area.findByRole('combobox', {
    name: new RegExp(`^${escape(label)}`),
  })
  fireEvent.mouseDown(field)
  fireEvent.click(await screen.findByRole('option', { name: option }))
}

/** The value shown by a menu or an Autocomplete labelled `label`. */
export const chosen = (label: string, scope: HTMLElement = document.body) => {
  const area = within(scope)
  const group = area.queryByRole('group', { name: label })
  if (group) {
    return (
      within(group)
        .queryAllByRole('button')
        .find(button => button.getAttribute('aria-pressed') === 'true')
        ?.textContent ?? ''
    )
  }
  const field = area.getByRole('combobox', {
    name: new RegExp(`^${escape(label)}`),
  })
  return field instanceof HTMLInputElement ? field.value : field.textContent
}
