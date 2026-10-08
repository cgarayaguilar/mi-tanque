/**
 * Text as a search compares it: "Diámetro", "DIAMETRO" and "diametro" are
 * the same (backend specs/0016 RF-5, specs/0017 RF-5).
 */
export const foldText = (text: string) =>
  text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

/**
 * A name as it is saved: without spaces at the ends or doubled inside,
 * "Acarreos   del Norte" is "Acarreos del Norte" (audit 0027).
 */
export const squeezeSpaces = (text: string) => text.trim().replace(/\s+/g, ' ')
