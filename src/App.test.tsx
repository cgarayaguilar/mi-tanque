import { render, screen } from '@testing-library/react'
import { Toaster } from 'sileo'
import App from './App'

test('renders the app bar and the tank list', async () => {
  window.history.pushState({}, '', '/tanques')

  render(<App />)

  expect(screen.getByText('Solo Camioneros')).toBeInTheDocument()
  expect(
    await screen.findByRole('heading', { name: 'Elige tu tanque' })
  ).toBeInTheDocument()
})

// Owner's directive: every toast, of any kind, shows at the top center
test('toasts show at the top center', () => {
  render(<App />)

  expect(vi.mocked(Toaster)).toHaveBeenLastCalledWith(
    expect.objectContaining({ position: 'top-center' }),
    undefined
  )
})
