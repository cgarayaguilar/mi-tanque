import type { TankOrientation, TankShape } from 'utils/tankVolume'

// What each measure is and how to take it (backend specs/0013 RF-4, RF-5).
// The same words in the ⓘ of each field and in the guide.

export type MeasureName =
  'capacity' | 'diameter' | 'height' | 'width' | 'length'

/** The ⓘ text of a field, for the tank's shape and position. */
export const measureHelp = (
  measure: MeasureName,
  shape: TankShape,
  orientation: TankOrientation
): string => {
  switch (measure) {
    case 'capacity':
      return 'Los galones que le caben al tanque lleno. Búscalos en la placa del tanque o pregúntale al fabricante.'
    case 'diameter':
      return orientation === 'vertical'
        ? 'El ancho del círculo de la tapa, de borde a borde por fuera, pasando por el centro.'
        : 'El alto del tanque acostado: de borde a borde por fuera, pasando por el centro del círculo.'
    case 'height':
      return shape === 'd_flat_side'
        ? 'Del fondo al techo, medido en el lado plano (el que va contra el chasis).'
        : shape === 'd_flat_bottom'
          ? 'Del fondo plano al punto más alto de la curva.'
          : 'Del fondo al techo, por fuera.'
    case 'width':
      return shape === 'd_flat_side'
        ? 'Del lado plano al punto más saliente de la curva, por fuera.'
        : 'De un costado al otro, por fuera.'
    case 'length':
      return orientation === 'vertical'
        ? 'De la base a la tapa, por fuera, con el tanque de pie.'
        : 'De una punta a la otra, por fuera. No cuentes tubos ni soportes.'
  }
}

/** The steps of the guide, for the tank's shape and position. */
export const measureSteps = (
  shape: TankShape,
  orientation: TankOrientation
): string[] => {
  const measures =
    shape === 'cylinder'
      ? `Mide el diámetro: ${measureHelp('diameter', shape, orientation).toLowerCase()}`
      : `Mide el alto (${measureHelp('height', shape, orientation).toLowerCase()}) y el ancho (${measureHelp('width', shape, orientation).toLowerCase()})`
  return [
    'Usa una cinta métrica y anota todo en pulgadas.',
    'Mide siempre por fuera del tanque, sin contar tubos, tapas ni soportes.',
    measures.replace(/\.\)/g, ')'),
    `Mide ${orientation === 'vertical' ? 'la altura' : 'el largo'}: ${measureHelp('length', shape, orientation).toLowerCase()}`,
    'La capacidad está en la placa del tanque. Si no la encuentras, la vista previa te dice cuánto cabe según las medidas.',
  ]
}
