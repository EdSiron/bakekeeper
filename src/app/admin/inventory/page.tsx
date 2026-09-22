"use client";
import { useEffect, useState, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { Ingredient, UNITS } from "@/app/data/recipes";

const emptyIngredient: Omit<Ingredient, "id" | "created_at"> = {
  name: "", quantity: 0, unit: "g", price_per_unit: 0, low_stock_threshold: 100,
};

const label = "block text-[10px] font-bold uppercase tracking-widest mb-1";
const labelStyle = { color: "#7a4a33", fontFamily: "'Mochibop', serif" };

function KawaiiInput({ value, onChange, placeholder, required, type = "text", min, step, className = "" }: {
  value: string | number; onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  placeholder?: string; required?: boolean; type?: string;
  min?: number; step?: number; className?: string;
}) {
  const [focused, setFocused] = useState(false);
  return (
    <input type={type} value={value} onChange={onChange} placeholder={placeholder} required={required} min={min} step={step}
      className={`w-full px-3 py-2.5 rounded-2xl border-2 bg-white/70 text-sm focus:outline-none transition-all ${className}`}
      style={{ borderColor: focused ? "#f5a8bc" : "#ffd1dc", color: "#7a4a33", fontFamily: "'Mochibop', serif", boxShadow: focused ? "0 0 0 3px rgba(255,209,220,0.3)" : "none" }}
      onFocus={() => setFocused(true)} onBlur={() => setFocused(false)} />
  );
}

function KawaiiSelect({ value, onChange, children, className = "" }: {
  value: string; onChange: (e: React.ChangeEvent<HTMLSelectElement>) => void;
  children: React.ReactNode; className?: string;
}) {
  return (
    <select value={value} onChange={onChange}
      className={`w-full px-3 py-2.5 rounded-2xl border-2 bg-white/70 text-sm focus:outline-none transition-colors ${className}`}
      style={{ borderColor: "#ffd1dc", color: "#7a4a33", fontFamily: "'Mochibop', serif" }}>
      {children}
    </select>
  );
}

export default function InventoryPage() {
  const topRef = useRef<HTMLDivElement>(null);
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [form, setForm] = useState(emptyIngredient);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [message, setMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);
  const [search, setSearch] = useState("");
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);

  useEffect(() => { fetchIngredients(); }, []);

  async function fetchIngredients() {
    setFetching(true);
    const { data } = await supabase.from("ingredients").select("*").order("name");
    if (data) setIngredients(data);
    setFetching(false);
  }

  function handleField(field: keyof typeof emptyIngredient, value: string | number) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  function handleEdit(ing: Ingredient) {
    setEditingId(ing.id!);
    setForm({ name: ing.name, quantity: ing.quantity, unit: ing.unit, price_per_unit: ing.price_per_unit, low_stock_threshold: ing.low_stock_threshold });
    setMessage(null);
    topRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function handleCancel() { setEditingId(null); setForm(emptyIngredient); setMessage(null); }

  async function handleDelete(id: number) {
    const { error } = await supabase.from("ingredients").delete().eq("id", id);
    setMessage(error ? { text: `Error: ${error.message}`, type: "error" } : { text: "Ingredient deleted.", type: "success" });
    setDeleteConfirmId(null);
    await fetchIngredients();
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMessage(null);
    if (editingId) {
      const { error } = await supabase.from("ingredients").update(form).eq("id", editingId);
      setMessage(error ? { text: `Error: ${error.message}`, type: "error" } : { text: "Ingredient updated! ✅", type: "success" });
    } else {
      const { error } = await supabase.from("ingredients").insert(form);
      setMessage(error ? { text: `Error: ${error.message}`, type: "error" } : { text: "Ingredient added! ✅", type: "success" });
    }
    setLoading(false);
    handleCancel();
    await fetchIngredients();
    topRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  const totalValue = ingredients.reduce((sum, i) => sum + i.quantity * i.price_per_unit, 0);
  const lowStock = ingredients.filter((i) => i.quantity <= i.low_stock_threshold);
  const filtered = ingredients.filter((i) => i.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <div ref={topRef} className="p-4 md:p-6 space-y-6 max-w-3xl mx-auto">
      {/* Title */}
      <div className="flex items-center gap-3 pt-2">
        <div className="w-10 h-10 rounded-2xl flex items-center justify-center text-xl" style={{ backgroundColor: "#ffd1dc" }}>🧂</div>
        <h2 style={{ fontFamily: "'SuperJoyful', serif", fontWeight: "normal", fontSize: "1.4rem", color: "#7a4a33" }}>
          Ingredient Inventory
        </h2>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "Total Items", value: ingredients.length, emoji: "🧺" },
          { label: "Low Stock", value: lowStock.length, emoji: "⚠️", warn: lowStock.length > 0 },
          { label: "Total Value", value: `₱${totalValue.toFixed(2)}`, emoji: "💰" },
        ].map((card) => (
          <div key={card.label} className="rounded-2xl p-3 border-2 text-center"
            style={{ backgroundColor: card.warn ? "#fef9c3" : "white", borderColor: card.warn ? "#fde047" : "#ffd1dc" }}>
            <p className="text-xl mb-1">{card.emoji}</p>
            <p className="text-[10px] uppercase tracking-widest" style={{ color: "#7a4a33", opacity: 0.6, fontFamily: "'Mochibop', serif" }}>{card.label}</p>
            <p className="text-lg font-bold" style={{ color: card.warn ? "#a16207" : "#7a4a33", fontFamily: "'Mochibop', serif" }}>{card.value}</p>
          </div>
        ))}
      </div>

      {/* Low Stock Warning */}
      {lowStock.length > 0 && (
        <div className="rounded-2xl px-4 py-3 border-2" style={{ backgroundColor: "#fef9c3", borderColor: "#fde047" }}>
          <p className="text-xs font-bold mb-1" style={{ color: "#a16207", fontFamily: "'Mochibop', serif" }}>⚠️ Low Stock Alert</p>
          <p className="text-xs" style={{ color: "#a16207", fontFamily: "'Mochibop', serif" }}>{lowStock.map((i) => i.name).join(", ")}</p>
        </div>
      )}

      {/* Message */}
      {message && (
        <div className="rounded-2xl px-4 py-3 text-sm border-2"
          style={{ backgroundColor: message.type === "success" ? "#f0fdf4" : "#fef2f2", borderColor: message.type === "success" ? "#bbf7d0" : "#fecaca", color: message.type === "success" ? "#16a34a" : "#dc2626", fontFamily: "'Mochibop', serif" }}>
          {message.text}
        </div>
      )}

      {/* Form */}
      <div className="rounded-3xl border-2 p-5" style={{ backgroundColor: "white", borderColor: "#ffd1dc" }}>
        <div className="flex items-center gap-2 mb-4">
          <span className="text-lg">{editingId ? "✏️" : "➕"}</span>
          <h3 style={{ fontFamily: "'SuperJoyful', serif", fontWeight: "normal", fontSize: "1.1rem", color: "#7a4a33" }}>
            {editingId ? "Edit Ingredient" : "Add Ingredient"}
          </h3>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="flex gap-3">
            <div className="flex-1">
              <label className={label} style={labelStyle}>Name</label>
              <KawaiiInput value={form.name} onChange={(e) => handleField("name", e.target.value)} placeholder="e.g. Bread Flour" required />
            </div>
            <div className="w-28">
              <label className={label} style={labelStyle}>Unit</label>
              <KawaiiSelect value={form.unit} onChange={(e) => handleField("unit", e.target.value)}>
                {UNITS.map((u) => <option key={u}>{u}</option>)}
              </KawaiiSelect>
            </div>
          </div>

          <div className="flex gap-3">
            <div className="flex-1">
              <label className={label} style={labelStyle}>Quantity</label>
              <KawaiiInput type="number" value={form.quantity} onChange={(e) => handleField("quantity", Number(e.target.value))} min={0} step={0.000001} required />
            </div>
            <div className="flex-1">
              <label className={label} style={labelStyle}>Price / {form.unit} (₱)</label>
              <KawaiiInput type="number" value={form.price_per_unit} onChange={(e) => handleField("price_per_unit", Number(e.target.value))} min={0} step={0.000001} required />
            </div>
            <div className="flex-1">
              <label className={label} style={labelStyle}>Low Stock At</label>
              <KawaiiInput type="number" value={form.low_stock_threshold} onChange={(e) => handleField("low_stock_threshold", Number(e.target.value))} min={0} required />
            </div>
          </div>

          <div className="flex gap-3">
            <button type="submit" disabled={loading}
              className="flex-1 py-3 rounded-2xl font-bold text-sm border-2 transition-all disabled:opacity-50"
              style={{ backgroundColor: "#ffd1dc", borderColor: "#f5a8bc", color: "#7a4a33", fontFamily: "'Mochibop', serif" }}
              onMouseEnter={(e) => !loading && (e.currentTarget.style.backgroundColor = "#f5a8bc")}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "#ffd1dc")}>
              {loading ? "Saving..." : editingId ? "Update ✨" : "Add Ingredient ✨"}
            </button>
            {editingId && (
              <button type="button" onClick={handleCancel}
                className="px-5 py-3 rounded-2xl font-bold text-sm border-2 transition-all"
                style={{ borderColor: "#ffd1dc", color: "#7a4a33", backgroundColor: "white", fontFamily: "'Mochibop', serif" }}>
                Cancel
              </button>
            )}
          </div>
        </form>
      </div>

      {/* Ingredient List */}
      <div>
        <div className="flex items-center gap-3 mb-4">
          <div className="w-8 h-8 rounded-xl flex items-center justify-center text-base" style={{ backgroundColor: "#ffd1dc" }}>📋</div>
          <h3 style={{ fontFamily: "'SuperJoyful', serif", fontWeight: "normal", fontSize: "1.1rem", color: "#7a4a33" }}>
            All Ingredients ({ingredients.length})
          </h3>
        </div>
        <KawaiiInput value={search} onChange={(e) => setSearch(e.target.value)} placeholder="🔍 Search ingredients..." className="mb-3" />

        {fetching ? (
          <div className="text-center py-12" style={{ color: "#7a4a33", opacity: 0.4, fontFamily: "'Mochibop', serif" }}>Loading...</div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-4xl mb-2">🥺</div>
            <p style={{ color: "#7a4a33", opacity: 0.4, fontFamily: "'Mochibop', serif" }}>No ingredients found</p>
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map((ing) => {
              const isLow = ing.quantity <= ing.low_stock_threshold;
              return (
                <div key={ing.id} className="rounded-2xl px-4 py-3 border-2 transition-all"
                  style={{ backgroundColor: isLow ? "#fef9c3" : "white", borderColor: isLow ? "#fde047" : "#ffd1dc" }}>
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-bold truncate" style={{ color: "#7a4a33", fontFamily: "'Mochibop', serif" }}>{ing.name}</p>
                        {isLow && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded-full font-bold"
                            style={{ backgroundColor: "#fde047", color: "#a16207", fontFamily: "'Mochibop', serif" }}>Low ⚠️</span>
                        )}
                      </div>
                      <div className="flex gap-3 mt-0.5 flex-wrap">
                        <p className="text-[11px]" style={{ color: "#7a4a33", opacity: 0.6, fontFamily: "'Mochibop', serif" }}>{ing.quantity} {ing.unit} in stock</p>
                        <p className="text-[11px]" style={{ color: "#7a4a33", opacity: 0.6, fontFamily: "'Mochibop', serif" }}>₱{ing.price_per_unit}/{ing.unit}</p>
                        <p className="text-[11px]" style={{ color: "#7a4a33", opacity: 0.6, fontFamily: "'Mochibop', serif" }}>Value: ₱{(ing.quantity * ing.price_per_unit).toFixed(2)}</p>
                      </div>
                    </div>
                    <div className="flex gap-2 shrink-0">
                      <button onClick={() => handleEdit(ing)}
                        className="text-xs px-3 py-1.5 rounded-xl border-2 transition-all"
                        style={{ borderColor: "#ffd1dc", color: "#7a4a33", backgroundColor: "white", fontFamily: "'Mochibop', serif" }}
                        onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#ffd1dc")}
                        onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "white")}>Edit</button>
                      <button onClick={() => setDeleteConfirmId(ing.id!)}
                        className="text-xs px-3 py-1.5 rounded-xl border-2 transition-all"
                        style={{ borderColor: "#fecaca", color: "#dc2626", backgroundColor: "#fef2f2", fontFamily: "'Mochibop', serif" }}
                        onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#fee2e2")}
                        onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "#fef2f2")}>Delete</button>
                    </div>
                  </div>
                  {deleteConfirmId === ing.id && (
                    <div className="mt-3 pt-3 flex items-center justify-between gap-3" style={{ borderTop: "2px dashed #ffd1dc" }}>
                      <p className="text-xs font-semibold" style={{ color: "#dc2626", fontFamily: "'Mochibop', serif" }}>Delete this ingredient? 🥺</p>
                      <div className="flex gap-2">
                        <button onClick={() => setDeleteConfirmId(null)}
                          className="text-xs px-3 py-1.5 rounded-xl border-2"
                          style={{ borderColor: "#ffd1dc", color: "#7a4a33", backgroundColor: "white", fontFamily: "'Mochibop', serif" }}>Cancel</button>
                        <button onClick={() => handleDelete(ing.id!)}
                          className="text-xs px-3 py-1.5 rounded-xl"
                          style={{ backgroundColor: "#ef4444", color: "white", fontFamily: "'Mochibop', serif" }}>Yes, delete</button>
                      </div>
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