/**
 * Reducers: record the facts each event carries. This is the only place state
 * changes because of an event's own payload. Cross-pane reactions live in
 * src/rules/ (one file per connection). Pure, immutable (Immer).
 */
import { produce, type Draft } from 'immer'
import type { AppState, DemoEvent, EventPayloads, EventType } from '../domain/types'
import { demoTuning } from '../config/demoTuning'
import { canPublishPromo } from '../rules/engine/promoStockCheck'

type Reducer<T extends EventType> = (d: Draft<AppState>, payload: EventPayloads[T], event: DemoEvent<T>) => void

const round2 = (n: number) => Math.round(n * 100) / 100

const reducers: { [T in EventType]?: Reducer<T> } = {
  OFFER_PUBLISHED: (d, p) => {
    const o = d.offers.find((x) => x.id === p.offerId)
    if (o) o.status = 'Live'
  },
  OFFER_PAUSED: (d, p) => {
    const o = d.offers.find((x) => x.id === p.offerId)
    if (o) o.status = 'Paused'
  },
  PROMO_SUBMITTED: (d, p) => {
    const promo = d.promos.promotions.find((x) => x.id === p.promoId)
    if (promo) promo.submitted = true
  },
  PROMO_STOCK_CHECKED: (d, p) => {
    const promo = d.promos.promotions.find((x) => x.id === p.promoId)
    if (!promo) return
    promo.gate = p.result
    promo.stockCheck.result = p.result.status
  },
  PROMO_PUBLISHED: (d, p) => {
    // A Fail blocks publishing (A8): the event is logged, the promo does not change.
    const promo = d.promos.promotions.find((x) => x.id === p.promoId)
    if (!promo || promo.status === 'Live' || !canPublishPromo(d as AppState, p.promoId)) return
    promo.status = 'Published'
  },
  SALE_COMPLETED: (d, p) => {
    d.till.basket = []
    d.till.memberId = null
    d.till.lastTxnId = p.txnId
  },
  POINTS_AWARDED: (d, p) => {
    const member = d.till.members.find((m) => m.id === p.memberId)
    if (member) member.points += p.points
    for (const r of p.reasons) {
      if (!r.offerId) continue
      const offer = d.offers.find((o) => o.id === r.offerId)
      if (!offer) continue
      const fundingUsd = r.points * demoTuning.supplierFundingPerPoint
      offer.redeemed += r.qty ?? 1
      offer.incrementalSalesUsd = round2(offer.incrementalSalesUsd + (r.salesUsd ?? 0))
      offer.costUsd = round2(offer.costUsd + fundingUsd)
      offer.vendorPaidUsd = round2(offer.vendorPaidUsd + (fundingUsd * offer.fundingPct) / 100)
    }
  },
  STOCK_CHANGED: (d, p) => {
    const pos = d.positions[p.sku]
    if (!pos) return
    pos.onHand = p.onHand
    pos.shelf = p.shelf
    pos.backRoom = p.backRoom
  },
  PROPOSAL_RECOMPUTED: (d, p) => {
    const prop = d.proposals.find((x) => x.id === p.proposalId)
    if (!prop) return
    prop.proposedQty = p.newQty
    prop.exceptions = p.exceptions
    prop.exception = p.exceptions[0] ?? null
    prop.status = p.status
    prop.onHand = p.onHand
    prop.inTransit = p.inTransit
    prop.orderUpTo = p.orderUpTo
    prop.uplift = p.uplift
    prop.effectiveDaily = p.effectiveDaily
    prop.daysOfCover = p.daysOfCover
    prop.value = round2(p.newQty * prop.cost)
  },
  ORDER_APPROVED: (d, p) => {
    const prop = d.proposals.find((x) => x.id === p.proposalId)
    if (!prop) return
    prop.lastOrderQty = p.qty
    prop.status = 'APPROVED'
  },
  ORDER_HELD: (d, p) => {
    const prop = d.proposals.find((x) => x.id === p.proposalId)
    if (prop) prop.status = 'HELD'
  },
  INBOUND_CREATED: (d, p) => {
    const prop = d.proposals.find((x) => x.itemId === p.sku)
    const item = d.items.find((x) => x.id === p.sku)
    d.inbound.push({
      id: p.inboundId,
      sku: p.sku,
      name: prop?.itemName ?? item?.name ?? p.sku,
      casePack: prop?.casePack ?? item?.casePack ?? 1,
      expectedQty: p.qty,
      receivedQty: null,
      source: prop?.source ?? item?.source ?? '',
      status: 'IN_TRANSIT',
      asnId: null,
      poId: null,
      eta: p.eta,
      shortShip: false,
    })
  },
  TASK_CREATED: (d, p, e) => {
    d.handheld.tasks.push({ id: p.taskId, kind: p.kind, title: p.title, detail: p.detail, priority: 'High', status: 'OPEN', ref: p.ref, createdBy: e.id })
  },
  TASK_COMPLETED: (d, p) => {
    const t = d.handheld.tasks.find((x) => x.id === p.taskId)
    if (t) t.status = 'DONE'
  },
  DELIVERY_RECEIVED: (d, p) => {
    const i = d.inbound.find((x) => x.id === p.inboundId)
    if (!i) return
    i.receivedQty = p.receivedQty
    i.status = 'RECEIVED'
  },
  CLAIM_RAISED: (d, p, e) => {
    const prop = d.proposals.find((x) => x.itemId === p.sku)
    const item = d.items.find((x) => x.id === p.sku)
    const inbound = p.inboundId ? d.inbound.find((x) => x.id === p.inboundId) : undefined
    d.claims.push({
      id: p.claimId,
      supplierId: p.supplierId,
      supplierName: prop?.supplierName ?? p.supplierId,
      poId: inbound?.poId ?? null,
      asnId: inbound?.asnId ?? null,
      type: 'Short shipment',
      itemId: p.sku,
      itemName: prop?.itemName ?? item?.name ?? p.sku,
      shortQty: p.shortQty,
      value: p.value,
      status: 'Draft',
      raisedAt: e.ts,
      storeId: d.store.id,
      raisedInDemo: true,
      inboundId: p.inboundId,
    })
  },
  STOCK_RISK_RAISED: (d, p, e) => {
    d.stockRisks.push({ offerId: p.offerId, sku: p.sku, coverDays: p.coverDays, eventId: e.id })
  },
  STOCK_RISK_CLEARED: (d, p) => {
    d.stockRisks = d.stockRisks.filter((r) => !(r.offerId === p.offerId && r.sku === p.sku))
  },
  NOTIFICATION_ADDED: (d, p, e) => {
    d.notifications.push({ id: e.id, role: p.role, text: p.text, link: p.link, severity: p.severity, eventId: e.id, read: false })
  },
}

export function applyEvent(state: AppState, event: DemoEvent): AppState {
  return produce(state, (d) => {
    d.events.push(event as Draft<DemoEvent>)
    const reducer = reducers[event.type] as Reducer<EventType> | undefined
    reducer?.(d, event.payload, event)
  })
}
