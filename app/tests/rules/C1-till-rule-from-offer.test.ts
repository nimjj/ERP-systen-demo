import { describe, expect, it } from 'vitest'
import { c1TillRuleFromOffer as rule } from '../../src/rules/c1TillRuleFromOffer'
import { afterReducer, pauseOffer, publishOffer, Sim } from '../helpers'

describe('C1 till rule from offer', () => {
  it('publish: R-BP-801 live + one notification to Jamal', () => {
    const { state, event } = afterReducer(publishOffer())
    const out = rule.run(state, event)
    expect(out.state.till.rules.find((r) => r.id === 'R-BP-801')!.status).toBe('live')
    expect(out.newEvents).toEqual([expect.objectContaining({ type: 'NOTIFICATION_ADDED', payload: expect.objectContaining({ role: 'jamal' }) })])
  })

  it('pause: R-BP-801 inactive again', () => {
    const sim = new Sim()
    sim.do(publishOffer())
    const { state, event } = afterReducer(pauseOffer(), sim.state)
    expect(rule.run(state, event).state.till.rules.find((r) => r.id === 'R-BP-801')!.status).toBe('inactive')
  })

  it('no-op when the rule is already in the target status or the offer is unknown', () => {
    const { state, event } = afterReducer(pauseOffer())
    expect(rule.run(state, event)).toEqual({ state, newEvents: [] })
    const unknown = afterReducer({ ...publishOffer(), payload: { offerId: 'OF-0000', items: [], storeIds: [] } } as never)
    expect(rule.run(unknown.state, unknown.event).newEvents).toEqual([])
  })
})
