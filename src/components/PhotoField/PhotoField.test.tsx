import { fireEvent, render, waitFor } from '@testing-library/react'
import { sileo } from 'sileo'
import PhotoField from 'components/PhotoField'

afterEach(() => {
  vi.restoreAllMocks()
})

// Regression: without signal the upload retried for minutes with the
// spinner on and no word to the user
test('without a connection a photo is not sent, and the user is told', () => {
  vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false)
  const upload = vi.fn(() => Promise.resolve({ path: 'p', url: 'u' }))
  const { container } = render(
    <PhotoField
      alt="Camión"
      path={null}
      loadUrl={() => Promise.resolve('u')}
      upload={upload}
      onUploaded={() => undefined}
    />
  )
  const input = container.querySelector('input[type="file"]')
  if (!input) throw new Error('No file input')

  fireEvent.change(input, {
    target: { files: [new File(['x'], 'foto.jpg', { type: 'image/jpeg' })] },
  })

  expect(upload).not.toHaveBeenCalled()
  expect(sileo.warning).toHaveBeenCalledWith(
    expect.objectContaining({ title: 'Necesitas conexión para subir la foto' })
  )
})

// Audit 2026-10-09: a receipt refused by Storage was blamed on the
// connection, and reported as a fleet photo
test('a refused receipt says so, and is reported as a receipt', async () => {
  vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(true)
  const reported = vi
    .spyOn(console, 'error')
    .mockImplementation(() => undefined)
  const upload = vi.fn(() =>
    Promise.reject(
      Object.assign(new Error('denied'), { code: 'storage/unauthorized' })
    )
  )
  const { container } = render(
    <PhotoField
      alt="Comprobante"
      path={null}
      loadUrl={() => Promise.resolve('u')}
      upload={upload}
      kind="expenseReceipt"
    />
  )
  const input = container.querySelector('input[type="file"]')
  if (!input) throw new Error('No file input')
  fireEvent.change(input, {
    target: { files: [new File(['x'], 'recibo.jpg', { type: 'image/jpeg' })] },
  })

  await waitFor(() => {
    expect(sileo.error).toHaveBeenCalledWith(
      expect.objectContaining({
        description:
          'No tienes permiso para subirla. Si el problema sigue, avísanos.',
      })
    )
  })
  expect(JSON.stringify(reported.mock.calls)).toContain('uploadExpenseReceipt')
})
