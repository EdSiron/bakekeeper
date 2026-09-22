"use client";
import { useEffect, useState, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { Order, OrderItem, Recipe, ORDER_STATUSES, OrderStatus, statusColors } from "@/app/data/recipes";

const labelClass = "block text-[10px] font-bold uppercase tracking-widest mb-1";
const labelStyle = { fontFamily: "'Mochibop', serif", color: "#7a4a33", opacity: 0.7 };
const inputStyle = {
  width: "100%", padding: "10px 14px", borderRadius: "16px",
  border: "2px solid #ffd1dc", backgroundColor: "white",
  fontFamily: "'Mochibop', serif", color: "#7a4a33",
  fontSize: "0.875rem", outline: "none",
};
const cardStyle = {
  backgroundColor: "white", borderRadius: "24px",
  border: "2px solid #ffd1dc", padding: "24px",
  boxShadow: "0 4px 16px rgba(255,209,220,0.3)",
};

type OrderFormItem = { recipe_id: number; quantity: number; price_per_item: number };

function formatDeliveryDate(dateStr: string | null | undefined): { label: string; urgent: boolean; overdue: boolean } {
  if (!dateStr) return { label: "No date set", urgent: false, overdue: false };
  const now = new Date(); now.setHours(0, 0, 0, 0);
  const d = new Date(dateStr); d.setHours(0, 0, 0, 0);
  const diffDays = Math.round((d.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  const formatted = d.toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" });
  if (diffDays < 0) return { label: `${formatted} (${Math.abs(diffDays)}d overdue)`, urgent: false, overdue: true };
  if (diffDays === 0) return { label: `Today · ${formatted}`, urgent: true, overdue: false };
  if (diffDays === 1) return { label: `Tomorrow · ${formatted}`, urgent: true, overdue: false };
  if (diffDays <= 3) return { label: `${diffDays}d left · ${formatted}`, urgent: true, overdue: false };
  return { label: formatted, urgent: false, overdue: false };
}

export default function OrdersPage() {
  const topRef = useRef<HTMLDivElement>(null);
  const [orders, setOrders] = useState<(Order & { delivery_date?: string | null; is_paid?: boolean })[]>([]);
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [fetching, setFetching] = useState(true);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);
  const [expandedOrderId, setExpandedOrderId] = useState<number | null>(null);
  const [statusFilter, setStatusFilter] = useState<"All" | OrderStatus>("All");
  const [deliveryDateFilter, setDeliveryDateFilter] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);
  const [form, setForm] = useState({
    customer_name: "",
    status: "Pending" as OrderStatus,
    notes: "",
    delivery_date: "",
    is_paid: false,
  });
  const [orderItems, setOrderItems] = useState<OrderFormItem[]>([{ recipe_id: 0, quantity: 1, price_per_item: 0 }]);

  useEffect(() => { fetchAll(); }, []);

  async function fetchAll() {
    setFetching(true);
    const [{ data: orderData }, { data: recipeData }] = await Promise.all([
      supabase
        .from("orders")
        .select("*, order_items(*, recipe:recipes(*))")
        .order("created_at", { ascending: false }),
      supabase.from("recipes").select("*").order("title"),
    ]);
    if (orderData) setOrders(orderData);
    if (recipeData) {
      setRecipes(recipeData);
      setOrderItems((prev) => {
        if (prev.length === 1 && prev[0].recipe_id === 0 && recipeData.length > 0) {
          return [{ recipe_id: recipeData[0].id!, quantity: 1, price_per_item: 0 }];
        }
        return prev;
      });
    }
    setFetching(false);
  }

  function addOrderItem() {
    if (!recipes.length) return;
    setOrderItems((prev) => [...prev, { recipe_id: recipes[0].id!, quantity: 1, price_per_item: 0 }]);
  }

  function removeOrderItem(index: number) {
    if (orderItems.length === 1) return;
    setOrderItems((prev) => prev.filter((_: OrderFormItem, i: number) => i !== index));
  }

  function updateOrderItem(index: number, field: keyof OrderFormItem, value: string | number) {
    setOrderItems((prev) => { const u = [...prev]; u[index] = { ...u[index], [field]: value }; return u; });
  }

  function handleEdit(order: Order & { delivery_date?: string | null; is_paid?: boolean }) {
    setEditingId(order.id!);
    setForm({
      customer_name: order.customer_name,
      status: order.status,
      notes: order.notes || "",
      delivery_date: order.delivery_date || "",
      is_paid: order.is_paid ?? false,
    });
    setOrderItems(
      order.order_items && order.order_items.length > 0
        ? order.order_items.map((oi: OrderItem) => ({ recipe_id: oi.recipe_id, quantity: oi.quantity, price_per_item: oi.price_per_item }))
        : [{ recipe_id: recipes[0]?.id || 0, quantity: 1, price_per_item: 0 }]
    );
    setMessage(null);
    topRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function handleCancel() {
    setEditingId(null);
    setForm({ customer_name: "", status: "Pending", notes: "", delivery_date: "", is_paid: false });
    setOrderItems([{ recipe_id: recipes[0]?.id ?? 0, quantity: 1, price_per_item: 0 }]);
    setMessage(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    const normalizedItems = orderItems.map((oi) => ({
      ...oi,
      recipe_id: oi.recipe_id === 0 && recipes.length > 0 ? recipes[0].id! : oi.recipe_id,
    }));
    const validItems = normalizedItems.filter((oi) => oi.recipe_id > 0 && oi.quantity > 0);

    if (!validItems.length) {
      setMessage({ text: "Add at least one recipe to the order.", type: "error" });
      setLoading(false);
      return;
    }

    const payload = {
      customer_name: form.customer_name,
      status: form.status,
      notes: form.notes,
      delivery_date: form.delivery_date || null,
      is_paid: form.is_paid,
    };

    let orderId = editingId;

    if (editingId) {
      const { error } = await supabase.from("orders").update(payload).eq("id", editingId);
      if (error) { setMessage({ text: `Error: ${error.message}`, type: "error" }); setLoading(false); return; }
      await supabase.from("order_items").delete().eq("order_id", editingId);
    } else {
      const { data, error } = await supabase.from("orders").insert(payload).select().single();
      if (error || !data) { setMessage({ text: `Error: ${error?.message}`, type: "error" }); setLoading(false); return; }
      orderId = data.id;
    }

    await supabase.from("order_items").insert(validItems.map((oi) => ({ ...oi, order_id: orderId })));
    setMessage({ text: editingId ? "Order updated! ✅" : "Order created! ✅", type: "success" });
    setLoading(false);
    handleCancel();
    await fetchAll();
  }

  async function updateStatus(orderId: number, status: OrderStatus) {
    await supabase.from("orders").update({ status }).eq("id", orderId);
    await fetchAll();
  }

  async function togglePaid(orderId: number, currentPaid: boolean) {
    await supabase.from("orders").update({ is_paid: !currentPaid }).eq("id", orderId);
    await fetchAll();
  }

  async function handleDelete(id: number) {
    const { error } = await supabase.from("orders").delete().eq("id", id);
    setMessage(error ? { text: `Error: ${error.message}`, type: "error" } : { text: "Order deleted. 🗑️", type: "success" });
    setDeleteConfirmId(null);
    await fetchAll();
  }

  const completedOrders = orders.filter((o) => o.status === "Completed");
  const unpaidOrders = orders.filter((o) => !o.is_paid && o.status !== "Cancelled");
  const totalRevenue = completedOrders.reduce((sum, o) =>
    sum + (o.order_items?.reduce((s: number, oi: OrderItem) => s + oi.price_per_item * oi.quantity, 0) || 0), 0);
  const currentOrderTotal = orderItems.reduce((sum, oi) => sum + oi.price_per_item * oi.quantity, 0);

  const filteredOrders = orders
    .filter((o) => statusFilter === "All" || o.status === statusFilter)
    .filter((o) => !deliveryDateFilter || o.delivery_date === deliveryDateFilter);

  return (
    <div ref={topRef} className="p-4 md:p-6 space-y-6 max-w-3xl mx-auto">

      {/* Page Title */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-2xl flex items-center justify-center text-xl" style={{ backgroundColor: "#ffd1dc" }}>🧾</div>
        <div>
          <h2 style={{ fontFamily: "'SuperJoyful', serif", fontWeight: "normal", fontSize: "1.4rem", color: "#7a4a33" }}>Order Tracker</h2>
          <p className="text-xs" style={{ fontFamily: "'Mochibop', serif", color: "#7a4a33", opacity: 0.5 }}>Manage orders and track revenue</p>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: "Total Orders", value: orders.length, emoji: "📦" },
          { label: "Pending", value: orders.filter((o) => o.status === "Pending").length, emoji: "⏳" },
          { label: "Completed", value: completedOrders.length, emoji: "✅" },
          { label: "Revenue", value: `₱${totalRevenue.toFixed(2)}`, emoji: "💰" },
        ].map((card) => (
          <div key={card.label} className="rounded-2xl p-3 border-2 text-center" style={{ backgroundColor: "white", borderColor: "#ffd1dc" }}>
            <span className="text-xl">{card.emoji}</span>
            <p className="text-[10px] uppercase tracking-widest mt-1" style={{ fontFamily: "'Mochibop', serif", color: "#7a4a33", opacity: 0.5 }}>{card.label}</p>
            <p className="text-lg font-bold" style={{ fontFamily: "'Mochibop', serif", color: "#7a4a33" }}>{card.value}</p>
          </div>
        ))}
      </div>

      {/* Unpaid warning */}
      {unpaidOrders.length > 0 && (
        <div className="rounded-2xl px-4 py-3 border-2 flex items-center gap-2" style={{ backgroundColor: "#fef9c3", borderColor: "#fde68a" }}>
          <span>💸</span>
          <p className="text-xs font-semibold" style={{ fontFamily: "'Mochibop', serif", color: "#92400e" }}>
            {unpaidOrders.length} order{unpaidOrders.length > 1 ? "s" : ""} still unpaid
          </p>
        </div>
      )}

      {/* Message */}
      {message && (
        <div className="rounded-2xl px-4 py-3 text-sm border-2" style={{ fontFamily: "'Mochibop', serif", backgroundColor: message.type === "success" ? "#f0fdf4" : "#fef2f2", color: message.type === "success" ? "#16a34a" : "#dc2626", borderColor: message.type === "success" ? "#bbf7d0" : "#fecaca" }}>
          {message.text}
        </div>
      )}

      {/* Order Form */}
      <div style={cardStyle}>
        <h3 style={{ fontFamily: "'SuperJoyful', serif", fontWeight: "normal", fontSize: "1.1rem", color: "#7a4a33", marginBottom: "1rem" }}>
          {editingId ? "✏️ Edit Order" : "➕ New Order"}
        </h3>
        <form onSubmit={handleSubmit} className="space-y-4">

          {/* Customer + Status */}
          <div className="flex gap-3">
            <div className="flex-1">
              <label className={labelClass} style={labelStyle}>Customer Name</label>
              <input
                value={form.customer_name}
                onChange={(e) => setForm((p) => ({ ...p, customer_name: e.target.value }))}
                style={inputStyle} placeholder="e.g. Juan Dela Cruz~" required
              />
            </div>
            <div className="w-36">
              <label className={labelClass} style={labelStyle}>Status</label>
              <select value={form.status} onChange={(e) => setForm((p) => ({ ...p, status: e.target.value as OrderStatus }))} style={inputStyle}>
                {ORDER_STATUSES.map((s) => <option key={s}>{s}</option>)}
              </select>
            </div>
          </div>

          {/* Delivery Date + Paid */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelClass} style={labelStyle}>Delivery Date</label>
              <input
                type="date"
                value={form.delivery_date}
                onChange={(e) => setForm((p) => ({ ...p, delivery_date: e.target.value }))}
                style={inputStyle}
              />
            </div>
            <div>
              <label className={labelClass} style={labelStyle}>Payment</label>
              <button
                type="button"
                onClick={() => setForm((p) => ({ ...p, is_paid: !p.is_paid }))}
                className="flex items-center gap-2 px-4 rounded-2xl border-2 transition-all w-full"
                style={{
                  fontFamily: "'Mochibop', serif",
                  fontSize: "0.8rem",
                  fontWeight: 700,
                  height: "42px",
                  backgroundColor: form.is_paid ? "#f0fdf4" : "white",
                  borderColor: form.is_paid ? "#bbf7d0" : "#ffd1dc",
                  color: form.is_paid ? "#16a34a" : "#7a4a33",
                }}
              >
                <span
                  className="w-4 h-4 rounded-full border-2 flex items-center justify-center text-[10px] shrink-0"
                  style={{
                    borderColor: form.is_paid ? "#16a34a" : "#f5a8bc",
                    backgroundColor: form.is_paid ? "#16a34a" : "white",
                    color: "white",
                  }}
                >
                  {form.is_paid ? "✓" : ""}
                </span>
                {form.is_paid ? "Paid" : "Unpaid"}
              </button>
            </div>
          </div>

          {/* Order Items */}
          <div>
            <label className={labelClass} style={labelStyle}>Order Items</label>
            {!recipes.length ? (
              <p className="text-xs italic" style={{ fontFamily: "'Mochibop', serif", color: "#7a4a33", opacity: 0.5 }}>No recipes yet. Add some in the Recipes tab~</p>
            ) : (
              <div className="space-y-2">
                {orderItems.map((oi: OrderFormItem, i: number) => (
                  <div key={i} className="flex gap-2 items-center">
                    <select
                      value={oi.recipe_id === 0 ? recipes[0].id! : oi.recipe_id}
                      onChange={(e) => updateOrderItem(i, "recipe_id", Number(e.target.value))}
                      style={{ ...inputStyle, flex: 1 }}
                    >
                      {recipes.map((r: Recipe) => <option key={r.id} value={r.id}>{r.emoji} {r.title}</option>)}
                    </select>
                    <input
                      type="number" value={oi.quantity}
                      onChange={(e) => updateOrderItem(i, "quantity", Number(e.target.value))}
                      style={{ ...inputStyle, width: "4rem" }} min={1} placeholder="Qty"
                    />
                    <div className="relative" style={{ width: "7rem" }}>
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs" style={{ color: "#7a4a33", opacity: 0.5, fontFamily: "'Mochibop', serif" }}>₱</span>
                      <input
                        type="number" value={oi.price_per_item}
                        onChange={(e) => updateOrderItem(i, "price_per_item", Number(e.target.value))}
                        style={{ ...inputStyle, paddingLeft: "1.5rem" }} min={0} step={0.01} placeholder="0.00"
                      />
                    </div>
                    <button
                      type="button" onClick={() => removeOrderItem(i)}
                      disabled={orderItems.length === 1}
                      className="text-xl px-1 shrink-0 disabled:opacity-20 transition-colors"
                      style={{ color: "#f5a8bc" }}
                    >×</button>
                  </div>
                ))}
                <button type="button" onClick={addOrderItem} className="mt-1 text-xs underline underline-offset-2" style={{ fontFamily: "'Mochibop', serif", color: "#7a4a33", opacity: 0.6 }}>
                  + Add item
                </button>
              </div>
            )}
          </div>

          {/* Order Total */}
          {currentOrderTotal > 0 && (
            <div className="flex justify-between items-center rounded-2xl px-4 py-3" style={{ backgroundColor: "#fff6e7", border: "2px solid #ffd1dc" }}>
              <span className="text-sm font-bold" style={{ fontFamily: "'Mochibop', serif", color: "#7a4a33" }}>Order Total</span>
              <span className="text-lg font-bold" style={{ fontFamily: "'SuperJoyful', serif", color: "#7a4a33", fontWeight: "normal" }}>₱{currentOrderTotal.toFixed(2)}</span>
            </div>
          )}

          {/* Notes */}
          <div>
            <label className={labelClass} style={labelStyle}>Notes (optional)</label>
            <textarea
              value={form.notes}
              onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))}
              style={{ ...inputStyle, resize: "none" } as React.CSSProperties}
              rows={2} placeholder="Special requests, delivery info~"
            />
          </div>

          {/* Submit */}
          <div className="flex gap-3">
            <button
              type="submit" disabled={loading}
              className="flex-1 py-3 rounded-2xl font-bold text-sm transition-all disabled:opacity-50"
              style={{ backgroundColor: "#ffd1dc", color: "#7a4a33", fontFamily: "'Mochibop', serif", border: "2px solid #f5a8bc", boxShadow: "0 4px 12px rgba(255,209,220,0.4)" }}
            >
              {loading ? "Saving..." : editingId ? "Update Order ✨" : "Create Order 🧾"}
            </button>
            {editingId && (
              <button
                type="button" onClick={handleCancel}
                className="px-5 py-3 rounded-2xl font-bold text-sm"
                style={{ backgroundColor: "white", color: "#7a4a33", fontFamily: "'Mochibop', serif", border: "2px solid #ffd1dc" }}
              >
                Cancel
              </button>
            )}
          </div>
        </form>
      </div>

      {/* Order List */}
      <div>
        <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl flex items-center justify-center text-base" style={{ backgroundColor: "#ffd1dc" }}>📋</div>
            <h3 style={{ fontFamily: "'SuperJoyful', serif", fontWeight: "normal", fontSize: "1.2rem", color: "#7a4a33" }}>
              All Orders ({orders.length})
            </h3>
          </div>
        </div>

        {/* Status filter */}
        <div className="flex gap-1 flex-wrap mb-2">
          {(["All", ...ORDER_STATUSES] as const).map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s as typeof statusFilter)}
              className="text-xs px-3 py-1.5 rounded-2xl border-2 transition-all"
              style={{
                fontFamily: "'Mochibop', serif",
                backgroundColor: statusFilter === s ? "#ffd1dc" : "white",
                borderColor: statusFilter === s ? "#f5a8bc" : "#ffd1dc",
                color: "#7a4a33",
                boxShadow: statusFilter === s ? "0 2px 8px rgba(255,209,220,0.5)" : "none",
              }}
            >
              {s}
            </button>
          ))}
        </div>

        {/* Delivery date filter */}
        <div className="flex items-center gap-2 mb-4">
          <label className="text-[10px] uppercase tracking-widest font-bold shrink-0" style={{ fontFamily: "'Mochibop', serif", color: "#7a4a33", opacity: 0.6 }}>
            🚚 Delivery
          </label>
          <input
            type="date"
            value={deliveryDateFilter}
            onChange={(e) => setDeliveryDateFilter(e.target.value)}
            style={{ ...inputStyle, width: "auto", flex: 1 }}
          />
          {deliveryDateFilter && (
            <button
              onClick={() => setDeliveryDateFilter("")}
              className="text-xs px-3 py-2 rounded-2xl border-2 shrink-0"
              style={{ fontFamily: "'Mochibop', serif", color: "#7a4a33", borderColor: "#ffd1dc", backgroundColor: "white" }}
            >
              Clear
            </button>
          )}
        </div>

        {fetching ? (
          <div className="text-center py-12" style={{ fontFamily: "'Mochibop', serif", color: "#7a4a33", opacity: 0.4 }}>Loading orders... 🍪</div>
        ) : filteredOrders.length === 0 ? (
          <div className="text-center py-12" style={{ fontFamily: "'Mochibop', serif", color: "#7a4a33", opacity: 0.4 }}>No orders found 🥺</div>
        ) : (
          <div className="space-y-3">
            {filteredOrders.map((order) => {
              const orderTotal = order.order_items?.reduce((s: number, oi: OrderItem) => s + oi.price_per_item * oi.quantity, 0) || 0;
              const isExpanded = expandedOrderId === order.id;
              const delivery = formatDeliveryDate(order.delivery_date);

              return (
                <div
                  key={order.id}
                  className="rounded-2xl border-2 overflow-hidden"
                  style={{
                    backgroundColor: "white",
                    borderColor: delivery.overdue && order.status !== "Completed" ? "#fecaca" : "#ffd1dc",
                  }}
                >
                  {/* Order row */}
                  <div
                    className="px-4 py-3 flex items-center justify-between gap-3 cursor-pointer"
                    onClick={() => setExpandedOrderId(isExpanded ? null : order.id!)}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-bold" style={{ fontFamily: "'Mochibop', serif", color: "#7a4a33" }}>
                          {order.customer_name}
                        </p>
                        <span
                          className={`text-[10px] px-2 py-0.5 rounded-full border font-bold ${statusColors[order.status]}`}
                          style={{ fontFamily: "'Mochibop', serif" }}
                        >
                          {order.status}
                        </span>
                        {/* Paid badge */}
                        <span
                          className="text-[10px] px-2 py-0.5 rounded-full border font-bold"
                          style={{
                            fontFamily: "'Mochibop', serif",
                            backgroundColor: order.is_paid ? "#f0fdf4" : "#fef9c3",
                            borderColor: order.is_paid ? "#bbf7d0" : "#fde68a",
                            color: order.is_paid ? "#16a34a" : "#92400e",
                          }}
                        >
                          {order.is_paid ? "💚 Paid" : "💸 Unpaid"}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                        <p className="text-[11px]" style={{ fontFamily: "'Mochibop', serif", color: "#7a4a33", opacity: 0.5 }}>
                          {order.order_items?.length || 0} item(s) · ₱{orderTotal.toFixed(2)}
                          {order.created_at && ` · ${new Date(order.created_at).toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" })}`}
                        </p>
                        {/* Delivery date pill */}
                        {order.delivery_date && (
                          <span
                            className="text-[10px] px-2 py-0.5 rounded-full font-semibold"
                            style={{
                              fontFamily: "'Mochibop', serif",
                              backgroundColor: delivery.overdue && order.status !== "Completed"
                                ? "#fef2f2"
                                : delivery.urgent ? "#fff6e7" : "rgba(255,209,220,0.2)",
                              color: delivery.overdue && order.status !== "Completed"
                                ? "#dc2626"
                                : delivery.urgent ? "#92400e" : "#7a4a33",
                            }}
                          >
                            🚚 {delivery.label}
                          </span>
                        )}
                      </div>
                    </div>
                    <span className="text-sm shrink-0" style={{ color: "#7a4a33", opacity: 0.4 }}>{isExpanded ? "▲" : "▼"}</span>
                  </div>

                  {/* Expanded details */}
                  {isExpanded && (
                    <div className="px-4 pb-4 pt-3 space-y-3" style={{ borderTop: "2px dashed #ffd1dc" }}>

                      {/* Delivery + payment info */}
                      <div className="flex gap-3 flex-wrap">
                        <div className="rounded-2xl px-3 py-2 flex-1" style={{ backgroundColor: "#fff6e7", border: "2px solid #ffd1dc", minWidth: "140px" }}>
                          <p className="text-[9px] uppercase tracking-widest font-bold mb-0.5" style={{ fontFamily: "'Mochibop', serif", color: "#7a4a33", opacity: 0.5 }}>Delivery</p>
                          <p
                            className="text-xs font-semibold"
                            style={{
                              fontFamily: "'Mochibop', serif",
                              color: delivery.overdue && order.status !== "Completed"
                                ? "#dc2626"
                                : delivery.urgent ? "#92400e" : "#7a4a33",
                            }}
                          >
                            🚚 {delivery.label}
                          </p>
                        </div>
                        <div
                          className="rounded-2xl px-3 py-2 flex-1 cursor-pointer transition-all"
                          style={{
                            backgroundColor: order.is_paid ? "#f0fdf4" : "#fef9c3",
                            border: `2px solid ${order.is_paid ? "#bbf7d0" : "#fde68a"}`,
                            minWidth: "120px",
                          }}
                          onClick={() => togglePaid(order.id!, order.is_paid ?? false)}
                          title="Click to toggle payment status"
                        >
                          <p className="text-[9px] uppercase tracking-widest font-bold mb-0.5" style={{ fontFamily: "'Mochibop', serif", color: "#7a4a33", opacity: 0.5 }}>Payment</p>
                          <p className="text-xs font-semibold" style={{ fontFamily: "'Mochibop', serif", color: order.is_paid ? "#16a34a" : "#92400e" }}>
                            {order.is_paid ? "💚 Paid · tap to unmark" : "💸 Unpaid · tap to mark paid"}
                          </p>
                        </div>
                      </div>

                      {/* Items */}
                      <div className="space-y-1">
                        {order.order_items?.map((oi: OrderItem, i: number) => (
                          <div key={i} className="flex justify-between items-center text-sm">
                            <span style={{ fontFamily: "'Mochibop', serif", color: "#7a4a33" }}>{oi.recipe?.emoji} {oi.recipe?.title} × {oi.quantity}</span>
                            <span className="font-semibold" style={{ fontFamily: "'Mochibop', serif", color: "#7a4a33" }}>₱{(oi.price_per_item * oi.quantity).toFixed(2)}</span>
                          </div>
                        ))}
                        <div className="flex justify-between text-sm font-bold pt-2 mt-2" style={{ borderTop: "2px dashed #ffd1dc" }}>
                          <span style={{ fontFamily: "'Mochibop', serif", color: "#7a4a33" }}>Total</span>
                          <span style={{ fontFamily: "'SuperJoyful', serif", color: "#7a4a33", fontWeight: "normal" }}>₱{orderTotal.toFixed(2)}</span>
                        </div>
                      </div>

                      {/* Notes */}
                      {order.notes && (
                        <p className="text-xs italic rounded-2xl px-3 py-2" style={{ fontFamily: "'Mochibop', serif", color: "#7a4a33", opacity: 0.7, backgroundColor: "#fff6e7" }}>
                          📝 {order.notes}
                        </p>
                      )}

                      {/* Status changers */}
                      <div className="flex gap-2 flex-wrap">
                        {ORDER_STATUSES.filter((s) => s !== order.status).map((s) => (
                          <button
                            key={s}
                            onClick={() => updateStatus(order.id!, s)}
                            className={`text-xs px-3 py-1.5 rounded-xl border font-semibold transition-colors ${statusColors[s]}`}
                            style={{ fontFamily: "'Mochibop', serif" }}
                          >
                            → {s}
                          </button>
                        ))}
                      </div>

                      {/* Edit / Delete */}
                      <div className="flex gap-2 pt-1">
                        <button
                          onClick={() => handleEdit(order)}
                          className="text-xs px-3 py-1.5 rounded-xl border-2 transition-colors"
                          style={{ fontFamily: "'Mochibop', serif", color: "#7a4a33", borderColor: "#ffd1dc", backgroundColor: "white" }}
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => setDeleteConfirmId(order.id!)}
                          className="text-xs px-3 py-1.5 rounded-xl border-2 transition-colors"
                          style={{ fontFamily: "'Mochibop', serif", color: "#dc2626", borderColor: "#fecaca", backgroundColor: "#fef2f2" }}
                        >
                          Delete
                        </button>
                      </div>

                      {deleteConfirmId === order.id && (
                        <div className="flex items-center justify-between gap-3 pt-2" style={{ borderTop: "2px dashed #ffd1dc" }}>
                          <p className="text-xs font-semibold" style={{ fontFamily: "'Mochibop', serif", color: "#dc2626" }}>Delete this order? 🥺</p>
                          <div className="flex gap-2">
                            <button
                              onClick={() => setDeleteConfirmId(null)}
                              className="text-xs px-3 py-1.5 rounded-xl border-2"
                              style={{ fontFamily: "'Mochibop', serif", color: "#7a4a33", borderColor: "#ffd1dc", backgroundColor: "white" }}
                            >
                              Cancel
                            </button>
                            <button
                              onClick={() => handleDelete(order.id!)}
                              className="text-xs px-3 py-1.5 rounded-xl"
                              style={{ fontFamily: "'Mochibop', serif", backgroundColor: "#ef4444", color: "white" }}
                            >
                              Yes, delete
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}