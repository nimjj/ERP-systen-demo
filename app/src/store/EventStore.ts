/**
 * EventStore — the one place state lives. Panes read state and append events;
 * they never write state directly. Implementations: LocalEventStore (browser,
 * localStorage + cross-tab sync). An optional SSE adapter can implement the same
 * interface later (CLAUDE.md); the demo must not depend on it.
 */
import type { AppState, DemoEvent, EventDraft } from '../domain/types'

export interface EventStore {
  readonly clientId: string
  getState(): AppState
  getEvents(): readonly DemoEvent[]
  /** Dispatch a root event (human or presenter action) and all its reactions. Returns every event appended. */
  append(draft: EventDraft): DemoEvent[]
  /** Called with the new state after every change (local or from another window). */
  subscribe(listener: (state: AppState) => void): () => void
  /** Rebuild state from seed + the given log (used on load). */
  replay(events: readonly DemoEvent[]): void
  /** Back to seed in every open window; then run the scenario's setup events, if any. */
  reset(scenarioId?: string): void
  /** Keep only the first `length` events, in every open window (Presenter "Back"). */
  truncate(length: number): void
  dispose(): void
}

/** Messages between windows. */
export type SyncMessage =
  | { kind: 'events'; from: string; events: DemoEvent[] }
  | { kind: 'reset'; from: string }
  | { kind: 'truncate'; from: string; length: number }

export interface SyncTransport {
  post(message: SyncMessage): void
  subscribe(handler: (message: SyncMessage) => void): () => void
  close(): void
}

/** The subset of the Web Storage API we use; tests pass an in-memory version. */
export interface KeyValueStorage {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
  removeItem(key: string): void
}
