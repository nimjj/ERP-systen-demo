/** One plain-language line per event, for the event stream. */
import type { Actor, AppState, DemoEvent, EventPayloads, EventType } from '../domain/types'

export const ACTOR_NAME: Record<Actor, string> = { jamal: 'Jamal', aisha: 'Aisha', emily: 'Emily', priya: 'Priya', system: 'System', external: 'Supplier / FDA notice' }
/** Short form for narrow columns (timeline). */
export const ACTOR_SHORT: Record<Actor, string> = { jamal: 'Jamal', aisha: 'Aisha', emily: 'Emily', priya: 'Priya', system: 'System', external: 'FDA notice' }
export const ACTOR_INITIAL: Record<Actor, string> = { jamal: 'J', aisha: 'A', emily: 'E', priya: 'P', system: 'S', external: '!' }

/** Plain-language name of each event type (the code stays in tooltips). */
export const TYPE_LABEL: Record<EventType, string> = {
  OFFER_PUBLISHED: 'Offer published',
  OFFER_PAUSED: 'Offer paused',
  PROMO_SUBMITTED: 'Promo submitted',
  PROMO_STOCK_CHECKED: 'Stock check',
  PROMO_PUBLISHED: 'Promo published',
  SALE_COMPLETED: 'Sale',
  POINTS_AWARDED: 'Points awarded',
  STOCK_CHANGED: 'Stock changed',
  PROPOSAL_RECOMPUTED: 'Order recalculated',
  ORDER_APPROVED: 'Order approved',
  ORDER_HELD: 'Order held',
  INBOUND_CREATED: 'Delivery on the way',
  TASK_CREATED: 'New task',
  TASK_COMPLETED: 'Task done',
  DELIVERY_RECEIVED: 'Delivery received',
  CLAIM_RAISED: 'Supplier claim',
  STOCK_RISK_RAISED: 'Stock risk',
  STOCK_RISK_CLEARED: 'Stock risk cleared',
  SHELF_REFILLED: 'Shelf refilled',
  COUNT_SUBMITTED: 'Count submitted',
  RECALL_ISSUED: 'Recall notice',
  RECALL_PULLED: 'Recall pull',
  RECALL_SCAN_BLOCKED: 'Scan refused',
  RECALL_NOTICE_SENT: 'Customer notice sent',
  INBOUND_HELD: 'Delivery held',
  NOTIFICATION_ADDED: 'Message',
  SUPPLY_ADDED: 'Supply added',
  WASTE_LOGGED: 'Waste logged',
  COUPON_ISSUED: 'Coupon issued',
  MARKDOWN_RECOMMENDED: 'Markdown suggested',
}

const memberName = (s: AppState, id: string | null) => (id ? (s.till.members.find((m) => m.id === id)?.name ?? 'a member') : '')

const money = (n: number) => `${n < 0 ? '−' : ''}$${Math.abs(n).toFixed(2)}`

function itemName(state: AppState, sku: string): string {
  return state.positions[sku]?.name ?? state.proposals.find((p) => p.itemId === sku)?.itemName ?? state.till.catalogue.find((c) => c.id === sku)?.name ?? sku
}

type Describer<T extends EventType> = (p: EventPayloads[T], s: AppState, e: DemoEvent<T>) => string

