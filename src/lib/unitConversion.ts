/**
 * unitConversion.ts
 *
 * Handles all unit conversions for BakeKeeper inventory system.
 *
 * Three unit families:
 *   WEIGHT  : g, kg, oz, lb
 *   VOLUME  : ml, l, tsp, tbsp, cup, fl_oz
 *   COUNT   : pcs, slice, pinch
 *
 * Cross-family (volume ↔ weight) uses water density (1 ml = 1 g) as the
 * default approximation — accurate enough for most baking ingredients like
 * flour, sugar, milk, butter when no density override is provided.
 *
 * Within-family conversions are exact.
 */

// ── Base units (everything converts to/from these) ────────────────────────────
// Weight base: grams (g)
// Volume base: millilitres (ml)

const WEIGHT_TO_G: Record<string, number> = {
  g: 1,
  kg: 1000,
  oz: 28.3495,
  lb: 453.592,
};

const VOLUME_TO_ML: Record<string, number> = {
  ml: 1,
  l: 1000,
  tsp: 4.92892,       // 1 US tsp = 4.92892 ml
  tbsp: 14.7868,      // 1 US tbsp = 14.7868 ml  (= 3 tsp)
  cup: 236.588,       // 1 US cup  = 236.588 ml  (= 16 tbsp)
  fl_oz: 29.5735,     // 1 US fl oz = 29.5735 ml
};

const WEIGHT_UNITS = new Set(Object.keys(WEIGHT_TO_G));
const VOLUME_UNITS = new Set(Object.keys(VOLUME_TO_ML));
const COUNT_UNITS  = new Set(["pcs", "slice", "pinch"]);

// ── Unit family detection ─────────────────────────────────────────────────────
export function unitFamily(unit: string): "weight" | "volume" | "count" | "unknown" {
  const u = normalizeUnit(unit);
  if (WEIGHT_UNITS.has(u)) return "weight";
  if (VOLUME_UNITS.has(u)) return "volume";
  if (COUNT_UNITS.has(u))  return "count";
  return "unknown";
}

// ── Normalize unit strings ────────────────────────────────────────────────────
// Accepts loose user input and maps to canonical keys
const ALIASES: Record<string, string> = {
  // weight
  "gram": "g", "grams": "g",
  "kilogram": "kg", "kilograms": "kg",
  "ounce": "oz", "ounces": "oz",
  "pound": "lb", "pounds": "lb", "lbs": "lb",
  // volume
  "milliliter": "ml", "millilitre": "ml", "milliliters": "ml", "millilitres": "ml",
  "liter": "l", "litre": "l", "liters": "l", "litres": "l",
  "teaspoon": "tsp", "teaspoons": "tsp",
  "tablespoon": "tbsp", "tablespoons": "tbsp",
  "cups": "cup",
  "fluid_oz": "fl_oz", "floz": "fl_oz", "fluid oz": "fl_oz",
  // count
  "piece": "pcs", "pieces": "pcs", "pc": "pcs",
  "slices": "slice",
  "pinches": "pinch",
};

export function normalizeUnit(unit: string): string {
  const lower = unit.trim().toLowerCase();
  return ALIASES[lower] ?? lower;
}

// ── Core convert function ─────────────────────────────────────────────────────
/**
 * Converts `amount` from `fromUnit` to `toUnit`.
 * Returns null if the conversion is not possible (e.g. incompatible families
 * and no density bridge available, or unknown units).
 *
 * Cross-family (volume ↔ weight) uses 1 ml = 1 g (water / generic baking).
 */
