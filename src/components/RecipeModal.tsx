"use client";
import { useEffect, useState } from "react";
import { Recipe, IngredientGroup } from "@/app/data/recipes";
import { supabase } from "@/lib/supabase";
import { checkStock, deductAmount } from "@/lib/unitConversion";
import SectionTitle from "@/components/SectionTitle";
import { useTimer } from "@/context/TimerContext";

type RawLinked = {
  id: number;
  amount_required: number;
  unit: string;
  ingredient: {
    id: number;
    name: string;
    quantity: number;
    unit: string;
    low_stock_threshold: number;
    price_per_unit: number | null;
  } | null;
};

type StockItem = {
  id: number;
  ingredientId: number;
  name: string;
  sufficient: boolean;
  compatible: boolean;
  displayRequired: string;
  displayAvailable: string;
  inventoryQty: number;
  inventoryUnit: string;
  requiredQty: number;
  requiredUnit: string;
  pricePerUnit: number | null;
};

type StockPanelProps = {
  allAvailable: boolean;
  hasIncompatible: boolean;
  stockItems: StockItem[];
  onRequestBake: () => void;
  baking: boolean;
  bakeSuccess: boolean;
};

// ── Ingredient / Step parsers ─────────────────────────────────────────────────

function parseIngredients(raw: unknown): string[] | IngredientGroup[] {
  if (typeof raw === "string") {
    try { raw = JSON.parse(raw); } catch { return [raw as string]; }
  }
  if (!Array.isArray(raw)) return [];
  if (raw.length > 0 && typeof raw[0] === "string") {
    const firstStr = (raw[0] as string).trim();
    if (firstStr.startsWith("{")) {
      try {
        const parsed = raw.map((item) => typeof item === "string" ? JSON.parse(item) : item);
        if (parsed.every((p) => p && typeof p === "object" && "group" in p)) {
          return parsed as IngredientGroup[];
        }
      } catch { /* fall through */ }
    }
  }
  return raw as string[] | IngredientGroup[];
}

function parseSteps(raw: unknown): string[] {
  if (typeof raw === "string") {
    try { raw = JSON.parse(raw); } catch { return [raw as string]; }
  }
  if (!Array.isArray(raw)) return [];
  return raw as string[];
}

// ── StockPanel ────────────────────────────────────────────────────────────────

