/**
 * C4 (P0) stock → Priya. Any change to stock or in-transit recomputes the SKU's
 * proposal with the order-up-to engine and the exception rules; a new demo
 * claim recomputes every proposal of that supplier (SUPPLIER_CONSTRAINT).
 * Forecast changes from offers are handled by C2.
 */
import type { DemoEvent, Rule } from '../domain/types'
import { recomputeDrafts } from './engine/proposal'

export const c4RecomputeProposal: Rule = {
  id: 'C4-recompute-proposal',
  on: ['STOCK_CHANGED', 'INBOUND_CREATED', 'CLAIM_RAISED'],
  run(state, event) {
    let skus: string[]
    if (event.type === 'CLAIM_RAISED') {
      const { supplierId } = (event as DemoEvent<'CLAIM_RAISED'>).payload
      skus = state.proposals.filter((p) => p.supplierId === supplierId).map((p) => p.itemId)
    } else {
      skus = [(event as DemoEvent<'STOCK_CHANGED'>).payload.sku]
    }
    return { state, newEvents: recomputeDrafts(state, skus) }
  },
}
