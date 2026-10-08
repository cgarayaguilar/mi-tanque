// zod/mini: same validation as zod with a fraction of the bundle (§5.8)
import * as z from 'zod/mini'
import { optionalText, requiredText } from 'schemas/fleet'
import { foldText, squeezeSpaces } from 'utils/foldText'
import { isPlainDate } from 'utils/plainDate'

/** Mirrors the rules of `drivers` (backend specs/0023 RF-1). */
export const DRIVER_LIMITS = {
  name: 60,
  phone: 20,
  licenseNumber: 30,
}

export interface Driver {
  id: string
  orgId: string
  name: string
  phone: string | null
  licenseNumber: string | null
  /** 'YYYY-MM-DD', like the insurance (specs/0011). */
  licenseExpiresOn: string | null
  /** A member of the organization this driver is, if any. */
  memberUid: string | null
  archived: boolean
}

export const driverFormSchema = z.object({
  name: requiredText('Escribe el nombre del conductor', DRIVER_LIMITS.name),
  phone: optionalText(DRIVER_LIMITS.phone),
  licenseNumber: optionalText(DRIVER_LIMITS.licenseNumber),
  // '' or 'YYYY-MM-DD', from the date picker
  licenseExpiresOn: z.string().check(
    z.refine(value => value === '' || isPlainDate(value), {
      error: 'Escribe una fecha válida',
    })
  ),
  memberUid: z.string(),
})

export type DriverFormValues = z.infer<typeof driverFormSchema>

const textOrNull = (value: string) => value.trim() || null

export const driverFromForm = (values: DriverFormValues) => ({
  name: squeezeSpaces(values.name),
  phone: textOrNull(values.phone),
  licenseNumber: textOrNull(values.licenseNumber),
  licenseExpiresOn: values.licenseExpiresOn || null,
  memberUid: values.memberUid || null,
})

export const driverToForm = (driver: Driver | null): DriverFormValues => ({
  name: driver?.name ?? '',
  phone: driver?.phone ?? '',
  licenseNumber: driver?.licenseNumber ?? '',
  // A stored date that does not exist would look empty but not save
  licenseExpiresOn:
    driver?.licenseExpiresOn && isPlainDate(driver.licenseExpiresOn)
      ? driver.licenseExpiresOn
      : '',
  memberUid: driver?.memberUid ?? '',
})

const nameKey = (name: string) => foldText(name).trim().replace(/\s+/g, ' ')

/** Another driver with this name, archived ones included (RF-8). */
export const driverWithName = (
  name: string,
  drivers: readonly Driver[],
  selfId: string
): Driver | null => {
  const key = nameKey(name)
  return (
    drivers.find(
      driver => driver.id !== selfId && nameKey(driver.name) === key
    ) ?? null
  )
}

export const duplicateDriverMessage = (other: Driver) =>
  other.archived
    ? 'Ya existe un conductor archivado con ese nombre. Restáuralo en Archivados'
    : 'Ya existe un conductor con ese nombre'

/** The active driver a member is already linked to, other than this one (RF-8). */
export const driverLinkedTo = (
  memberUid: string,
  drivers: readonly Driver[],
  selfId: string
): Driver | null =>
  drivers.find(
    driver =>
      driver.id !== selfId && !driver.archived && driver.memberUid === memberUid
  ) ?? null

/** "8888 7777 · Licencia A-123456" (RF-6). */
export const driverContact = (driver: Driver) =>
  [driver.phone, driver.licenseNumber && `Licencia ${driver.licenseNumber}`]
    .filter(Boolean)
    .join(' · ') || null
