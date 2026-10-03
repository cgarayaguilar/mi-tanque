// Exact by definition (backend specs/0018 RF-8): the inch is 25.4 mm and the
// US gallon is 231 cubic inches, 3.785411784 liters. One value for each, used
// by measurements and refuels alike.
export const MILLIMETERS_PER_INCH = 25.4
export const CUBIC_INCHES_PER_GALLON = 231
export const LITERS_PER_GALLON = 3.785411784

export const convertInchesToMillimeters = ({
  inches,
}: {
  inches: number
}): number => inches * MILLIMETERS_PER_INCH

export const convertLitersToGallons = ({
  liters,
}: {
  liters: number
}): number => liters / LITERS_PER_GALLON

export const convertGallonsToLiters = ({
  gallons,
}: {
  gallons: number
}): number => gallons * LITERS_PER_GALLON
