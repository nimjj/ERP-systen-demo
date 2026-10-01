/**
 * C4 (P0) stock → Priya. Any change to stock or in-transit recomputes the SKU's
 * proposal with the order-up-to engine and the exception rules; a new demo
 * claim recomputes the short item's proposal (SUPPLIER_CONSTRAINT).
 * Forecast changes from offers are handled by C2.
 */
import type { DemoEvent, Rule } from '../domain/types'
import { recomputeDrafts } from './engine/proposal'

export const c4RecomputeProposal: Rule = {
  id: 'C4-recompute-proposal',
  on: ['STOCK_CHANGED', 'INBOUND_CREATED', 'CLAIM_RAISED'],
  run(state, event) {
    const { sku } = (event as DemoEvent<'STOCK_CHANGED' | 'CLAIM_RAISED'>).payload
    return { state, newEvents: recomputeDrafts(state, [sku]) }
  },
}
