/**
 * Extract the Plano (US-DFW-1101) slice from reference/mock/*.json into seed/.
 *
 * - Reads reference/ only; never writes there.
 * - Applies the SPEC §10 fixes and the M0 decisions, logging each in seed/CHANGES.md.
 * - Deterministic: re-running produces byte-identical output.
 * - Fails loudly if the seed is internally inconsistent (positions vs proposals vs inbound).
 *
 * Run: node scripts/extract-seed.ts   (Node >= 22.6 with type stripping)
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { demoTuning } from '../app/src/config/demoTuning.ts'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const MOCK = join(ROOT, 'reference', 'mock')
const SEED = join(ROOT, 'seed')

const STORE_ID = 'US-DFW-1101'
const PERSONA_USER_IDS = ['U-1005', 'U-1006', 'U-1007', 'U-1002'] // Jamal, Aisha, Emily, Priya
const PERSONA_ROLE: Record<string, string> = { 'U-1005': 'jamal', 'U-1006': 'aisha', 'U-1007': 'emily', 'U-1002': 'priya' }
const SCOPE_PROMOS = ['PRM-2698', 'PRM-2702', 'PRM-2720', 'PRM-2641']
const SCOPE_OFFERS = ['OF-3101']
const SCOPE_CAMPAIGNS = ['CMP-505']
const HERO_ASN = 'ASN-US-778134'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Any = any

const load = (name: string): Any => JSON.parse(readFileSync(join(MOCK, `${name}.json`), 'utf8'))
const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v))
const ceilToCase = (q: number, casePack: number) => Math.ceil(q / casePack) * casePack

// ---------------------------------------------------------------- change log
type Change = { area: string; what: string; why: string }
const changes: Change[] = []
const change = (area: string, what: string, why: string) => changes.push({ area, what, why })

function fail(msg: string): never {
  throw new Error(`extract-seed: ${msg}`)
}

// ---------------------------------------------------------------- sources
const org = load('org')
const itemsSrc: Any[] = load('items')
const inventory = load('inventory')
const proposalsSrc: Any[] = load('proposals')
const seriesSrc = load('series')
const storeTasks = load('store-tasks')
const pos = load('pos')
const loyalty = load('loyalty')
const engage = load('engage')
const promoModule = load('promotions-module')
const supply = load('supply')
const ops = load('ops')
const admin = load('admin')

// ---------------------------------------------------------------- personas
const personas = PERSONA_USER_IDS.map((uid) => {
  const u = admin.users?.find((x: Any) => x.id === uid) ?? findDeep(admin, (x: Any) => x?.id === uid && x?.name)
  if (!u) fail(`persona ${uid} not found in admin.json`)
  return { role: PERSONA_ROLE[uid], userId: u.id, name: u.name, email: u.email, roleId: u.roleId, scope: u.scope }
})

function findDeep(node: Any, pred: (x: Any) => boolean): Any {
  if (pred(node)) return node
  if (node && typeof node === 'object') {
    for (const v of Object.values(node)) {
      const hit = findDeep(v, pred)
      if (hit) return hit
    }
  }
  return null
}

// ---------------------------------------------------------------- store
const orgStore = org.stores.find((s: Any) => s.id === STORE_ID) ?? fail('Plano not in org.json')
const location = inventory.locations.find((l: Any) => l.id === STORE_ID)
const store = {
  ...orgStore,
  displayName: pos.store.name,
  number: pos.store.number,
  address: pos.store.address,
  phone: pos.store.phone,
  lanes: pos.store.lanes,
  manager: location?.manager ?? null,
  districtManager: location?.districtManager ?? null,
  country: org.country,
  dcs: org.dcs,
  asOf: inventory.asOf,
  asOfLabel: inventory.asOfLabel,
}

// ---------------------------------------------------------------- proposals
const proposals = proposalsSrc.filter((p) => p.storeId === STORE_ID).map(clone)
if (proposals.length !== 11) fail(`expected 11 Plano proposals, got ${proposals.length}`)
const proposalBySku = new Map(proposals.map((p) => [p.itemId, p]))

// ---------------------------------------------------------------- positions
const positionsSrc: Any[] = inventory.positions.filter((p: Any) => p.locationId === STORE_ID)
if (positionsSrc.length !== 14) fail(`expected 14 Plano positions, got ${positionsSrc.length}`)

type Position = {
  sku: string
  positionId: string
  name: string
  onHand: number
  shelf: number
  backRoom: number
  quarantine: number
  rtvHold: number
  shelfCapacity: number
  dailyDemand: number
  lots: Any[]
  flags: string[]
  lastCounted: string | null
}

const positions: Record<string, Position> = {}
for (const p of positionsSrc) {
  positions[p.itemId] = {
    sku: p.itemId,
    positionId: p.id,
    name: p.itemName,
    onHand: p.onHand,
    shelf: p.sub.shelf,
    backRoom: p.sub.backRoom,
    quarantine: p.sub.quarantine,
    rtvHold: p.sub.rtvHold,
    shelfCapacity: p.shelfCapacity,
    dailyDemand: p.dailyDemand,
    lots: p.lots,
    flags: p.flags,
    lastCounted: p.lastCounted ?? null,
  }
}

// SPEC §10.1 — yogurt shelf/back room split from the gap scan.
{
  const gap = storeTasks.gaps.find((g: Any) => g.itemId === 'SKU-100221')
  const y = positions['SKU-100221']
  if (gap.systemQty + gap.backroomQty !== y.onHand) fail('yogurt gap split does not sum to onHand')
  y.shelf = gap.systemQty
  y.backRoom = gap.backroomQty
  change(
    'positions',
    `SKU-100221 Plain Greek Yogurt 32 oz: shelf 17 / back room 0 → shelf ${gap.systemQty} / back room ${gap.backroomQty}.`,
    'SPEC §10.1: the gap scan shows 9 on shelf and 8 in the back room; the split still sums to onHand 17.',
  )
}

// SPEC §6 — Plano holds no cheddar position; add one (numbers in demoTuning.cheddarPlanoPosition).
{
  const c = demoTuning.cheddarPlanoPosition
  if (positions[c.sku]) fail('Plano already has a cheddar position; remove the patch')
  const item = itemsSrc.find((i) => i.id === c.sku) ?? fail('cheddar item missing')
  const lotsQty = c.lots.reduce((a, l) => a + l.qty, 0)
  if (lotsQty !== c.shelf + c.backRoom) fail('cheddar lots do not sum to onHand')
  const recall = ops.recalls.find((r: Any) => r.id === 'RCL-2026-014')
  positions[c.sku] = {
    sku: c.sku,
    positionId: 'POS-PLANO-100228',
    name: item.name,
    onHand: c.shelf + c.backRoom,
    shelf: c.shelf,
    backRoom: c.backRoom,
    quarantine: 0,
    rtvHold: 0,
    shelfCapacity: c.shelfCapacity,
    dailyDemand: c.dailyDemand,
    lots: c.lots.map((l) => ({
      lot: l.lot,
      qty: l.qty,
      expiry: recall.lots.find((rl: Any) => rl.lot === l.lot)?.bestBy ?? null,
      ref: null,
    })),
    flags: [],
    lastCounted: null,
  }
  change(
    'positions',
    `Added Plano position for SKU-100228 Shredded Mild Cheddar 8 oz: shelf ${c.shelf}, back room ${c.backRoom}, shelf capacity ${c.shelfCapacity}, daily demand ${c.dailyDemand}, lots ${c.lots.map((l) => `${l.lot}×${l.qty}`).join(', ')}.`,
    'SPEC §6: Plano has no cheddar row in inventory.json, but store-tasks.json shows 31 on shelf (gap scan) and 7 cases on ASN-US-778134. Capacity and demand copied from Irving Market (same region and format); lot split is a demo value. All numbers live in demoTuning.cheddarPlanoPosition.',
  )
}

// ---------------------------------------------------------------- inbound
type Inbound = {
  id: string
  sku: string
  name: string
  casePack: number
  expectedQty: number
  receivedQty: number | null
  source: string
  status: 'ORDERED' | 'IN_TRANSIT' | 'RECEIVED' | 'HELD'
  asnId: string | null
  poId: string | null
  eta: string | null
  shortShip: boolean
}

const inbound: Inbound[] = []
const asn = storeTasks.asn
const droppedAsnLines: string[] = []
const resizedAsnLines: string[] = []

for (const line of asn.lines) {
  const sourceUnits = line.expectedCases * line.casePack
  const prop = proposalBySku.get(line.itemId)
  const posi = positions[line.itemId]
  let expectedQty: number
  if (prop) {
    // Decision M0 #4: proposal numbers win — the ASN line carries the proposal's inTransit.
    if (prop.inTransit === 0) {
      droppedAsnLines.push(`${line.itemId} ${line.name} (${line.expectedCases} cs)`)
      continue
    }
    expectedQty = prop.inTransit
  } else if (posi && line.itemId !== demoTuning.cheddarPlanoPosition.sku) {
    expectedQty = positionsSrc.find((p: Any) => p.itemId === line.itemId).inTransit
    if (expectedQty === 0) {
      droppedAsnLines.push(`${line.itemId} ${line.name} (${line.expectedCases} cs)`)
      continue
    }
  } else {
    expectedQty = sourceUnits // not planned by Priya; keep the ASN quantity
  }
  if (expectedQty !== sourceUnits) {
    resizedAsnLines.push(`${line.itemId} ${line.name}: ${line.expectedCases} cs (${sourceUnits}) → ${expectedQty / line.casePack} cs (${expectedQty})`)
  }
  inbound.push({
    id: `${HERO_ASN}:${line.itemId}`,
    sku: line.itemId,
    name: line.name,
    casePack: line.casePack,
    expectedQty,
    receivedQty: null,
    source: asn.source,
    status: 'IN_TRANSIT',
    asnId: asn.id,
    poId: asn.poId,
    eta: asn.eta,
    shortShip: line.shortShip,
  })
}
change(
  'inbound',
  `ASN-US-778134 lines resized to the planner's in-transit quantity: ${resizedAsnLines.join('; ')}.`,
  'Decision M0 #4 (proposal numbers win). Counting the original ASN quantities would make the yogurt seed order 0 instead of 6, breaking calibration (A0).',
)
change(
  'inbound',
  `ASN-US-778134 lines dropped (planner shows nothing in transit for them): ${droppedAsnLines.join('; ')}.`,
  'Decision M0 #4 (proposal numbers win). These SKUs have inTransit 0 in proposals.json/inventory.json.',
)

// In-transit stock not on the hero ASN (ambient lines from proposals / positions).
for (const p of positionsSrc) {
  const covered = inbound.some((i) => i.sku === p.itemId)
  const qty = proposalBySku.get(p.itemId)?.inTransit ?? p.inTransit
  if (covered || qty === 0) continue
  inbound.push({
    id: `INB-${STORE_ID}-${p.itemId}`,
    sku: p.itemId,
    name: p.itemName,
    casePack: p.casePack,
    expectedQty: qty,
    receivedQty: null,
    source: p.source,
    status: 'IN_TRANSIT',
    asnId: null,
    poId: null,
    eta: null,
    shortShip: false,
  })
}
change(
  'inbound',
  `Added in-transit records not on ASN-US-778134: ${inbound.filter((i) => !i.asnId).map((i) => `${i.sku} ${i.name} ${i.expectedQty}`).join('; ')}.`,
  'SPEC §2: inbound comes from proposals inTransit + supply.json pods. These quantities are in transit in proposals.json/inventory.json but on no ASN in the data; ids are generated (INB-…), eta unknown.',
)

// Positions store no inTransit/onOrder (engine derives inTransit from inbound and
// uses proposals.onOrder). Record the decision once.
change(
  'positions',
  'Dropped inTransit / onOrder / reserved / available / daysOfCover from positions.',
  'inventory.json positions.onOrder equals the proposed quantity (yogurt 6, eggs 30, water 170) and would double-count. The engine uses inbound[] for in transit and proposals.onOrder (0) for on order.',
)

// ---------------------------------------------------------------- tasks (handheld)
const tasks = storeTasks.tasks.map((t: Any) => ({
  id: t.id,
  kind: t.type === 'WASTE' ? 'MARKDOWN' : t.type,
  title: t.title,
  detail: t.detail,
  priority: t.priority,
  status: 'OPEN',
  ref: t.type === 'RECEIVE' ? asn.id : t.type === 'COUNT' ? storeTasks.count.id : null,
  createdBy: null,
}))
change('tasks', 't4 kind WASTE → MARKDOWN.', 'SPEC §4 task kinds are RECEIVE, COUNT, GAP, MARKDOWN, RECALL_PULL; t4 is the near-expiry markdown labels task.')

const countLines = storeTasks.count.lines.map((l: Any) => {
  const posi = positions[l.itemId]
  return { ...l, systemQty: posi ? posi.onHand : l.systemQty }
})
change(
  'tasks',
  `CNT-44821 systemQty aligned to positions.onHand: ${storeTasks.count.lines
    .filter((l: Any) => positions[l.itemId] && positions[l.itemId].onHand !== l.systemQty)
    .map((l: Any) => `${l.itemId} ${l.name} ${l.systemQty} → ${positions[l.itemId].onHand}`)
    .join('; ')}.`,
  'Decision M0 #4 (proposal numbers win). SPEC §10.2 asked for eggs 30, but positions/proposals say 19; the count now shows system 19, found 0 (variance −19). Other lines conflicted the same way.',
)

const gaps = storeTasks.gaps.map((g: Any) => {
  const posi = positions[g.itemId]
  return posi ? { ...g, systemQty: posi.shelf, backroomQty: posi.backRoom } : g
})
{
  const diffs = storeTasks.gaps
    .filter((g: Any) => positions[g.itemId] && (positions[g.itemId].shelf !== g.systemQty || positions[g.itemId].backRoom !== g.backroomQty))
    .map((g: Any) => `${g.itemId} ${g.name} ${g.systemQty}/${g.backroomQty} → ${positions[g.itemId].shelf}/${positions[g.itemId].backRoom}`)
  change('tasks', `Gap scan shelf/back room aligned to positions: ${diffs.join('; ')}.`, 'Decision M0 #4 (proposal numbers win): one stock number per SKU across all panes.')
}

const asnSeed = {
  id: asn.id,
  poId: asn.poId,
  storeId: asn.storeId,
  source: asn.source,
  truck: asn.truck,
  eta: asn.eta,
  lines: inbound
    .filter((i) => i.asnId === asn.id)
    .map((i) => {
      const src = asn.lines.find((l: Any) => l.itemId === i.sku)
      return { itemId: i.sku, gtin: src.gtin, name: i.name, casePack: i.casePack, expectedCases: i.expectedQty / i.casePack, expiry: src.expiry, shortShip: src.shortShip }
    }),
}

const tasksSeed = {
  user: { name: personas.find((p) => p.role === 'aisha')!.name, role: storeTasks.user.role },
  tasks,
  asn: asnSeed,
  count: { ...storeTasks.count, lines: countLines },
  gaps,
}

// ---------------------------------------------------------------- proposals: eggs phantom (decision #4)
{
  const eggs = proposalBySku.get('SKU-100214')
  const signal = demoTuning.phantomSignals['SKU-100214']
  const expected = (eggs.dailyForecast * signal.hoursWithoutSale) / 24
  const p = Math.exp(-expected)
  if (!(p < demoTuning.phantomPThreshold)) fail('eggs phantom signal does not reach threshold')
  const ifEmpty = ceilToCase(Math.max(0, eggs.orderUpTo - (0 + eggs.inTransit + eggs.onOrder)) + eggs.prebuild, eggs.casePack)
  eggs.exception = {
    code: 'PHANTOM_SUSPECTED',
    label: 'Possible phantom stock',
    severity: 'high',
    explanation: `System shows ${eggs.onHand} on hand, but there have been no sales for ${signal.hoursWithoutSale} hours where ${Math.round(expected)} were expected (p < 0.01). The shelf may be empty. A count task has been sent to the store. If the count finds it empty, order ${ifEmpty} units instead of ${eggs.proposedQty}.`,
  }
  eggs.ifEmptyQty = ifEmpty
  eggs.status = 'PENDING_REVIEW'
  change(
    'proposals',
    `PRP-00005 Large Grade A Eggs 18 ct: exception null → PHANTOM_SUSPECTED, status AUTO_RELEASED → PENDING_REVIEW, ifEmptyQty → ${ifEmpty}. proposedQty stays ${eggs.proposedQty}.`,
    'Decision M0 #4: eggs phantom driven by demoTuning.phantomSignals (8 h without a sale). Needed for count task CNT-44821 and A10. Explanation text follows the format of the other PHANTOM_SUSPECTED lines in proposals.json.',
  )
}

// ---------------------------------------------------------------- series
const series: Record<string, Any[]> = {}
for (const p of proposals) {
  const key = `${STORE_ID}|${p.itemId}`
  if (!seriesSrc[key]) fail(`series missing ${key}`)
  series[p.itemId] = seriesSrc[key]
}

// ---------------------------------------------------------------- till
const tillRules = pos.rules.map(clone)
{
  const r = tillRules.find((x: Any) => x.id === 'R-BP-801')
  r.status = 'inactive'
  change('till', 'R-BP-801 (+200 bonus points on Greek Yogurt 32 oz) status live → inactive.', 'Decision M0 #2: seed is the "before" state. Emily publishing OF-3101 activates it (C1).')
}
const tillSeed = {
  asOf: pos.asOf,
  week: pos.week,
  taxRate: pos.taxRate,
  taxLabel: pos.taxLabel,
  store: pos.store,
  cashier: { id: personas.find((p) => p.role === 'jamal')!.userId, name: personas.find((p) => p.role === 'jamal')!.name, role: 'Cashier' },
  managers: pos.managers,
  catalogue: pos.catalogue,
  quickKeys: pos.quickKeys,
  scanScript: pos.scanScript,
  scaleWeights: pos.scaleWeights,
  rules: tillRules,
  coupons: pos.coupons,
  members: pos.members,
  loyalty: pos.loyalty,
  payments: pos.payments,
  shift: pos.shift,
  stacking: pos.stacking,
}
change('till', 'Cashier is Jamal Carter (admin.json U-1005).', 'pos.json cashiers do not include the persona; admin.json does.')

// ---------------------------------------------------------------- offers / campaigns / segments
const offers = loyalty.offers.filter((o: Any) => SCOPE_OFFERS.includes(o.id)).map(clone)
{
  const o = offers.find((x: Any) => x.id === 'OF-3101')
  const rule = tillRules.find((x: Any) => x.id === 'R-BP-801')
  const before = { name: o.name, status: o.status, clipped: o.clipped, redeemed: o.redeemed, costUsd: o.costUsd, incrementalSalesUsd: o.incrementalSalesUsd }
  o.name = rule.name
  o.status = 'Draft'
  o.itemIds = rule.itemIds
  o.storeIds = [STORE_ID]
  o.tillRuleId = rule.id
  o.bonusPoints = rule.points
  for (const k of ['clipped', 'redeemed', 'clipRatePct', 'redemptionRatePct', 'costUsd', 'vendorPaidUsd', 'incrementalSalesUsd']) o[k] = 0
  change('offers', `OF-3101 name "${before.name}" → "${o.name}".`, 'SPEC §10.3: relabel the offer to match till rule R-BP-801 (+200 bonus points).')
  change(
    'offers',
    `OF-3101 status ${before.status} → Draft; counters zeroed (were clipped ${before.clipped}, redeemed ${before.redeemed}, cost $${before.costUsd}, incremental $${before.incrementalSalesUsd}).`,
    'Decision M0 #2: seed is the "before" state; Emily publishes OF-3101 in S1. A draft offer cannot show redemptions; counters then tick up live from real till sales (C7).',
  )
  change('offers', 'OF-3101 gains itemIds [SKU-100221], storeIds [US-DFW-1101], tillRuleId R-BP-801, bonusPoints 200.', 'loyalty.json offers carry no item or store link; taken from till rule R-BP-801.')
}

const campaigns = engage.marketing.campaigns.filter((c: Any) => SCOPE_CAMPAIGNS.includes(c.id)).map(clone)
{
  const c = campaigns.find((x: Any) => x.id === 'CMP-505')
  const o = offers.find((x: Any) => x.id === 'OF-3101')
  const before = { name: c.name, seg: c.segmentName, aud: c.audience, status: c.status }
  c.segmentId = null
  c.segmentName = o.audience
  c.audience = o.targeted
  c.name = 'Fall dairy bonus points'
  c.offerName = o.name
  c.status = 'Draft'
  c.results = null
  change('campaigns', `CMP-505 audience "${before.seg}" (${before.aud}) → "${c.segmentName}" (${c.audience}); segmentId SEG-09 → null.`, 'SPEC §10.4: campaign audience set to the offer audience. No segment in engage.json matches it, so the size is the offer\'s targeted count.')
  change('campaigns', `CMP-505 name "${before.name}" → "${c.name}", offerName follows OF-3101.`, 'Same inconsistency as SPEC §10.3: "3x points" contradicts the +200 bonus points rule.')
  change('campaigns', `CMP-505 status ${before.status} → Draft; results cleared.`, 'Decision M0 #2: the campaign cannot be live before its offer is published.')
}
const segments = engage.marketing.segments

// ---------------------------------------------------------------- promos
const promos = {
  mechanics: promoModule.mechanics,
  itemBaselines: promoModule.itemBaselines,
  stockCapacity: promoModule.stockCapacity,
  promotions: promoModule.promotions.filter((p: Any) => SCOPE_PROMOS.includes(p.id)),
}
if (promos.promotions.length !== SCOPE_PROMOS.length) fail('missing scoped promo')
change('promos', `Kept only ${SCOPE_PROMOS.join(', ')} of ${promoModule.promotions.length} promotions.`, 'SPEC §2 / §6 scope.')
change(
  'promos',
  'PRM-2698 stays Live; its uplift is treated as already inside dailyForecast (demoTuning.upliftBakedIntoForecast).',
  'Decision M0 #2: otherwise yogurt would start with a 0.40 uplift and the seed order would not be 6.',
)

// ---------------------------------------------------------------- claims
const sliceSkus = new Set([...Object.keys(positions), ...inbound.map((i) => i.sku)])
const claims = supply.claims.filter((c: Any) => sliceSkus.has(c.itemId)).map((c: Any) => ({ ...c, storeId: null, raisedInDemo: false }))
change(
  'claims',
  `Kept ${claims.length} of ${supply.claims.length} claims (items in the Plano slice); added storeId null, raisedInDemo false.`,
  'Decision M0 #3: SUPPLIER_CONSTRAINT only counts claims raised during the demo; seed claims are history.',
)

// ---------------------------------------------------------------- recalls
const recalls = ops.recalls.map(clone)
{
  const r = recalls.find((x: Any) => x.id === 'RCL-2026-014')
  const c = demoTuning.cheddarPlanoPosition
  r.status = 'NOT_ISSUED'
  r.issued = null
  r.posBlock = { blocked: false, blockedAt: null, blockedScans: 0 }
  for (const s of r.stores) {
    s.confirmedBy = null
    for (const l of s.lots) l.pulled = 0
  }
  r.stores.unshift({ storeId: STORE_ID, storeName: orgStore.name, region: orgStore.region, lots: c.lots.map((l) => ({ lot: l.lot, onHand: l.qty, pulled: 0 })), confirmedBy: null })
  change('recalls', 'RCL-2026-014 status → NOT_ISSUED: issued null, POS block off, every store row pulled 0 / confirmedBy null.', 'Decision M0 #2: the presenter issues the recall in S3 (C14).')
  change('recalls', 'RCL-2026-014 gains a Plano store row with the cheddar lots from demoTuning.cheddarPlanoPosition.', 'SPEC §6: Plano was not among the 21 stores in ops.json.')
  const r15 = recalls.find((x: Any) => x.id === 'RCL-2026-015')
  r15.status = 'CLOSED'
  change('recalls', 'RCL-2026-015 status → CLOSED (history).', 'Decision M0 #2: Plano already pulled 11/11 (confirmed by Aaliyah Lopez); current strawberry lots are different lots.')
}

// ---------------------------------------------------------------- items
for (const p of promos.promotions) for (const id of p.itemIds) sliceSkus.add(id)
const catalogueById = new Map(pos.catalogue.map((c: Any) => [c.gtin, c.id]))
for (const code of pos.scanScript) {
  const id = catalogueById.get(code)
  if (id) sliceSkus.add(id as string)
}
const items = itemsSrc.filter((i) => sliceSkus.has(i.id))

// ---------------------------------------------------------------- invariants
for (const p of proposals) {
  const posi = positions[p.itemId] ?? fail(`no position for proposal ${p.id}`)
  if (posi.onHand !== p.onHand) fail(`${p.itemId}: position onHand ${posi.onHand} ≠ proposal ${p.onHand}`)
  const inT = inbound.filter((i) => i.sku === p.itemId).reduce((a, i) => a + i.expectedQty, 0)
  if (inT !== p.inTransit) fail(`${p.itemId}: inbound ${inT} ≠ proposal inTransit ${p.inTransit}`)
  // Calibration (A0) on the seed itself.
  const q = ceilToCase(Math.max(0, p.orderUpTo - (p.onHand + p.inTransit + p.onOrder)) + p.prebuild, p.casePack)
  if (p.status === 'AUTO_RELEASED' && q !== p.proposedQty) fail(`${p.id}: calibration ${q} ≠ ${p.proposedQty}`)
}
for (const s of Object.values(positions)) {
  if (s.shelf + s.backRoom + s.quarantine + s.rtvHold !== s.onHand) fail(`${s.sku}: sub-locations do not sum to onHand`)
}

// ---------------------------------------------------------------- write
mkdirSync(SEED, { recursive: true })
const write = (name: string, data: unknown) => writeFileSync(join(SEED, name), JSON.stringify(data, null, 2) + '\n')

write('meta.json', { storeId: STORE_ID, sourceAsOf: inventory.asOf, source: 'reference/mock', generator: 'scripts/extract-seed.ts' })
write('personas.json', personas)
write('store.json', store)
write('items.json', items)
write('positions.json', positions)
write('inbound.json', inbound)
write('proposals.json', proposals)
write('series.json', series)
write('tasks.json', tasksSeed)
write('till.json', tillSeed)
write('offers.json', offers)
write('campaigns.json', campaigns)
write('segments.json', segments)
write('promos.json', promos)
write('claims.json', claims)
write('recalls.json', recalls)

const md = [
  '# seed/CHANGES.md',
  '',
  'Generated by `scripts/extract-seed.ts` from `reference/mock/*.json`. Do not edit by hand; edit the script and re-run.',
  '',
  'Every place the seed differs from the source data, and why. "Decision M0 #n" refers to the user decisions recorded at M0:',
  '1. Layout: prototype in `reference/`, docs in `docs/`.',
  '2. Seed is the "before" state (OF-3101 draft, R-BP-801 inactive, PRM-2698 uplift baked in, RCL-2026-014 not issued, Plano cheddar position added, RCL-2026-015 history).',
  '3. Exception rules calibrated to the seed (autoReleaseTolerance 1.0, SUPPLIER_CONSTRAINT only for demo claims, PROMO_UPLIFT when uplift raises qty).',
  '4. Proposal numbers win (eggs onHand 19, count variance −19, eggs phantom via demoTuning, yogurt ASN line 1 case).',
  '',
  ...[...new Set(changes.map((c) => c.area))].flatMap((area) => [
    `## ${area}`,
    '',
    ...changes.filter((c) => c.area === area).flatMap((c) => [`- **${c.what}**`, `  ${c.why}`]),
    '',
  ]),
].join('\n')
writeFileSync(join(SEED, 'CHANGES.md'), md)

console.log(`seed written: ${Object.keys(positions).length} positions, ${proposals.length} proposals, ${inbound.length} inbound, ${items.length} items, ${changes.length} changes`)
