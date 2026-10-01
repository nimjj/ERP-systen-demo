/**
 * C1 (P0) Emily → Jamal. Publishing an offer switches its till rule on for the
 * store; pausing switches it off (the till side of C10, needed by A7).
 */
import { produce } from 'immer'
import type { DemoEvent, Rule } from '../domain/types'
import { notify } from './notify'

export const c1TillRuleFromOffer: Rule = {
  id: 'C1-till-rule-from-offer',
  on: ['OFFER_PUBLISHED', 'OFFER_PAUSED'],
  run(state, event) {
    const { offerId } = (event as DemoEvent<'OFFER_PUBLISHED'>).payload
    const offer = state.offers.find((o) => o.id === offerId)
    const rule = offer && state.till.rules.find((r) => r.id === offer.tillRuleId)
    if (!offer || !rule) return { state, newEvents: [] }
    const publishing = event.type === 'OFFER_PUBLISHED'
    const status = publishing ? 'live' : 'inactive'
    if (rule.status === status) return { state, newEvents: [] }
    const next = produce(state, (d) => {
      d.till.rules.find((r) => r.id === rule.id)!.status = status
    })
    const text = publishing ? `New on the till: ${rule.name} (${offer.id}). Members get it automatically.` : `Till promotion stopped: ${rule.name} (${offer.id} paused).`
    return { state: next, newEvents: [notify('jamal', text, publishing ? 'success' : 'warning', `till-rule:${rule.id}`)] }
  },
}
