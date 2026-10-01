/**
 * A12 — Every event except root events has a non-null causedBy; following
 * causedBy from any reaction reaches a root started by a person or by an
 * external notice (the supplier / FDA recall), never by the system itself.
 */
import { describe, expect, it } from 'vitest'
import { holdOrder, pauseOffer, submitCount } from '../../src/actions'
import { ROOT_ACTORS, type DemoEvent } from '../../src/domain/types'
import { s1, s2, s3, type Scenario } from '../../src/scenarios'
import { ACTOR_NAME } from '../../src/ui/describe'
import { Sim } from '../helpers'

function play(sim: Sim, scenario: Scenario) {
  for (const step of scenario.steps) for (const d of step.next(sim.state, { shortShip: true })) sim.do(d)
}

/** Everything the demo can do, in one log: S1, S2, S3, plus count, hold and pause. */
function fullLog(): DemoEvent[] {
  const sim = new Sim()
  play(sim, s1)
  play(sim, s2)
  play(sim, s3)
  const countTask = sim.state.handheld.tasks.find((t) => t.kind === 'COUNT')!
  for (const d of submitCount(sim.state, countTask, { 'SKU-100214': 0 })) sim.do(d)
  sim.do(holdOrder(sim.state.proposals.find((p) => p.id === 'PRP-00010')!))
  sim.do(pauseOffer(sim.offer('OF-3101')))
  return sim.log
}

describe('A12 causality', () => {
  const log = fullLog()
  const byId = new Map(log.map((e, i) => [e.id, { e, i }]))

  it('covers a busy demo', () => {
    expect(log.length).toBeGreaterThan(100)
  })

  it('roots have causedBy null and come from a person or an external notice', () => {
    const roots = log.filter((e) => e.causedBy === null)
    expect(roots.length).toBeGreaterThan(0)
    for (const r of roots) expect(ROOT_ACTORS, `${r.type} by ${r.actor}`).toContain(r.actor)
    expect(roots.some((r) => r.actor === 'external' && r.type === 'RECALL_ISSUED')).toBe(true)
  })

  it('every reaction has a causedBy that points to an earlier event, and is emitted by the system', () => {
    log.forEach((e, i) => {
      if (e.causedBy === null) return
      const parent = byId.get(e.causedBy)
      expect(parent, `${e.id} points to a missing event`).toBeDefined()
      expect(parent!.i).toBeLessThan(i)
      expect(e.actor).toBe('system')
    })
  })

  it('following causedBy from any reaction reaches a person or an external notice', () => {
    for (const e of log) {
      let cur = e
      let hops = 0
      while (cur.causedBy !== null) {
        cur = byId.get(cur.causedBy)!.e
        if (++hops > 50) throw new Error(`cycle from ${e.id}`)
      }
      expect(ROOT_ACTORS, `${e.type} traces to ${cur.actor}`).toContain(cur.actor)
    }
  })

  it('the recall root is labelled as an external notice', () => {
    expect(ACTOR_NAME.external).toBe('Supplier / FDA notice')
  })
})
