// zod/mini: same validation as zod with a fraction of the bundle (§5.8)
import * as z from 'zod/mini'
import { requiredText } from 'schemas/fleet'
import { foldText } from 'utils/foldText'

/** Mirrors the rules of `expenseCategories` (backend specs/0026 RF-1). */
export const CATEGORY_NAME_MAX = 40

export interface ExpenseCategory {
  id: string
  orgId: string
  name: string
  /** 'fuel': the refuels' (specs/0027); it is never archived. */
  system: 'fuel' | null
  archived: boolean
}

/**
 * The ones an organization starts with (owner, 2026-10-07). Their ids are
 * fixed, {orgId}_key, so two phones seeding at once write the same ones.
 */
export const PRESET_CATEGORIES = [
  { key: 'fuel', name: 'Combustible', system: 'fuel' },
  { key: 'per_diem', name: 'Viáticos', system: null },
  { key: 'driver_pay', name: 'Pago del conductor', system: null },
  { key: 'parking', name: 'Parqueo', system: null },
  { key: 'tolls', name: 'Peajes', system: null },
  { key: 'preventive', name: 'Mantenimiento preventivo', system: null },
  { key: 'corrective', name: 'Mantenimiento correctivo', system: null },
  { key: 'parts', name: 'Repuestos', system: null },
  { key: 'tires', name: 'Llantas', system: null },
] as const

export const presetCategoryId = (orgId: string, key: string) =>
  `${orgId}_${key}`

/** The presets as an organization's categories (RF-1). */
export const presetCategoriesOf = (orgId: string): ExpenseCategory[] =>
  PRESET_CATEGORIES.map(preset => ({
    id: presetCategoryId(orgId, preset.key),
    orgId,
    name: preset.name,
    system: preset.system,
    archived: false,
  }))

export const categoryFormSchema = z.object({
  name: requiredText('Escribe el nombre de la categoría', CATEGORY_NAME_MAX),
})

export type CategoryFormValues = z.infer<typeof categoryFormSchema>

const nameKey = (name: string) => foldText(name).trim().replace(/\s+/g, ' ')

/** Another category with this name, archived ones included (RF-11). */
export const categoryWithName = (
  name: string,
  categories: readonly ExpenseCategory[],
  selfId: string
): ExpenseCategory | null =>
  categories.find(
    category =>
      category.id !== selfId && nameKey(category.name) === nameKey(name)
  ) ?? null

export const duplicateCategoryMessage = (other: ExpenseCategory) =>
  other.archived
    ? 'Ya existe una categoría archivada con ese nombre. Restáurala en Archivadas'
    : 'Ya existe una categoría con ese nombre'

/** Alphabetical, fuel first: the one most used. */
export const sortCategories = (categories: readonly ExpenseCategory[]) =>
  [...categories].sort(
    (a, b) =>
      Number(b.system === 'fuel') - Number(a.system === 'fuel') ||
      a.name.localeCompare(b.name, 'es')
  )
