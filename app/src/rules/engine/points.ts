/**
 * Loyalty points for a member sale (SPEC §5.5):
 *   points = floor(eligibleSpend × earnPerDollar × tierMultiplier) + bonus-rule points
 * Bonus rules are the till's live BONUS_POINTS rules: per unit for item rules,
 * once per basket for spend / category threshold rules; personal offers only for
 * their target members.
 */
import type { AppState, PointsReason, SaleLine } from '../../domain/types'

const cents = (n: number) => Math.round(n * 100) / 100

export function computePoints(state: AppState, memberId: string | null, lines: SaleLine[]): { points: number; reasons: PointsReason[] } | null {
  const member = memberId ? state.till.members.find((m) => m.id === memberId) : undefined
  if (!member) return null
  const { loyalty, catalogue, rules } = state.till
  const entry = (sku: string) => catalogue.find((c) => c.id === sku)
  const excluded = (loyalty.excludedDepts as string[] | undefined) ?? []
  const eligible = lines.filter((l) => {
    const e = entry(l.sku)
    return e ? e.points !== false && !excluded.includes(e.dept) : true
  })
  const spend = cents(eligible.reduce((s, l) => s + l.qty * l.price, 0))
  const multiplier = loyalty.tierMultiplier[member.tier] ?? 1
  const base = Math.floor(cents(spend * loyalty.earnPerDollar * multiplier))
  const reasons: PointsReason[] = [{ label: `Base points: $${spend.toFixed(2)} × ${multiplier} (${member.tier})`, points: base }]

  for (const rule of rules) {
    if (rule.type !== 'BONUS_POINTS' || rule.status !== 'live' || !rule.points) continue
    const targets = rule.targetMemberIds as string[] | undefined
    if (targets && !targets.includes(member.id)) continue
    const offerId = state.offers.find((o) => o.tillRuleId === rule.id && o.status === 'Live')?.id
    if (rule.itemIds) {
      const hit = eligible.filter((l) => rule.itemIds!.includes(l.sku))
      const qty = hit.reduce((s, l) => s + l.qty, 0)
      if (qty === 0) continue
      reasons.push({ label: rule.name, points: rule.points * qty, ruleId: rule.id, offerId, sku: hit[0].sku, qty, salesUsd: cents(hit.reduce((s, l) => s + l.qty * l.price, 0)) })
    } else if (rule.categories) {
      const catSpend = cents(eligible.filter((l) => rule.categories!.includes(entry(l.sku)?.category ?? '')).reduce((s, l) => s + l.qty * l.price, 0))
      if (catSpend >= (rule.minSpend ?? 0)) reasons.push({ label: rule.name, points: rule.points, ruleId: rule.id, offerId })
    } else if (rule.minSpend !== undefined && spend >= rule.minSpend) {
      reasons.push({ label: rule.name, points: rule.points, ruleId: rule.id, offerId })
    }
  }
  return { points: reasons.reduce((s, r) => s + r.points, 0), reasons }
}