const d: { [T in EventType]: Describer<T> } = {
  OFFER_PUBLISHED: (p) => `Published offer ${p.offerId}`,
  OFFER_PAUSED: (p) => `Paused offer ${p.offerId}`,
  PROMO_SUBMITTED: (p) => `Submitted ${p.promoId} for the stock check`,
  PROMO_STOCK_CHECKED: (p) => `${p.promoId} stock check: ${p.result.status} (${p.result.coveragePct}% covered)`,
  PROMO_PUBLISHED: (p, s) => {
    const promo = s.promos.promotions.find((x) => x.id === p.promoId)
    return promo?.status === 'Published' ? `Published ${p.promoId}` : `Tried to publish ${p.promoId}`
  },
  SALE_COMPLETED: (p, s) => {
    const n = p.lines.reduce((sum, l) => sum + (Number.isInteger(l.qty) ? l.qty : 1), 0)
    return `Sale ${p.txnId}: ${n} ${n === 1 ? 'item' : 'items'}, ${money(p.total)}${p.memberId ? ` · ${memberName(s, p.memberId)}` : ''}`
  },
  POINTS_AWARDED: (p, s) => `${p.points.toLocaleString()} points to ${memberName(s, p.memberId)}${p.reasons.some((r) => r.offerId) ? ' (incl. offer bonus)' : ''}`,
  STOCK_CHANGED: (p, s) => `${itemName(s, p.sku)}: ${p.delta > 0 ? '+' : ''}${p.delta} (${p.reason.toLowerCase().replace(/_/g, ' ')}) → ${p.onHand} on hand`,
  PROPOSAL_RECOMPUTED: (p, s) =>
    `${itemName(s, p.sku)} order ${p.oldQty === p.newQty ? `stays ${p.newQty}` : `${p.oldQty} → ${p.newQty}`} · ${p.onHand} on hand${p.exceptions.length ? ` · ${p.exceptions.map((x) => x.label).join(', ')}` : ''}`,
  ORDER_APPROVED: (p, s) => `Approved ${p.qty} × ${itemName(s, s.proposals.find((x) => x.id === p.proposalId)?.itemId ?? '')}${p.editedFrom !== undefined ? ` (was ${p.editedFrom})` : ''}`,
  ORDER_HELD: (p, s) => `Held the order for ${itemName(s, s.proposals.find((x) => x.id === p.proposalId)?.itemId ?? '')}`,
  INBOUND_CREATED: (p, s) => `In transit: ${p.qty} × ${itemName(s, p.sku)}`,
  TASK_CREATED: (p) => `New task for Aisha: ${p.title}`,
  TASK_COMPLETED: (p, s) => `Task done: ${s.handheld.tasks.find((t) => t.id === p.taskId)?.title ?? p.taskId}`,
  DELIVERY_RECEIVED: (p, s) => `Received ${p.receivedQty} of ${p.expectedQty} × ${s.inbound.find((i) => i.id === p.inboundId)?.name ?? p.inboundId}`,
  CLAIM_RAISED: (p, s) => `Claim ${p.claimId}: ${p.shortQty} × ${itemName(s, p.sku)} short, ${money(p.value)}`,
  STOCK_RISK_RAISED: (p, s) => `Stock risk on ${p.offerId}: ${itemName(s, p.sku)} ${p.coverDays.toFixed(2)} days of cover`,
  STOCK_RISK_CLEARED: (p) => `Stock risk cleared on ${p.offerId}`,
  SHELF_REFILLED: (p, s) => `Refilled ${p.qty} × ${itemName(s, p.sku)} from the back room`,
  COUNT_SUBMITTED: (p) => `Count ${p.countId} submitted (${p.lines.length} lines)`,
  RECALL_ISSUED: (p, s) => `Recall ${p.recallId} issued: ${itemName(s, p.sku)}, lots ${p.lots.join(', ')}`,
  RECALL_PULLED: (p, s) => `Pulled ${p.qty} × ${itemName(s, p.sku)} (lot ${p.lots.join(', ')}) for ${p.recallId}`,
  RECALL_SCAN_BLOCKED: (p, s) => `Till lane ${p.lane} refused a scan of ${itemName(s, p.sku)} (recall ${p.recallId})`,
  RECALL_NOTICE_SENT: (p) => `Customer notice for ${p.recallId} sent: ${p.push.toLocaleString()} push, ${p.email.toLocaleString()} email, ${p.sms.toLocaleString()} SMS`,
  INBOUND_HELD: (p, s) => `Order held: ${p.qty} × ${itemName(s, p.sku)} (${p.reason})`,
  NOTIFICATION_ADDED: (p) => `To ${ACTOR_NAME[p.role]}: ${p.text}`,
  SUPPLY_ADDED: (p) => `Added ${p.units} units of supply for ${p.promoId}`,
  WASTE_LOGGED: (p, s) => `Waste: ${p.qty} × ${itemName(s, p.sku)}`,
  COUPON_ISSUED: (p, s) => `Coupon ${p.couponId} to ${memberName(s, p.memberId)}`,
  MARKDOWN_RECOMMENDED: (p, s) => `Markdown suggested for ${itemName(s, p.sku)}`,
}

export function describeEvent(state: AppState, e: DemoEvent): string {
  return (d[e.type] as Describer<EventType>)(e.payload, state, e)
}
