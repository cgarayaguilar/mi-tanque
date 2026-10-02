import { fireEvent, render, screen } from '@testing-library/react'
import SessionErrorNotice from 'components/SessionErrorNotice'
import { useSessionStore } from 'store/session'

// Regression: with the account failing to load, Medición and Historial fell
// back to the phone without a word, as if the data went to the organization
test('an account that did not load is said, with a way to retry', () => {
  const refresh = vi.fn(() => Promise.resolve())
  useSessionStore.setState({ status: 'error', refresh })
  render(<SessionErrorNotice />)

  expect(
    screen.getByText(/Lo que guardes ahora queda solo en este teléfono/)
  ).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }))
  expect(refresh).toHaveBeenCalled()
})

test('nothing while the account is fine', () => {
  useSessionStore.setState({ status: 'ready' })
  const { container } = render(<SessionErrorNotice />)
  expect(container).toBeEmptyDOMElement()
})
