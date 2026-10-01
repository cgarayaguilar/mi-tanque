import { fireEvent, render, screen } from '@testing-library/react'
import App from '../../App'
import { db } from 'services/db'
import { useTanksStore } from 'store/tanks'

beforeEach(async () => {
  window.localStorage.clear()
  useTanksStore.setState({ tanks: [], status: 'idle' })
  await db.tanks.clear()
  window.history.pushState({}, '', '/tanques')
  render(<App />)
  await screen.findByText('Tanque de 50 gls')
})

test('the logo is a link home', () => {
  expect(
    screen.getByRole('link', { name: 'Mi tanque, ir al inicio' })
  ).toHaveAttribute('href', '/')
})

test('starts in light mode and the toggle switches it', () => {
  fireEvent.click(screen.getByRole('button', { name: 'Activar modo oscuro' }))

  expect(window.localStorage.getItem('isDarkModeActive')).toBe('true')

  fireEvent.click(screen.getByRole('button', { name: 'Activar modo claro' }))

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
