/**
 * A15 — Rules are pure: running the same event on the same state twice gives
 * identical output. Covers the event pipeline (applyEvent, step, dispatch, replay)
 * for every event type, and every rule in the registry automatically.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { AppState, DemoEvent, EventDraft, EventType, Rule } from '../../src/domain/types'
import { rules } from '../../src/rules'
import { buildSeedState } from '../../src/seed/loadSeed'
import { applyEvent, childEvent, dispatch, MAX_EVENTS_PER_DISPATCH, replay, step } from '../../src/store/dispatch'
import { approve, deepFreeze, MARIA, publishOffer, sale, sampleDrafts, Sim, YOGURT } from '../helpers'

const asRoot = (draft: EventDraft, id = 'root-1'): DemoEvent => ({ id, ts: '2026-09-28T14:35:00.000Z', causedBy: null, ...draft }) as DemoEvent

/** Any use of the clock or randomness inside the pipeline fails the test. */
function forbidClockAndRandom() {
  const boom = () => {
    throw new Error('rules must not use Date or Math.random')
  }
  vi.spyOn(Date, 'now').mockImplementation(boom)
  vi.spyOn(Math, 'random').mockImplementation(boom)
}
afterEach(() => vi.restoreAllMocks())

const seed = deepFreeze(buildSeedState())
const drafts = sampleDrafts(seed)
const types = Object.keys(drafts) as EventType[]

describe('A15 purity — pipeline', () => {
  it.each(types)('step(%s) is deterministic and never mutates its input', (type) => {
    forbidClockAndRandom()
    const event = deepFreeze(asRoot(drafts[type]))
    const before = structuredClone(seed)
    const a = step(seed, event, rules)
    const b = step(seed, event, rules)
    expect(a).toEqual(b)
    expect(seed).toEqual(before)
  })

  it('dispatch of the same root on the same state twice gives identical events and state', () => {
    forbidClockAndRandom()
    for (const type of types) {
      const root = deepFreeze(asRoot(drafts[type], `root-${type}`))
      expect(dispatch(seed, root, rules)).toEqual(dispatch(seed, root, rules))
    }
  })

  it('replaying a dispatched log reproduces the dispatched state exactly', () => {
    let state: AppState = seed
    const log: DemoEvent[] = []
    types.forEach((type, i) => {
      const out = dispatch(state, asRoot(drafts[type], `root-${i}`), rules)
      state = out.state
      log.push(...out.events)
    })
    expect(replay(seed, log, rules)).toEqual(state)
  })

  it('follow-on events get deterministic ids, the parent ts, and causedBy = parent', () => {
    const toyRule: Rule = {
      id: 'toy',
      on: ['SHELF_REFILLED'],
      run: (state) => ({ state, newEvents: [drafts.NOTIFICATION_ADDED, drafts.NOTIFICATION_ADDED] }),
    }
    const root = asRoot(drafts.SHELF_REFILLED, 'r')
    const { events } = dispatch(seed, root, [toyRule])
    expect(events.map((e) => [e.id, e.causedBy, e.ts])).toEqual([
      ['r', null, root.ts],
      ['r.1', 'r', root.ts],
      ['r.2', 'r', root.ts],
    ])
    expect(childEvent(root, drafts.NOTIFICATION_ADDED, 0).id).toBe('r.1')
  })

  it('a rule loop is stopped instead of hanging the demo', () => {
    const loop: Rule = { id: 'loop', on: ['NOTIFICATION_ADDED'], run: (state) => ({ state, newEvents: [drafts.NOTIFICATION_ADDED] }) }
    expect(() => dispatch(seed, asRoot(drafts.NOTIFICATION_ADDED), [loop])).toThrow(String(MAX_EVENTS_PER_DISPATCH))
  })
})

describe('A15 purity — registered rules', () => {
  /** Fixture states where the rules have something to do: seed, and mid-S1 (offer live, stock sold down with a stock risk open, an order in transit). */
  const busy = (() => {
    const sim = new Sim()
    sim.do(publishOffer())
    for (let i = 0; i < 10; i++) sim.do(sale([{ sku: YOGURT, qty: 1 }], i === 0 ? MARIA : null))
    sim.do(approve('PRP-00001', 12))
    return deepFreeze(sim.state)
  })()

  it('the busy fixture really is busy', () => {
    expect(busy.stockRisks).toHaveLength(1)
    expect(busy.inbound.some((i) => i.id === 'IN-PRP-00001-1' && i.status === 'IN_TRANSIT')).toBe(true)
  })
  const fixtures: [string, AppState][] = [
    ['seed', seed],
    ['busy', busy],
  ]
  const busyDrafts = sampleDrafts(busy)
  const cases = rules.flatMap((rule) => rule.on.flatMap((type) => fixtures.map(([name, state]) => [rule.id, type, name, rule, state] as const)))

  it('every registered rule listens to known event types', () => {
    for (const rule of rules) for (const type of rule.on) expect(types).toContain(type)
  })

  it('the registry holds C1–C9', () => {
    expect(rules.map((r) => r.id.split('-')[0])).toEqual(expect.arrayContaining(['C1', 'C2', 'C3', 'C4', 'C5', 'C6', 'C7', 'C8', 'C9']))
  })

  it.each(cases)('rule %s on %s (%s state): same input twice → identical output, input untouched', (_id, type, fixture, rule, state) => {
    forbidClockAndRandom()
    const draft = fixture === 'busy' ? busyDrafts[type] : drafts[type]
    const prepared = deepFreeze(applyEvent(state, deepFreeze(asRoot(draft))))
    const event = prepared.events[prepared.events.length - 1]
    const before = structuredClone(prepared)
    const a = rule.run(prepared, event)
    const b = rule.run(prepared, event)
    expect(a).toEqual(b)
    expect(prepared).toEqual(before)
  })

  it('every rule actually does something in at least one fixture (the purity check is not vacuous)', () => {
    for (const rule of rules) {
      const acted = rule.on.some((type) =>
        fixtures.some(([name, state]) => {
          const draft = name === 'busy' ? busyDrafts[type] : drafts[type]
          const prepared = applyEvent(state, asRoot(draft))
          const out = rule.run(prepared, prepared.events[prepared.events.length - 1])
          return out.newEvents.length > 0 || out.state !== prepared
        }),
      )
      expect(acted, rule.id).toBe(true)
    }
  })
})
