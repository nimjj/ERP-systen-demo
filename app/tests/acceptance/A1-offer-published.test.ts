/** A1 — Publishing OF-3101 activates the till bonus rule and raises yogurt proposedQty (new > old). */
import { describe, expect, it } from 'vitest'
import { ofType, publishOffer, Sim, YOGURT } from '../helpers'

describe('A1 offer published', () => {
  it('activates R-BP-801 on the till (C1)', () => {
    const sim = new Sim()
    expect(sim.state.till.rules.find((r) => r.id === 'R-BP-801')!.status).toBe('inactive')
    sim.do(publishOffer())
    expect(sim.offer('OF-3101').status).toBe('Live')
    expect(sim.state.till.rules.find((r) => r.id === 'R-BP-801')!.status).toBe('live')
    expect(sim.state.notifications.some((n) => n.role === 'jamal' && n.text.includes('+200 bonus points'))).toBe(true)
  })

  it('raises the yogurt proposal 6 → 12, tags PROMO_UPLIFT and sends it to review (C2, §13.3)', () => {
    const sim = new Sim()
    const before = sim.proposal(YOGURT).proposedQty
    const events = sim.do(publishOffer())
    const after = sim.proposal(YOGURT)

    expect(before).toBe(6)
    expect(after.proposedQty).toBeGreaterThan(before)
    expect(after.proposedQty).toBe(12)
    expect(after.uplift).toBe(0.4)
    expect(after.exceptions.map((e) => e.code)).toEqual(['PROMO_UPLIFT'])
    expect(after.status).toBe('PENDING_REVIEW')

    const [recomputed] = ofType(events, 'PROPOSAL_RECOMPUTED')
    expect(recomputed.payload).toMatchObject({ sku: YOGURT, oldQty: 6, newQty: 12, status: 'PENDING_REVIEW' })
    expect(recomputed.causedBy).toBe(events[0].id)
  })

  it('touches no other proposal', () => {
    const sim = new Sim()
    const before = sim.state.proposals.filter((p) => p.itemId !== YOGURT)
    sim.do(publishOffer())
    expect(sim.state.proposals.filter((p) => p.itemId !== YOGURT)).toEqual(before)
  })
})
