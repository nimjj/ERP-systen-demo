/** A9 — Approving the Cola prebuild changes PRM-2702 from Warn to Pass (C11). */
import { describe, expect, it } from 'vitest'
import { approve, ofType, Sim, submitPromo } from '../helpers'

describe('A9 supply added', () => {
  it('Warn → Pass after Priya approves PRP-00003, and Emily is told', () => {
    const sim = new Sim()
    sim.do(submitPromo('PRM-2702'))
    expect(sim.promo('PRM-2702').gate?.status).toBe('Warn')
    const events = sim.do(approve('PRP-00003', 160))
    expect(ofType(events, 'SUPPLY_ADDED')[0].payload).toEqual({ promoId: 'PRM-2702', proposalId: 'PRP-00003', units: 2200 })
    expect(ofType(events, 'PROMO_STOCK_CHECKED')[0].payload.result).toMatchObject({ status: 'Pass', coveragePct: 100 })
    expect(sim.promo('PRM-2702').gate?.status).toBe('Pass')
    expect(sim.state.notifications.at(-1)?.text).toContain('You can publish')
  })

  it('supply is added once, even if the line is approved again', () => {
    const sim = new Sim()
    sim.do(approve('PRP-00003', 160))
    const again = sim.do(approve('PRP-00003', 2))
    expect(ofType(again, 'SUPPLY_ADDED')).toEqual([])
    expect(sim.promo('PRM-2702').extraSupplyUnits).toBe(2200)
  })

  it('the approved order carries the pre-build: the next Cola order is not inflated again', () => {
    const sim = new Sim()
    expect(sim.state.proposals.find((p) => p.id === 'PRP-00003')!.proposedQty).toBe(160)
    sim.do(approve('PRP-00003', 160))
    const cola = sim.state.proposals.find((p) => p.id === 'PRP-00003')!
    expect(cola).toMatchObject({ prebuild: 0, proposedQty: 0, inTransit: 160, status: 'AUTO_RELEASED' })
  })

  it('approving other lines adds no promo supply', () => {
    const sim = new Sim()
    expect(ofType(sim.do(approve('PRP-00001', 6)), 'SUPPLY_ADDED')).toEqual([])
  })
})
