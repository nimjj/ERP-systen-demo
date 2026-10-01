/**
 * C12 (P1) Aisha → Priya. A submitted count corrects stock to what was found
 * (COUNT_VARIANCE) and marks every counted item PHANTOM_CORRECTED, so a
 * PHANTOM_SUSPECTED exception clears and the proposal is recomputed. The flag is
 * set on the rule's returned state before the stock event is applied, so the
 * recompute that follows already sees it.
 */
import { produce } from 'immer'
import type { DemoEvent, EventDraft, Rule } from '../domain/types'
import { recomputeDrafts } from './engine/proposal'
import { notify } from './notify'

export const c12CountVariance: Rule = {
  id: 'C12-count-variance',
  on: ['COUNT_SUBMITTED'],
  run(state, event) {
    const { countId, lines } = (event as DemoEvent<'COUNT_SUBMITTED'>).payload
    const counted = lines.filter((l) => state.positions[l.sku])
    if (counted.length === 0) return { state, newEvents: [] }

    const next = produce(state, (d) => {
      for (const l of counted) {
        const flags = d.positions[l.sku].flags
        if (!flags.includes('PHANTOM_CORRECTED')) flags.push('PHANTOM_CORRECTED')
      }
    })

    const newEvents: EventDraft[] = []
    const unchanged: string[] = []
    for (const l of counted) {
      const pos = next.positions[l.sku]
      const delta = l.actualQty - pos.onHand
      if (delta === 0) {
        unchanged.push(l.sku)
        continue
      }
      // Missing stock comes off the shelf first, then the back room; found stock goes on the shelf.
      const fromShelf = delta < 0 ? Math.min(pos.shelf, -delta) : 0
      const fromBack = delta < 0 ? Math.min(pos.backRoom, -delta - fromShelf) : 0
      newEvents.push({
        type: 'STOCK_CHANGED',
        actor: 'system',
        payload: {
          sku: l.sku,
          delta,
          reason: 'COUNT_VARIANCE',
          onHand: l.actualQty,
          shelf: delta < 0 ? pos.shelf - fromShelf : pos.shelf + delta,
          backRoom: pos.backRoom - fromBack,
        },
      })
      newEvents.push(notify('priya', `Count ${countId}: ${pos.name} system ${pos.onHand}, found ${l.actualQty} (${delta > 0 ? '+' : ''}${delta}). Stock corrected.`, 'warning', `sku:${l.sku}`))
    }
    // Counted with no variance: stock is confirmed, so a phantom flag still clears.
    newEvents.push(...recomputeDrafts(next, unchanged))
    return { state: next, newEvents }
  },
}
