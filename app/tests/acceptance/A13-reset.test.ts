/** A13 — Reset restores seed exactly (deep-equal). */
import { describe, expect, it } from 'vitest'
import { rules } from '../../src/rules'
import { buildSeedState, seedHash } from '../../src/seed/loadSeed'
import { LocalEventStore } from '../../src/store/localEventStore'
import { LOG_KEY, saveLog } from '../../src/store/persistence'
import positionsJson from '../../../seed/positions.json'
import proposalsJson from '../../../seed/proposals.json'
import { MemoryStorage, note } from '../helpers'

const makeStore = (storage = new MemoryStorage()) =>
  new LocalEventStore({ buildSeed: buildSeedState, seedHash, rules, storage, clientId: 'a13' })

describe('A13 reset', () => {
  it('seed state is built from seed/*.json and is identical on every build', () => {
    const a = buildSeedState()
    const b = buildSeedState()
    expect(a).toEqual(b)
    expect(a).not.toBe(b)
    expect(a.positions).toEqual(positionsJson)
    expect(a.proposals).toEqual(proposalsJson)
    expect(a.events).toEqual([])
    expect(a.notifications).toEqual([])
  })

  it('reset after activity deep-equals the seed and clears the persisted log', () => {
    const storage = new MemoryStorage()
    const store = makeStore(storage)
    store.append(note('one'))
    store.append(note('two'))
    expect(store.getEvents()).toHaveLength(2)
    expect(store.getState()).not.toEqual(buildSeedState())

    store.reset()

    expect(store.getState()).toEqual(buildSeedState())
    expect(makeStore(storage).getState()).toEqual(buildSeedState())
  })

  it('a reset state is not shared with the next run (mutating a copy cannot leak)', () => {
    const store = makeStore()
    store.reset()
    const copy = structuredClone(store.getState())
    copy.positions['SKU-100221'].onHand = -999
    store.reset()
    expect(store.getState().positions['SKU-100221'].onHand).toBe(17)
  })

  it('a persisted log is replayed on load', () => {
    const storage = new MemoryStorage()
    const first = makeStore(storage)
    first.append(note('kept'))
    const second = makeStore(storage)
    expect(second.getState()).toEqual(first.getState())
  })

  it('a log saved against a different seed is ignored', () => {
    const storage = new MemoryStorage()
    const other = makeStore(new MemoryStorage())
    other.append(note('from an older seed'))
    saveLog(storage, 'not-the-current-seed', other.getEvents(), LOG_KEY)
    expect(makeStore(storage).getState()).toEqual(buildSeedState())
  })

  it('a corrupt log is ignored', () => {
    const storage = new MemoryStorage()
    storage.setItem(LOG_KEY, '{not json')
    expect(makeStore(storage).getState()).toEqual(buildSeedState())
  })
})
