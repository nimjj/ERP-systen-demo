/** A10 — COUNT_SUBMITTED eggs 19 → 0 creates a COUNT_VARIANCE of −19 and clears PHANTOM_SUSPECTED (SPEC §13.4: −19, not −30). */
import { describe, expect, it } from 'vitest'
import { ofType, Sim } from '../helpers'

const EGGS = 'SKU-100214'
const count = (actualQty: number) => ({ type: 'COUNT_SUBMITTED' as const, actor: 'aisha' as const, payload: { countId: 'CNT-44821', lines: [{ sku: EGGS, systemQty: 19, actualQty }] } })

describe('A10 count variance', () => {
  it('eggs found 0: variance −19, phantom cleared, order recomputed to the if-empty quantity', () => {
    const sim = new Sim()
    expect(sim.proposal(EGGS).exceptions.map((e) => e.code)).toEqual(['PHANTOM_SUSPECTED'])
    const ifEmpty = sim.proposal(EGGS).ifEmptyQty
    const events = sim.do(count(0))

    const [variance] = ofType(events, 'STOCK_CHANGED')
    expect(variance.payload).toMatchObject({ sku: EGGS, delta: -19, reason: 'COUNT_VARIANCE', onHand: 0, shelf: 0 })
    expect(sim.position(EGGS)).toMatchObject({ onHand: 0, shelf: 0, backRoom: 0 })
    expect(sim.position(EGGS).flags).toContain('PHANTOM_CORRECTED')

    const p = sim.proposal(EGGS)
    expect(p.exceptions.map((e) => e.code)).not.toContain('PHANTOM_SUSPECTED')
    expect(p.proposedQty).toBe(ifEmpty) // 48, as the phantom explanation promised
    expect(p.onHand).toBe(0)
    expect(sim.state.notifications.some((n) => n.role === 'priya' && n.text.includes('found 0'))).toBe(true)
  })

  it('a count that confirms the system stock still clears the phantom flag, with no stock event', () => {
    const sim = new Sim()
    const events = sim.do(count(19))
    expect(ofType(events, 'STOCK_CHANGED')).toEqual([])
    expect(sim.proposal(EGGS).exceptions).toEqual([])
    expect(sim.proposal(EGGS).status).toBe('AUTO_RELEASED')
  })

  it('found more than the system: the extra goes on the shelf', () => {
    const sim = new Sim()
    sim.do(count(25))
    expect(sim.position(EGGS)).toMatchObject({ onHand: 25, shelf: 25 })
  })
})
