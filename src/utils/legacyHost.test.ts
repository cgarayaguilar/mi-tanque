import { redirectFromLegacyHost } from 'utils/legacyHost'

const fakeLocation = (hostname: string) => ({
  hostname,
  pathname: '/history',
  search: '?a=1',
  hash: '#top',
  replace: vi.fn(),
})

test('sends the old domain to the same path on solocamioneros.com', () => {
  const location = fakeLocation('mi-tanque.vercel.app')

  expect(redirectFromLegacyHost(location)).toBe(true)
  expect(location.replace).toHaveBeenCalledWith(
    'https://solocamioneros.com/history?a=1#top'
  )
})

test('leaves every other host alone (new domain, previews, localhost)', () => {
  for (const host of [
    'solocamioneros.com',
    'mi-tanque-git-feature.vercel.app',
    'localhost',
  ]) {
    const location = fakeLocation(host)
    expect(redirectFromLegacyHost(location)).toBe(false)
    expect(location.replace).not.toHaveBeenCalled()
  }
})
