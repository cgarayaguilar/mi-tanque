import { sectionBySlug, sectionWords } from 'utils/fleetSections'

// specs/0024: "la tarifa" makes the words around it agree
test('the words around a section agree with its gender', () => {
  expect(sectionWords(sectionBySlug('tarifas'))).toMatchObject({
    the: 'la',
    newOne: 'Nueva',
    all: 'Todas tus',
    it: 'a',
  })
  expect(sectionWords(sectionBySlug('camiones'))).toMatchObject({
    the: 'el',
    newOne: 'Nuevo',
    all: 'Todos tus',
    it: 'o',
  })
})
