import { renderHook, waitFor } from '@testing-library/react'
import { sileo } from 'sileo'
import { usePrecisionNotice } from 'hooks/usePrecisionNotice'
import { useSelectedTankStore } from 'store/selectedTank'

const notice = {
  title: 'Mejoramos la precisión',
  description: 'Lleno ahora marca la capacidad de tu tanque.',
}

beforeEach(() => {
  window.localStorage.clear()
  vi.mocked(sileo.success).mockClear()
})

afterEach(() => {
  useSelectedTankStore.setState({ selectedTank: null })
})

// backend specs/0018 RF-7
test('who already measured is told once per phone', async () => {
  useSelectedTankStore.setState({
    selectedTank: { id: 1, capacity: 100, diameter: 26, length: 48 },
  })
  renderHook(() => {
    usePrecisionNotice()
  })
  await waitFor(() => {
    expect(sileo.success).toHaveBeenCalledWith(notice)
  })

  renderHook(() => {
    usePrecisionNotice()
  })
  await new Promise(resolve => setTimeout(resolve, 10))
  expect(sileo.success).toHaveBeenCalledTimes(1)
})

test('someone new is never told, not even after choosing a tank', async () => {
  renderHook(() => {
    usePrecisionNotice()
  })
  await waitFor(() => {
    expect(window.localStorage.getItem('precisionNotice0018')).toBe('seen')
  })
  useSelectedTankStore.setState({
    selectedTank: { id: 1, capacity: 100, diameter: 26, length: 48 },
  })
  renderHook(() => {
    usePrecisionNotice()
  })
  await new Promise(resolve => setTimeout(resolve, 10))
  expect(sileo.success).not.toHaveBeenCalled()
})

// The Toaster mounts after the page: StrictMode's mount, unmount and mount
// again must still end in one toast
test('a page mounted twice still shows it once', async () => {
  useSelectedTankStore.setState({
    selectedTank: { id: 1, capacity: 100, diameter: 26, length: 48 },
  })
  const first = renderHook(() => {
    usePrecisionNotice()
  })
  first.unmount()
  renderHook(() => {
    usePrecisionNotice()
  })
  await waitFor(() => {
    expect(sileo.success).toHaveBeenCalledTimes(1)
  })
})
