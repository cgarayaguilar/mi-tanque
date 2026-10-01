import { formatNumber } from 'utils/formatNumber'

test('uses a decimal dot and only the decimals needed', () => {
  expect(formatNumber(24.5)).toBe('24.5')
  expect(formatNumber(25)).toBe('25')
  expect(formatNumber('12.25')).toBe('12.25')
})

test('fixed decimals for amounts, with a comma for thousands', () => {
  expect(formatNumber('26.2', 2)).toBe('26.20')
  expect(formatNumber(12345.678, 2)).toBe('12,345.68')
  expect(formatNumber(1500)).toBe('1,500')
})

test('leaves text that is not a number as it is', () => {
  expect(formatNumber('—')).toBe('—')
})
