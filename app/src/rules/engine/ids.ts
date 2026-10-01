/** Deterministic ids derived from state (rules may not use clocks or randomness). */
import type { AppState } from '../../domain/types'

/** Next CLM-#### after the highest numeric claim id in state. */
export function nextClaimId(state: AppState): string {
  const max = state.claims.reduce((m, c) => {
    const n = /^CLM-(\d+)$/.exec(c.id)
    return n ? Math.max(m, Number(n[1])) : m
  }, 0)
  return `CLM-${max + 1}`
}

/** IN-<proposalId>-<n>: one per approval of that proposal. */
export function nextInboundId(state: AppState, proposalId: string): string {
  const n = state.inbound.filter((i) => i.id.startsWith(`IN-${proposalId}-`)).length + 1
  return `IN-${proposalId}-${n}`
}
