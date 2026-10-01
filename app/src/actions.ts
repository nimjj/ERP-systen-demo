/**
 * Action builders: the one place that turns a user action into event drafts.
 * Panes and the Presenter's Next button both call these, so a step produces the
 * same events (type, actor, payload) whichever way it is triggered. Pure and
 * deterministic: ids are derived from state, never from the clock.
 */
import { demoTuning } from './config/demoTuning'
import type { AppState, EventDraft, Inbound, Offer, Position, Proposal, Recall, Task } from './domain/types'
import { priceBasket, type BasketItem } from './rules/engine/tillPricing'

// ---------------------------------------------------------------- Emily
export const publishOffer = (offer: Offer): EventDraft => ({ type: 'OFFER_PUBLISHED', actor: 'emily', payload: { offerId: offer.id, items: offer.itemIds, storeIds: offer.storeIds } })
export const pauseOffer = (offer: Offer): EventDraft => ({ type: 'OFFER_PAUSED', actor: 'emily', payload: { offerId: offer.id, items: offer.itemIds, storeIds: offer.storeIds } })
export const submitPromo = (promoId: string): EventDraft => ({ type: 'PROMO_SUBMITTED', actor: 'emily', payload: { promoId } })
export const publishPromo = (promoId: string): EventDraft => ({ type: 'PROMO_PUBLISHED', actor: 'emily', payload: { promoId } })

// ---------------------------------------------------------------- Jamal
/** Transaction number from the count of sales so far: 1101-04-0001, 0002, … */
export function txnId(state: AppState, offset = 0): string {
  const n = state.events.filter((e) => e.type === 'SALE_COMPLETED').length + 1 + offset
  return `1101-04-${String(n).padStart(4, '0')}`
}

export function completeSale(state: AppState, basket: BasketItem[], memberId: string | null, offset = 0): EventDraft {
  const priced = priceBasket(state, basket, memberId)
  return { type: 'SALE_COMPLETED', actor: 'jamal', payload: { txnId: txnId(state, offset), memberId, lines: priced.saleLines, total: priced.total, tax: priced.tax, tender: 'Card' } }
}

/** Presenter helper: n single-yogurt sales at the till, as Jamal, no member. */
export function simulateSales(state: AppState, n = demoTuning.simulateSales.perClick, sku = 'SKU-100221'): EventDraft[] {
  return Array.from({ length: n }, (_, i) => completeSale(state, [{ sku, qty: 1 }], null, i))
}

// ---------------------------------------------------------------- Priya
export function approveOrder(p: Proposal, qty = p.proposedQty): EventDraft {
  return { type: 'ORDER_APPROVED', actor: 'priya', payload: { proposalId: p.id, qty, ...(qty !== p.proposedQty ? { editedFrom: p.proposedQty } : {}) } }
}
export const holdOrder = (p: Proposal): EventDraft => ({ type: 'ORDER_HELD', actor: 'priya', payload: { proposalId: p.id, qty: p.proposedQty } })

// ---------------------------------------------------------------- Aisha
export function receiveLines(state: AppState, task: Task): Inbound[] {
  return state.inbound.filter((i) => i.asnId === task.ref || i.id === task.ref)
}

/** Units short per line when the presenter's Short-ship toggle is on (demoTuning.shortShip: 12 expected, 8 received → 4). */
export const SHORT_UNITS = demoTuning.shortShip.defaultExpected - demoTuning.shortShip.defaultReceived

/** Default received quantity shown on the form. Short-ship applies to orders placed during the demo. */
export function defaultReceived(line: Inbound, shortShip: boolean): number {
  return shortShip && !line.asnId ? Math.max(0, line.expectedQty - SHORT_UNITS) : line.expectedQty
}

