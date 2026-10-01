/**
 * A15 — Rules are pure: running the same event on the same state twice gives
 * identical output. Covers the event pipeline (applyEvent, step, dispatch, replay)
 * for every event type, and every rule in the registry automatically.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { AppState, DemoEvent, EventDraft, EventType, Rule } from '../../src/domain/types'
import { rules } from '../../src/rules'
import { buildSeedState } from '../../src/seed/loadSeed'
import { childEvent, dispatch, MAX_EVENTS_PER_DISPATCH, replay, step } from '../../src/store/dispatch'
import { deepFreeze, sampleDrafts } from '../helpers'

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
  const cases = rules.flatMap((rule) => rule.on.map((type) => [rule.id, type, rule] as const))

  it('every registered rule listens to known event types', () => {
    for (const rule of rules) for (const type of rule.on) expect(types).toContain(type)
  })

  it.skipIf(cases.length === 0).each(cases)('rule %s on %s: same input twice → identical output, input untouched', (_id, type, rule) => {
    forbidClockAndRandom()
    const event = deepFreeze(asRoot(drafts[type]))
    const before = structuredClone(seed)
    expect(rule.run(seed, event)).toEqual(rule.run(seed, event))
    expect(seed).toEqual(before)
  })
})
