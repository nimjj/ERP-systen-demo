import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './ui/theme.css'
import './ui/styles.css'
import { App } from './ui/App'
import { PresenterProvider } from './ui/PresenterContext'
import { startRun } from './ui/Presenter'
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

// ?scenario=S1 loads the scenario's starting state and opens the presenter on step 1.
const scenario = new URLSearchParams(window.location.search).get('scenario')
const initialRun = scenario && scenarios[scenario] ? (store.reset(scenario), startRun(scenario, store.getState().events.length)) : null

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <StoreProvider store={store}>
      <PresenterProvider initialRun={initialRun}>
        <App />
      </PresenterProvider>
    </StoreProvider>
  </StrictMode>,
)
