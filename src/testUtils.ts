import { act } from '@testing-library/react'

// Lets pending IndexedDB promises, and the state updates they trigger, finish
// inside act() as React 19 requires. Use it before asserting that nothing
// else happened (no errors, no extra writes).
export const settle = (ms = 200): Promise<void> =>
  act(() => new Promise<void>(resolve => setTimeout(resolve, ms)))
