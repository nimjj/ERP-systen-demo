/**
 * Cross-tab sync. BroadcastChannel when available; otherwise a localStorage
 * "bus" key whose `storage` events reach the other windows of the same origin.
 */
import type { KeyValueStorage, SyncMessage, SyncTransport } from './EventStore'

export const CHANNEL_NAME = 'jh-connected-demo'
export const BUS_KEY = 'jh-connected-demo:bus'

export class BroadcastChannelTransport implements SyncTransport {
  private readonly channel: BroadcastChannel

  constructor(name: string = CHANNEL_NAME) {
    this.channel = new BroadcastChannel(name)
  }

  post(message: SyncMessage): void {
    this.channel.postMessage(message)
  }

  subscribe(handler: (message: SyncMessage) => void): () => void {
    const listener = (e: MessageEvent) => handler(e.data as SyncMessage)
    this.channel.addEventListener('message', listener)
    return () => this.channel.removeEventListener('message', listener)
  }

  close(): void {
    this.channel.close()
  }
}

/** Minimal shape of a `storage` event and its target (window), so tests can fake them. */
export interface StorageEventLike {
  key: string | null
  newValue: string | null
}
export interface StorageEventSource {
  addEventListener(type: 'storage', listener: (e: StorageEventLike) => void): void
  removeEventListener(type: 'storage', listener: (e: StorageEventLike) => void): void
}

export class StorageEventTransport implements SyncTransport {
  private seq = 0

  constructor(
    private readonly storage: KeyValueStorage,
    private readonly source: StorageEventSource,
    private readonly key: string = BUS_KEY,
  ) {}

  post(message: SyncMessage): void {
    // The nonce makes every write a change, so a storage event always fires.
    this.storage.setItem(this.key, JSON.stringify({ nonce: `${message.from}:${++this.seq}`, message }))
  }

  subscribe(handler: (message: SyncMessage) => void): () => void {
    const listener = (e: StorageEventLike) => {
      if (e.key !== this.key || !e.newValue) return
      try {
        handler((JSON.parse(e.newValue) as { message: SyncMessage }).message)
      } catch {
        // ignore malformed bus writes
      }
    }
    this.source.addEventListener('storage', listener)
    return () => this.source.removeEventListener('storage', listener)
  }

  close(): void {}
}

export function createBrowserTransport(): SyncTransport | null {
  if (typeof BroadcastChannel !== 'undefined') return new BroadcastChannelTransport()
  if (typeof window !== 'undefined' && safeLocalStorage()) {
    return new StorageEventTransport(safeLocalStorage()!, window as unknown as StorageEventSource)
  }
  return null
}

export function safeLocalStorage(): KeyValueStorage | null {
  try {
    if (typeof localStorage === 'undefined') return null
    const probe = '__jh_probe__'
    localStorage.setItem(probe, '1')
    localStorage.removeItem(probe)
    return localStorage
  } catch {
    return null
  }
}
