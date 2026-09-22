"use client";
import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";

// ── Styles ────────────────────────────────────────────────────────────────────
const labelStyle = { fontFamily: "'Mochibop', serif", color: "#7a4a33", opacity: 0.7 };
const cardStyle = {
  backgroundColor: "white", borderRadius: "24px",
  border: "2px solid #ffd1dc", padding: "20px",
  boxShadow: "0 4px 16px rgba(255,209,220,0.3)",
};
const font = { fontFamily: "'Mochibop', serif", color: "#7a4a33" };

// ── Types ─────────────────────────────────────────────────────────────────────
type OrderItem = {
  id: number;
  recipe_id: number;
  quantity: number;
  price_per_item: number;
  recipe?: { title: string; emoji: string };
};

// No total_price on orders table — computed from order_items
type Order = {
  id: number;
  customer_name: string;
  status: string;
  notes: string | null;
  created_at: string;
  order_items: OrderItem[];
};

type OrderWithTotal = Order & { total: number };

type BakeLog = {
  id: number;
  recipe_id: number | null;
  baked_at: string;
  total_cost: number;
  batch_size: number | null;
  ingredients_used: {
    ingredient_id: number;
    name: string;
    amount_used: number;
    unit: string;
    price_per_unit: number | null;
    cost: number;
  }[];
  recipe?: { title: string; emoji: string };
};

type Ingredient = {
  id: number;
  name: string;
  quantity: number;
  unit: string;
  price_per_unit: number | null;
};

type MiscExpense = {
  id: number;
  description: string;
  amount: number;
  expense_date: string;
};

type MonthOption = { label: string; value: string };

