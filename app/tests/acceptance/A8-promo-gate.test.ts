/** A8 — PRM-2698 → Pass, PRM-2702 → Warn, PRM-2720 → Fail on seed; Fail blocks publish. */
import { describe, expect, it } from 'vitest'
import { canPublishPromo } from '../../src/rules/engine/promoStockCheck'
import { ofType, publishPromo, Sim, submitPromo } from '../helpers'

describe('A8 promo stock gate', () => {
  it.each([
    ['PRM-2698', 'Pass', 150],
    ['PRM-2702', 'Warn', 84],
    ['PRM-2720', 'Fail', 68],
  ])('%s → %s', (promoId, status, coveragePct) => {
    const sim = new Sim()
    const events = sim.do(submitPromo(promoId))
    const [checked] = ofType(events, 'PROMO_STOCK_CHECKED')
    expect(checked.payload.result).toMatchObject({ status, coveragePct })
    expect(sim.promo(promoId).gate?.status).toBe(status)
    expect(sim.state.notifications.some((n) => n.role === 'emily' && n.text.includes(`${promoId} stock check: ${status}`))).toBe(true)
  })

  it('the gate agrees with the stock-check result in the source data', () => {
    const sim = new Sim()
    for (const id of ['PRM-2698', 'PRM-2702', 'PRM-2720']) {
      const dataResult = sim.promo(id).stockCheck.result
      sim.do(submitPromo(id))
      expect(sim.promo(id).gate?.status).toBe(dataResult)
    }
  })

  it('Warn and Fail tell Priya what supply is missing; Pass does not', () => {
    const sim = new Sim()
    sim.do(submitPromo('PRM-2698'))
    expect(sim.state.notifications.filter((n) => n.role === 'priya')).toHaveLength(0)
    sim.do(submitPromo('PRM-2720'))
    const msg = sim.state.notifications.find((n) => n.role === 'priya')!
    expect(msg.text).toContain('4,631 more units per week')
    expect(msg.severity).toBe('critical')
  })

  it('Fail blocks publish: the promo does not change and Emily is told why', () => {
    const sim = new Sim()
    expect(canPublishPromo(sim.state, 'PRM-2720')).toBe(false)
    const before = sim.promo('PRM-2720').status
    sim.do(submitPromo('PRM-2720'))
    sim.do(publishPromo('PRM-2720'))
    expect(sim.promo('PRM-2720').status).toBe(before)
    expect(sim.state.notifications.some((n) => n.role === 'emily' && n.text.includes('PRM-2720 was not published'))).toBe(true)
  })

  it('Warn does not block publish', () => {
    const sim = new Sim()
    expect(canPublishPromo(sim.state, 'PRM-2702')).toBe(true)
    sim.do(publishPromo('PRM-2702'))
    expect(sim.promo('PRM-2702').status).toBe('Published')
  })
})
