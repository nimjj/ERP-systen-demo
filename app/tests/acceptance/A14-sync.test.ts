/** A14 — Two windows: an event in window 1 appears in window 2 within 1 second. */
import { afterEach, describe, expect, it } from 'vitest'
import { demoTuning } from '../../src/config/demoTuning'
import { rules } from '../../src/rules'
import { buildSeedState, seedHash } from '../../src/seed/loadSeed'
import type { KeyValueStorage, SyncTransport } from '../../src/store/EventStore'
import { LocalEventStore, type ScenarioSetups } from '../../src/store/localEventStore'
import { BroadcastChannelTransport, StorageEventTransport } from '../../src/store/transports'
import { FakeBrowser, MemoryStorage, note, waitFor } from '../helpers'

const opened: LocalEventStore[] = []
afterEach(() => {
  while (opened.length) opened.pop()!.dispose()
})

function openWindow(clientId: string, transport: SyncTransport, storage: KeyValueStorage = new MemoryStorage(), extra: { scenarios?: ScenarioSetups } = {}) {
  const store = new LocalEventStore({ buildSeed: buildSeedState, seedHash, rules, storage, transport, clientId, ...extra })
  opened.push(store)
  return store
}

const budget = demoTuning.syncBudgetMs

describe('A14 cross-tab sync — BroadcastChannel', () => {
  const channel = () => `jh-test-${Math.random().toString(36).slice(2)}`

  it('an event appended in window 1 reaches window 2 within the budget, with identical state', async () => {
    const name = channel()
    const w1 = openWindow('w1', new BroadcastChannelTransport(name))
    const w2 = openWindow('w2', new BroadcastChannelTransport(name))

    const appended = w1.append(note('hello from window 1'))
    const elapsed = await waitFor(() => w2.getEvents().length === appended.length, budget)

    expect(elapsed).toBeLessThan(budget)
    expect(w2.getEvents()).toEqual(w1.getEvents())
    expect(w2.getState()).toEqual(w1.getState())
  })

  it('works in both directions and keeps one shared log', async () => {
    const name = channel()
    const w1 = openWindow('w1', new BroadcastChannelTransport(name))
    const w2 = openWindow('w2', new BroadcastChannelTransport(name))

    w1.append(note('from 1'))
    await waitFor(() => w2.getEvents().length === 1, budget)
    w2.append(note('from 2'))
    await waitFor(() => w1.getEvents().length === 2, budget)

    expect(w1.getEvents().map((e) => e.id)).toEqual(w2.getEvents().map((e) => e.id))
    expect(w1.getState()).toEqual(w2.getState())
  })

  it('subscribers in window 2 are notified', async () => {
    const name = channel()
    const w1 = openWindow('w1', new BroadcastChannelTransport(name))
    const w2 = openWindow('w2', new BroadcastChannelTransport(name))
    let calls = 0
    w2.subscribe(() => calls++)
    w1.append(note('ping'))
    await waitFor(() => calls > 0, budget)
    expect(calls).toBe(1)
  })

  it('reset in one window resets every window', async () => {
    const name = channel()
    const w1 = openWindow('w1', new BroadcastChannelTransport(name))
    const w2 = openWindow('w2', new BroadcastChannelTransport(name))
    w1.append(note('before reset'))
    await waitFor(() => w2.getEvents().length === 1, budget)

    w2.reset()
    await waitFor(() => w1.getEvents().length === 0, budget)

    expect(w1.getState()).toEqual(buildSeedState())
    expect(w2.getState()).toEqual(buildSeedState())
  })

  it('reset with a scenario: setup events reach every window', async () => {
    const name = channel()
    const registry: ScenarioSetups = { demo: { setup: [note('setup 1'), note('setup 2')] } }
    const w1 = openWindow('w1', new BroadcastChannelTransport(name), new MemoryStorage(), { scenarios: registry })
    const w2 = openWindow('w2', new BroadcastChannelTransport(name), new MemoryStorage(), { scenarios: registry })
    w2.append(note('stale'))
    await waitFor(() => w1.getEvents().length === 1, budget)

    w1.reset('demo')
    await waitFor(() => w2.getEvents().length === 2 && w2.getEvents()[0].id === w1.getEvents()[0].id, budget)

    expect(w2.getState()).toEqual(w1.getState())
  })
})

describe('A14 cross-tab sync — Presenter Back (truncate)', () => {
  it('truncating in one window rolls every window back to the same state', async () => {
    const name = `jh-test-${Math.random().toString(36).slice(2)}`
    const w1 = openWindow('w1', new BroadcastChannelTransport(name))
    const w2 = openWindow('w2', new BroadcastChannelTransport(name))
    w1.append(note('step 1'))
    const keep = w1.getEvents().length
    const atMark = w1.getState()
    w1.append(note('step 2'))
    await waitFor(() => w2.getEvents().length === 2, budget)

    w1.truncate(keep)
    await waitFor(() => w2.getEvents().length === keep, budget)

    expect(w1.getState()).toEqual(atMark)
    expect(w2.getState()).toEqual(atMark)
  })
})

describe('A14 cross-tab sync — localStorage fallback', () => {
  it('an event appended in window 1 reaches window 2 within the budget via storage events', async () => {
    const browser = new FakeBrowser()
    const a = browser.openWindow()
    const b = browser.openWindow()
    const w1 = openWindow('w1', new StorageEventTransport(a.storage, a), a.storage)
    const w2 = openWindow('w2', new StorageEventTransport(b.storage, b), b.storage)

    w1.append(note('via storage'))
    const elapsed = await waitFor(() => w2.getEvents().length === 1, budget)

    expect(elapsed).toBeLessThan(budget)
    expect(w2.getState()).toEqual(w1.getState())
  })

  it('a window opened later loads the shared log from storage', () => {
    const browser = new FakeBrowser()
    const a = browser.openWindow()
    const w1 = openWindow('w1', new StorageEventTransport(a.storage, a), a.storage)
    w1.append(note('one'))
    w1.append(note('two'))

    const b = browser.openWindow()
    const late = openWindow('late', new StorageEventTransport(b.storage, b), b.storage)
    expect(late.getState()).toEqual(w1.getState())
  })
})
