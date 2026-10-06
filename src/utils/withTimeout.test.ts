import { SlowConnectionError, withTimeout } from 'utils/withTimeout'

afterEach(() => {
  vi.useRealTimers()
})

// backend specs/0020 RF-5
test('a read that answers in time passes through', async () => {
  await expect(withTimeout(Promise.resolve(7), 'readFleet')).resolves.toBe(7)
})

test('a read that hangs fails after 15 s, with its operation', async () => {
  vi.useFakeTimers()
  const hanging = withTimeout(new Promise(() => undefined), 'readAccount')
  const caught = hanging.catch((error: unknown) => error)
  await vi.advanceTimersByTimeAsync(14_999)
  vi.advanceTimersByTime(1)
  const error = await caught
  expect(error).toBeInstanceOf(SlowConnectionError)
  expect((error as SlowConnectionError).message).toMatch(/^readAccount/)
})

test('a read that fails fails as it did', async () => {
  await expect(
    withTimeout(Promise.reject(new Error('denied')), 'readTeam')
  ).rejects.toThrow('denied')
})
