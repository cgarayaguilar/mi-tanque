import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import ErrorBoundary from 'components/ErrorBoundary'
import registerServiceWorker from './registerServiceWorker'
import { reloadOnOldChunks } from 'utils/chunkReload'
import { redirectFromLegacyHost } from 'utils/legacyHost'

const start = () => {
  reloadOnOldChunks()
  const rootElement = document.getElementById('root')

  if (!rootElement) {
    throw new Error('Root element #root not found in index.html')
  }

  createRoot(rootElement).render(
    <StrictMode>
      <ErrorBoundary>
        <App />
      </ErrorBoundary>
    </StrictMode>
  )

  registerServiceWorker()
}

// On the old domain the app only forwards to the new one
if (!redirectFromLegacyHost()) start()
