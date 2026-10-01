/**
 * Demo tuning — every demo-only number lives here, labelled.
 *
 * Rule code must read these values; never hard-code them in rules.
 * Values marked "SOURCE" come straight from reference/mock. Values marked
 * "DEMO" are not in the data and were chosen for the demo (see seed/CHANGES.md).
 *
 * Keep this file free of imports and non-erasable TypeScript: the seed
 * extraction script (scripts/extract-seed.ts) imports it with plain Node.
 */
export const demoTuning = {
  /** DEMO. Uplift for bonus-points offers. Source value is 0.10 (promotions-module mechanics), too small to see on screen. */
  offerUplift: 0.4,

  /** DEMO (bonus points) + SOURCE (others, promotions-module.json mechanics[].baseUplift). */
  upliftByMechanic: {
    'Bonus points': 0.4,
    'Member price': 0.2,
    '% off': 0.2,
    'Multi-buy': 0.25,
    BOGO: 0.35,
  } as Record<string, number>,

  /**
   * DEMO (decision M0). Promos already live at seed whose uplift is treated as
   * already inside dailyForecast, so they add no extra uplift. PRM-2698 has been
   * live since 21 Sep; without this the hero yogurt would not start at 6.
   */
  upliftBakedIntoForecast: ['PRM-2698'] as string[],

  /** DEMO. Stock-risk threshold in days of cover (C9). */
  riskCoverDays: 1.0,

  /** SOURCE-aligned. Matches the LARGE_DEVIATION wording in proposals.json (~75%+ above usual order). */
  largeDeviationPct: 75,

  /**
   * DEMO (decision M0). A line with no exception stays AUTO_RELEASED while
   * qty <= lastOrderQty * (1 + tolerance). SPEC said 0.25, which would push
   * Half & Half 24/12, 2% Milk 76/48 and Water 170/86 to review at seed.
   * 1.0 keeps every seed AUTO_RELEASED line auto-released.
   */
  autoReleaseTolerance: 1.0,

  /**
   * DEMO (decision M0). SUPPLIER_CONSTRAINT is raised only by claims created
   * during the demo (events), not by the historical claims in the seed.
   */
  supplierConstraintFromSeedClaims: false,

  /**
   * DEMO (decision M0). Phantom-stock signal for the PHANTOM_SUSPECTED rule:
   * hours since the last sale. expectedSales = dailyForecast * hours / 24;
   * flagged when exp(-expectedSales) < 0.01. Data shows eggs selling just now
   * (lastSaleAt = asOf), so the signal is a demo value.
   * Eggs: 17.6/day * 8h / 24 = 5.87 expected → p = 0.003.
   */
  phantomSignals: {
    'SKU-100214': { hoursWithoutSale: 8 },
  } as Record<string, { hoursWithoutSale: number }>,
  phantomPThreshold: 0.01,

  /**
   * DEMO (SPEC §6). Plano holds no SKU-100228 position in inventory.json.
   * shelf 31 / backRoom 0: SOURCE, store-tasks.json gap scan.
   * inTransit 84: SOURCE, ASN-US-778134 line (7 cases x 12).
   * shelfCapacity 80 / dailyDemand 16: DEMO, copied from Irving Market
   * (US-DFW-1104, same region and Market format) in inventory.json.
   * Lot split: DEMO, recall lots from ops.json RCL-2026-014.
   */
  cheddarPlanoPosition: {
    sku: 'SKU-100228',
    shelf: 31,
    backRoom: 0,
    shelfCapacity: 80,
    dailyDemand: 16,
    lots: [
      { lot: 'PGD-26261A', qty: 12 },
      { lot: 'PGD-26261B', qty: 12 },
      { lot: 'PGD-26263A', qty: 7 },
    ],
  },

  /**
   * DEMO (SPEC §5.3 fallback). Promo stock check, units per week, network level.
   * demand = forecast.promoUnits / weeks
   * supply = sum(stockCapacity[item]) + stockCheck.prebuildUnits / weeks (− DC short for PRM-2720)
   *   PRM-2698: 15869/2 = 7935  vs 11629 + 245        = 11874 → 1.50 Pass
   *   PRM-2702: 26302/2 = 13151 vs 9169 + 1820        = 10989 → 0.84 Warn
   *   PRM-2720: 28829/2 = 14415 vs 10024 + 2085 − 2325 = 9784 → 0.68 Fail
   */
  promoStockCheck: {
    'PRM-2698': { demandUnits: 7935, supplyUnits: 11874 },
    'PRM-2702': { demandUnits: 13151, supplyUnits: 10989 },
    'PRM-2720': { demandUnits: 14415, supplyUnits: 9784 },
  } as Record<string, { demandUnits: number; supplyUnits: number }>,
  promoCoverage: { pass: 1.0, warn: 0.8 },

  /**
   * DEMO (C11). Approving the Plano Cola pre-build line (PRP-00003) stands in for
   * releasing the network pre-build for PRM-2702. 10989 + 2200 = 13189 → 1.003 Pass.
   */
  promoSupplyOnApproval: {
    'PRM-2702': { proposalId: 'PRP-00003', addsUnits: 2200 },
  } as Record<string, { proposalId: string; addsUnits: number }>,

  /** SOURCE. Points value: 1,000 pts = $5 (pos.json loyalty, loyalty.json pointValueUsd). */
  supplierFundingPerPoint: 0.005,

  /** DEMO. Presenter "Simulate sales" button. */
  simulateSales: { perClick: 10 },

  /** DEMO. S1 step 6 short delivery. */
  shortShip: { defaultExpected: 12, defaultReceived: 8 },

  /** DEMO. Highlight flash on changed values. */
  animationMs: 600,

  /** DEMO. Cross-tab sync must deliver within this many ms (A14). */
  syncBudgetMs: 1000,
}

export type DemoTuning = typeof demoTuning
