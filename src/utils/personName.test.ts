import { authorName, usableName } from 'utils/personName'

test('a long name is cut to 60 characters, without loose spaces', () => {
  const name = usableName(`  María ${'de los Ángeles  '.repeat(6)}Pérez `)
  expect(name?.length).toBeLessThanOrEqual(60)
  expect(name?.startsWith('María de los Ángeles de los')).toBe(true)
  expect(name).not.toMatch(/\s{2}|\s$/)
})

test('too short or missing is no name', () => {
  expect(usableName('A')).toBeNull()
  expect(usableName('   ')).toBeNull()
  expect(usableName(undefined)).toBeNull()
  expect(usableName('Ana')).toBe('Ana')
})

// Regression: the profile kept a Google name over 60, and the rules rejected
// every measurement and refuel with it
test('what is saved always carries a name the rules accept', () => {
  expect(authorName('x'.repeat(80))).toHaveLength(60)
  expect(authorName('')).toBe('Sin nombre')
})
