/** A4 — After 10 yogurt sales, proposal qty ≥ before, and STOCK_RISK_RAISED exists for OF-3101 when cover < threshold. */
import { describe, expect, it } from 'vitest'
import { demoTuning } from '../../src/config/demoTuning'
import { MARIA, ofType, publishOffer, sale, Sim, YOGURT } from '../helpers'

describe('A4 stock risk', () => {
  it('10 sales with the offer live: qty rises and one stock risk is raised for OF-3101', () => {
    const sim = new Sim()
    sim.do(publishOffer())
    const before = sim.proposal(YOGURT).proposedQty
    for (let i = 0; i < demoTuning.simulateSales.perClick; i++) sim.do(sale([{ sku: YOGURT, qty: 1 }], i === 0 ? MARIA : null))

    expect(sim.proposal(YOGURT).proposedQty).toBeGreaterThanOrEqual(before)
    expect(sim.proposal(YOGURT).proposedQty).toBe(24) // SPEC §9 sanity bound: ~18–24
    const raised = ofType(sim.log, 'STOCK_RISK_RAISED')
    expect(raised).toHaveLength(1)
    expect(raised[0].payload.offerId).toBe('OF-3101')
    expect(raised[0].payload.coverDays).toBeLessThan(demoTuning.riskCoverDays)
    expect(sim.state.stockRisks).toEqual([expect.objectContaining({ offerId: 'OF-3101', sku: YOGURT })])
    expect(sim.state.notifications.some((n) => n.role === 'emily' && n.severity === 'warning' && n.text.includes('OF-3101'))).toBe(true)
  })

  it('the risk is raised on the first sale that takes cover below the threshold', () => {
    const sim = new Sim()
    sim.do(publishOffer())
    // effective daily = 9.3 × 1.4 = 13.02; cover < 1.0 once onHand ≤ 13 (17 − 4 sales)
    for (let i = 0; i < 3; i++) sim.do(sale([{ sku: YOGURT, qty: 1 }]))
    expect(sim.state.stockRisks).toEqual([])
    sim.do(sale([{ sku: YOGURT, qty: 1 }]))
    expect(sim.state.stockRisks).toHaveLength(1)
  })

  it('no risk without a live offer', () => {
    const sim = new Sim()
    for (let i = 0; i < 10; i++) sim.do(sale([{ sku: YOGURT, qty: 1 }]))
    expect(ofType(sim.log, 'STOCK_RISK_RAISED')).toEqual([])
  })

  it('a receipt that restores cover clears the risk', () => {
    const sim = new Sim()
    sim.do(publishOffer())
    for (let i = 0; i < 10; i++) sim.do(sale([{ sku: YOGURT, qty: 1 }]))
    const inbound = sim.state.inbound.find((i) => i.sku === YOGURT)!
    sim.do({ type: 'DELIVERY_RECEIVED', actor: 'aisha', payload: { inboundId: inbound.id, expectedQty: 6, receivedQty: 6 } })
    // 7 + 6 = 13 → cover 0.998, still at risk
    expect(sim.state.stockRisks).toHaveLength(1)
    sim.do({ type: 'ORDER_APPROVED', actor: 'priya', payload: { proposalId: sim.proposal(YOGURT).id, qty: 24 } })
    const ordered = sim.state.inbound.find((i) => i.id.startsWith('IN-PRP-00001'))!
    sim.do({ type: 'DELIVERY_RECEIVED', actor: 'aisha', payload: { inboundId: ordered.id, expectedQty: 24, receivedQty: 24 } })
    expect(sim.state.stockRisks).toEqual([])
    expect(ofType(sim.log, 'STOCK_RISK_CLEARED')).toHaveLength(1)
  })
})
