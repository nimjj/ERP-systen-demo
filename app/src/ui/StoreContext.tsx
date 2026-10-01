import { createContext, useContext, useSyncExternalStore, type ReactNode } from 'react'
import type { AppState } from '../domain/types'
import type { EventStore } from '../store/EventStore'

const StoreContext = createContext<EventStore | null>(null)

export function StoreProvider({ store, children }: { store: EventStore; children: ReactNode }) {
  return <StoreContext.Provider value={store}>{children}</StoreContext.Provider>
}

export function useEventStore(): EventStore {
  const store = useContext(StoreContext)
  if (!store) throw new Error('useEventStore must be used inside <StoreProvider>')
  return store
}

export function useAppState(): AppState {
  const store = useEventStore()
  return useSyncExternalStore((cb) => store.subscribe(cb), () => store.getState())
}
