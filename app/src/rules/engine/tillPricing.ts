/**
 * Till pricing (SPEC §6): prices a basket with the till's live rules in the
 * stacking order from pos.json — member price → multi-buy / BOGO / mix & match →
 * % off → basket threshold. Only the steps present in the seed rules are
 * implemented (coupons and employee discount are not used in the demo).
 * Non-stackable item promotions: one per line, the first in stacking order wins.
 * Tax: Texas 8.25% on taxable lines. Bonus points are shown via computePoints.
 */
import type { AppState, PointsReason, SaleLine, TillRule } from '../../domain/types'
import { computePoints } from './points'

export interface BasketItem {
  sku: string
  /** Units, or pounds for weighed items. */
  qty: number
}

export interface Adjustment {
  ruleId: string
  label: string
  amount: number
}

export interface PricedLine {
  sku: string
  name: string
  qty: number
  unit: string
  unitPrice: number
  base: number
  adjustments: Adjustment[]
  net: number
  taxable: boolean
  bonus: PointsReason[]
}

export interface PricedBasket {
  lines: PricedLine[]
  basketAdjustments: Adjustment[]
  items: number
  subtotal: number
  savings: number
  tax: number
  total: number
  points: { points: number; reasons: PointsReason[] } | null
  saleLines: SaleLine[]
}

const cents = (n: number) => Math.round(n * 100) / 100
const STAGE: Record<string, number> = { MEMBER_PRICE: 2, MULTI_BUY: 3, MIX_MATCH: 3, BOGO: 3, PCT_OFF: 4 }

export function catalogueEntry(state: AppState, sku: string) {
  return state.till.catalogue.find((c) => c.id === sku)
}

/** Scan code (GTIN or PLU) → catalogue SKU. */
export function resolveCode(state: AppState, code: string): string | null {
  const byGtin = state.till.catalogue.find((c) => c.gtin === code)
  if (byGtin) return byGtin.id
  return state.till.catalogue.find((c) => c.id === `PLU-${code}`)?.id ?? null
}

export function priceBasket(state: AppState, basket: BasketItem[], memberId: string | null): PricedBasket {
  const member = memberId ? state.till.members.find((m) => m.id === memberId) : undefined
  const lines: PricedLine[] = basket.map((b) => {
    const e = catalogueEntry(state, b.sku)
    const unitPrice = e?.price ?? 0
    const base = cents(unitPrice * b.qty)
    return { sku: b.sku, name: e?.name ?? b.sku, qty: b.qty, unit: e?.unit ?? 'each', unitPrice, base, adjustments: [], net: base, taxable: e?.taxable ?? false, bonus: [] }
  })

  const itemRules = state.till.rules
    .filter((r) => r.status === 'live' && STAGE[r.type] !== undefined)
    .sort((a, b) => STAGE[a.type] - STAGE[b.type])
  const promoted = new Set<number>() // line indexes that already carry a non-stackable item promo

  const covers = (r: TillRule, l: PricedLine) => (r.itemIds ? r.itemIds.includes(l.sku) : r.categories ? r.categories.includes(catalogueEntry(state, l.sku)?.category ?? '') : false)
  const apply = (i: number, r: TillRule, amount: number) => {
    if (amount <= 0) return
    const l = lines[i]
    l.adjustments.push({ ruleId: r.id, label: r.name, amount: -cents(amount) })
    l.net = cents(l.net - amount)
    if (!r.stackable) promoted.add(i)
  }

  for (const r of itemRules) {
    if (r.membersOnly && !member) continue
    const idx = lines.map((_, i) => i).filter((i) => covers(r, lines[i]) && !promoted.has(i))
    if (idx.length === 0) continue
    switch (r.type) {
      case 'MEMBER_PRICE':
        for (const i of idx) apply(i, r, (lines[i].unitPrice - (r.price ?? lines[i].unitPrice)) * lines[i].qty)
        break
      case 'MULTI_BUY':
        for (const i of idx) {
          const groups = Math.floor(lines[i].qty / (r.qty ?? 1))
          apply(i, r, groups * ((r.qty ?? 1) * lines[i].unitPrice - (r.price ?? 0)))
        }
        break
      case 'MIX_MATCH':
      case 'BOGO': {
        // Units across all covered lines, most expensive first.
        const units = idx.flatMap((i) => Array.from({ length: Math.floor(lines[i].qty) }, () => i)).sort((a, b) => lines[b].unitPrice - lines[a].unitPrice)
        if (r.type === 'BOGO') {
          const size = (r.qty ?? 1) + (r.getQty ?? 1)
          const free = Math.floor(units.length / size) * (r.getQty ?? 1)
          const pct = (r.getPct ?? 100) / 100
          const freeUnits = units.slice(units.length - free) // cheapest units are free
          const byLine = new Map<number, number>()
          for (const i of freeUnits) byLine.set(i, (byLine.get(i) ?? 0) + lines[i].unitPrice * pct)
          for (const [i, amt] of byLine) apply(i, r, amt)
        } else {
          const n = r.qty ?? 1
          const groups = Math.floor(units.length / n)
          const inDeal = units.slice(0, groups * n)
          const regular = inDeal.reduce((s, i) => s + lines[i].unitPrice, 0)
          const saving = regular - groups * (r.price ?? 0)
          if (saving <= 0) break
          const byLine = new Map<number, number>()
          for (const i of inDeal) byLine.set(i, (byLine.get(i) ?? 0) + (lines[i].unitPrice / regular) * saving)
          for (const [i, amt] of byLine) apply(i, r, amt)
        }
        break
      }
      case 'PCT_OFF':
        for (const i of idx) apply(i, r, (lines[i].net * (r.pct ?? 0)) / 100)
        break
    }
  }

  const basketAdjustments: Adjustment[] = []
  for (const r of state.till.rules) {
    if (r.status !== 'live' || r.type !== 'SPEND_SAVE') continue
    const excluded = (r.excludeDepts as string[] | undefined) ?? []
    const spend = lines.filter((l) => !excluded.includes(catalogueEntry(state, l.sku)?.dept ?? '')).reduce((s, l) => s + l.net, 0)
    if (spend >= (r.threshold ?? Infinity)) basketAdjustments.push({ ruleId: r.id, label: r.name, amount: -(r.amount ?? 0) })
  }

  const saleLines: SaleLine[] = lines.map((l) => ({ sku: l.sku, qty: l.qty, price: l.qty > 0 ? cents(l.net / l.qty) : 0, promoApplied: l.adjustments.map((a) => a.ruleId) }))
  const points = computePoints(state, memberId, saleLines)
  if (points) {
    for (const reason of points.reasons) {
      const line = reason.sku ? lines.find((l) => l.sku === reason.sku) : undefined
      if (line) line.bonus.push(reason)
    }
  }

  // Savings are derived from the rounded line nets, so subtotal − savings + tax = total to the cent.
  const subtotal = cents(lines.reduce((s, l) => s + l.base, 0))
  const basketSavings = basketAdjustments.reduce((s, a) => s + a.amount, 0)
  const tax = cents(lines.filter((l) => l.taxable).reduce((s, l) => s + l.net, 0) * state.till.taxRate)
  const net = cents(lines.reduce((s, l) => s + l.net, 0) + basketSavings)
  return {
    lines,
    basketAdjustments,
    items: lines.reduce((s, l) => s + (l.unit === 'each' ? l.qty : 1), 0),
    subtotal,
    savings: cents(subtotal - net),
    tax,
    total: cents(net + tax),
    points,
    saleLines,
  }
}
