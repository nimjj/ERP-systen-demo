/**
 * C13 (P1) Aisha. Refilling moves stock from the back room to the shelf
 * (STOCK_CHANGED, reason MOVE). onHand does not change, so the till and the
 * planner are unaffected. The move is capped at what the back room holds.
 */
import type { DemoEvent, Rule } from '../domain/types'

export const c13ShelfRefill: Rule = {
  id: 'C13-shelf-refill',
  on: ['SHELF_REFILLED'],
  run(state, event) {
    const { sku, qty } = (event as DemoEvent<'SHELF_REFILLED'>).payload
    const pos = state.positions[sku]
    const moved = pos ? Math.min(qty, pos.backRoom) : 0
    if (!pos || moved <= 0) return { state, newEvents: [] }
    return {
      state,
      newEvents: [
        { type: 'STOCK_CHANGED', actor: 'system', payload: { sku, delta: 0, reason: 'MOVE', onHand: pos.onHand, shelf: pos.shelf + moved, backRoom: pos.backRoom - moved } },
      ],
    }
  },
}
