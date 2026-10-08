// zod/mini: same validation as zod with a fraction of the bundle (§5.8)
import * as z from 'zod/mini'
import { optionalText, requiredText } from 'schemas/fleet'
import { foldText, squeezeSpaces } from 'utils/foldText'

/** Mirrors the rules of `clients` (backend specs/0022 RF-1). */
export const CLIENT_LIMITS = {
  name: 60,
  phone: 20,
  email: 100,
  taxId: 30,
  notes: 500,
}

export interface Client {
  id: string
  orgId: string
  name: string
  phone: string | null
  email: string | null
  /** RUC, NIT or RTN. */
  taxId: string | null
  notes: string | null
  archived: boolean
}

// Enough to catch a typo, not to judge an address
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export const clientFormSchema = z.object({
  name: requiredText('Escribe el nombre del cliente', CLIENT_LIMITS.name),
  phone: optionalText(CLIENT_LIMITS.phone),
  email: optionalText(CLIENT_LIMITS.email).check(
    z.refine(value => value === '' || EMAIL.test(value), {
      error: 'Escribe un correo válido',
    })
  ),
  taxId: optionalText(CLIENT_LIMITS.taxId),
  notes: optionalText(CLIENT_LIMITS.notes),
})

export type ClientFormValues = z.infer<typeof clientFormSchema>

const textOrNull = (value: string) => value.trim() || null

export const clientFromForm = (values: ClientFormValues) => ({
  name: squeezeSpaces(values.name),
  phone: textOrNull(values.phone),
  email: textOrNull(values.email),
  taxId: textOrNull(values.taxId),
  notes: textOrNull(values.notes),
})

export const clientToForm = (client: Client | null): ClientFormValues => ({
  name: client?.name ?? '',
  phone: client?.phone ?? '',
  email: client?.email ?? '',
  taxId: client?.taxId ?? '',
  notes: client?.notes ?? '',
})

/** "Transportes  Pérez " and "transportes perez" are the same name (RF-7). */
const nameKey = (name: string) => foldText(name).trim().replace(/\s+/g, ' ')

/**
 * Another client with this name, archived ones included; editing a client
 * does not clash with itself (backend specs/0022 RF-7).
 */
export const clientWithName = (
  name: string,
  clients: readonly Client[],
  selfId: string
): Client | null => {
  const key = nameKey(name)
  return (
    clients.find(
      client => client.id !== selfId && nameKey(client.name) === key
    ) ?? null
  )
}

/** What the name field says when it clashes (RF-7). */
export const duplicateNameMessage = (other: Client) =>
  other.archived
    ? 'Ya existe un cliente archivado con ese nombre. Restáuralo en Archivados'
    : 'Ya existe un cliente con ese nombre'

/** "8888 7777 · compras@perez.com · J0310000012345" (RF-5). */
export const clientContact = (client: Client) =>
  [client.phone, client.email, client.taxId].filter(Boolean).join(' · ') || null
