import { create } from 'zustand'
import { sileo } from 'sileo'
import { defaultColorMode, type ColorMode } from 'theme/tokens'
import { reportError } from 'utils/reportError'

// Legacy key and format (a JSON boolean), so installed apps keep their choice
const STORAGE_KEY = 'isDarkModeActive'

const readStoredMode = (): ColorMode => {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY)
    if (stored === 'true') return 'dark'
    if (stored === 'false') return 'light'
  } catch (error) {
    // No toast: the default is a valid state and there is nothing to act on
    reportError(error, { operation: 'readColorMode' })
  }
  return defaultColorMode
}

interface ColorModeState {
  mode: ColorMode
  toggle: () => void
}

export const useColorModeStore = create<ColorModeState>()((set, get) => ({
  mode: readStoredMode(),
  toggle: () => {
    const mode = get().mode === 'dark' ? 'light' : 'dark'
    // Applied for this session even if it cannot be remembered
    set({ mode })
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(mode === 'dark'))
    } catch (error) {
      reportError(error, { operation: 'writeColorMode' })
      sileo.error({
        title: 'No pudimos recordar tu elección',
        description: 'Seguirá activa hasta que cierres la app.',
      })
    }
  },
}))
