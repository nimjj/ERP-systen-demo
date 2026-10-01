/**
 * Builds the starting AppState from seed/*.json (extracted from reference/mock by
 * scripts/extract-seed.ts). Returns a fresh deep copy on every call, so a reset
 * can never share objects with a previous run (A13).
 */
import type { AppState, Campaign, Claim, HandheldState, Inbound, Item, Offer, Persona, Position, PromosState, Proposal, Recall, Segment, SeriesPoint, Store, TillState } from '../domain/types'
import campaigns from '@seed/campaigns.json'
import claims from '@seed/claims.json'
import inbound from '@seed/inbound.json'
import items from '@seed/items.json'
import offers from '@seed/offers.json'
import personas from '@seed/personas.json'
import positions from '@seed/positions.json'
import promos from '@seed/promos.json'
import proposals from '@seed/proposals.json'
import recalls from '@seed/recalls.json'
import segments from '@seed/segments.json'
import series from '@seed/series.json'
import store from '@seed/store.json'
import tasks from '@seed/tasks.json'
import till from '@seed/till.json'

const raw = {
  store: store as unknown as Store,
  personas: personas as unknown as Persona[],
  items: items as unknown as Item[],
  positions: positions as unknown as Record<string, Position>,
  inbound: inbound as unknown as Inbound[],
  proposals: proposals as unknown as Proposal[],
  series: series as unknown as Record<string, SeriesPoint[]>,
  handheld: tasks as unknown as HandheldState,
  till: { ...(till as object), basket: [], memberId: null, blockedSkus: [] } as unknown as TillState,
  offers: offers as unknown as Offer[],
  campaigns: campaigns as unknown as Campaign[],
  segments: segments as unknown as Segment[],
  promos: promos as unknown as PromosState,
  claims: claims as unknown as Claim[],
  recalls: recalls as unknown as Recall[],
}

const seedJson = JSON.stringify(raw)

export function buildSeedState(): AppState {
  return { ...(JSON.parse(seedJson) as typeof raw), notifications: [], events: [] }
}

/** FNV-1a of the seed, so a persisted log from an older seed is discarded. */
export const seedHash: string = (() => {
  let h = 0x811c9dc5
  for (let i = 0; i < seedJson.length; i++) {
    h ^= seedJson.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return (h >>> 0).toString(16).padStart(8, '0')
})()
