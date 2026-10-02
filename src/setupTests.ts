// jest-dom adds custom jest matchers for asserting on DOM nodes.
// allows you to do things like:
// expect(element).toHaveTextContent(/react/i)
// learn more: https://github.com/testing-library/jest-dom
import '@testing-library/jest-dom/vitest'
// jsdom has no IndexedDB; Dexie (services/db) needs one.
import 'fake-indexeddb/auto'
import { configure } from '@testing-library/react'

// Screens load their chunk with lazy() the first time a test renders them;
// on a busy machine or in CI that can pass the default 1 s of findBy* and
// waitFor. 3 s keeps real failures fast enough without flaky timeouts
configure({ asyncUtilTimeout: 3000 })

// Sileo renders animated toasts that jsdom cannot lay out. Tests assert on the
// calls instead: import { sileo } from 'sileo' and check sileo.success/error.
vi.mock('sileo', () => ({
  sileo: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    warning: vi.fn(),
    action: vi.fn(),
    promise: vi.fn(),
    dismiss: vi.fn(),
  },
  Toaster: vi.fn(() => null),
}))

// jsdom has no matchMedia (real browsers do): report no media preference
Object.defineProperty(window, 'matchMedia', {
  configurable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  }),
})
