const INCHES_PER_MILLIMETER = 0.0393701
const GALLONS_PER_LITER = 0.26417

export const convertInchesToMillimeters = ({
  inches,
}: {
  inches: number
}): number => inches / INCHES_PER_MILLIMETER

export const convertLitersToGallons = ({
  liters,
}: {
  liters: number
}): number => liters * GALLONS_PER_LITER

export const convertGallonsToLiters = ({
  gallons,
}: {
  gallons: number
}): number => gallons / GALLONS_PER_LITER
