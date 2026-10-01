import { useSyncExternalStore } from 'react'

const subscribe = (onChange: () => void) => {
  window.addEventListener('online', onChange)
  window.addEventListener('offline', onChange)
  return () => {
    window.removeEventListener('online', onChange)
    window.removeEventListener('offline', onChange)
  }
}

/** Whether the browser believes it is online, kept up to date. */
export const useOnlineStatus = (): boolean =>
  useSyncExternalStore(subscribe, () => navigator.onLine)
