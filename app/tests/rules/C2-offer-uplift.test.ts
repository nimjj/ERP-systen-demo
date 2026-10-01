import { describe, expect, it } from 'vitest'
import { demoTuning } from '../../src/config/demoTuning'
import { c2OfferUplift as rule } from '../../src/rules/c2OfferUplift'
import { activeUplift } from '../../src/rules/engine/uplift'
import { buildSeedState } from '../../src/seed/loadSeed'
import { afterReducer, publishOffer, YOGURT } from '../helpers'

describe('C2 offer uplift', () => {
  it('a live offer gives its items demoTuning.offerUplift; nothing else is uplifted', () => {
    const { state } = afterReducer(publishOffer())
    expect(activeUplift(state, YOGURT)).toBe(demoTuning.offerUplift)
    expect(activeUplift(state, 'SKU-100214')).toBe(0)
  })

  it('PRM-2698 is live on yogurt at seed but adds no uplift (baked into forecast, §13.2)', () => {
    expect(activeUplift(buildSeedState(), YOGURT)).toBe(0)
  })

  it('emits exactly one PROPOSAL_RECOMPUTED for the yogurt line, 6 → 12', () => {
    const { state, event } = afterReducer(publishOffer())
    const out = rule.run(state, event)
    expect(out.state).toBe(state)
    expect(out.newEvents).toHaveLength(1)
    expect(out.newEvents[0]).toMatchObject({ type: 'PROPOSAL_RECOMPUTED', payload: { proposalId: 'PRP-00001', oldQty: 6, newQty: 12, orderUpTo: 35 } })
  })
})
