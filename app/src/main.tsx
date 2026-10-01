import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource/inter/400.css'
import '@fontsource/inter/500.css'
import '@fontsource/inter/600.css'
import '@fontsource/inter/700.css'
import './ui/styles.css'
import { App } from './ui/App'
import { StoreProvider } from './ui/StoreContext'
import { rules } from './rules'
import { scenarios } from './scenarios'
import { buildSeedState, seedHash } from './seed/loadSeed'
import { LocalEventStore } from './store/localEventStore'
import { createBrowserTransport, safeLocalStorage } from './store/transports'

const store = new LocalEventStore({
  buildSeed: buildSeedState,
  seedHash,
  rules,
  scenarios,
  storage: safeLocalStorage(),
  transport: createBrowserTransport(),
})

const scenario = new URLSearchParams(window.location.search).get('scenario')
if (scenario) store.reset(scenario)

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <StoreProvider store={store}>
      <App />
    </StoreProvider>
  </StrictMode>,
)
