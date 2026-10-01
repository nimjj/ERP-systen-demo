/** Refill (C13, SPEC S1 step 4): back room → shelf, onHand unchanged, till and planner unaffected. */
import { describe, expect, it } from 'vitest'
import { ofType, publishOffer, sale, Sim, YOGURT } from '../helpers'

const refill = (qty: number) => ({ type: 'SHELF_REFILLED' as const, actor: 'aisha' as const, payload: { sku: YOGURT, qty } })

describe('Refill (C13)', () => {
  it('moves stock from the back room to the shelf with a MOVE event', () => {
    const sim = new Sim()
    const before = sim.proposal(YOGURT)
    const events = sim.do(refill(8))
    const [move] = ofType(events, 'STOCK_CHANGED')
    expect(move.payload).toEqual({ sku: YOGURT, delta: 0, reason: 'MOVE', onHand: 17, shelf: 17, backRoom: 0 })
    expect(sim.position(YOGURT)).toMatchObject({ onHand: 17, shelf: 17, backRoom: 0 })
    expect(sim.proposal(YOGURT)).toEqual(before)
    expect(ofType(events, 'PROPOSAL_RECOMPUTED')).toEqual([])
  })

  it('S1 step 4: after the sales the shelf is empty; refill moves the 6 left in the back room', () => {
    const sim = new Sim()
    sim.do(publishOffer())
    for (let i = 0; i < 11; i++) sim.do(sale([{ sku: YOGURT, qty: 1 }]))
    expect(sim.position(YOGURT)).toMatchObject({ onHand: 6, shelf: 0, backRoom: 6 })
    sim.do(refill(6))
    expect(sim.position(YOGURT)).toMatchObject({ onHand: 6, shelf: 6, backRoom: 0 })
    expect(sim.state.stockRisks).toHaveLength(1) // cover is about stock on hand, not where it sits
  })

  it('never moves more than the back room holds', () => {
    const sim = new Sim()
    sim.do(refill(50))
    expect(sim.position(YOGURT)).toMatchObject({ shelf: 17, backRoom: 0 })
  })
})
