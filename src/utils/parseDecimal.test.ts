import { normalizeDecimal, parseDecimal } from 'utils/parseDecimal'

test.each([
  ['12', 12],
  ['12.5', 12.5],
  [' 7.25 ', 7.25],
  ['.5', 0.5],
  ['0', 0],
  ['1,500', 1500],
  ['1,500.25', 1500.25],
  ['120,600', 120600],
  ['1,234,567', 1234567],
])('parses %j as %d (dot decimal, comma thousands)', (input, expected) => {
  expect(parseDecimal(input)).toBe(expected)
})

// Phones set to a comma-decimal region offer only a comma
test.each([
  ['12,5', 12.5],
  ['30,50', 30.5],
  ['0,125', 0.125],
  ['1234,5', 1234.5],
])(
  'reads a comma that cannot be thousands in %j as decimal',
  (input, expected) => {
    expect(parseDecimal(input)).toBe(expected)
  }
)

test.each([
  '',
  '.',
  'abc',
  '12,5,1',
  '1.2.3',
  '1,50.5',
  '12,5.5',
  '-3',
  '12 5',
  '1e3',
])('rejects %j', input => {
  expect(parseDecimal(input)).toBeNaN()
})

test('normalizes to the dot form for searching', () => {
  expect(normalizeDecimal('1,500')).toBe('1500')
  expect(normalizeDecimal('24,5')).toBe('24.5')
  expect(normalizeDecimal('x')).toBeNull()
})
