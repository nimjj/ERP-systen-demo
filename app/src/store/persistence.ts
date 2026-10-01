/**
 * Persists the event log (not the state) in localStorage. State is always
 * rebuilt by replaying the log over the seed. A log written against a different
 * seed is discarded.
 */
import type { DemoEvent } from '../domain/types'
import type { KeyValueStorage } from './EventStore'

export const LOG_KEY = 'jh-connected-demo:log'
const VERSION = 1

interface PersistedLog {
  version: number
  seedHash: string
  events: DemoEvent[]
}

export function loadLog(storage: KeyValueStorage | null, seedHash: string, key: string = LOG_KEY): DemoEvent[] {
  if (!storage) return []
  try {
    const raw = storage.getItem(key)
    if (!raw) return []
    const parsed = JSON.parse(raw) as PersistedLog
    if (parsed.version !== VERSION || parsed.seedHash !== seedHash || !Array.isArray(parsed.events)) return []
    return parsed.events
  } catch {
    return []
  }
}

export function saveLog(storage: KeyValueStorage | null, seedHash: string, events: readonly DemoEvent[], key: string = LOG_KEY): void {
  if (!storage) return
  try {
    const data: PersistedLog = { version: VERSION, seedHash, events: [...events] }
    storage.setItem(key, JSON.stringify(data))
  } catch {
    // Storage full or blocked: the demo keeps running in memory.
  }
}