function StockPanel({ allAvailable, hasIncompatible, stockItems, onRequestBake, baking, bakeSuccess }: StockPanelProps) {
  const [open, setOpen] = useState(false);

  return (
    <div className="rounded-2xl mb-5 overflow-hidden border-2" style={{ borderColor: allAvailable ? "#bbf7d0" : "#fecaca" }}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-3 text-left transition-colors"
        style={{ backgroundColor: allAvailable ? "#f0fdf4" : "#fef2f2" }}
      >
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-bold" style={{ fontFamily: "'Mochibop', serif", color: allAvailable ? "#16a34a" : "#dc2626" }}>
            {allAvailable ? "✅ All ingredients available" : "⚠️ Some ingredients are low or out of stock"}
          </span>
          {hasIncompatible && (
            <span className="text-[10px] px-2 py-0.5 rounded-full font-bold" style={{ backgroundColor: "#fed7aa", color: "#92400e", fontFamily: "'Mochibop', serif" }}>
              Unit mismatch
            </span>
          )}
        </div>
        <span className="text-xs font-bold shrink-0 ml-2 transition-transform duration-200" style={{ color: allAvailable ? "#16a34a" : "#dc2626", transform: open ? "rotate(180deg)" : "rotate(0deg)", display: "inline-block" }}>▼</span>
      </button>

      {open && (
        <div className="px-4 pb-4 pt-3 space-y-2 border-t-2" style={{ backgroundColor: allAvailable ? "#f0fdf4" : "#fef2f2", borderColor: allAvailable ? "#bbf7d0" : "#fecaca" }}>
          {hasIncompatible && (
            <p className="text-[11px] font-semibold pb-1" style={{ fontFamily: "'Mochibop', serif", color: "#92400e" }}>
              ⚠️ Some ingredients have incompatible units and could not be compared.
            </p>
          )}
          {stockItems.map((item) => (
            <div key={item.id} className="rounded-2xl px-3 py-2 border-2" style={{ backgroundColor: !item.compatible ? "#fff7ed" : item.sufficient ? "rgba(240,253,244,0.8)" : "rgba(254,242,242,0.8)", borderColor: !item.compatible ? "#fed7aa" : item.sufficient ? "#bbf7d0" : "#fecaca" }}>
              <span className="text-xs font-semibold" style={{ fontFamily: "'Mochibop', serif", color: !item.compatible ? "#92400e" : item.sufficient ? "#16a34a" : "#dc2626" }}>
                {!item.compatible ? "⚠️" : item.sufficient ? "✓" : "✗"} {item.name}
              </span>
              <div className="flex gap-4 mt-1">
                {[{ label: "Needed", value: item.displayRequired }, { label: "In Stock", value: item.compatible ? item.displayAvailable : "⚠️ Unit mismatch" }].map((d) => (
                  <div key={d.label}>
                    <p className="text-[9px] uppercase tracking-widest" style={{ fontFamily: "'Mochibop', serif", color: "#7a4a33", opacity: 0.5 }}>{d.label}</p>
                    <p className="text-[11px] font-medium" style={{ fontFamily: "'Mochibop', serif", color: "#7a4a33" }}>{d.value}</p>
                  </div>
                ))}
              </div>
              {!item.compatible && (
                <p className="text-[10px] mt-1" style={{ fontFamily: "'Mochibop', serif", color: "#92400e" }}>
                  Can&apos;t compare — update inventory or recipe units to match.
                </p>
              )}
            </div>
          ))}
        </div>
      )}

      <div className="px-4 py-3 border-t-2" style={{ borderColor: allAvailable ? "#bbf7d0" : "#fecaca", backgroundColor: allAvailable ? "rgba(240,253,244,0.4)" : "rgba(254,242,242,0.3)" }}>
        {bakeSuccess ? (
          <div className="flex items-center gap-2 justify-center py-1">
            <span className="text-sm font-bold" style={{ fontFamily: "'Mochibop', serif", color: "#16a34a" }}>🎉 Inventory updated! Happy baking!</span>
          </div>
        ) : (
          <div className="space-y-2">
            <button
              onClick={onRequestBake}
              disabled={baking || !allAvailable || stockItems.every((s) => !s.compatible)}
              className="w-full py-2.5 rounded-2xl font-bold text-sm flex items-center justify-center gap-2 transition-all"
              style={{
                fontFamily: "'Mochibop', serif",
                backgroundColor: allAvailable && !baking ? "#ffd1dc" : "#f3ead9",
                color: "#7a4a33",
                border: `2px solid ${allAvailable && !baking ? "#f5a8bc" : "#d4c4b0"}`,
                opacity: !allAvailable ? 0.5 : 1,
                cursor: !allAvailable ? "not-allowed" : "pointer",
                boxShadow: allAvailable && !baking ? "0 4px 12px rgba(255,209,220,0.4)" : "none",
              }}
            >
              {baking ? (<><span className="animate-spin text-base">⏳</span>Updating inventory...</>) : <>🍳 I&apos;m Baking This!</>}
            </button>
            <p className="text-[10px] text-center" style={{ fontFamily: "'Mochibop', serif", color: "#7a4a33", opacity: 0.5 }}>
              {!allAvailable ? "❌ Not enough ingredients to bake this recipe." : "This will subtract the required ingredients from your inventory."}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main Modal ────────────────────────────────────────────────────────────────

export default function RecipeModal({ recipe, onClose }: { recipe: Recipe; onClose: () => void }) {
  const [stockItems, setStockItems] = useState<StockItem[]>([]);
  const [stockLoading, setStockLoading] = useState(true);
  const [baking, setBaking] = useState(false);
  const [bakeSuccess, setBakeSuccess] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [batchSize, setBatchSize] = useState<1 | 0.5>(1);
  const { setVisible, running, done, timeLeft, inputMinutes, inputSeconds } = useTimer();

  async function fetchLinked() {
    if (!recipe.id) { setStockLoading(false); return; }
    setStockLoading(true);
    const { data } = await supabase
      .from("recipe_ingredients")
      .select("id, amount_required, unit, ingredient:ingredients(id, name, quantity, unit, low_stock_threshold, price_per_unit)")
      .eq("recipe_id", recipe.id);

    if (data && data.length > 0) {
      const items: StockItem[] = (data as unknown as RawLinked[]).map((d) => {
        if (!d.ingredient) {
          return { id: d.id, ingredientId: 0, name: "Unknown ingredient", sufficient: false, compatible: false, displayRequired: `${d.amount_required} ${d.unit}`, displayAvailable: "Not found", inventoryQty: 0, inventoryUnit: "", requiredQty: d.amount_required, requiredUnit: d.unit, pricePerUnit: null };
        }
        const result = checkStock(d.ingredient.quantity, d.ingredient.unit, d.amount_required, d.unit);
        return { id: d.id, ingredientId: d.ingredient.id, name: d.ingredient.name, sufficient: result.sufficient, compatible: result.compatible, displayRequired: result.displayRequired, displayAvailable: result.displayAvailable, inventoryQty: d.ingredient.quantity, inventoryUnit: d.ingredient.unit, requiredQty: d.amount_required, requiredUnit: d.unit, pricePerUnit: d.ingredient.price_per_unit ?? null };
      });
      setStockItems(items);
    } else {
      setStockItems([]);
    }
    setStockLoading(false);
  }

  useEffect(() => {
    fetchLinked();
    setBakeSuccess(false);
    setBatchSize(1);
  }, [recipe.id]);

  async function handleBake() {
    setBaking(true);
    const compatibleItems = stockItems.filter((s) => s.compatible);
    if (!compatibleItems.length) { setBaking(false); return; }

    const updates = compatibleItems.map((item) => {
      // deductAmount handles all unit conversions correctly (weight↔volume included)
      const toDeduct = deductAmount(item.requiredQty * batchSize, item.requiredUnit, item.inventoryUnit);
      const deductInInventoryUnit = toDeduct !== null ? toDeduct : item.requiredQty * batchSize;
      return {
        ingredientId: item.ingredientId,
        name: item.name,
        newQty: parseFloat(Math.max(0, item.inventoryQty - deductInInventoryUnit).toFixed(6)),
        amountUsed: parseFloat(deductInInventoryUnit.toFixed(6)),
        unit: item.inventoryUnit,
        pricePerUnit: item.pricePerUnit,
        cost: item.pricePerUnit != null
          ? parseFloat((deductInInventoryUnit * item.pricePerUnit).toFixed(4))
          : 0,
      };
    });

    // 1. Deduct inventory
    await Promise.all(
      updates.map(({ ingredientId, newQty }) =>
        supabase.from("ingredients").update({ quantity: newQty }).eq("id", ingredientId)
      )
    );

    // 2. Log the bake with ingredient costs
    const totalCost = updates.reduce((sum, u) => sum + u.cost, 0);
    await supabase.from("bake_logs").insert({
      recipe_id: recipe.id,
      batch_size: batchSize,
      ingredients_used: updates.map((u) => ({
        ingredient_id: u.ingredientId,
        name: u.name,
        amount_used: u.amountUsed,
        unit: u.unit,
        price_per_unit: u.pricePerUnit,
        cost: u.cost,
      })),
      total_cost: parseFloat(totalCost.toFixed(4)),
    });

    await fetchLinked();
    setBaking(false);
    setBakeSuccess(true);
    setTimeout(() => setBakeSuccess(false), 4000);
  }

  // Re-check stock availability based on current batchSize
  const effectiveStockItems = stockItems.map((item) => {
    const effectiveQty = item.requiredQty * batchSize;
    const result = checkStock(item.inventoryQty, item.inventoryUnit, effectiveQty, item.requiredUnit);
    return {
      ...item,
      sufficient: result.sufficient,
      displayRequired: result.displayRequired,
      displayAvailable: result.displayAvailable,
    };
  });
  const allAvailable = effectiveStockItems.length > 0 && effectiveStockItems.every((s) => s.sufficient);
  const hasIncompatible = effectiveStockItems.some((s) => !s.compatible);
  const hasLinked = stockItems.length > 0;

  const parsedIngredients = parseIngredients(recipe.ingredients);
  const parsedSteps = parseSteps(recipe.steps);
  const isGrouped = parsedIngredients.length > 0 && typeof parsedIngredients[0] === "object" && parsedIngredients[0] !== null && "group" in (parsedIngredients[0] as object);

  // Timer button display
  const timerSecs = timeLeft !== null ? timeLeft : inputMinutes * 60 + inputSeconds;
  const timerLabel = `${String(Math.floor(timerSecs / 60)).padStart(2, "0")}:${String(timerSecs % 60).padStart(2, "0")}`;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center" style={{ backdropFilter: "blur(8px)", backgroundColor: "rgba(122,74,51,0.3)" }}>
      <style>{`
        @keyframes slideUp {
          from { transform: translateY(100%); }
          to { transform: translateY(0); }
        }
        @keyframes slideUpDesktop {
          from { transform: translateY(40px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
        .modal-sheet {
          animation: slideUp 0.3s cubic-bezier(0.34, 1.1, 0.64, 1) forwards;
        }
        @media (min-width: 640px) {
          .modal-sheet {
            max-width: 520px;
            border-radius: 24px;
            max-height: 85vh;
            margin-bottom: 32px;
            animation: slideUpDesktop 0.25s ease forwards;
          }
        }
      `}</style>

      <div
        className="modal-sheet w-full max-h-[88vh] overflow-y-auto rounded-t-3xl no-scrollbar"
        style={{ backgroundColor: "#fff6e7" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* ── Header ── */}
        <div className="sticky top-0 z-10 px-5 pt-5 pb-4 rounded-t-3xl" style={{ backgroundColor: "#ffd1dc" }}>
          <div className="flex justify-between items-start">
            <div className="flex-1 pr-3">
              <p className="text-[10px] tracking-[3px] uppercase mb-1" style={{ fontFamily: "'Mochibop', serif", color: "#7a4a33", opacity: 0.6 }}>
                {recipe.category}
              </p>
              <h2 className="text-xl leading-tight" style={{ fontFamily: "'SuperJoyful', serif", fontWeight: "normal", color: "#7a4a33" }}>
                {recipe.emoji} {recipe.title}
              </h2>
            </div>
            <button onClick={onClose} className="shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-base border-none cursor-pointer transition-colors" style={{ backgroundColor: "rgba(122,74,51,0.15)", color: "#7a4a33" }}>
              ✕
            </button>
          </div>

          {/* Meta row */}
          <div className="flex gap-4 mt-3 flex-wrap items-end">
            {[
              { label: "Prep", value: recipe.prep },
              { label: "Bake", value: recipe.bake },
              { label: "Yield", value: recipe.yield },
              { label: "Level", value: recipe.difficulty },
            ].map((m) => (
              <div key={m.label}>
                <p className="text-[9px] tracking-widest uppercase" style={{ fontFamily: "'Mochibop', serif", color: "#7a4a33", opacity: 0.6 }}>{m.label}</p>
                <p className="text-sm font-semibold" style={{ fontFamily: "'Mochibop', serif", color: "#7a4a33" }}>{m.value}</p>
              </div>
            ))}

            {/* Timer launcher button */}
            <div>
              <p className="text-[9px] tracking-widest uppercase mb-1" style={{ fontFamily: "'Mochibop', serif", color: "#7a4a33", opacity: 0.6 }}>Timer</p>
              <button
                onClick={() => setVisible(true)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "5px",
                  padding: "4px 12px 4px 8px",
                  borderRadius: "999px",
                  border: `2px solid ${done ? "#f5a8bc" : "rgba(245,168,188,0.5)"}`,
                  background: done ? "#ffd1dc" : "rgba(255,255,255,0.5)",
                  fontFamily: "'Mochibop', serif",
                  color: "#7a4a33",
                  fontSize: "12px",
                  fontWeight: 700,
                  cursor: "pointer",
                  backdropFilter: "blur(4px)",
                }}
              >
                <span>{done ? "🔔" : running ? "⏱️" : "⏳"}</span>
                {running || done || timeLeft !== null ? timerLabel : "Open"}
              </button>
            </div>
          </div>
        </div>

        {/* ── Body ── */}
        <div className="px-5 pt-5 pb-8">
          {!stockLoading && hasLinked && (
            <>
              {/* ── Batch Size Toggle ── */}
              <div className="flex items-center gap-2 mb-3">
                <p className="text-[10px] uppercase tracking-widest font-bold shrink-0" style={{ fontFamily: "'Mochibop', serif", color: "#7a4a33", opacity: 0.5 }}>Batch Size</p>
                <div className="flex rounded-2xl border-2 overflow-hidden" style={{ borderColor: "#ffd1dc" }}>
                  {([1, 0.5] as const).map((size) => (
                    <button
                      key={size}
                      type="button"
                      onClick={() => setBatchSize(size)}
                      className="px-4 py-1.5 text-xs font-bold transition-all"
                      style={{
                        fontFamily: "'Mochibop', serif",
                        backgroundColor: batchSize === size ? "#ffd1dc" : "white",
                        color: batchSize === size ? "#7a4a33" : "#7a4a33",
                        opacity: batchSize === size ? 1 : 0.5,
                        borderRight: size === 1 ? "2px solid #ffd1dc" : "none",
                      }}
                    >
                      {size === 1 ? "🎂 Full Batch" : "🍰 Half Batch"}
                    </button>
                  ))}
                </div>
                {batchSize === 0.5 && (
                  <span className="text-[10px] px-2 py-1 rounded-full font-bold" style={{ backgroundColor: "#fff6e7", color: "#92400e", fontFamily: "'Mochibop', serif", border: "1px solid #fde68a" }}>
                    ½ ingredients
                  </span>
                )}
              </div>
              <StockPanel allAvailable={allAvailable} hasIncompatible={hasIncompatible} stockItems={effectiveStockItems} onRequestBake={() => setConfirmOpen(true)} baking={baking} bakeSuccess={bakeSuccess} />
            </>
          )}

          {/* Ingredients */}
          <div className="mb-6">
            <SectionTitle>Ingredients</SectionTitle>
            {isGrouped ? (
              <div className="space-y-5">
                {(parsedIngredients as IngredientGroup[]).map((group, gi) => (
                  <div key={gi}>
                    {group.group != "Ingredients" && <SectionTitle>{group.group}</SectionTitle>}
                    <ul className="m-0 p-0 list-none">
                      {group.items.map((ing, ii) => (
                        <li key={ii} className="flex items-center gap-2.5 py-2 text-sm" style={{ fontFamily: "'Mochibop', serif", color: "#7a4a33" }}>
                          <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: "#f5a8bc" }} />
                          {ing}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            ) : (
              <ul className="m-0 p-0 list-none">
                {(parsedIngredients as string[]).map((ing, i) => (
                  <li key={i} className="flex items-center gap-2.5 py-2 text-sm" style={{ fontFamily: "'Mochibop', serif", color: "#7a4a33" }}>
                    <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: "#f5a8bc" }} />
                    {ing}
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Instructions */}
          <div className="mb-6">
            <SectionTitle>Instructions</SectionTitle>
            <ol className="m-0 p-0 list-none">
              {parsedSteps.map((step, i) => (
                <li key={i} className="flex gap-3 mb-3.5">
                  <div className="shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold mt-0.5" style={{ backgroundColor: "#ffd1dc", color: "#7a4a33", fontFamily: "'Mochibop', serif" }}>
                    {i + 1}
                  </div>
                  <p className="m-0 text-sm leading-relaxed" style={{ fontFamily: "'Mochibop', serif", color: "#7a4a33" }}>{step}</p>
                </li>
              ))}
            </ol>
          </div>

          {/* Baker's Note */}
          {recipe.notes && (
            <div className="rounded-2xl p-4" style={{ backgroundColor: "rgba(255,209,220,0.2)", border: "2px solid #ffd1dc", borderLeft: "4px solid #f5a8bc" }}>
              <p className="text-[11px] tracking-widest uppercase font-bold mb-1" style={{ fontFamily: "'Mochibop', serif", color: "#7a4a33" }}>📌 Baker&apos;s Note</p>
              <p className="m-0 text-sm leading-relaxed italic" style={{ fontFamily: "'Mochibop', serif", color: "#7a4a33", opacity: 0.8 }}>{recipe.notes}</p>
            </div>
          )}
        </div>
      </div>

      {/* ── Bake Confirmation Modal ── */}
      {confirmOpen && (
        <div
          className="fixed inset-0 z-60 flex items-center justify-center px-6"
          style={{ backdropFilter: "blur(6px)", backgroundColor: "rgba(122,74,51,0.25)" }}
          onClick={() => setConfirmOpen(false)}
        >
          <div
            className="w-full max-w-xs rounded-3xl p-6 space-y-4"
            style={{
              backgroundColor: "#fff6e7",
              border: "2px solid #ffd1dc",
              boxShadow: "0 16px 48px rgba(122,74,51,0.2)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Icon + title */}
            <div className="text-center space-y-2">
              <div className="w-14 h-14 rounded-3xl flex items-center justify-center text-3xl mx-auto" style={{ backgroundColor: "#ffd1dc" }}>
                {batchSize === 0.5 ? "🍰" : "🍳"}
              </div>
              <h3 style={{ fontFamily: "'SuperJoyful', serif", fontWeight: "normal", fontSize: "1.3rem", color: "#7a4a33" }}>
                {batchSize === 0.5 ? "Bake Half Batch?" : "Start Baking?"}
              </h3>
              <p className="text-xs leading-relaxed" style={{ fontFamily: "'Mochibop', serif", color: "#7a4a33", opacity: 0.6 }}>
                {batchSize === 0.5
                  ? "Half the ingredients will be deducted and logged as a half batch expense."
                  : "This will deduct the required ingredients from your inventory and log the expense. This can't be undone!"}
              </p>
            </div>

            {/* Ingredient summary */}
            <div className="rounded-2xl p-3 space-y-1.5" style={{ backgroundColor: "rgba(255,209,220,0.2)", border: "2px solid #ffd1dc" }}>
              <p className="text-[10px] uppercase tracking-widest font-bold mb-2" style={{ fontFamily: "'Mochibop', serif", color: "#7a4a33", opacity: 0.5 }}>
                Will deduct {batchSize === 0.5 ? "(½ batch)" : ""}:
              </p>
              {effectiveStockItems.filter((s) => s.compatible).map((item) => (
                <div key={item.id} className="flex justify-between items-center">
                  <p className="text-xs font-semibold" style={{ fontFamily: "'Mochibop', serif", color: "#7a4a33" }}>
                    {item.name}
                  </p>
                  <p className="text-xs" style={{ fontFamily: "'Mochibop', serif", color: "#7a4a33", opacity: 0.6 }}>
                    {item.displayRequired}
                  </p>
                </div>
              ))}
            </div>

            {/* Buttons */}
            <div className="flex gap-3">
              <button
                onClick={() => setConfirmOpen(false)}
                className="flex-1 py-3 rounded-2xl text-sm font-bold"
                style={{
                  fontFamily: "'Mochibop', serif",
                  backgroundColor: "white",
                  color: "#7a4a33",
                  border: "2px solid #ffd1dc",
                }}
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  setConfirmOpen(false);
                  handleBake();
                }}
                className="flex-1 py-3 rounded-2xl text-sm font-bold"
                style={{
                  fontFamily: "'Mochibop', serif",
                  backgroundColor: "#ffd1dc",
                  color: "#7a4a33",
                  border: "2px solid #f5a8bc",
                  boxShadow: "0 4px 12px rgba(255,209,220,0.5)",
                }}
              >
                Yes, let&apos;s bake! 🎀
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}