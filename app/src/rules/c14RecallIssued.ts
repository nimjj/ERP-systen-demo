/**
 * C14 (P1) ops → everyone. Issuing a recall changes all four panes at once
 * (SPEC §5.6):
 *  - Jamal: the SKU is blocked at the till (scans show "RECALLED — do not sell").
 *  - Aisha: one "Pull from shelf" task per Plano lot, with the lot numbers.
 *  - Priya: open orders (in-transit inbound) for the SKU are held; proposals blocked.
 *  - Emily: the SKU is removed from active promotions, which are flagged, and a
 *    customer notice is drafted from the recall record's real counts.
 */
import { produce } from 'immer'
import type { DemoEvent, EventDraft, Recall, RecallNotice, Rule } from '../domain/types'
import { notify } from './notify'

const ACTIVE_PROMO = ['Live', 'Approved', 'In approval', 'Published']
const fmt = (n: number) => n.toLocaleString('en-US')

export function draftNotice(recall: Recall, storeName: string): RecallNotice {
  const c = recall.customers
  const lots = recall.lots.map((l) => `${l.lot} (best by ${l.bestBy})`).join(', ')
  return {
    status: 'DRAFT',
    buyers: c.buyers,
    push: c.push,
    email: c.email,
    sms: c.sms,
    refunds: c.refunds,
    nonMemberSales: c.nonMemberSales,
    signage: c.signage,
    subject: `Recall: ${recall.itemName} — please do not eat`,
    body:
      `${recall.supplierName} is recalling ${recall.itemName}, lots ${lots}. ${recall.reason} ` +
      `Our records show you bought this product. Please do not eat it: return it to ${storeName} or any John Henry store for a full refund, no receipt needed.`,
  }
}

export const c14RecallIssued: Rule = {
  id: 'C14-recall-issued',
  on: ['RECALL_ISSUED'],
  run(state, event) {
    const { recallId, sku } = (event as DemoEvent<'RECALL_ISSUED'>).payload
    const recall = state.recalls.find((r) => r.id === recallId)
    if (!recall) return { state, newEvents: [] }
    const row = recall.stores.find((s) => s.storeId === state.store.id)
    const flagged = state.promos.promotions.filter((p) => ACTIVE_PROMO.includes(p.status) && p.itemIds.includes(sku))

    const next = produce(state, (d) => {
      if (!d.till.blockedSkus.includes(sku)) d.till.blockedSkus.push(sku)
      for (const p of d.proposals) if (p.itemId === sku) p.status = 'BLOCKED'
      for (const p of d.promos.promotions) {
        if (!flagged.some((f) => f.id === p.id)) continue
        const i = p.itemIds.indexOf(sku)
        p.itemIds.splice(i, 1)
        p.itemNames = p.itemNames.filter((n) => n !== recall.itemName)
        p.recallFlags = [...(p.recallFlags ?? []), { recallId, sku, itemName: recall.itemName }]
      }
      const r = d.recalls.find((x) => x.id === recallId)!
      r.notice = draftNotice(recall, state.store.name)
    })

    const newEvents: EventDraft[] = [notify('jamal', `${recall.itemName} is recalled (${recallId}). It is blocked at the till: do not sell.`, 'critical', `recall:${recallId}`)]

    for (const lot of row?.lots ?? []) {
      newEvents.push({
        type: 'TASK_CREATED',
        actor: 'system',
        payload: {
          taskId: `pull-${recallId}-${lot.lot}`,
          kind: 'RECALL_PULL',
          title: `Pull ${recall.itemName} · lot ${lot.lot}`,
          detail: `${lot.onHand} units · ${recall.kind} ${recall.classification} · shelf and back room`,
          ref: `${recallId}:${lot.lot}`,
        },
      })
    }
    if (row?.lots.length) newEvents.push(notify('aisha', `Recall ${recallId}: pull ${row.lots.length} lots of ${recall.itemName} from the shelf and back room now.`, 'critical', `recall:${recallId}`))

    const held = state.inbound.filter((i) => i.sku === sku && i.status === 'IN_TRANSIT')
    for (const i of held) newEvents.push({ type: 'INBOUND_HELD', actor: 'system', payload: { inboundId: i.id, sku, qty: i.expectedQty, reason: `Recall ${recallId}` } })
    newEvents.push(
      notify(
        'priya',
        `Recall ${recallId}: ${recall.itemName} orders are held${held.length ? ` (${held.map((i) => `${i.expectedQty} units on ${i.asnId ?? i.id}`).join(', ')})` : ''} and no new orders will be proposed.`,
        'critical',
        `recall:${recallId}`,
      ),
    )

    const c = recall.customers
    newEvents.push(
      notify(
        'emily',
        `Recall ${recallId}: ${recall.itemName} removed from ${flagged.map((p) => p.id).join(', ') || 'no active promotions'}. Customer notice drafted for ${fmt(c.buyers)} buyers (push ${fmt(c.push)}, email ${fmt(c.email)}, SMS ${fmt(c.sms)}).`,
        'critical',
        `recall:${recallId}`,
      ),
    )
    return { state: next, newEvents }
  },
}
