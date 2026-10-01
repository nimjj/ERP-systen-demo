/** A7 — Pausing the offer removes the till rule, removes uplift, and lowers the proposal. */
import { describe, expect, it } from 'vitest'
import { ofType, pauseOffer, publishOffer, sale, Sim, YOGURT } from '../helpers'

describe('A7 offer paused', () => {
  it('till rule off, uplift gone, yogurt back from 12 to 6', () => {
    const sim = new Sim()
    sim.do(publishOffer())
    const live = sim.proposal(YOGURT).proposedQty
    sim.do(pauseOffer())

    expect(sim.offer('OF-3101').status).toBe('Paused')
    expect(sim.state.till.rules.find((r) => r.id === 'R-BP-801')!.status).toBe('inactive')
    const y = sim.proposal(YOGURT)
    expect(y.uplift).toBe(0)
    expect(y.proposedQty).toBeLessThan(live)
    expect(y.proposedQty).toBe(6)
    expect(y.exceptions).toEqual([])
    expect(y.status).toBe('AUTO_RELEASED')
  })

  it('clears an open stock risk', () => {
    const sim = new Sim()
    sim.do(publishOffer())
    for (let i = 0; i < 10; i++) sim.do(sale([{ sku: YOGURT, qty: 1 }]))
    expect(sim.state.stockRisks).toHaveLength(1)
    const events = sim.do(pauseOffer())
    expect(ofType(events, 'STOCK_RISK_CLEARED')).toHaveLength(1)
    expect(sim.state.stockRisks).toEqual([])
  })

  it('publish then pause returns the yogurt proposal to its seed values', () => {
    const sim = new Sim()
    const seedProposal = sim.proposal(YOGURT)
    sim.do(publishOffer())
    sim.do(pauseOffer())
    expect(sim.proposal(YOGURT)).toEqual(seedProposal)
  })
})
