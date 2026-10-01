/**
 * C6 (P0) Aisha → Priya. Receiving a delivery adds only what arrived (to the back
 * room) and closes the receive task. A short delivery raises one supplier claim
 * (shortQty × unit cost), which also flags the supplier's proposals (C4).
 */
import type { DemoEvent, EventDraft, Rule } from '../domain/types'
import { nextClaimId } from './engine/ids'
import { notify } from './notify'

const round2 = (n: number) => Math.round(n * 100) / 100

export const c6DeliveryReceipt: Rule = {
  id: 'C6-delivery-receipt',
  on: ['DELIVERY_RECEIVED'],
  run(state, event) {
    const { inboundId, expectedQty, receivedQty } = (event as DemoEvent<'DELIVERY_RECEIVED'>).payload
    const inbound = state.inbound.find((i) => i.id === inboundId)
    if (!inbound) return { state, newEvents: [] }
    const sku = inbound.sku
    const pos = state.positions[sku]
    const proposal = state.proposals.find((p) => p.itemId === sku)
    const item = state.items.find((i) => i.id === sku)
    const newEvents: EventDraft[] = []

    if (pos && receivedQty > 0) {
      newEvents.push({
        type: 'STOCK_CHANGED',
        actor: 'system',
        payload: { sku, delta: receivedQty, reason: 'DC_RECEIPT', onHand: pos.onHand + receivedQty, shelf: pos.shelf, backRoom: pos.backRoom + receivedQty },
      })
    }

    const shortQty = expectedQty - receivedQty
    if (shortQty > 0) {
      const claimId = nextClaimId(state)
      const unitCost = proposal?.cost ?? item?.cost ?? 0
      const supplierId = proposal?.supplierId ?? item?.supplierId ?? ''
      const value = round2(shortQty * unitCost)
      newEvents.push(
        { type: 'CLAIM_RAISED', actor: 'system', payload: { claimId, supplierId, sku, shortQty, value, inboundId } },
        notify('priya', `Short delivery: ${receivedQty} of ${expectedQty} ${inbound.name} received. Claim ${claimId} raised with ${proposal?.supplierName ?? supplierId} ($${value.toFixed(2)}).`, 'warning', `claim:${claimId}`),
      )
    }

    const task = state.handheld.tasks.find((t) => t.kind === 'RECEIVE' && t.ref === inboundId && t.status === 'OPEN')
    if (task) newEvents.push({ type: 'TASK_COMPLETED', actor: 'system', payload: { taskId: task.id, kind: 'RECEIVE' } })
    return { state, newEvents }
  },
}
