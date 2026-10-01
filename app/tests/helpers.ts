import type { AppState, EventDraft, EventType } from '../src/domain/types'
import type { KeyValueStorage } from '../src/store/EventStore'
import type { StorageEventLike, StorageEventSource } from '../src/store/transports'

export class MemoryStorage implements KeyValueStorage {
  readonly map = new Map<string, string>()
  getItem(key: string) {
    return this.map.has(key) ? this.map.get(key)! : null
  }
  setItem(key: string, value: string) {
    this.map.set(key, value)
  }
  removeItem(key: string) {
    this.map.delete(key)
  }
}

/**
 * Fakes several browser windows sharing one localStorage: a write from one
 * window fires a `storage` event in every other window (never in the writer),
 * asynchronously, like real browsers.
 */
export class FakeBrowser {
  private readonly shared = new Map<string, string>()
  private readonly windows: FakeWindow[] = []

  openWindow(): FakeWindow {
    const w = new FakeWindow(this)
    this.windows.push(w)
    return w
  }

  read(key: string) {
    return this.shared.has(key) ? this.shared.get(key)! : null
  }

  write(from: FakeWindow, key: string, value: string | null) {
    if (value === null) this.shared.delete(key)
    else this.shared.set(key, value)
    for (const w of this.windows) if (w !== from) setTimeout(() => w.fire({ key, newValue: value }), 0)
  }
}

export class FakeWindow implements StorageEventSource {
  private readonly listeners = new Set<(e: StorageEventLike) => void>()
  readonly storage: KeyValueStorage

  constructor(browser: FakeBrowser) {
    this.storage = {
      getItem: (k) => browser.read(k),
      setItem: (k, v) => browser.write(this, k, v),
      removeItem: (k) => browser.write(this, k, null),
    }
  }

  addEventListener(_type: 'storage', listener: (e: StorageEventLike) => void) {
    this.listeners.add(listener)
  }
  removeEventListener(_type: 'storage', listener: (e: StorageEventLike) => void) {
    this.listeners.delete(listener)
  }
  fire(e: StorageEventLike) {
    for (const l of this.listeners) l(e)
  }
}

export async function waitFor(predicate: () => boolean, timeoutMs: number): Promise<number> {
  const start = performance.now()
  while (!predicate()) {
    if (performance.now() - start > timeoutMs) throw new Error(`waitFor: condition not met within ${timeoutMs} ms`)
    await new Promise((r) => setTimeout(r, 5))
  }
  return performance.now() - start
}

export function deepFreeze<T>(value: T): T {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value)
    for (const v of Object.values(value as object)) deepFreeze(v)
  }
  return value
}