export function receiveDelivery(state: AppState, task: Task, received: Record<string, number>): EventDraft[] {
  const open = receiveLines(state, task).filter((l) => l.status === 'IN_TRANSIT')
  const drafts: EventDraft[] = open.map((l) => ({ type: 'DELIVERY_RECEIVED', actor: 'aisha', payload: { inboundId: l.id, expectedQty: l.expectedQty, receivedQty: received[l.id] ?? l.expectedQty } }))
  // A delivery created by an approval closes its own task (C6); an ASN task is closed by Aisha.
  if (!state.inbound.some((i) => i.id === task.ref) && task.status === 'OPEN') drafts.push({ type: 'TASK_COMPLETED', actor: 'aisha', payload: { taskId: task.id, kind: task.kind } })
  return drafts
}

export function countLines(state: AppState) {
  return state.handheld.count.lines.map((l) => ({ ...l, systemQty: state.positions[l.itemId]?.onHand ?? l.systemQty }))
}

export function submitCount(state: AppState, task: Task, actual: Record<string, number>): EventDraft[] {
  const lines = countLines(state).map((l) => ({ sku: l.itemId, systemQty: l.systemQty, actualQty: actual[l.itemId] ?? l.systemQty }))
  return [
    { type: 'COUNT_SUBMITTED', actor: 'aisha', payload: { countId: state.handheld.count.id, lines } },
    { type: 'TASK_COMPLETED', actor: 'aisha', payload: { taskId: task.id, kind: task.kind } },
  ]
}

/** Live gap list: shelf below a quarter of its capacity with stock in the back room, or empty. Recalled items are not gaps. */
export function gapList(state: AppState): (Position & { refill: number })[] {
  return Object.values(state.positions)
    .filter((p) => !state.till.blockedSkus.includes(p.sku))
    .filter((p) => p.shelf < p.shelfCapacity * 0.25 && (p.backRoom > 0 || p.shelf === 0))
    .map((p) => ({ ...p, refill: Math.min(p.backRoom, p.shelfCapacity - p.shelf) }))
}

export function refillShelf(position: Position): EventDraft {
  return { type: 'SHELF_REFILLED', actor: 'aisha', payload: { sku: position.sku, qty: Math.min(position.backRoom, position.shelfCapacity - position.shelf) } }
}

// ---------------------------------------------------------------- Recall (ops, Jamal, Aisha, Emily)
/** A supplier / FDA recall notice arrives (Presenter control / S3 step 1): an external root event. */
export function issueRecall(recall: Recall): EventDraft {
  const qty = recall.stores.reduce((n, s) => n + s.lots.reduce((m, l) => m + l.onHand, 0), 0)
  return { type: 'RECALL_ISSUED', actor: 'external', payload: { recallId: recall.id, sku: recall.itemId, lots: recall.lots.map((l) => l.lot), qty } }
}

/** The till refused a scan of a recalled item. */
export function scanBlocked(state: AppState, sku: string, lane = 4): EventDraft | null {
  const recall = state.recalls.find((r) => r.itemId === sku && r.status === 'ISSUED')
  return recall ? { type: 'RECALL_SCAN_BLOCKED', actor: 'jamal', payload: { recallId: recall.id, sku, lane } } : null
}

/** The lot behind a RECALL_PULL task (ref = "<recallId>:<lot>") and how many Plano holds. */
export function pullTaskLot(state: AppState, task: Task) {
  const [recallId, lot] = (task.ref ?? '').split(':')
  const recall = state.recalls.find((r) => r.id === recallId)
  const row = recall?.stores.find((s) => s.storeId === state.store.id)
  const l = row?.lots.find((x) => x.lot === lot)
  return recall && l ? { recall, lot: l.lot, onHand: l.onHand, pulled: l.pulled } : null
}

export function pullLot(state: AppState, task: Task, qty: number): EventDraft[] {
  const info = pullTaskLot(state, task)
  if (!info) return []
  return [{ type: 'RECALL_PULLED', actor: 'aisha', payload: { recallId: info.recall.id, sku: info.recall.itemId, lots: [info.lot], qty } }]
}

export function sendRecallNotice(recall: Recall): EventDraft | null {
  if (!recall.notice || recall.notice.status !== 'DRAFT') return null
  return { type: 'RECALL_NOTICE_SENT', actor: 'emily', payload: { recallId: recall.id, push: recall.notice.push, email: recall.notice.email, sms: recall.notice.sms } }
}
