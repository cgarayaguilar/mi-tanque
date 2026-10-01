import { render, screen } from '@testing-library/react'
import App from './App'

test('renders the app bar and the tank list', async () => {
  window.history.pushState({}, '', '/tanques')

  render(<App />)

  expect(screen.getByText('Mi tanque')).toBeInTheDocument()
  expect(
    await screen.findByRole('heading', { name: 'Elige tu tanque' })
  ).toBeInTheDocument()
})
