import type { Client } from 'schemas/clients'
import type { Driver } from 'schemas/drivers'
import type { FleetTank, Trailer, Truck } from 'schemas/fleet'
import type { Rate } from 'schemas/rates'
import { FLEET_SECTIONS, type FleetSection } from 'utils/fleetSections'
import {
  insuranceNotice,
  licenseNotice,
  type ExpiryNotice,
} from 'utils/insurance'

// The "Más" view (backend specs/0034): its groups and rows, in one place
// (RNF-1). Pure: the page draws them

export type MoreRowKey = FleetSection['slug'] | 'categorias' | 'cuenta'

export interface MoreRow {
  key: MoreRowKey
  label: string
  href: string
  /** "3 camiones · 1 seguro por vencer"; null while it is not known. */
  line: string | null
}

export interface MoreGroup {
  title: string
  rows: MoreRow[]
}

export interface MoreData {
  /** null while the fleet is read, or if it could not be. */
  fleet: {
    trucks: readonly Truck[]
    trailers: readonly Trailer[]
    tanks: readonly FleetTank[]
    clients: readonly Client[]
    drivers: readonly Driver[]
    rates: readonly Rate[]
  } | null
  /** The expense categories in use; null while not known. */
  categories: number | null
  person: string | null
  organization: string | null
}

// RF-3: the groups, and their fleet modules in order
const GROUPS: { title: string; rows: readonly MoreRowKey[] }[] = [
  {
    title: 'Flota',
    rows: ['camiones', 'remolques', 'tanques', 'conductores'],
  },
  { title: 'Comercial', rows: ['clientes', 'tarifas'] },
  { title: 'Gastos', rows: ['categorias'] },
  { title: 'Cuenta', rows: ['cuenta'] },
]

/** "3 camiones", "1 tarifa", "Ninguna tarifa" (RF-4). */
export const countText = (section: FleetSection, count: number) =>
  count === 0
    ? `${section.feminine ? 'Ninguna' : 'Ningún'} ${section.one}`
    : count === 1
      ? `1 ${section.one}`
      : `${String(count)} ${section.label.toLowerCase()}`

/** "1 seguro por vencer · 2 seguros vencidos" (RF-4). */
const noticesText = (
  notices: readonly (ExpiryNotice | null)[],
  /** The notice of one already expired: "Seguro vencido". */
  expiredText: string,
  one: string,
  many: string,
  expired: (plural: boolean) => string
) => {
  const shown = notices.filter((notice): notice is ExpiryNotice =>
    Boolean(notice)
  )
  const late = shown.filter(notice => notice.text === expiredText).length
  const soon = shown.length - late
  return [
    soon > 0 && `${String(soon)} ${soon === 1 ? one : many} por vencer`,
    late > 0 &&
      `${String(late)} ${late === 1 ? one : many} ${expired(late > 1)}`,
  ].filter(Boolean)
}

const fleetLine = (
  section: FleetSection,
  fleet: NonNullable<MoreData['fleet']>,
  today: Date
) => {
  const active = <T extends { archived: boolean }>(items: readonly T[]) =>
    items.filter(item => !item.archived)
  const items: readonly { archived: boolean }[] = fleet[section.collection]
  const vehicles: readonly (Truck | Trailer)[] =
    section.collection === 'trucks'
      ? fleet.trucks
      : section.collection === 'trailers'
        ? fleet.trailers
        : []
  const notices =
    vehicles.length > 0
      ? noticesText(
          active(vehicles).map(item =>
            insuranceNotice(item.insuranceExpiresOn, today)
          ),
          'Seguro vencido',
          'seguro',
          'seguros',
          plural => (plural ? 'vencidos' : 'vencido')
        )
      : section.collection === 'drivers'
        ? noticesText(
            active(fleet.drivers).map(driver =>
              licenseNotice(driver.licenseExpiresOn, today)
            ),
            'Licencia vencida',
            'licencia',
            'licencias',
            plural => (plural ? 'vencidas' : 'vencida')
          )
        : []
  return [countText(section, active(items).length), ...notices].join(' · ')
}

/** The groups of "Más", with what each row has (RF-3, RF-4). */
export const moreGroups = (data: MoreData, today: Date): MoreGroup[] =>
  GROUPS.map(({ title, rows }) => ({
    title,
    rows: rows.map(key => {
      if (key === 'categorias')
        return {
          key,
          label: 'Categorías de gasto',
          href: '/gastos/categorias?desde=mas',
          line:
            data.categories === null
              ? null
              : data.categories === 1
                ? '1 categoría'
                : `${String(data.categories)} categorías`,
        }
      if (key === 'cuenta')
        return {
          key,
          label: 'Mi cuenta y equipo',
          href: '/cuenta',
          line:
            [data.person, data.organization].filter(Boolean).join(' · ') ||
            null,
        }
      const section = FLEET_SECTIONS.find(item => item.slug === key)
      if (!section) throw new Error(`No fleet section ${key}`)
      return {
        key,
        label: section.label,
        href: `/flota/${section.slug}`,
        line: data.fleet ? fleetLine(section, data.fleet, today) : null,
      }
    }),
  }))
