import { declaredEfficiency } from 'utils/fleetLabels'

// backend specs/0021 RF-5
describe('the declared efficiency', () => {
  const efficiency = (loaded: number | null, empty: number | null) => ({
    fuelEfficiencyKmPerGal: loaded,
    fuelEfficiencyEmptyKmPerGal: empty,
  })

  test('both, one or none', () => {
    expect(declaredEfficiency(efficiency(8.5, 11), 'km')).toBe(
      '8.5 cargado · 11 vacío km/gal'
    )
    expect(declaredEfficiency(efficiency(8.5, null), 'km')).toBe(
      '8.5 km/gal cargado'
    )
    expect(declaredEfficiency(efficiency(null, 11), 'km')).toBe(
      '11 km/gal vacío'
    )
    expect(declaredEfficiency(efficiency(null, null), 'km')).toBeNull()
  })

  test('in miles, from the km stored', () => {
    expect(
      declaredEfficiency(efficiency(6 * 1.609344, 8 * 1.609344), 'mi')
    ).toBe('6 cargado · 8 vacío mi/gal')
  })
})
