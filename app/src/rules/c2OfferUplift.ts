/**
 * C2 (P0) Emily → Priya. A published offer adds demand uplift to its items
 * (demoTuning.offerUplift), so their proposals are recomputed; pausing removes
 * the uplift again (the planner side of C10, needed by A7).
 */
import type { DemoEvent, Rule } from '../domain/types'
import { recomputeDrafts } from './engine/proposal'

export const c2OfferUplift: Rule = {
  id: 'C2-offer-uplift',
  on: ['OFFER_PUBLISHED', 'OFFER_PAUSED'],
  run(state, event) {
    const { offerId } = (event as DemoEvent<'OFFER_PUBLISHED'>).payload
    const offer = state.offers.find((o) => o.id === offerId)
    return { state, newEvents: offer ? recomputeDrafts(state, offer.itemIds) : [] }
  },
}
