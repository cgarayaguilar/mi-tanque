import { darkTheme, lightTheme } from 'store/initialState'
import { useLocalStorage } from 'hooks/useLocalStorage'
import { defaultColorMode } from 'theme/tokens'

const useInitialState = () => {
  // Only the preference is stored; colors always come from the design tokens
  // (storing the whole theme object kept old colors after a design change)
  const [isDarkModeActive, setIsDarkModeActive] = useLocalStorage(
    'isDarkModeActive',
    defaultColorMode === 'dark'
  )
  const theme = isDarkModeActive ? darkTheme : lightTheme

  const activateDarkMode = () => {
    setIsDarkModeActive(true)
  }

  const disableDarkMode = () => {
    setIsDarkModeActive(false)
  }

  return {
    theme,
    isDarkModeActive,
    activateDarkMode,
    disableDarkMode,
  }
}

export default useInitialState
