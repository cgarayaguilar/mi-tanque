import { db } from 'services/db'
import { getDeviceId } from 'services/deviceId'

beforeEach(async () => {
  await db.settings.clear()
})

test('one id per install, the same every time', async () => {
  const [first, second] = await Promise.all([getDeviceId(), getDeviceId()])
  expect(first).toMatch(/^[0-9a-f]{12}$/)
  expect(second).toBe(first)
  expect(await getDeviceId()).toBe(first)
})

test('a cleared install gets a new id', async () => {
  const first = await getDeviceId()
  await db.settings.clear()
  expect(await getDeviceId()).not.toBe(first)
})
