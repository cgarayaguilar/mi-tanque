import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { sileo } from 'sileo'
import ExportButton from 'components/ExportButton'
import { ExportOfflineError } from 'utils/exportFile'

afterEach(() => {
  vi.clearAllMocks()
})

const click = (
  run: () => Promise<{ count: number; truncated: boolean }>,
  kind: 'refuels' | 'measurements' = 'refuels'
) => {
  render(<ExportButton kind={kind} run={run} />)
  fireEvent.click(
    screen.getByRole('button', {
      name: `Exportar ${kind === 'refuels' ? 'rellenos' : 'mediciones'} del periodo`,
    })
  )
}

test('says how many were exported (RF-9)', async () => {
  click(() => Promise.resolve({ count: 42, truncated: false }))
  await waitFor(() => {
    expect(sileo.success).toHaveBeenCalledWith({
      title: 'Exportamos 42 rellenos',
    })
  })
})

test('one, none and too many read naturally', async () => {
  click(() => Promise.resolve({ count: 1, truncated: false }), 'measurements')
  await waitFor(() => {
    expect(sileo.success).toHaveBeenCalledWith({
      title: 'Exportamos 1 medición',
    })
  })
  vi.clearAllMocks()
  document.body.innerHTML = ''
  click(() => Promise.resolve({ count: 0, truncated: false }))
  await waitFor(() => {
    expect(sileo.warning).toHaveBeenCalledWith({
      title: 'No hay rellenos en este periodo',
    })
  })
  document.body.innerHTML = ''
  click(() => Promise.resolve({ count: 5000, truncated: true }), 'measurements')
  await waitFor(() => {
    expect(sileo.warning).toHaveBeenCalledWith({
      title: 'Exportamos las 5,000 mediciones más recientes',
      description: 'Acorta el periodo para exportar el resto.',
    })
  })
})

test('offline it asks for a connection (RF-8)', async () => {
  click(() => Promise.reject(new ExportOfflineError()))
  await waitFor(() => {
    expect(sileo.warning).toHaveBeenCalledWith({
      title: 'Necesitas conexión para exportar',
      description: 'Así el archivo trae todo el periodo.',
    })
  })
})

test('a failure offers to retry, and runs once at a time', async () => {
  vi.spyOn(console, 'error').mockImplementation(() => undefined)
  const run = vi.fn(() => Promise.reject(new Error('unavailable')))
  click(run)
  // A second tap while it works does not start another export
  fireEvent.click(screen.getByRole('button', { name: /Exportar/ }))
  await waitFor(() => {
    expect(sileo.action).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'No pudimos exportar' })
    )
  })
  expect(run).toHaveBeenCalledTimes(1)
})
