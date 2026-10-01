/**
 * C7 (P0) Jamal → Emily. A member sale awards points: base points by tier plus
 * the till's live bonus rules. Bonus reasons tied to a live offer carry its id,
 * and the POINTS_AWARDED reducer ticks that offer's counters (redeemed,
 * incremental sales, supplier funding).
 */
import type { DemoEvent, Rule } from '../domain/types'
import { computePoints } from './engine/points'

export const c7MemberPoints: Rule = {
  id: 'C7-member-points',
  on: ['SALE_COMPLETED'],
  run(state, event) {
    const { memberId, lines } = (event as DemoEvent<'SALE_COMPLETED'>).payload
    const result = computePoints(state, memberId, lines)
    if (!result || !memberId) return { state, newEvents: [] }
    return { state, newEvents: [{ type: 'POINTS_AWARDED', actor: 'system', payload: { memberId, points: result.points, reasons: result.reasons } }] }
  },
}
