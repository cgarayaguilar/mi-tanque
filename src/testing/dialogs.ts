import { fireEvent, screen, waitFor, within } from '@testing-library/react'

/**
 * Waits until `dialog` is gone and what it covered can be used again.
 *
 * MUI takes a closed dialog out of the DOM first and gives back what it hid
 * (`aria-hidden`, the scroll lock) later, in an effect. When the dialog closes
 * after an async submit, outside act(), that effect can still be pending once
 * the dialog is gone: `getByRole` then finds nothing behind it, on some runs
 * only (2026-10-11). Waiting for the dialog alone is not enough.
 */
export const waitForDialogToClose = async (dialog: HTMLElement) => {
  await waitFor(() => {
    expect(dialog).not.toBeInTheDocument()
    // With another dialog still open, that one is what must be usable
    const top = screen.queryAllByRole('dialog', { hidden: true }).at(-1)
    if (top) {
      expect(top.closest('[aria-hidden="true"]')).toBeNull()
    } else {
      expect(document.querySelector('body > [aria-hidden="true"]')).toBeNull()
    }
  })
}

/** Its "Guardar", which closes it once its values are valid. */
export const saveDialog = async (dialog: HTMLElement) => {
  fireEvent.click(within(dialog).getByRole('button', { name: 'Guardar' }))
  await waitForDialogToClose(dialog)
}
