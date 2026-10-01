/** A3 — Member yogurt sale with OF-3101 live: POINTS_AWARDED includes the bonus; redeemed +1; funding +$1.00. */
import { describe, expect, it } from 'vitest'
import { MARIA, ofType, publishOffer, sale, Sim, YOGURT } from '../helpers'

describe('A3 member points and offer counters', () => {
  it('awards base + 200 bonus to Maria (Gold) and ticks OF-3101', () => {
    const sim = new Sim()
    sim.do(publishOffer())
    const offerBefore = { ...sim.offer('OF-3101') }
    const pointsBefore = sim.state.till.members.find((m) => m.id === MARIA)!.points

    const events = sim.do(sale([{ sku: YOGURT, qty: 1 }], MARIA))
    const [awarded] = ofType(events, 'POINTS_AWARDED')

    // floor(5.98 × 1.5) = 8 base + 200 bonus
    expect(awarded.payload.points).toBe(208)
    expect(awarded.payload.reasons).toContainEqual(expect.objectContaining({ ruleId: 'R-BP-801', offerId: 'OF-3101', points: 200, qty: 1 }))
    expect(sim.state.till.members.find((m) => m.id === MARIA)!.points).toBe(pointsBefore + 208)

    const offer = sim.offer('OF-3101')
    expect(offer.redeemed - offerBefore.redeemed).toBe(1)
    expect(offer.incrementalSalesUsd - offerBefore.incrementalSalesUsd).toBeCloseTo(5.98, 2)
    expect(offer.vendorPaidUsd - offerBefore.vendorPaidUsd).toBeCloseTo(1.0, 2)
    expect(pointsBefore).toBe(8420)
  })

  it('no bonus while the offer is still a draft', () => {
    const sim = new Sim()
    const [awarded] = ofType(sim.do(sale([{ sku: YOGURT, qty: 1 }], MARIA)), 'POINTS_AWARDED')
    expect(awarded.payload.points).toBe(8)
    expect(sim.offer('OF-3101').redeemed).toBe(0)
  })

  it('bonus is per unit: two yogurts → 400 bonus, redeemed +2', () => {
    const sim = new Sim()
    sim.do(publishOffer())
    const [awarded] = ofType(sim.do(sale([{ sku: YOGURT, qty: 2 }], MARIA)), 'POINTS_AWARDED')
    expect(awarded.payload.reasons.find((r) => r.ruleId === 'R-BP-801')!.points).toBe(400)
    expect(sim.offer('OF-3101').redeemed).toBe(2)
  })

  it('non-member sale awards nothing', () => {
    const sim = new Sim()
    sim.do(publishOffer())
    expect(ofType(sim.do(sale([{ sku: YOGURT, qty: 1 }])), 'POINTS_AWARDED')).toEqual([])
    expect(sim.offer('OF-3101').redeemed).toBe(0)
  })
})
