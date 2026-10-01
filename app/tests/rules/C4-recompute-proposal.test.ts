import { describe, expect, it } from 'vitest'
import type { EventDraft } from '../../src/domain/types'
import { c4RecomputeProposal as rule } from '../../src/rules/c4RecomputeProposal'
import { afterReducer, YOGURT } from '../helpers'

const stockChanged = (sku: string, onHand: number, shelf: number, backRoom: number): EventDraft => ({
  type: 'STOCK_CHANGED',
  actor: 'system',
  payload: { sku, delta: 0, reason: 'ADJUSTMENT', onHand, shelf, backRoom },
})

describe('C4 recompute proposal', () => {
  it('a stock change recomputes only that SKU', () => {
    const { state, event } = afterReducer(stockChanged(YOGURT, 10, 2, 8))
    const out = rule.run(state, event)
    expect(out.newEvents).toHaveLength(1)
    // S 27 − (10 + 6) = 11 → 12
    expect(out.newEvents[0]).toMatchObject({ type: 'PROPOSAL_RECOMPUTED', payload: { sku: YOGURT, oldQty: 6, newQty: 12, onHand: 10, daysOfCover: 1.1 } })
  })

  it('no event when nothing about the proposal changed', () => {
    const { state, event } = afterReducer(stockChanged(YOGURT, 17, 9, 8))
    expect(rule.run(state, event).newEvents).toEqual([])
  })

  it('a stock change on a SKU without a proposal emits nothing', () => {
    const { state, event } = afterReducer(stockChanged('SKU-100228', 30, 30, 0))
    expect(rule.run(state, event).newEvents).toEqual([])
  })

  it('a demo claim recomputes every proposal of that supplier', () => {
    const { state, event } = afterReducer({ type: 'CLAIM_RAISED', actor: 'system', payload: { claimId: 'CLM-9999', supplierId: 'SUP-PRAIRIE', sku: YOGURT, shortQty: 2, value: 8.34 } })
    const skus = rule.run(state, event).newEvents.map((e) => (e.payload as { sku: string }).sku)
    expect(skus.sort()).toEqual(['SKU-100207', 'SKU-100214', 'SKU-100221', 'SKU-100249'])
  })

  it('historical seed claims do not raise SUPPLIER_CONSTRAINT (§13.3)', () => {
    const { state, event } = afterReducer(stockChanged('SKU-100298', 54, 54, 0)) // water: CLM-5218 Disputed in seed
    const out = rule.run(state, event)
    expect(out.newEvents[0]).toMatchObject({ payload: { exceptions: [] } })
  })
})
