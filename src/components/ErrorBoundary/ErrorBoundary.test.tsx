import { render, screen } from '@testing-library/react'
import ErrorBoundary from 'components/ErrorBoundary'

const Broken = (): never => {
  throw new Error('Render failed')
}

test('shows a friendly fallback and reports the error', () => {
  const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})

  render(
    <ErrorBoundary>
      <Broken />
    </ErrorBoundary>
  )

  expect(screen.getByRole('alert')).toHaveTextContent('Algo salió mal')
  expect(screen.getByRole('button', { name: 'Recargar' })).toBeInTheDocument()
  expect(consoleError).toHaveBeenCalledWith(
    '[render]',
    expect.objectContaining({ operation: 'render' }),
    expect.objectContaining({ message: 'Render failed' })
  )
  consoleError.mockRestore()
})

test('renders its children when nothing fails', () => {
  render(
    <ErrorBoundary>
      <p>Contenido</p>
    </ErrorBoundary>
  )

  expect(screen.getByText('Contenido')).toBeInTheDocument()
})
