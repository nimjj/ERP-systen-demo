import { describe, expect, it } from 'vitest'
import type { EventDraft } from '../../src/domain/types'
import { c9StockRisk as rule } from '../../src/rules/c9StockRisk'
import { afterReducer, pauseOffer, publishOffer, Sim, YOGURT } from '../helpers'

const setYogurt = (onHand: number): EventDraft => ({ type: 'STOCK_CHANGED', actor: 'system', payload: { sku: YOGURT, delta: 0, reason: 'ADJUSTMENT', onHand, shelf: onHand, backRoom: 0 } })

function liveOffer() {
  const sim = new Sim()
  sim.do(publishOffer())
  return sim
}

describe('C9 stock risk', () => {
  it('raises once when cover drops below the threshold while the offer is live', () => {
    const { state, event } = afterReducer(setYogurt(13), liveOffer().state) // 13 / 13.02 = 0.998
    const out = rule.run(state, event)
    expect(out.newEvents.map((e) => e.type)).toEqual(['STOCK_RISK_RAISED', 'NOTIFICATION_ADDED'])
    expect(out.newEvents[0].payload).toEqual({ offerId: 'OF-3101', sku: YOGURT, coverDays: 0.99 })
  })

  it('does not raise at exactly the threshold or above', () => {
    const { state, event } = afterReducer(setYogurt(14), liveOffer().state) // 1.075
    expect(rule.run(state, event).newEvents).toEqual([])
  })

  it('does not raise twice', () => {
    const sim = liveOffer()
    sim.do(setYogurt(5))
    const { state, event } = afterReducer(setYogurt(4), sim.state)
    expect(rule.run(state, event).newEvents).toEqual([])
  })

  it('clears when cover recovers, and when the offer is paused', () => {
    const sim = liveOffer()
    sim.do(setYogurt(5))
    const recovered = afterReducer(setYogurt(20), sim.state)
    expect(rule.run(recovered.state, recovered.event).newEvents.map((e) => e.type)).toEqual(['STOCK_RISK_CLEARED', 'NOTIFICATION_ADDED'])
    const paused = afterReducer(pauseOffer(), sim.state)
    expect(rule.run(paused.state, paused.event).newEvents.map((e) => e.type)).toEqual(['STOCK_RISK_CLEARED', 'NOTIFICATION_ADDED'])
  })

  it('no offer live → no risk', () => {
    const { state, event } = afterReducer(setYogurt(1))
    expect(rule.run(state, event).newEvents).toEqual([])
  })
})
