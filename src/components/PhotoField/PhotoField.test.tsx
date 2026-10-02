import { fireEvent, render } from '@testing-library/react'
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
