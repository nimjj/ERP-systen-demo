/** Stock risk while an offer is live (SPEC §5.4, C9). */
import { demoTuning } from '../../config/demoTuning'
import type { AppState, EventDraft, Offer } from '../../domain/types'
import { effectiveDaily } from './uplift'

/** Cover is shown rounded down, so a value just under the threshold never displays as the threshold. */
const floor2 = (n: number) => Math.floor(n * 100) / 100

/** Exact days of cover; compare this against the threshold and round only for display. */
export function coverDays(state: AppState, sku: string): number {
  const daily = effectiveDaily(state, sku)
  const onHand = state.positions[sku]?.onHand ?? 0
  return daily > 0 ? onHand / daily : Infinity
}

const liveOffersFor = (state: AppState, sku: string): Offer[] =>
  state.offers.filter((o) => o.status === 'Live' && o.itemIds.includes(sku) && o.storeIds.includes(state.store.id))

const itemName = (state: AppState, sku: string) => state.positions[sku]?.name ?? sku

/** Raise or clear risks for live offers covering these SKUs. */
export function riskDrafts(state: AppState, skus: readonly string[]): EventDraft[] {
  const drafts: EventDraft[] = []
  for (const sku of skus) {
    const cover = coverDays(state, sku)
    for (const offer of liveOffersFor(state, sku)) {
      const active = state.stockRisks.some((r) => r.offerId === offer.id && r.sku === sku)
      if (cover < demoTuning.riskCoverDays && !active) {
        drafts.push(
          { type: 'STOCK_RISK_RAISED', actor: 'system', payload: { offerId: offer.id, sku, coverDays: floor2(cover) } },
          {
            type: 'NOTIFICATION_ADDED',
            actor: 'system',
            payload: {
              role: 'emily',
              text: `Stock risk on ${offer.id}: ${itemName(state, sku)} has ${floor2(cover).toFixed(2)} days of cover at ${state.store.name}. Consider pausing the offer.`,
              link: `offer:${offer.id}`,
              severity: 'warning',
            },
          },
        )
      } else if (cover >= demoTuning.riskCoverDays && active) {
        drafts.push(...clearDraft(state, offer.id, sku, cover))
      }
    }
  }
  return drafts
}

/** Clear every risk of an offer that is no longer live. */
export function clearOfferRisks(state: AppState, offerId: string): EventDraft[] {
  return state.stockRisks.filter((r) => r.offerId === offerId).flatMap((r) => clearDraft(state, offerId, r.sku, coverDays(state, r.sku)))
}

function clearDraft(state: AppState, offerId: string, sku: string, cover: number): EventDraft[] {
  return [
    { type: 'STOCK_RISK_CLEARED', actor: 'system', payload: { offerId, sku, coverDays: Number.isFinite(cover) ? floor2(cover) : 0 } },
    {
      type: 'NOTIFICATION_ADDED',
      actor: 'system',
      payload: { role: 'emily', text: `Stock risk cleared on ${offerId}: ${itemName(state, sku)} is back to ${Number.isFinite(cover) ? floor2(cover).toFixed(2) : '—'} days of cover.`, link: `offer:${offerId}`, severity: 'success' },
    },
  ]
}
