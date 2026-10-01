import { describe, expect, it } from 'vitest'
import { c8PromoStockGate as rule } from '../../src/rules/c8PromoStockGate'
import { promoStockCheck } from '../../src/rules/engine/promoStockCheck'
import { buildSeedState } from '../../src/seed/loadSeed'
import { afterReducer, publishPromo, submitPromo } from '../helpers'

describe('C8 promo stock gate', () => {
  it('thresholds: ≥ 100% Pass, 80–99% Warn, < 80% Fail', () => {
    const s = buildSeedState()
    expect(promoStockCheck(s, 'PRM-2702')).toEqual({ status: 'Warn', demand: 13151, supply: 10989, coveragePct: 84 })
    const plus = structuredClone(s)
    plus.promos.promotions.find((p) => p.id === 'PRM-2702')!.extraSupplyUnits = 2200
    expect(promoStockCheck(plus, 'PRM-2702').status).toBe('Pass')
    const minus = structuredClone(s)
    minus.promos.promotions.find((p) => p.id === 'PRM-2702')!.extraSupplyUnits = -500
    expect(promoStockCheck(minus, 'PRM-2702').status).toBe('Fail')
  })

  it('submit: PROMO_STOCK_CHECKED + Emily, and Priya on Warn/Fail', () => {
    const pass = afterReducer(submitPromo('PRM-2698'))
    expect(rule.run(pass.state, pass.event).newEvents.map((e) => e.type)).toEqual(['PROMO_STOCK_CHECKED', 'NOTIFICATION_ADDED'])
    const fail = afterReducer(submitPromo('PRM-2720'))
    const events = rule.run(fail.state, fail.event).newEvents
    expect(events.map((e) => (e.type === 'NOTIFICATION_ADDED' ? e.payload.role : e.type))).toEqual(['PROMO_STOCK_CHECKED', 'emily', 'priya'])
  })

  it('publish: silent when allowed, explains when blocked', () => {
    const ok = afterReducer(publishPromo('PRM-2702'))
    expect(rule.run(ok.state, ok.event).newEvents).toEqual([])
    const blocked = afterReducer(publishPromo('PRM-2720'))
    expect(rule.run(blocked.state, blocked.event).newEvents).toEqual([expect.objectContaining({ payload: expect.objectContaining({ role: 'emily', severity: 'critical' }) })])
  })
})
