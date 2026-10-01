import { StrictMode } from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import App from '../../App'
import AppProvider from 'store'
import { db } from 'services/db'
import { settle } from '../../testUtils'

beforeEach(async () => {
  window.localStorage.clear()
  await db.tanks.clear()
})

// StrictMode runs effects twice in development (React 18+): the first visit
// must still seed the predefined tanks exactly once.
test('seeds the predefined tanks once on the first visit', async () => {
  window.history.pushState({}, '', '/tanques')

  render(
    <StrictMode>
      <AppProvider>
        <App />
      </AppProvider>
    </StrictMode>
  )

  expect(await screen.findByText('Tanque de 50 gls')).toBeInTheDocument()
  await waitFor(async () => expect(await db.tanks.count()).toBeGreaterThan(0))
  await settle()

  expect(await db.tanks.count()).toBe(15)
})
