// jest-dom adds custom jest matchers for asserting on DOM nodes.
// allows you to do things like:
// expect(element).toHaveTextContent(/react/i)
// learn more: https://github.com/testing-library/jest-dom
import '@testing-library/jest-dom/vitest'
// jsdom has no IndexedDB; Dexie (services/db) needs one.
import 'fake-indexeddb/auto'

// Sileo renders animated toasts that jsdom cannot lay out. Tests assert on the
// calls instead: import { sileo } from 'sileo' and check sileo.success/error.
vi.mock('sileo', () => ({
  sileo: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    warning: vi.fn(),
    promise: vi.fn(),
  },
  Toaster: () => null,
}))
