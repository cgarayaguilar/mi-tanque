import { render, screen } from '@testing-library/react'
import App from './App'
import AppProvider from 'store'

test('renders the app bar and the tank list', async () => {
  window.history.pushState({}, '', '/tanques')

  render(
    <AppProvider>
      <App />
    </AppProvider>
  )

  expect(screen.getByText('Mi tanque')).toBeInTheDocument()
  expect(
    await screen.findByRole('heading', { name: 'Elige tu tanque' })
  ).toBeInTheDocument()
})
