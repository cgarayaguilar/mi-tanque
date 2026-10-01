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
  //Estado que guarda el tanque seleccionado
  const [defaultTank, setDefaultTank] = useLocalStorage('defaultTank', {})

  const theme = isDarkModeActive ? darkTheme : lightTheme

  const activateDarkMode = () => {
    setIsDarkModeActive(true)
  }

  const disableDarkMode = () => {
    setIsDarkModeActive(false)
  }

  const addTankForDefault = ({ tank }) => {
    setDefaultTank(tank)
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
