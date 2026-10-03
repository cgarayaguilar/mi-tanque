import type { ThumbnailTank } from 'components/TankThumbnail'
import type { TankDimensions } from 'types'
import { formatNumber } from 'utils/formatNumber'

// A tank of this phone in words, of any shape and position (backend
// specs/0019 RF-6): "Ø 26 × 48 pulg." as in the catalog, or "En D de pie ·
// 26 × 27 × 41 pulg.".

const KIND = {
  cylinder: 'Cilíndrico',
  rectangular: 'Rectangular',
  d_flat_side: 'En D',
  d_flat_bottom: 'En D de fondo plano',
} as const

/** Its shape and measures, short, for a card. */
export const tankMeasuresText = (tank: TankDimensions) => {
  const length = formatNumber(tank.length)
  const standing = tank.orientation === 'vertical'
  if (tank.shape === 'cylinder') {
    const measures = `Ø ${formatNumber(tank.diameter)} × ${length} pulg.`
    return standing ? `Cilíndrico de pie · ${measures}` : measures
  }
  return `${KIND[tank.shape]}${standing ? ' de pie' : ''} · ${formatNumber(tank.height)} × ${formatNumber(tank.width)} × ${length} pulg.`
}

/** The same, said in full, for an accessible name. */
export const spokenTankMeasures = (tank: TankDimensions) => {
  const length = `${formatNumber(tank.length)} de ${tank.orientation === 'vertical' ? 'altura' : 'largo'}`
  if (tank.shape === 'cylinder') {
    const measures = `${formatNumber(tank.diameter)} pulgadas de diámetro y ${length}`
    return tank.orientation === 'vertical' ? `de pie, ${measures}` : measures
  }
  return `${KIND[tank.shape].toLowerCase()}${tank.orientation === 'vertical' ? ' de pie' : ''}, ${formatNumber(tank.height)} pulgadas de alto, ${formatNumber(tank.width)} de ancho y ${length}`
}

/** What the inches are measured against: "el diámetro", "el alto"… */
export const maxInchesName = (tank: TankDimensions) =>
  tank.orientation === 'vertical'
    ? 'la altura'
    : tank.shape === 'cylinder'
      ? 'el diámetro'
      : 'el alto'

/** The tank as its 3D thumbnail draws it (specs/0019 RF-9). */
export const thumbnailOf = (tank: TankDimensions): ThumbnailTank =>
  tank.shape === 'cylinder'
    ? {
        shape: 'cylinder',
        orientation: tank.orientation,
        size: tank.diameter,
        width: null,
        length: tank.length,
      }
    : {
        shape: tank.shape,
        orientation: tank.orientation,
        size: tank.height,
        width: tank.width,
        length: tank.length,
      }
