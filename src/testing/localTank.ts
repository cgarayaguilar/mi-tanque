import type { Tank } from 'types'

type CylinderFields = Partial<Omit<Tank & { shape: 'cylinder' }, 'shape'>> & {
  diameter: number
  length: number
}

/**
 * A lying cylinder of this phone, as every tank was before backend
 * specs/0019; fields not given are left out (no id, no capacity).
 */
export const cylinder = <T extends CylinderFields>(fields: T) => ({
  shape: 'cylinder' as const,
  orientation: 'horizontal' as const,
  ...fields,
})
