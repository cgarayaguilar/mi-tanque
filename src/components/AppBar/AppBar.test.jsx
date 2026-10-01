import { fireEvent, render, screen } from '@testing-library/react'
import App from '../../App'
import AppProvider from 'store'
import { db } from 'services/db'

beforeEach(async () => {
  window.localStorage.clear()
  await db.tanks.clear()
  window.history.pushState({}, '', '/tanques')
  render(
    <AppProvider>
      <App />
    </AppProvider>
  )
  await screen.findByText('Tanque de 50 gls')
})

test('the logo is a link home', () => {
  expect(
    screen.getByRole('link', { name: 'Mi tanque, ir al inicio' })
  ).toHaveAttribute('href', '/')
})

test('the theme toggle is a labelled button that switches the mode', () => {
  fireEvent.click(screen.getByRole('button', { name: 'Activar modo claro' }))

  expect(
    screen.getByRole('button', { name: 'Activar modo oscuro' })
  ).toBeInTheDocument()
  expect(window.localStorage.getItem('isDarkModeActive')).toBe('false')
})

test('tank cards are buttons named after the tank', () => {
  fireEvent.click(
    screen.getByRole('button', {
      name: 'Seleccionar: tanque de 50 galones, 25 por 26 pulgadas',
    })
  )

  expect(window.location.pathname).toBe('/')
})
