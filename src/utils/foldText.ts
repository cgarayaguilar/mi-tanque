/**
 * Text as a search compares it: "Diámetro", "DIAMETRO" and "diametro" are
 * the same (backend specs/0016 RF-5, specs/0017 RF-5).
 */
export const foldText = (text: string) =>
  text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
