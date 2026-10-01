/** A6 — DELIVERY_RECEIVED with received < expected creates exactly one claim, value = shortQty × unit cost, and increases onHand by received only. */
import { describe, expect, it } from 'vitest'
import { demoTuning } from '../../src/config/demoTuning'
import { approve, ofType, receive, Sim, YOGURT } from '../helpers'

function approvedSim() {
  const sim = new Sim()
  sim.do(approve('PRP-00001', demoTuning.shortShip.defaultExpected))
  const inbound = sim.state.inbound.find((i) => i.id === 'IN-PRP-00001-1')!
  return { sim, inbound }
}

describe('A6 short delivery', () => {
  it('one claim worth shortQty × unit cost; onHand rises by the received quantity only', () => {
    const { sim, inbound } = approvedSim()
    const onHandBefore = sim.position(YOGURT).onHand
    const claimsBefore = sim.state.claims.length
    const { defaultExpected, defaultReceived } = demoTuning.shortShip

    const events = sim.do(receive(inbound.id, defaultExpected, defaultReceived))

    const claims = ofType(events, 'CLAIM_RAISED')
    expect(claims).toHaveLength(1)
    expect(claims[0].payload).toMatchObject({ supplierId: 'SUP-PRAIRIE', sku: YOGURT, shortQty: 4, value: 16.68 }) // 4 × $4.17
    expect(sim.state.claims).toHaveLength(claimsBefore + 1)
    expect(sim.state.claims.at(-1)).toMatchObject({ id: claims[0].payload.claimId, status: 'Draft', raisedInDemo: true, shortQty: 4 })

    expect(sim.position(YOGURT).onHand).toBe(onHandBefore + defaultReceived)
    expect(sim.state.inbound.find((i) => i.id === inbound.id)).toMatchObject({ status: 'RECEIVED', receivedQty: 8 })
    expect(sim.state.handheld.tasks.find((t) => t.ref === inbound.id)!.status).toBe('DONE')
    expect(sim.state.notifications.some((n) => n.role === 'priya' && n.text.includes(claims[0].payload.claimId))).toBe(true)
  })

  it('claim ids continue the data sequence', () => {
    const { sim, inbound } = approvedSim()
    sim.do(receive(inbound.id, 12, 8))
    expect(sim.state.claims.at(-1)!.id).toBe('CLM-5223')
  })

  it('the claim flags only the short item with SUPPLIER_CONSTRAINT; the gap re-opens', () => {
    const { sim, inbound } = approvedSim()
    const afterApproval = sim.proposal(YOGURT).proposedQty
    sim.do(receive(inbound.id, 12, 8))
    const y = sim.proposal(YOGURT)
    expect(y.exceptions.map((e) => e.code)).toContain('SUPPLIER_CONSTRAINT')
    expect(y.status).toBe('PENDING_REVIEW')
    // stock arrived but 4 units never will: the order no longer covers S
    expect(y.inTransit).toBe(6)
    expect(y.proposedQty).toBeGreaterThanOrEqual(afterApproval)
    const otherPrairie = sim.state.proposals.filter((p) => p.supplierId === 'SUP-PRAIRIE' && p.itemId !== YOGURT)
    expect(otherPrairie.map((p) => p.itemId).sort()).toEqual(['SKU-100207', 'SKU-100214', 'SKU-100249'])
    expect(otherPrairie.some((p) => p.exceptions.some((e) => e.code === 'SUPPLIER_CONSTRAINT'))).toBe(false)
    expect(sim.state.proposals.filter((p) => p.status === 'PENDING_REVIEW')).toHaveLength(4) // strawberries, cola, eggs + yogurt
  })

  it('S1: with the offer live, a short receipt re-opens the gap by one case (SPEC §9)', () => {
    const sim = new Sim()
    sim.do({ type: 'OFFER_PUBLISHED', actor: 'emily', payload: { offerId: 'OF-3101', items: [YOGURT], storeIds: ['US-DFW-1101'] } })
    for (let i = 0; i < 11; i++) sim.do({ type: 'SALE_COMPLETED', actor: 'jamal', payload: { txnId: `S${i}`, memberId: null, lines: [{ sku: YOGURT, qty: 1, price: 5.98, promoApplied: [] }], total: 5.98, tax: 0, tender: 'Card' } })
    sim.do(approve('PRP-00001', 24))
    expect(sim.proposal(YOGURT).proposedQty).toBe(0)
    sim.do(receive('IN-PRP-00001-1', 24, 20))
    expect(sim.proposal(YOGURT).proposedQty).toBe(6)
  })

  it('a full delivery raises no claim', () => {
    const { sim, inbound } = approvedSim()
    const events = sim.do(receive(inbound.id, 12, 12))
    expect(ofType(events, 'CLAIM_RAISED')).toEqual([])
    expect(sim.position(YOGURT).onHand).toBe(17 + 12)
  })
})
