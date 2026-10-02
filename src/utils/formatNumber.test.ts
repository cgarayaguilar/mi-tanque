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

// Regression: edit forms showed 2 decimals, so saving any change rounded
// 24.125 inches to 24.13 and a reefer's 0.125 gal/h to 0.13
test('a number back in a form keeps its decimals', async () => {
  const { formatEditable } = await import('utils/formatNumber')
  const { parseDecimal } = await import('utils/parseDecimal')
  expect(formatEditable(24.125)).toBe('24.125')
  expect(formatEditable(160934.4)).toBe('160,934.4')
  expect(parseDecimal(formatEditable(0.125))).toBe(0.125)
  expect(formatEditable(0.1 + 0.2)).toBe('0.3')
})