// ── Helpers ───────────────────────────────────────────────────────────────────
function toMonthValue(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function monthLabel(value: string) {
  const [y, m] = value.split("-");
  return new Date(Number(y), Number(m) - 1).toLocaleString("default", { month: "long", year: "numeric" });
}

function fmt(n: number) {
  return `₱${n.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function orderTotal(order: Order): number {
  return (order.order_items || []).reduce(
    (sum, item) => sum + item.price_per_item * item.quantity, 0
  );
}

function generateMonths(): MonthOption[] {
  const months: MonthOption[] = [];
  const now = new Date();
  for (let i = 0; i < 12; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const v = toMonthValue(d);
    months.push({ label: monthLabel(v), value: v });
  }
  return months;
}

// ── Stat Card ─────────────────────────────────────────────────────────────────
function StatCard({ emoji, label, value, sub, color }: {
  emoji: string; label: string; value: string; sub?: string; color: string;
}) {
  return (
    <div style={{ ...cardStyle, borderColor: color, padding: "16px" }}>
      <div className="flex items-center gap-2 mb-2">
        <div className="w-8 h-8 rounded-xl flex items-center justify-center text-base" style={{ backgroundColor: color + "33" }}>
          {emoji}
        </div>
        <p className="text-[10px] uppercase tracking-widest font-bold" style={{ ...labelStyle, opacity: 0.5 }}>{label}</p>
      </div>
      <p className="text-xl font-bold" style={font}>{value}</p>
      {sub && <p className="text-[11px] mt-0.5" style={{ ...font, opacity: 0.5 }}>{sub}</p>}
    </div>
  );
}

// ── Bar Chart (pure CSS) ──────────────────────────────────────────────────────
function BarChart({ data, color }: { data: { label: string; value: number }[]; color: string }) {
  const max = Math.max(...data.map((d) => d.value), 1);
  return (
    <div className="flex items-end gap-2 h-28 w-full">
      {data.map((d, i) => (
        <div key={i} className="flex flex-col items-center gap-1 flex-1">
          <p className="text-[9px] font-bold" style={{ ...font, opacity: 0.6 }}>
            {d.value > 0 ? fmt(d.value).replace("₱", "") : "—"}
          </p>
          <div
            className="w-full rounded-t-xl transition-all duration-500"
            style={{
              height: `${Math.max((d.value / max) * 80, d.value > 0 ? 4 : 0)}px`,
              backgroundColor: color,
              opacity: 0.85,
            }}
          />
          <p className="text-[9px] text-center" style={{ ...font, opacity: 0.5 }}>{d.label}</p>
        </div>
      ))}
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function ReportsPage() {
  const { authed } = useAuth();
  const [selectedMonth, setSelectedMonth] = useState(toMonthValue(new Date()));
  const [orders, setOrders] = useState<OrderWithTotal[]>([]);
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [bakeLogs, setBakeLogs] = useState<BakeLog[]>([]);
  const [miscExpenses, setMiscExpenses] = useState<MiscExpense[]>([]);
  const [miscForm, setMiscForm] = useState({ description: "", amount: "", expense_date: new Date().toISOString().split("T")[0] });
  const [miscLoading, setMiscLoading] = useState(false);
  const [miscEditId, setMiscEditId] = useState<number | null>(null);
  const [miscDeleteId, setMiscDeleteId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const months = generateMonths();

  const fetchData = useCallback(async () => {
    setLoading(true);
    const [y, m] = selectedMonth.split("-").map(Number);
    const start = new Date(y, m - 1, 1).toISOString();
    const end = new Date(y, m, 1).toISOString();

    const [ordersRes, ingredientsRes, bakeLogsRes, miscRes] = await Promise.all([
      supabase
        .from("orders")
        .select(`
          id,
          customer_name,
          status,
          notes,
          created_at,
          order_items (
            id,
            recipe_id,
            quantity,
            price_per_item,
            recipe:recipes (title, emoji)
          )
        `)
        .gte("created_at", start)
        .lt("created_at", end)
        .order("created_at", { ascending: false }),
      supabase
        .from("ingredients")
        .select("id, name, quantity, unit, price_per_unit"),
      supabase
        .from("bake_logs")
        .select("id, recipe_id, baked_at, total_cost, batch_size, ingredients_used, recipe:recipes(title, emoji)")
        .gte("baked_at", start)
        .lt("baked_at", end)
        .order("baked_at", { ascending: false }),
      supabase
        .from("misc_expenses")
        .select("id, description, amount, expense_date")
        .gte("expense_date", `${y}-${String(m).padStart(2, "0")}-01`)
        .lt("expense_date", `${m === 12 ? y + 1 : y}-${String(m === 12 ? 1 : m + 1).padStart(2, "0")}-01`)
        .order("expense_date", { ascending: false }),
    ]);

    if (ordersRes.data) {
      const withTotals = (ordersRes.data as unknown as Order[]).map((o) => ({
        ...o,
        total: orderTotal(o),
      }));
      setOrders(withTotals);
    }
    if (ingredientsRes.data) setIngredients(ingredientsRes.data as Ingredient[]);
    if (bakeLogsRes.data) setBakeLogs(bakeLogsRes.data as unknown as BakeLog[]);
    if (miscRes.data) setMiscExpenses(miscRes.data as MiscExpense[]);
    setLoading(false);
  }, [selectedMonth]);

  useEffect(() => { if (authed) fetchData(); }, [authed, fetchData]);

  async function handleMiscSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!miscForm.description || !miscForm.amount) return;
    setMiscLoading(true);
    const payload = {
      description: miscForm.description,
      amount: parseFloat(miscForm.amount),
      expense_date: miscForm.expense_date,
    };
    if (miscEditId) {
      await supabase.from("misc_expenses").update(payload).eq("id", miscEditId);
    } else {
      await supabase.from("misc_expenses").insert(payload);
    }
    setMiscForm({ description: "", amount: "", expense_date: new Date().toISOString().split("T")[0] });
    setMiscEditId(null);
    setMiscLoading(false);
    await fetchData();
  }

  function handleMiscEdit(exp: MiscExpense) {
    setMiscEditId(exp.id);
    setMiscForm({ description: exp.description, amount: String(exp.amount), expense_date: exp.expense_date });
  }

  async function handleMiscDelete(id: number) {
    await supabase.from("misc_expenses").delete().eq("id", id);
    setMiscDeleteId(null);
    await fetchData();
  }

  if (!authed) return null;

  // ── Computed stats ────────────────────────────────────────────────────────
  const completedOrders = orders.filter((o) => o.status === "Completed");
  const pendingOrders = orders.filter((o) => o.status === "Pending");
  const inProgressOrders = orders.filter((o) => o.status === "In Progress");
  const cancelledOrders = orders.filter((o) => o.status === "Cancelled");

  const totalRevenue = completedOrders.reduce((sum, o) => sum + o.total, 0);
  const pendingRevenue = [...pendingOrders, ...inProgressOrders].reduce((sum, o) => sum + o.total, 0);
  const totalOrders = orders.length;

  // Total ingredient expenses = sum of total_cost from all bake logs this month
  const totalIngredientExpenses = bakeLogs.reduce((sum, log) => sum + (log.total_cost || 0), 0);

  // Per-ingredient cost breakdown from bake logs
  const ingredientCostMap: Record<string, { name: string; totalCost: number; totalUsed: number; unit: string }> = {};
  bakeLogs.forEach((log) => {
    log.ingredients_used?.forEach((item) => {
      const key = String(item.ingredient_id);
      if (!ingredientCostMap[key]) {
        ingredientCostMap[key] = { name: item.name, totalCost: 0, totalUsed: 0, unit: item.unit };
      }
      ingredientCostMap[key].totalCost += item.cost || 0;
      ingredientCostMap[key].totalUsed += item.amount_used || 0;
    });
  });
  const ingredientCostBreakdown = Object.values(ingredientCostMap).sort((a, b) => b.totalCost - a.totalCost);

  const totalMiscExpenses = miscExpenses.reduce((sum, e) => sum + e.amount, 0);
  const estimatedProfit = totalRevenue - totalIngredientExpenses - totalMiscExpenses;

  // Top selling recipes from completed orders
  const recipeSales: Record<string, { title: string; emoji: string; qty: number; revenue: number }> = {};
  completedOrders.forEach((order) => {
    order.order_items?.forEach((item) => {
      const key = String(item.recipe_id);
      if (!recipeSales[key]) {
        recipeSales[key] = {
          title: item.recipe?.title || "Unknown",
          emoji: item.recipe?.emoji || "🍞",
          qty: 0,
          revenue: 0,
        };
      }
      recipeSales[key].qty += item.quantity;
      recipeSales[key].revenue += item.price_per_item * item.quantity;
    });
  });
  const topRecipes = Object.values(recipeSales)
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 5);

  // Daily revenue chart from completed orders
  const dailyRevenue: Record<string, number> = {};
  completedOrders.forEach((o) => {
    const day = String(new Date(o.created_at).getDate());
    dailyRevenue[day] = (dailyRevenue[day] || 0) + o.total;
  });
  const dailyChartData = Object.entries(dailyRevenue)
    .sort((a, b) => Number(a[0]) - Number(b[0]))
    .slice(-7)
    .map(([day, val]) => ({ label: day, value: val }));

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-3xl mx-auto">

      {/* ── Page Title ── */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl flex items-center justify-center text-xl" style={{ backgroundColor: "#ffd1dc" }}>📊</div>
          <div>
            <h2 style={{ fontFamily: "'SuperJoyful', serif", fontWeight: "normal", fontSize: "1.4rem", color: "#7a4a33" }}>
              Monthly Report
            </h2>
            <p className="text-xs" style={{ ...font, opacity: 0.5 }}>Track your revenue, expenses & top sellers</p>
          </div>
        </div>

        {/* Month Picker */}
        <select
          value={selectedMonth}
          onChange={(e) => setSelectedMonth(e.target.value)}
          style={{
            padding: "8px 14px", borderRadius: "16px", border: "2px solid #ffd1dc",
            backgroundColor: "white", fontFamily: "'Mochibop', serif", color: "#7a4a33",
            fontSize: "0.875rem", outline: "none", cursor: "pointer",
          }}
        >
          {months.map((mo) => (
            <option key={mo.value} value={mo.value}>{mo.label}</option>
          ))}
        </select>
      </div>

      {loading ? (
        <div className="text-center py-20" style={{ ...font, opacity: 0.4 }}>Loading report... 🍪</div>
      ) : (
        <>
          {/* ── Summary Cards ── */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <StatCard
              emoji="💰" label="Revenue" value={fmt(totalRevenue)}
              sub={`${completedOrders.length} completed`} color="#bbf7d0"
            />
            <StatCard
              emoji="⏳" label="Pending / In Progress" value={fmt(pendingRevenue)}
              sub={`${pendingOrders.length + inProgressOrders.length} orders`} color="#fed7aa"
            />
            <StatCard
              emoji="🧾" label="Total Orders" value={String(totalOrders)}
              sub={`${cancelledOrders.length} cancelled`} color="#ffd1dc"
            />
            <StatCard
              emoji="✨" label="Est. Profit" value={fmt(Math.max(0, estimatedProfit))}
              sub={estimatedProfit < 0 ? "⚠️ Check costs" : "after all expenses"}
              color={estimatedProfit >= 0 ? "#bbf7d0" : "#fecaca"}
            />
          </div>



          {/* ── Daily Revenue Chart ── */}
          {dailyChartData.length > 0 && (
            <div style={cardStyle}>
              <p className="text-[11px] uppercase tracking-widest font-bold mb-4" style={{ ...font, opacity: 0.5 }}>
                📈 Daily Revenue — {monthLabel(selectedMonth)} (last {dailyChartData.length} active days)
              </p>
              <BarChart data={dailyChartData} color="#ffd1dc" />
            </div>
          )}

          {/* ── Top Selling Recipes ── */}
          <div style={cardStyle}>
            <p className="text-[11px] uppercase tracking-widest font-bold mb-4" style={{ ...font, opacity: 0.5 }}>
              🏆 Top Selling Recipes
            </p>
            {topRecipes.length === 0 ? (
              <p className="text-sm text-center py-4" style={{ ...font, opacity: 0.3 }}>No completed orders this month 🥺</p>
            ) : (
              <div className="space-y-2">
                {topRecipes.map((r, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-2xl border-2"
                    style={{ borderColor: "#ffd1dc", backgroundColor: i === 0 ? "rgba(255,209,220,0.15)" : "white" }}
                  >
                    <span className="text-[11px] font-bold w-5 text-center" style={{ ...font, opacity: 0.4 }}>#{i + 1}</span>
                    <span className="text-lg">{r.emoji}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold truncate" style={font}>{r.title}</p>
                      <p className="text-[11px]" style={{ ...font, opacity: 0.5 }}>{r.qty} sold</p>
                    </div>
                    <p className="text-sm font-bold shrink-0" style={{ ...font, color: "#16a34a" }}>{fmt(r.revenue)}</p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* ── Ingredient Expenses from Baking ── */}
          <div style={cardStyle}>
            <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
              <div>
                <p className="text-[11px] uppercase tracking-widest font-bold" style={{ ...font, opacity: 0.5 }}>
                  🧂 Ingredient Expenses
                </p>
                <p className="text-[10px] mt-0.5" style={{ ...font, opacity: 0.4 }}>
                  Based on {bakeLogs.length} bake session{bakeLogs.length !== 1 ? "s" : ""} this month
                </p>
              </div>
              <p className="text-sm font-bold" style={{ ...font, color: "#dc2626" }}>{fmt(totalIngredientExpenses)}</p>
            </div>

            {bakeLogs.length === 0 ? (
              <p className="text-sm text-center py-4" style={{ ...font, opacity: 0.3 }}>
                No baking sessions logged yet — hit &ldquo;I&apos;m Baking This!&rdquo; on a recipe to track expenses 🍞
              </p>
            ) : ingredientCostBreakdown.length === 0 ? (
              <div className="rounded-2xl px-4 py-3 border-2" style={{ backgroundColor: "#fef9c3", borderColor: "#fde68a" }}>
                <p className="text-xs font-semibold" style={{ fontFamily: "'Mochibop', serif", color: "#92400e" }}>
                  💡 Add <strong>price per unit</strong> to your ingredients in the Inventory tab to see cost breakdowns.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {ingredientCostBreakdown.map((ing) => {
                  const pct = totalIngredientExpenses > 0 ? (ing.totalCost / totalIngredientExpenses) * 100 : 0;
                  return (
                    <div key={ing.name}>
                      <div className="flex items-center justify-between mb-1">
                        <p className="text-xs font-semibold" style={font}>{ing.name}</p>
                        <p className="text-xs" style={{ ...font, opacity: 0.6 }}>
                          {fmt(ing.totalCost)}
                          <span style={{ opacity: 0.4 }}> · {parseFloat(ing.totalUsed.toFixed(3))} {ing.unit} used</span>
                        </p>
                      </div>
                      <div className="w-full h-1.5 rounded-full" style={{ backgroundColor: "#fde8ef" }}>
                        <div
                          className="h-1.5 rounded-full transition-all duration-500"
                          style={{ width: `${pct}%`, backgroundColor: "#f5a8bc" }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Bake log list */}
            {bakeLogs.length > 0 && (
              <div className="mt-4 pt-4 space-y-2" style={{ borderTop: "2px dashed #ffd1dc" }}>
                <p className="text-[10px] uppercase tracking-widest font-bold mb-2" style={{ ...font, opacity: 0.4 }}>Bake Sessions</p>
                {bakeLogs.map((log) => (
                  <div key={log.id} className="flex items-center justify-between px-3 py-2 rounded-2xl border-2" style={{ borderColor: "#ffd1dc" }}>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="text-xs font-semibold" style={font}>
                          {(log.recipe as { emoji?: string; title?: string } | null)?.emoji} {(log.recipe as { emoji?: string; title?: string } | null)?.title || "Unknown Recipe"}
                        </p>
                        {log.batch_size === 0.5 && (
                          <span className="text-[9px] px-1.5 py-0.5 rounded-full font-bold" style={{ backgroundColor: "#fff6e7", color: "#92400e", border: "1px solid #fde68a", fontFamily: "'Mochibop', serif" }}>
                            ½ batch
                          </span>
                        )}
                      </div>
                      <p className="text-[10px]" style={{ ...font, opacity: 0.4 }}>
                        {new Date(log.baked_at).toLocaleDateString("en-PH", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                      </p>
                    </div>
                    <p className="text-xs font-bold" style={{ ...font, color: "#dc2626" }}>{fmt(log.total_cost)}</p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* ── Orders Table ── */}
          <div style={cardStyle}>
            <p className="text-[11px] uppercase tracking-widest font-bold mb-4" style={{ ...font, opacity: 0.5 }}>
              🧾 Orders This Month ({orders.length})
            </p>
            {orders.length === 0 ? (
              <p className="text-sm text-center py-4" style={{ ...font, opacity: 0.3 }}>No orders this month 🥺</p>
            ) : (
              <div className="space-y-2">
                {orders.map((order) => {
                  const statusColor =
                    order.status === "Completed"
                      ? { bg: "#f0fdf4", border: "#bbf7d0", text: "#16a34a" }
                      : order.status === "Cancelled"
                      ? { bg: "#fef2f2", border: "#fecaca", text: "#dc2626" }
                      : order.status === "In Progress"
                      ? { bg: "#eff6ff", border: "#bfdbfe", text: "#1d4ed8" }
                      : { bg: "#fff7ed", border: "#fed7aa", text: "#92400e" };

                  return (
                    <div key={order.id} className="rounded-2xl px-4 py-3 border-2" style={{ borderColor: "#ffd1dc" }}>
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <div>
                          <p className="text-sm font-bold" style={font}>{order.customer_name}</p>
                          <p className="text-[11px]" style={{ ...font, opacity: 0.5 }}>
                            {new Date(order.created_at).toLocaleDateString("en-PH", { month: "short", day: "numeric" })}
                            {" · "}
                            {order.order_items?.length || 0} item(s)
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <span
                            className="text-[10px] font-bold px-2 py-1 rounded-full"
                            style={{ backgroundColor: statusColor.bg, color: statusColor.text, border: `1px solid ${statusColor.border}` }}
                          >
                            {order.status}
                          </span>
                          <p
                            className="text-sm font-bold"
                            style={{ ...font, color: order.status === "Completed" ? "#16a34a" : "#7a4a33" }}
                          >
                            {fmt(order.total)}
                          </p>
                        </div>
                      </div>

                      {/* Order items */}
                      {order.order_items?.length > 0 && (
                        <div className="mt-2 pt-2 space-y-1" style={{ borderTop: "1px dashed #ffd1dc" }}>
                          {order.order_items.map((item) => (
                            <div key={item.id} className="flex justify-between">
                              <p className="text-[11px]" style={{ ...font, opacity: 0.7 }}>
                                {item.recipe?.emoji} {item.recipe?.title || "Unknown"} × {item.quantity}
                              </p>
                              <p className="text-[11px]" style={{ ...font, opacity: 0.7 }}>
                                {fmt(item.price_per_item * item.quantity)}
                              </p>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Notes */}
                      {order.notes && (
                        <p className="text-[11px] mt-2 italic" style={{ ...font, opacity: 0.5 }}>
                          📝 {order.notes}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* ── Miscellaneous Expenses ── */}
          <div style={cardStyle}>
            <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
              <div>
                <p className="text-[11px] uppercase tracking-widest font-bold" style={{ ...font, opacity: 0.5 }}>
                  🧾 Miscellaneous Expenses
                </p>
                <p className="text-[10px] mt-0.5" style={{ ...font, opacity: 0.4 }}>
                  Packaging, gas, tools, and other costs
                </p>
              </div>
              <p className="text-sm font-bold" style={{ ...font, color: "#dc2626" }}>{fmt(totalMiscExpenses)}</p>
            </div>

            {/* Add / Edit form */}
            <form onSubmit={handleMiscSubmit} className="mb-4 p-3 rounded-2xl space-y-2" style={{ backgroundColor: "rgba(255,209,220,0.1)", border: "2px solid #ffd1dc" }}>
              <p className="text-[10px] uppercase tracking-widest font-bold" style={{ ...font, opacity: 0.5 }}>
                {miscEditId ? "✏️ Edit Expense" : "➕ Add Expense"}
              </p>
              <div className="flex gap-2 flex-wrap">
                <input
                  type="text"
                  placeholder="Description (e.g. Packaging, Gas)"
                  value={miscForm.description}
                  onChange={(e) => setMiscForm((p) => ({ ...p, description: e.target.value }))}
                  required
                  style={{
                    flex: 1, minWidth: "140px", padding: "8px 12px", borderRadius: "12px",
                    border: "2px solid #ffd1dc", backgroundColor: "white",
                    fontFamily: "'Mochibop', serif", color: "#7a4a33", fontSize: "0.8rem", outline: "none",
                  }}
                />
                <div className="relative" style={{ width: "100px" }}>
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs" style={{ color: "#7a4a33", opacity: 0.5, fontFamily: "'Mochibop', serif" }}>₱</span>
                  <input
                    type="number"
                    placeholder="0.00"
                    value={miscForm.amount}
                    onChange={(e) => setMiscForm((p) => ({ ...p, amount: e.target.value }))}
                    min={0} step={0.01} required
                    style={{
                      width: "100%", padding: "8px 12px 8px 24px", borderRadius: "12px",
                      border: "2px solid #ffd1dc", backgroundColor: "white",
                      fontFamily: "'Mochibop', serif", color: "#7a4a33", fontSize: "0.8rem", outline: "none",
                    }}
                  />
                </div>
                <input
                  type="date"
                  value={miscForm.expense_date}
                  onChange={(e) => setMiscForm((p) => ({ ...p, expense_date: e.target.value }))}
                  required
                  style={{
                    padding: "8px 12px", borderRadius: "12px",
                    border: "2px solid #ffd1dc", backgroundColor: "white",
                    fontFamily: "'Mochibop', serif", color: "#7a4a33", fontSize: "0.8rem", outline: "none",
                  }}
                />
              </div>
              <div className="flex gap-2">
                <button
                  type="submit" disabled={miscLoading}
                  className="px-4 py-2 rounded-2xl text-xs font-bold transition-all disabled:opacity-50"
                  style={{ backgroundColor: "#ffd1dc", color: "#7a4a33", fontFamily: "'Mochibop', serif", border: "2px solid #f5a8bc" }}
                >
                  {miscLoading ? "Saving..." : miscEditId ? "Update ✨" : "Add ✨"}
                </button>
                {miscEditId && (
                  <button
                    type="button"
                    onClick={() => { setMiscEditId(null); setMiscForm({ description: "", amount: "", expense_date: new Date().toISOString().split("T")[0] }); }}
                    className="px-4 py-2 rounded-2xl text-xs font-bold"
                    style={{ backgroundColor: "white", color: "#7a4a33", fontFamily: "'Mochibop', serif", border: "2px solid #ffd1dc" }}
                  >
                    Cancel
                  </button>
                )}
              </div>
            </form>

            {/* Expense list */}
            {miscExpenses.length === 0 ? (
              <p className="text-sm text-center py-3" style={{ ...font, opacity: 0.3 }}>
                No miscellaneous expenses logged this month 🧴
              </p>
            ) : (
              <div className="space-y-2">
                {miscExpenses.map((exp) => (
                  <div key={exp.id} className="rounded-2xl border-2 overflow-hidden" style={{ borderColor: "#ffd1dc" }}>
                    <div className="flex items-center justify-between px-3 py-2.5 gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold truncate" style={font}>{exp.description}</p>
                        <p className="text-[10px]" style={{ ...font, opacity: 0.4 }}>
                          {new Date(exp.expense_date).toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" })}
                        </p>
                      </div>
                      <p className="text-xs font-bold shrink-0" style={{ ...font, color: "#dc2626" }}>{fmt(exp.amount)}</p>
                      <div className="flex gap-1 shrink-0">
                        <button
                          onClick={() => handleMiscEdit(exp)}
                          className="text-[10px] px-2 py-1 rounded-xl border-2"
                          style={{ fontFamily: "'Mochibop', serif", color: "#7a4a33", borderColor: "#ffd1dc", backgroundColor: "white" }}
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => setMiscDeleteId(exp.id)}
                          className="text-[10px] px-2 py-1 rounded-xl border-2"
                          style={{ fontFamily: "'Mochibop', serif", color: "#dc2626", borderColor: "#fecaca", backgroundColor: "#fef2f2" }}
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                    {miscDeleteId === exp.id && (
                      <div className="flex items-center justify-between px-3 py-2 gap-3" style={{ borderTop: "2px dashed #ffd1dc", backgroundColor: "#fef2f2" }}>
                        <p className="text-[10px] font-semibold" style={{ fontFamily: "'Mochibop', serif", color: "#dc2626" }}>Delete this expense? 🥺</p>
                        <div className="flex gap-2">
                          <button
                            onClick={() => setMiscDeleteId(null)}
                            className="text-[10px] px-2 py-1 rounded-xl border-2"
                            style={{ fontFamily: "'Mochibop', serif", color: "#7a4a33", borderColor: "#ffd1dc", backgroundColor: "white" }}
                          >Cancel</button>
                          <button
                            onClick={() => handleMiscDelete(exp.id)}
                            className="text-[10px] px-2 py-1 rounded-xl"
                            style={{ fontFamily: "'Mochibop', serif", backgroundColor: "#ef4444", color: "white" }}
                          >Yes, delete</button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* ── Summary Footer ── */}
          <div className="rounded-2xl px-5 py-4 border-2" style={{ backgroundColor: "rgba(255,209,220,0.15)", borderColor: "#ffd1dc" }}>
            <p className="text-[11px] uppercase tracking-widest font-bold mb-3" style={{ ...font, opacity: 0.5 }}>
              📋 {monthLabel(selectedMonth)} Summary
            </p>
            <div className="space-y-2">
              {[
                { label: "Total Revenue (completed orders)", value: fmt(totalRevenue) },
                { label: "Pending / In-Progress Revenue", value: fmt(pendingRevenue) },
                { label: "Ingredient Expenses (from baking)", value: fmt(totalIngredientExpenses) },
                { label: "Miscellaneous Expenses", value: fmt(totalMiscExpenses) },
              ].map((row) => (
                <div key={row.label} className="flex justify-between items-center">
                  <p className="text-xs" style={{ ...font, opacity: 0.7 }}>{row.label}</p>
                  <p className="text-sm" style={font}>{row.value}</p>
                </div>
              ))}
              <div style={{ borderTop: "2px dashed #ffd1dc", marginTop: "8px", paddingTop: "8px" }} className="space-y-2">
                <div className="flex justify-between items-center">
                  <p className="text-xs font-bold" style={font}>Estimated Net Profit</p>
                  <p className="text-sm font-bold" style={{ ...font, color: estimatedProfit >= 0 ? "#16a34a" : "#dc2626" }}>
                    {fmt(Math.max(0, estimatedProfit))}
                  </p>
                </div>
                <div className="flex justify-between items-center">
                  <p className="text-xs font-bold" style={font}>Profit Margin</p>
                  <p className="text-sm font-bold" style={{ ...font, color: estimatedProfit >= 0 ? "#16a34a" : "#dc2626" }}>
                    {totalRevenue > 0
                      ? `${Math.round((Math.max(0, estimatedProfit) / totalRevenue) * 100)}%`
                      : "—"}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}