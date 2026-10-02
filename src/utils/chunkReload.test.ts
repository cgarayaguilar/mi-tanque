import { reloadOnOldChunks } from 'utils/chunkReload'

afterEach(() => {
  sessionStorage.clear()
  vi.restoreAllMocks()
})

// Regression: a chunk of the previous version after a deploy fell into the
// error screen instead of loading the new version
test('an old chunk reloads the page, once', () => {
  const reload = vi.fn()
  vi.spyOn(window, 'location', 'get').mockReturnValue({
    reload,
  } as unknown as Location)
  let time = 1_000_000
  reloadOnOldChunks(() => time)

  window.dispatchEvent(new Event('vite:preloadError', { cancelable: true }))
  time += 5_000
  window.dispatchEvent(new Event('vite:preloadError', { cancelable: true }))

  expect(reload).toHaveBeenCalledTimes(1)
})
