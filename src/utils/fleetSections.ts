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
    feminine: false,
  },
  {
    slug: 'remolques',
    collection: 'trailers',
    label: 'Remolques',
    one: 'remolque',
    add: 'Agregar remolque',
    photo: true,
    feminine: false,
  },
  {
    slug: 'tanques',
    collection: 'tanks',
    label: 'Tanques',
    one: 'tanque',
    add: 'Agregar tanque',
    photo: true,
    feminine: false,
  },
  // A catalog of the organization, without photo (backend specs/0022 RF-4)
  {
    slug: 'clientes',
    collection: 'clients',
    label: 'Clientes',
    one: 'cliente',
    add: 'Agregar cliente',
    photo: false,
    feminine: false,
  },
  // Who drives the trips, with or without an account (specs/0023 RF-5)
  {
    slug: 'conductores',
    collection: 'drivers',
    label: 'Conductores',
    one: 'conductor',
    add: 'Agregar conductor',
    photo: false,
    feminine: false,
  },
  // The prices of the trips, by route (specs/0024 RF-4)
  {
    slug: 'tarifas',
    collection: 'rates',
    label: 'Tarifas',
    one: 'tarifa',
    add: 'Agregar tarifa',
    photo: false,
    feminine: true,
  },
] as const satisfies readonly {
  slug: string
  collection: FleetCollection
  label: string
  one: string
  add: string
  /** Its items have a photo. */
  photo: boolean
  /** "la tarifa": the words around it agree (specs/0024). */
  feminine: boolean
}[]

export type FleetSection = (typeof FLEET_SECTIONS)[number]

export const sectionBySlug = (slug: string | undefined): FleetSection =>
  FLEET_SECTIONS.find(section => section.slug === slug) ?? FLEET_SECTIONS[0]

/**
 * The words around a section's name, in its gender: "Nuevo camión",
 * "Nueva tarifa", "Todos tus clientes", "Todas tus tarifas".
 */
export const sectionWords = (section: FleetSection) => {
  const feminine = section.feminine
  return {
    the: feminine ? 'la' : 'el',
    that: feminine ? 'esa' : 'ese',
    newOne: feminine ? 'Nueva' : 'Nuevo',
    first: feminine ? 'primera' : 'primer',
    all: feminine ? 'Todas tus' : 'Todos tus',
    thePlural: feminine ? 'las' : 'los',
    /** "guardad" + it: guardado, guardada. */
    it: feminine ? 'a' : 'o',
    /** "archivad" + them: archivados, archivadas. */
    them: feminine ? 'as' : 'os',
  }
}
