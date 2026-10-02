import { db } from 'services/db'

const KEY = 'deviceId'

/**
 * This install's id, created once and kept with the local data: clearing
 * the site's data clears both, so a new id never meets old local ids.
 * Imports use it to tell phones apart (backend specs/0004 RF-17).
 */
export const getDeviceId = (): Promise<string> =>
  db.transaction('rw', db.settings, async () => {
    const stored = await db.settings.get(KEY)
    if (stored) return stored.value
    const value = crypto.randomUUID().replaceAll('-', '').slice(0, 12)
    await db.settings.add({ key: KEY, value })
    return value
  })