export function convert(
  amount: number,
  fromUnit: string,
  toUnit: string,
): number | null {
  if (amount < 0) return null;

  const from = normalizeUnit(fromUnit);
  const to   = normalizeUnit(toUnit);

  // Same unit — no conversion needed
  if (from === to) return amount;

  const fromFamily = unitFamily(from);
  const toFamily   = unitFamily(to);

  // ── Within weight ──────────────────────────────────────────────────────────
  if (fromFamily === "weight" && toFamily === "weight") {
    const grams = amount * WEIGHT_TO_G[from];
    return grams / WEIGHT_TO_G[to];
  }

  // ── Within volume ──────────────────────────────────────────────────────────
  if (fromFamily === "volume" && toFamily === "volume") {
    const ml = amount * VOLUME_TO_ML[from];
    return ml / VOLUME_TO_ML[to];
  }

  // ── Cross-family: volume ↔ weight (density bridge: 1 ml ≈ 1 g) ──────────
  if (fromFamily === "volume" && toFamily === "weight") {
    const ml    = amount * VOLUME_TO_ML[from];
    const grams = ml * 1; // 1 ml = 1 g (water density)
    return grams / WEIGHT_TO_G[to];
  }

  if (fromFamily === "weight" && toFamily === "volume") {
    const grams = amount * WEIGHT_TO_G[from];
    const ml    = grams / 1; // 1 g = 1 ml
    return ml / VOLUME_TO_ML[to];
  }

  // ── Count units — only same-to-same ───────────────────────────────────────
  // Can't convert pcs ↔ weight or volume
  return null;
}

// ── Format a quantity nicely ──────────────────────────────────────────────────
export function formatQty(amount: number, unit: string): string {
  // Avoid floating point noise: round to 4 decimal places then trim trailing zeros
  const rounded = parseFloat(amount.toFixed(4));
  return `${rounded} ${unit}`;
}

// ── checkStock ────────────────────────────────────────────────────────────────
/**
 * Given inventory (inventoryQty, inventoryUnit) and a recipe requirement
 * (requiredQty, requiredUnit), determines whether there is enough stock.
 *
 * Returns:
 *   sufficient       — true if inventory covers the requirement
 *   compatible       — false if units are completely incompatible (count vs weight etc.)
 *   displayRequired  — human-readable required amount
 *   displayAvailable — human-readable available amount (converted to required unit if possible)
 *   deficit          — how much is missing (in requiredUnit), 0 if sufficient
 */
export type StockCheckResult = {
  sufficient: boolean;
  compatible: boolean;
  displayRequired: string;
  displayAvailable: string;
  deficit: number;
};

export function checkStock(
  inventoryQty: number,
  inventoryUnit: string,
  requiredQty: number,
  requiredUnit: string,
): StockCheckResult {
  const invU = normalizeUnit(inventoryUnit);
  const reqU = normalizeUnit(requiredUnit);

  const displayRequired = formatQty(requiredQty, reqU);

  // ── Same unit: direct comparison ──────────────────────────────────────────
  if (invU === reqU) {
    const sufficient = inventoryQty >= requiredQty;
    return {
      sufficient,
      compatible: true,
      displayRequired,
      displayAvailable: formatQty(inventoryQty, invU),
      deficit: sufficient ? 0 : requiredQty - inventoryQty,
    };
  }

  // ── Try converting inventory → required unit ──────────────────────────────
  const invInReqUnit = convert(inventoryQty, invU, reqU);
  if (invInReqUnit !== null) {
    const sufficient = invInReqUnit >= requiredQty;
    return {
      sufficient,
      compatible: true,
      displayRequired,
      displayAvailable: formatQty(invInReqUnit, reqU),
      deficit: sufficient ? 0 : requiredQty - invInReqUnit,
    };
  }

  // ── Try converting required → inventory unit (for display) ───────────────
  const reqInInvUnit = convert(requiredQty, reqU, invU);
  if (reqInInvUnit !== null) {
    const sufficient = inventoryQty >= reqInInvUnit;
    return {
      sufficient,
      compatible: true,
      displayRequired,
      displayAvailable: formatQty(inventoryQty, invU),
      deficit: sufficient ? 0 : reqInInvUnit - inventoryQty,
    };
  }

  // ── Incompatible units ────────────────────────────────────────────────────
  return {
    sufficient: false,
    compatible: false,
    displayRequired,
    displayAvailable: formatQty(inventoryQty, invU),
    deficit: 0,
  };
}

// ── deductAmount ──────────────────────────────────────────────────────────────
/**
 * Returns the amount to subtract from inventory (in inventoryUnit)
 * when a recipe requires `requiredQty` in `requiredUnit`.
 *
 * Returns null if units are incompatible.
 */
export function deductAmount(
  requiredQty: number,
  requiredUnit: string,
  inventoryUnit: string,
): number | null {
  const reqU = normalizeUnit(requiredUnit);
  const invU = normalizeUnit(inventoryUnit);

  if (reqU === invU) return requiredQty;

  // Convert required quantity into inventory's unit
  return convert(requiredQty, reqU, invU);
}