/** One plausible draft for every event type, built from seed ids. Typed so a new event type must be added here. */
export function sampleDrafts(state: AppState): Record<EventType, EventDraft> {
  const yogurt = state.proposals.find((p) => p.itemId === 'SKU-100221')!
  const pos = state.positions['SKU-100221']
  const inbound = state.inbound.find((i) => i.sku === 'SKU-100221')!
  return {
    OFFER_PUBLISHED: { type: 'OFFER_PUBLISHED', actor: 'emily', payload: { offerId: 'OF-3101', items: ['SKU-100221'], storeIds: [state.store.id] } },
    OFFER_PAUSED: { type: 'OFFER_PAUSED', actor: 'emily', payload: { offerId: 'OF-3101', items: ['SKU-100221'], storeIds: [state.store.id] } },
    PROMO_SUBMITTED: { type: 'PROMO_SUBMITTED', actor: 'emily', payload: { promoId: 'PRM-2720' } },
    PROMO_STOCK_CHECKED: { type: 'PROMO_STOCK_CHECKED', actor: 'system', payload: { promoId: 'PRM-2720', result: { status: 'Fail', demand: 14415, supply: 9784, coveragePct: 68 } } },
    PROMO_PUBLISHED: { type: 'PROMO_PUBLISHED', actor: 'emily', payload: { promoId: 'PRM-2698' } },
    SALE_COMPLETED: {
      type: 'SALE_COMPLETED',
      actor: 'jamal',
      payload: { txnId: 'T-1', memberId: 'M-1001', lines: [{ sku: 'SKU-100221', qty: 1, price: 5.98, promoApplied: [] }], total: 5.98, tax: 0, tender: 'Card' },
    },
    POINTS_AWARDED: { type: 'POINTS_AWARDED', actor: 'system', payload: { memberId: 'M-1001', points: 208, reasons: [{ label: 'Base', points: 8 }, { label: 'R-BP-801', points: 200 }] } },
    STOCK_CHANGED: { type: 'STOCK_CHANGED', actor: 'system', payload: { sku: 'SKU-100221', delta: -1, reason: 'SALE', onHand: pos.onHand - 1, shelf: pos.shelf - 1, backRoom: pos.backRoom } },
    PROPOSAL_RECOMPUTED: { type: 'PROPOSAL_RECOMPUTED', actor: 'system', payload: { proposalId: yogurt.id, sku: yogurt.itemId, oldQty: 6, newQty: 12, exceptions: ['PROMO_UPLIFT'], status: 'PENDING_REVIEW' } },
    ORDER_APPROVED: { type: 'ORDER_APPROVED', actor: 'priya', payload: { proposalId: yogurt.id, qty: 12 } },
    ORDER_HELD: { type: 'ORDER_HELD', actor: 'system', payload: { proposalId: yogurt.id, qty: 12 } },
    INBOUND_CREATED: { type: 'INBOUND_CREATED', actor: 'system', payload: { inboundId: 'IN-1', sku: 'SKU-100221', qty: 12, eta: null } },
    TASK_CREATED: { type: 'TASK_CREATED', actor: 'system', payload: { taskId: 'task-1', kind: 'RECEIVE', title: 'Receive delivery', detail: '2 cases', ref: 'IN-1' } },
    TASK_COMPLETED: { type: 'TASK_COMPLETED', actor: 'aisha', payload: { taskId: 't3', kind: 'GAP' } },
    DELIVERY_RECEIVED: { type: 'DELIVERY_RECEIVED', actor: 'aisha', payload: { inboundId: inbound.id, expectedQty: 12, receivedQty: 8 } },
    CLAIM_RAISED: { type: 'CLAIM_RAISED', actor: 'system', payload: { claimId: 'CLM-D-1', supplierId: 'SUP-PRAIRIE', sku: 'SKU-100221', shortQty: 4, value: 16.68 } },
    STOCK_RISK_RAISED: { type: 'STOCK_RISK_RAISED', actor: 'system', payload: { offerId: 'OF-3101', sku: 'SKU-100221', coverDays: 0.5 } },
    STOCK_RISK_CLEARED: { type: 'STOCK_RISK_CLEARED', actor: 'system', payload: { offerId: 'OF-3101', sku: 'SKU-100221', coverDays: 1.5 } },
    SHELF_REFILLED: { type: 'SHELF_REFILLED', actor: 'aisha', payload: { sku: 'SKU-100221', qty: 8 } },
    COUNT_SUBMITTED: { type: 'COUNT_SUBMITTED', actor: 'aisha', payload: { countId: 'CNT-44821', lines: [{ sku: 'SKU-100214', systemQty: 19, actualQty: 0 }] } },
    RECALL_ISSUED: { type: 'RECALL_ISSUED', actor: 'system', payload: { recallId: 'RCL-2026-014', sku: 'SKU-100228', lots: ['PGD-26261A'], qty: 31 } },
    RECALL_PULLED: { type: 'RECALL_PULLED', actor: 'aisha', payload: { recallId: 'RCL-2026-014', sku: 'SKU-100228', lots: ['PGD-26261A'], qty: 12 } },
    NOTIFICATION_ADDED: { type: 'NOTIFICATION_ADDED', actor: 'system', payload: { role: 'priya', text: 'Test', link: null, severity: 'info' } },
    SUPPLY_ADDED: { type: 'SUPPLY_ADDED', actor: 'priya', payload: { promoId: 'PRM-2702', proposalId: 'PRP-00003', units: 2200 } },
    WASTE_LOGGED: { type: 'WASTE_LOGGED', actor: 'aisha', payload: { sku: 'SKU-100410', qty: 2, reason: 'Damaged' } },
    COUPON_ISSUED: { type: 'COUPON_ISSUED', actor: 'emily', payload: { couponId: 'CP-M-02', memberId: 'M-1001' } },
    MARKDOWN_RECOMMENDED: { type: 'MARKDOWN_RECOMMENDED', actor: 'priya', payload: { proposalId: yogurt.id, sku: 'SKU-100221' } },
  }
}

export const note = (text: string): EventDraft => ({ type: 'NOTIFICATION_ADDED', actor: 'system', payload: { role: 'emily', text, link: null, severity: 'info' } })
