import {
  maxInchesName,
  spokenTankMeasures,
  tankMeasuresText,
} from 'utils/tankText'

const cylinder = {
  capacity: 100,
  shape: 'cylinder',
  orientation: 'horizontal',
  diameter: 26,
  length: 48,
} as const
const box = {
  capacity: 80,
  shape: 'rectangular',
  orientation: 'vertical',
  height: 20,
  width: 24,
  length: 40,
} as const

// backend specs/0019 RF-6, CA-4
test('a tank in words, by its shape and position', () => {
  expect(tankMeasuresText(cylinder)).toBe('Ø 26 × 48 pulg.')
  expect(tankMeasuresText(box)).toBe('Rectangular de pie · 20 × 24 × 40 pulg.')
  expect(
    tankMeasuresText({
      ...box,
      shape: 'd_flat_side',
      orientation: 'horizontal',
      height: 26,
      width: 27,
      length: 41,
    })
  ).toBe('En D · 26 × 27 × 41 pulg.')
  expect(spokenTankMeasures(cylinder)).toBe(
    '26 pulgadas de diámetro y 48 de largo'
  )
  expect(spokenTankMeasures(box)).toBe(
    'rectangular de pie, 20 pulgadas de alto, 24 de ancho y 40 de altura'
  )
  expect(maxInchesName(cylinder)).toBe('el diámetro')
  expect(maxInchesName(box)).toBe('la altura')
  expect(maxInchesName({ ...box, orientation: 'horizontal' })).toBe('el alto')
})
