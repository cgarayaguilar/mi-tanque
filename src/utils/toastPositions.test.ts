import { placeToasts } from 'utils/toastPositions'

const fakeToasts = () => {
  const shown = vi.fn((_options: object) => 'id')
  const toasts = {
    success: shown,
    error: shown,
    warning: shown,
    info: shown,
    action: shown,
  }
  placeToasts(toasts)
  return { toasts, shown }
}

test('errors show at the top center', () => {
  const { toasts, shown } = fakeToasts()
  toasts.error({ title: 'No pudimos guardar' })
  expect(shown).toHaveBeenLastCalledWith({
    position: 'top-center',
    title: 'No pudimos guardar',
  })
})

// Sileo reuses one toast: without its own position, a success after an
// error would inherit the top
test('the other toasts stay at the bottom center', () => {
  const { toasts, shown } = fakeToasts()
  for (const kind of ['success', 'warning', 'info', 'action'] as const) {
    toasts[kind]({ title: kind })
    expect(shown).toHaveBeenLastCalledWith({
      position: 'bottom-center',
      title: kind,
    })
  }
})

test('a call can still ask for another place', () => {
  const { toasts, shown } = fakeToasts()
  toasts.error({ title: 'Error', position: 'bottom-center' })
  expect(shown).toHaveBeenLastCalledWith({
    position: 'bottom-center',
    title: 'Error',
  })
})
