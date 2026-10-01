/**
 * C3 (P0) Jamal → Aisha, Priya. A sale takes stock off the shelf first, then the
 * back room; onHand falls by the quantity sold. SKUs without a Plano position
 * (bananas by weight, beer, general merchandise) are not stock-tracked here.
 */
import type { DemoEvent, EventDraft, Rule } from '../domain/types'

export const c3SaleDepletesStock: Rule = {
  id: 'C3-sale-depletes-stock',
  on: ['SALE_COMPLETED'],
  run(state, event) {
    const { lines } = (event as DemoEvent<'SALE_COMPLETED'>).payload
    const sold = new Map<string, number>()
    for (const l of lines) if (state.positions[l.sku]) sold.set(l.sku, (sold.get(l.sku) ?? 0) + l.qty)
    const newEvents: EventDraft[] = []
    for (const [sku, qty] of sold) {
      const pos = state.positions[sku]
      const fromShelf = Math.min(pos.shelf, qty)
      const fromBack = Math.min(pos.backRoom, qty - fromShelf)
      newEvents.push({
        type: 'STOCK_CHANGED',
        actor: 'system',
        payload: { sku, delta: -qty, reason: 'SALE', onHand: pos.onHand - qty, shelf: pos.shelf - fromShelf, backRoom: pos.backRoom - fromBack },
      })
    }
    return { state, newEvents }
  },
}
