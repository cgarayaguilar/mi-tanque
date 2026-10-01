import { darkTheme, lightTheme } from 'store/initialState'
import { useLocalStorage } from 'hooks/useLocalStorage'
import { defaultColorMode } from 'theme/tokens'
import { useSelectedTankStore } from 'store/selectedTank'

const useInitialState = () => {
  // Only the preference is stored; colors always come from the design tokens
  // (storing the whole theme object kept old colors after a design change)
  const [isDarkModeActive, setIsDarkModeActive] = useLocalStorage(
    'isDarkModeActive',
    defaultColorMode === 'dark'
  )
  // Backed by the Zustand store so migrated and legacy screens share one source
  const selectedTank = useSelectedTankStore(state => state.selectedTank)
  const selectTank = useSelectedTankStore(state => state.selectTank)
  const defaultTank = selectedTank ?? {}

  const theme = isDarkModeActive ? darkTheme : lightTheme

  const activateDarkMode = () => {
    setIsDarkModeActive(true)
  }

  const disableDarkMode = () => {
    setIsDarkModeActive(false)
  }

  const addTankForDefault = ({ tank }) => {
    selectTank(tank)
  }

  return {
    theme,
    isDarkModeActive,
    activateDarkMode,
    disableDarkMode,
    addTankForDefault,
    defaultTank,
  }
}

export default useInitialState
