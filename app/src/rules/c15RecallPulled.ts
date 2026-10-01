/**
 * C15 (P1) Aisha → ops, Priya. Pulling recalled stock takes it out of on-hand
 * (STOCK_CHANGED, reason RECALL_PULL: shelf first, then back room) and closes
 * the lot's pull task. Priya is told the write-off (units × unit cost, credited
 * via the recall's supplier claim). When the last lot is pulled, stock for the
 * SKU is 0 and the store's recall row is confirmed (reducer).
 */
import type { DemoEvent, EventDraft, Rule } from '../domain/types'
import { notify } from './notify'

export const c15RecallPulled: Rule = {
  id: 'C15-recall-pulled',
  on: ['RECALL_PULLED'],
  run(state, event) {
    const { recallId, sku, lots, qty } = (event as DemoEvent<'RECALL_PULLED'>).payload
    const recall = state.recalls.find((r) => r.id === recallId)
    const pos = state.positions[sku]
    if (!recall || !pos || qty <= 0) return { state, newEvents: [] }
    const newEvents: EventDraft[] = []

    const take = Math.min(qty, pos.onHand)
    const fromShelf = Math.min(pos.shelf, take)
    const fromBack = Math.min(pos.backRoom, take - fromShelf)
    newEvents.push({
      type: 'STOCK_CHANGED',
      actor: 'system',
      payload: { sku, delta: -take, reason: 'RECALL_PULL', onHand: pos.onHand - take, shelf: pos.shelf - fromShelf, backRoom: pos.backRoom - fromBack },
    })

    for (const lot of lots) {
      const task = state.handheld.tasks.find((t) => t.kind === 'RECALL_PULL' && t.ref === `${recallId}:${lot}` && t.status === 'OPEN')
      if (task) newEvents.push({ type: 'TASK_COMPLETED', actor: 'system', payload: { taskId: task.id, kind: 'RECALL_PULL' } })
    }

    const row = recall.stores.find((s) => s.storeId === state.store.id)
    const pulled = row?.lots.reduce((n, l) => n + l.pulled, 0) ?? take
    const total = row?.lots.reduce((n, l) => n + l.onHand, 0) ?? take
    const value = Math.round(take * recall.credit.unitCost * 100) / 100
    newEvents.push(
      notify(
        'priya',
        `Recall ${recallId}: ${take} × ${recall.itemName} pulled (lot ${lots.join(', ')}). Write-off $${value.toFixed(2)}, credited via ${recall.credit.claimId ?? 'the supplier claim'}. Plano ${pulled} of ${total} pulled.`,
        pulled >= total ? 'success' : 'info',
        `recall:${recallId}`,
      ),
    )
    return { state, newEvents }
  },
}
