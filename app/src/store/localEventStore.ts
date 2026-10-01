/**
 * Browser EventStore: in-memory state, event log persisted to localStorage,
 * changes shared with other windows through a SyncTransport.
 *
 * - append(): dispatches locally (rules run here only), persists, broadcasts the
 *   resulting events. Receivers apply them with step() and never re-run rule
 *   output, so every window holds the same log and the same state.
 * - reset(): back to seed here and in every other window, then the scenario's
 *   setup events are appended (and broadcast) like any other events.
 */
import type { AppState, DemoEvent, EventDraft, Rule } from '../domain/types'
import type { ScenarioRegistry } from '../scenarios'
import { dispatch, replay as replayLog, step } from './dispatch'
import type { EventStore, KeyValueStorage, SyncMessage, SyncTransport } from './EventStore'
import { LOG_KEY, loadLog, saveLog } from './persistence'

export interface LocalEventStoreOptions {
  buildSeed: () => AppState
  seedHash: string
  rules: readonly Rule[]
  storage?: KeyValueStorage | null
  transport?: SyncTransport | null
  scenarios?: ScenarioRegistry
  /** Identifies this window in event ids and sync messages. */
  clientId?: string
  /** Clock for root events only; rules never see it. */
  now?: () => string
  storageKey?: string
}

export function randomClientId(): string {
  const bytes = new Uint8Array(4)
  globalThis.crypto.getRandomValues(bytes)
  return Array.from(bytes, (b) => (b % 36).toString(36)).join('')
}

export class LocalEventStore implements EventStore {
  readonly clientId: string
  private state: AppState
  private readonly known = new Set<string>()
  private readonly listeners = new Set<(state: AppState) => void>()
  private readonly unsubscribeTransport: (() => void) | null
  private counter = 0
  private readonly opts: Required<Omit<LocalEventStoreOptions, 'transport' | 'storage'>> & {
    transport: SyncTransport | null
    storage: KeyValueStorage | null
  }

  constructor(options: LocalEventStoreOptions) {
    this.opts = {
      scenarios: {},
      clientId: randomClientId(),
      now: () => new Date().toISOString(),
      storageKey: LOG_KEY,
      storage: null,
      transport: null,
      ...options,
    }
    this.clientId = this.opts.clientId
    this.state = this.opts.buildSeed()
    const persisted = loadLog(this.opts.storage, this.opts.seedHash, this.opts.storageKey)
    if (persisted.length > 0) this.replay(persisted)
    this.unsubscribeTransport = this.opts.transport ? this.opts.transport.subscribe((m) => this.onMessage(m)) : null
  }

  getState(): AppState {
    return this.state
  }

  getEvents(): readonly DemoEvent[] {
    return this.state.events
  }

  append(draft: EventDraft): DemoEvent[] {
    const root = {
      id: `e-${this.clientId}-${++this.counter}`,
      ts: this.opts.now(),
      actor: draft.actor,
      type: draft.type,
      payload: draft.payload,
      causedBy: null,
    } as DemoEvent
    const out = dispatch(this.state, root, this.opts.rules)
    this.state = out.state
    for (const e of out.events) this.known.add(e.id)
    this.persist()
    this.opts.transport?.post({ kind: 'events', from: this.clientId, events: out.events })
    this.notify()
    return out.events
  }

  subscribe(listener: (state: AppState) => void): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  replay(events: readonly DemoEvent[]): void {
    this.state = replayLog(this.opts.buildSeed(), events, this.opts.rules)
    this.known.clear()
    for (const e of events) this.known.add(e.id)
    this.notify()
  }

  reset(scenarioId?: string): void {
    this.resetLocal()
    this.opts.transport?.post({ kind: 'reset', from: this.clientId })
    const scenario = scenarioId ? this.opts.scenarios[scenarioId] : undefined
    if (scenarioId && !scenario) console.warn(`Unknown scenario "${scenarioId}"; loaded seed only.`)
    for (const draft of scenario?.setup ?? []) this.append(draft)
  }

  dispose(): void {
    this.unsubscribeTransport?.()
    this.opts.transport?.close()
    this.listeners.clear()
  }

  private resetLocal(): void {
    this.state = this.opts.buildSeed()
    this.known.clear()
    this.persist()
    this.notify()
  }

  private onMessage(message: SyncMessage): void {
    if (message.from === this.clientId) return
    if (message.kind === 'reset') {
      this.resetLocal()
      return
    }
    let changed = false
    for (const e of message.events) {
      if (this.known.has(e.id)) continue
      this.state = step(this.state, e, this.opts.rules).state
      this.known.add(e.id)
      changed = true
    }
    if (!changed) return
    this.persist()
    this.notify()
  }

  private persist(): void {
    saveLog(this.opts.storage, this.opts.seedHash, this.state.events, this.opts.storageKey)
  }

  private notify(): void {
    for (const l of this.listeners) l(this.state)
  }
}
