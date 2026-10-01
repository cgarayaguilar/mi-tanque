import { parseDecimal } from 'utils/parseDecimal'

test.each([
  ['12', 12],
  ['12.5', 12.5],
  ['12,5', 12.5],
  [' 7,25 ', 7.25],
  ['.5', 0.5],
  ['0', 0],
])('parses %j as %d', (input, expected) => {
  expect(parseDecimal(input)).toBe(expected)
})

test.each(['', 'abc', '12,5,1', '1.2.3', '-3', '12 5', '1e3'])(
  'rejects %j',
  input => {
    expect(parseDecimal(input)).toBeNaN()
  }
)
