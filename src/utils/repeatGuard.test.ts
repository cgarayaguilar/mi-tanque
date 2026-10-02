import { createRepeatGuard, REPEAT_WINDOW_MS } from 'utils/repeatGuard'

test('the same save right away is a double tap', () => {
  const repeated = createRepeatGuard()
  expect(repeated('tank-1|12.5', 1000)).toBe(false)
  expect(repeated('tank-1|12.5', 1150)).toBe(true)
})

test('another level, another tank or a later measurement are new', () => {
  const repeated = createRepeatGuard()
  expect(repeated('tank-1|12.5', 0)).toBe(false)
  expect(repeated('tank-1|13', 100)).toBe(false)
  expect(repeated('tank-2|13', 200)).toBe(false)
  expect(repeated('tank-2|13', 200 + REPEAT_WINDOW_MS)).toBe(false)
})
