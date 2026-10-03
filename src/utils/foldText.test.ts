import { foldText } from 'utils/foldText'

test('accents and capitals do not count', () => {
  expect(foldText('Diámetro CAMIÓN')).toBe('diametro camion')
  expect(foldText('120 gal')).toBe('120 gal')
})
