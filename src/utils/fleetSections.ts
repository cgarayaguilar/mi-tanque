import type { FleetCollection } from 'services/fleet'

/** URL slug of each fleet section, in Spanish (/flota/camiones, …). */
export const FLEET_SECTIONS = [
  {
    slug: 'camiones',
    collection: 'trucks',
    label: 'Camiones',
    one: 'camión',
    add: 'Agregar camión',
    photo: true,
  },
  {
    slug: 'remolques',
    collection: 'trailers',
    label: 'Remolques',
    one: 'remolque',
    add: 'Agregar remolque',
    photo: true,
  },
  {
    slug: 'tanques',
    collection: 'tanks',
    label: 'Tanques',
    one: 'tanque',
    add: 'Agregar tanque',
    photo: true,
  },
  // A catalog of the organization, without photo (backend specs/0022 RF-4)
  {
    slug: 'clientes',
    collection: 'clients',
    label: 'Clientes',
    one: 'cliente',
    add: 'Agregar cliente',
    photo: false,
  },
] as const satisfies readonly {
  slug: string
  collection: FleetCollection
  label: string
  one: string
  add: string
  /** Its items have a photo. */
  photo: boolean
}[]

export type FleetSection = (typeof FLEET_SECTIONS)[number]

export const sectionBySlug = (slug: string | undefined): FleetSection =>
  FLEET_SECTIONS.find(section => section.slug === slug) ?? FLEET_SECTIONS[0]
