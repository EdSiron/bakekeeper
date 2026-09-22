"use client";
import { useEffect, useState, useCallback, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";
import { Recipe, Ingredient, IngredientGroup, CATEGORIES, DIFFICULTIES, UNITS } from "@/app/data/recipes";

const emptyRecipe: Omit<Recipe, "id" | "created_at"> = {
  title: "", category: "Breads", emoji: "🍞",
  prep: "", bake: "", yield: "", difficulty: "Easy",
  ingredients: [""], steps: [""], notes: "",
};

const labelClass = "block text-[10px] font-bold uppercase tracking-widest mb-1";
const labelStyle = { fontFamily: "'Mochibop', serif", color: "#7a4a33", opacity: 0.7 };
const inputStyle = {
  width: "100%", padding: "10px 14px", borderRadius: "16px",
  border: "2px solid #ffd1dc", backgroundColor: "white",
  fontFamily: "'Mochibop', serif", color: "#7a4a33",
  fontSize: "0.875rem", outline: "none", transition: "border-color 0.2s",
};
const cardStyle = {
  backgroundColor: "white", borderRadius: "24px",
  border: "2px solid #ffd1dc", padding: "24px",
  boxShadow: "0 4px 16px rgba(255,209,220,0.3)",
};

type LinkedIngredient = { ingredient_id: number; amount_required: number; unit: string };
type RawRecipeIngredient = { ingredient_id: number; amount_required: number; unit: string; ingredient: { unit: string } };
type IngredientsMode = "simple" | "grouped";

// Handles all 3 formats Supabase may return:
// 1. already parsed objects  [{group, items}, ...]
// 2. one JSON string         "[{\"group\":...}]"
// 3. array of JSON strings   ["{\"group\":...}", ...]
function safeParseIngredients(raw: unknown): string[] | IngredientGroup[] {
  if (typeof raw === "string") {
    try { raw = JSON.parse(raw); } catch { return [raw as string]; }
  }
  if (!Array.isArray(raw)) return [];
  if (raw.length > 0 && typeof raw[0] === "string") {
    const first = (raw[0] as string).trim();
    if (first.startsWith("{")) {
      try {
        const parsed = raw.map((item) =>
          typeof item === "string" ? JSON.parse(item) : item
        );
        if (parsed.every((p) => p && typeof p === "object" && "group" in p)) {
          return parsed as IngredientGroup[];
        }
      } catch { /* fall through */ }
    }
  }
  return raw as string[] | IngredientGroup[];
}

export default function AdminRecipesPage() {
  const { authed, setAuthed } = useAuth();
  const topRef = useRef<HTMLDivElement>(null);
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [ingredientsLoading, setIngredientsLoading] = useState(true);
  const [form, setForm] = useState<Omit<Recipe, "id" | "created_at">>(emptyRecipe);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [message, setMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);
  const [pw, setPw] = useState("");
  const [pwError, setPwError] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("All");
  const [linkedIngredients, setLinkedIngredients] = useState<LinkedIngredient[]>([]);
  const [ingredientsMode, setIngredientsMode] = useState<IngredientsMode>("simple");
  const [ingredientGroups, setIngredientGroups] = useState<IngredientGroup[]>([
    { group: "Ingredients", items: [""] },
  ]);

  const fetchRecipes = useCallback(async () => {
    setFetching(true);
    const { data } = await supabase.from("recipes").select("*").order("created_at", { ascending: false });
    if (data) setRecipes(data as Recipe[]);
    setFetching(false);
  }, []);

  const fetchIngredients = useCallback(async () => {
    setIngredientsLoading(true);
    const { data } = await supabase.from("ingredients").select("*").order("name");
    if (data) setIngredients(data as Ingredient[]);
    setIngredientsLoading(false);
  }, []);

  useEffect(() => {
    if (authed) { fetchRecipes(); fetchIngredients(); }
  }, [authed, fetchRecipes, fetchIngredients]);

  async function fetchRecipeIngredients(recipeId: number) {
    const { data } = await supabase
      .from("recipe_ingredients")
      .select("*, ingredient:ingredients(*)")
      .eq("recipe_id", recipeId);
    if (data && data.length > 0) {
      setLinkedIngredients(data.map((d: RawRecipeIngredient) => ({
        ingredient_id: d.ingredient_id,
        amount_required: d.amount_required,
        unit: d.unit,
      })));
    } else setLinkedIngredients([]);
  }

  function handleLogin() {
    if (pw === "admin") { setAuthed(true); setPwError(false); }
    else setPwError(true);
  }

  function handleField(field: keyof Omit<Recipe, "id" | "created_at">, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  function handleArrayField(field: "ingredients" | "steps", index: number, value: string) {
    setForm((prev) => {
      const arr = Array.isArray(prev[field]) ? [...(prev[field] as string[])] : [""];
      arr[index] = value;
      return { ...prev, [field]: arr };
    });
  }

  function addArrayItem(field: "ingredients" | "steps") {
    setForm((prev) => ({ ...prev, [field]: Array.isArray(prev[field]) ? [...(prev[field] as string[]), ""] : [""] }));
  }

  function removeArrayItem(field: "ingredients" | "steps", index: number) {
    setForm((prev) => {
      const arr = Array.isArray(prev[field]) ? (prev[field] as string[]) : [];
      if (arr.length === 1) return prev;
      return { ...prev, [field]: arr.filter((_: string, i: number) => i !== index) };
    });
  }

  function addLinkedIngredient() {
    if (!ingredients.length) return;
    const first = ingredients[0];
    setLinkedIngredients((prev) => [...prev, { ingredient_id: first.id!, amount_required: 0, unit: first.unit }]);
  }

  function updateLinkedIngredient(index: number, field: string, value: string | number) {
    setLinkedIngredients((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      // Only pre-fill unit when switching ingredient AND unit hasn't been manually changed
      if (field === "ingredient_id") {
        const ing = ingredients.find((i) => i.id === Number(value));
        if (ing) updated[index].unit = ing.unit;
      }
      return updated;
    });
  }

  function removeLinkedIngredient(index: number) {
    setLinkedIngredients((prev) => prev.filter((_: LinkedIngredient, i: number) => i !== index));
  }

  async function handleEdit(recipe: Recipe) {
    setEditingId(recipe.id!);

    const ings = safeParseIngredients(recipe.ingredients);
    const isGrouped =
      ings.length > 0 &&
      typeof ings[0] === "object" &&
      ings[0] !== null &&
      "group" in (ings[0] as object);

    if (isGrouped) {
      setIngredientsMode("grouped");
      setIngredientGroups(ings as IngredientGroup[]);
    } else {
      setIngredientsMode("simple");
      setIngredientGroups([{ group: "Ingredients", items: [""] }]);
    }

    // Safely parse steps too
    let parsedSteps: string[] = [];
    const rawSteps = recipe.steps as unknown;
    if (typeof rawSteps === "string") {
      try { parsedSteps = JSON.parse(rawSteps); } catch { parsedSteps = [rawSteps]; }
    } else if (Array.isArray(rawSteps)) {
      parsedSteps = rawSteps as string[];
    }

    setForm({
      title: recipe.title,
      category: recipe.category,
      emoji: recipe.emoji,
      prep: recipe.prep,
      bake: recipe.bake,
      yield: recipe.yield,
      difficulty: recipe.difficulty,
      ingredients: isGrouped ? [] : ((ings as string[]).length > 0 ? [...(ings as string[])] : [""]),
      steps: parsedSteps.length > 0 ? parsedSteps : [""],
      notes: recipe.notes ?? "",
    });
    await fetchRecipeIngredients(recipe.id!);
    setMessage(null);
    topRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function handleCancel() {
    setEditingId(null);
    setForm({ ...emptyRecipe, ingredients: [""], steps: [""] });
    setLinkedIngredients([]);
    setIngredientGroups([{ group: "Ingredients", items: [""] }]);
    setIngredientsMode("simple");
    setMessage(null);
  }

  async function handleDelete(id: number) {
    const { error } = await supabase.from("recipes").delete().eq("id", id);
    setMessage(error
      ? { text: `Error: ${error.message}`, type: "error" }
      : { text: "Recipe deleted. 🗑️", type: "success" });
    setDeleteConfirmId(null);
    await fetchRecipes();
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    const validLinked = linkedIngredients.filter((li) => li.ingredient_id && li.amount_required > 0);

    const ingredientsArr =
      ingredientsMode === "grouped"
        ? ingredientGroups
            .filter((g) => g.items.some((i) => i.trim() !== ""))
            .map((g) => ({ group: g.group, items: g.items.filter((i) => i.trim() !== "") }))
        : Array.isArray(form.ingredients)
        ? (form.ingredients as string[]).filter((i: string) => i.trim() !== "")
        : [];

    const stepsArr = Array.isArray(form.steps)
      ? form.steps.filter((s: string) => s.trim() !== "")
      : [];

    if (!ingredientsArr.length) {
      setMessage({ text: "Please add at least one ingredient.", type: "error" });
      setLoading(false);
      return;
    }
    if (!stepsArr.length) {
      setMessage({ text: "Please add at least one step.", type: "error" });
      setLoading(false);
      return;
    }

    const payload = {
      title: form.title, category: form.category, emoji: form.emoji,
      prep: form.prep, bake: form.bake, yield: form.yield,
      difficulty: form.difficulty, notes: form.notes ?? "",
      ingredients: ingredientsArr, steps: stepsArr,
    };

    let savedRecipeId: number | null = null;

    if (editingId !== null) {
      const { error } = await supabase.from("recipes").update(payload).eq("id", editingId);
      if (error) { setMessage({ text: `Error: ${error.message}`, type: "error" }); setLoading(false); return; }
      savedRecipeId = editingId;
    } else {
      const { data, error } = await supabase.from("recipes").insert(payload).select("id").single();
      if (error || !data) { setMessage({ text: `Error: ${error?.message}`, type: "error" }); setLoading(false); return; }
      savedRecipeId = data.id as number;
    }

    await supabase.from("recipe_ingredients").delete().eq("recipe_id", savedRecipeId);
    if (validLinked.length > 0) {
      const { error: linkError } = await supabase.from("recipe_ingredients").insert(
        validLinked.map((li) => ({ recipe_id: savedRecipeId, ingredient_id: li.ingredient_id, amount_required: li.amount_required, unit: li.unit }))
      );
      if (linkError) {
        setMessage({ text: `Recipe saved but failed to link ingredients: ${linkError.message}`, type: "error" });
        setLoading(false);
        await fetchRecipes();
        return;
      }
    }

    setMessage({
      text: editingId !== null
        ? `Recipe updated! ${validLinked.length} ingredient(s) linked. ✅`
        : `Recipe created! ${validLinked.length} ingredient(s) linked. ✅`,
      type: "success",
    });
    setLoading(false);
    handleCancel();
    await fetchRecipes();
  }

  const filteredRecipes = recipes.filter((r: Recipe) => {
    const matchSearch = r.title.toLowerCase().includes(search.toLowerCase());
    const matchCategory = categoryFilter === "All" || r.category === categoryFilter;
    return matchSearch && matchCategory;
  });

  // ── Login Gate ──
  if (!authed) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4" style={{ backgroundColor: "#fff6e7" }}>
        <div className="fixed inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-20 -left-20 w-72 h-72 opacity-40" style={{ background: "#ffd1dc", borderRadius: "60% 40% 70% 30% / 50% 60% 40% 50%", filter: "blur(40px)" }} />
          <div className="absolute -bottom-20 -right-20 w-80 h-80 opacity-30" style={{ background: "#f3ead9", borderRadius: "40% 60% 30% 70% / 60% 40% 70% 30%", filter: "blur(50px)" }} />
        </div>
        <div className="relative w-full max-w-sm" style={cardStyle}>
          <div className="text-center mb-6">
            <div className="w-16 h-16 rounded-3xl flex items-center justify-center text-3xl mx-auto mb-4" style={{ backgroundColor: "#ffd1dc" }}>🔒</div>
            <h1 style={{ fontFamily: "'SuperJoyful', serif", fontWeight: "normal", fontSize: "1.8rem", color: "#7a4a33" }}>Admin Access</h1>
            <p className="text-sm mt-1" style={{ fontFamily: "'Mochibop', serif", color: "#7a4a33", opacity: 0.6 }}>BakeKeeper ♡</p>
          </div>
          <div className="space-y-4">
            <div>
              <label className={labelClass} style={labelStyle}>Password</label>
              <input
                type="password" value={pw}
                onChange={(e) => { setPw(e.target.value); setPwError(false); }}
                onKeyDown={(e) => e.key === "Enter" && handleLogin()}
                style={{ ...inputStyle, borderColor: pwError ? "#ef4444" : "#ffd1dc" }}
                placeholder="Enter your password~"
                autoFocus
              />
                          <p className="text-sm mt-1" style={{ fontFamily: "'Mochibop', serif", color: "#7a4a33", opacity: 0.6 }}>Password for this is: admin</p>
              {pwError && <p className="text-xs mt-1" style={{ fontFamily: "'Mochibop', serif", color: "#ef4444" }}>Incorrect password! 🙈</p>}
            </div>
            <button
              onClick={handleLogin}
              className="w-full py-3 rounded-2xl font-bold text-sm transition-all"
              style={{ backgroundColor: "#ffd1dc", color: "#7a4a33", fontFamily: "'Mochibop', serif", border: "2px solid #f5a8bc", boxShadow: "0 4px 12px rgba(255,209,220,0.5)" }}
            >
              Enter the Kitchen 🍳
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div ref={topRef} className="p-4 md:p-6 space-y-6 max-w-3xl mx-auto">

      {/* Page Title */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-2xl flex items-center justify-center text-xl" style={{ backgroundColor: "#ffd1dc" }}>📖</div>
        <div>
          <h2 style={{ fontFamily: "'SuperJoyful', serif", fontWeight: "normal", fontSize: "1.4rem", color: "#7a4a33" }}>
            {editingId !== null ? "Edit Recipe" : "New Recipe"}
          </h2>
          <p className="text-xs" style={{ fontFamily: "'Mochibop', serif", color: "#7a4a33", opacity: 0.5 }}>
            {editingId !== null ? "Update your recipe details below" : "Fill in the details to add a new recipe"}
          </p>
        </div>
      </div>

      {/* Message */}
      {message && (
        <div className="rounded-2xl px-4 py-3 text-sm border-2" style={{
          fontFamily: "'Mochibop', serif",
          backgroundColor: message.type === "success" ? "#f0fdf4" : "#fef2f2",
          color: message.type === "success" ? "#16a34a" : "#dc2626",
          borderColor: message.type === "success" ? "#bbf7d0" : "#fecaca",
        }}>
          {message.text}
        </div>
      )}

      {/* ── Form Card ── */}
      <div style={cardStyle}>
        <form onSubmit={handleSubmit} className="space-y-5">

          {/* Emoji + Title */}
          <div className="flex gap-3">
            <div className="w-20">
              <label className={labelClass} style={labelStyle}>Emoji</label>
              <input value={form.emoji} onChange={(e) => handleField("emoji", e.target.value)} style={inputStyle} placeholder="🍞" required />
            </div>
            <div className="flex-1">
              <label className={labelClass} style={labelStyle}>Title</label>
              <input value={form.title} onChange={(e) => handleField("title", e.target.value)} style={inputStyle} placeholder="Recipe name~" required />
            </div>
          </div>

          {/* Category + Difficulty */}
          <div className="flex gap-3">
            <div className="flex-1">
              <label className={labelClass} style={labelStyle}>Category</label>
              <select value={form.category} onChange={(e) => handleField("category", e.target.value)} style={inputStyle}>
                {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
              </select>
            </div>
            <div className="flex-1">
              <label className={labelClass} style={labelStyle}>Difficulty</label>
              <select value={form.difficulty} onChange={(e) => handleField("difficulty", e.target.value)} style={inputStyle}>
                {DIFFICULTIES.map((d) => <option key={d}>{d}</option>)}
              </select>
            </div>
          </div>

          {/* Prep + Bake + Yield */}
          <div className="flex gap-3">
            {(["prep", "bake", "yield"] as const).map((field) => (
              <div className="flex-1" key={field}>
                <label className={labelClass} style={labelStyle}>{field.charAt(0).toUpperCase() + field.slice(1)}</label>
                <input value={form[field]} onChange={(e) => handleField(field, e.target.value)} style={inputStyle} placeholder={field === "yield" ? "12 pcs" : "30 min"} required />
              </div>
            ))}
          </div>

          {/* ── Ingredients ── */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <div>
                <label className={labelClass} style={labelStyle}>
                  Ingredients ({
                    ingredientsMode === "grouped"
                      ? ingredientGroups.reduce((n, g) => n + g.items.length, 0)
                      : Array.isArray(form.ingredients) ? (form.ingredients as string[]).length : 0
                  })
                </label>
                <p className="text-[11px]" style={{ fontFamily: "'Mochibop', serif", color: "#7a4a33", opacity: 0.5 }}>
                  Written ingredients shown in the recipe card.
                </p>
              </div>

              {/* Mode Toggle */}
              <div className="flex rounded-2xl overflow-hidden border-2 shrink-0" style={{ borderColor: "#ffd1dc" }}>
                {(["simple", "grouped"] as const).map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => setIngredientsMode(mode)}
                    className="text-[10px] px-3 py-1.5 transition-all"
                    style={{
                      fontFamily: "'Mochibop', serif",
                      backgroundColor: ingredientsMode === mode ? "#ffd1dc" : "white",
                      color: "#7a4a33",
                    }}
                  >
                    {mode === "simple" ? "🍃 Simple" : "🗂️ Grouped"}
                  </button>
                ))}
              </div>
            </div>

            {/* Simple Mode */}
            {ingredientsMode === "simple" && (
              <div className="space-y-2">
                {Array.isArray(form.ingredients) && (form.ingredients as string[]).map((ing: string, i: number) => (
                  <div key={i} className="flex gap-2 items-center">
                    <span className="text-xs w-5 text-right shrink-0" style={{ fontFamily: "'Mochibop', serif", color: "#7a4a33", opacity: 0.4 }}>{i + 1}.</span>
                    <input
                      value={ing}
                      onChange={(e) => handleArrayField("ingredients", i, e.target.value)}
                      style={inputStyle}
                      placeholder="e.g. 500g bread flour"
                    />
                    <button
                      type="button"
                      onClick={() => removeArrayItem("ingredients", i)}
                      disabled={(form.ingredients as string[]).length === 1}
                      className="text-xl px-1 shrink-0 disabled:opacity-20"
                      style={{ color: "#f5a8bc" }}
                    >×</button>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() => addArrayItem("ingredients")}
                  className="mt-2 text-xs underline underline-offset-2"
                  style={{ fontFamily: "'Mochibop', serif", color: "#7a4a33", opacity: 0.6 }}
                >
                  + Add ingredient
                </button>
              </div>
            )}

            {/* Grouped Mode */}
            {ingredientsMode === "grouped" && (
              <div className="space-y-4">
                {ingredientGroups.map((group, gi) => (
                  <div key={gi} className="rounded-2xl p-3 space-y-2" style={{ backgroundColor: "#fff6e7", border: "2px solid #ffd1dc" }}>
                    {/* Group Header */}
                    <div className="flex gap-2 items-center">
                      <input
                        value={group.group}
                        onChange={(e) => setIngredientGroups((prev) => {
                          const updated = [...prev];
                          updated[gi] = { ...updated[gi], group: e.target.value };
                          return updated;
                        })}
                        style={{ ...inputStyle, fontWeight: "bold" }}
                        placeholder="Group name (e.g. For the Sauce)"
                      />
                      <button
                        type="button"
                        onClick={() => setIngredientGroups((prev) => prev.filter((_, i) => i !== gi))}
                        disabled={ingredientGroups.length === 1}
                        className="text-xl px-1 shrink-0 disabled:opacity-20"
                        style={{ color: "#f5a8bc" }}
                      >×</button>
                    </div>

                    {/* Group Items */}
                    <div className="space-y-2 pl-2">
                      {group.items.map((item, ii) => (
                        <div key={ii} className="flex gap-2 items-center">
                          <span className="text-xs w-4 text-right shrink-0" style={{ fontFamily: "'Mochibop', serif", color: "#7a4a33", opacity: 0.4 }}>{ii + 1}.</span>
                          <input
                            value={item}
                            onChange={(e) => setIngredientGroups((prev) => {
                              const updated = [...prev];
                              const items = [...updated[gi].items];
                              items[ii] = e.target.value;
                              updated[gi] = { ...updated[gi], items };
                              return updated;
                            })}
                            style={inputStyle}
                            placeholder="e.g. 200g cream cheese"
                          />
                          <button
                            type="button"
                            onClick={() => setIngredientGroups((prev) => {
                              const updated = [...prev];
                              const items = updated[gi].items.filter((_, i) => i !== ii);
                              updated[gi] = { ...updated[gi], items: items.length ? items : [""] };
                              return updated;
                            })}
                            disabled={group.items.length === 1}
                            className="text-xl px-1 shrink-0 disabled:opacity-20"
                            style={{ color: "#f5a8bc" }}
                          >×</button>
                        </div>
                      ))}
                    </div>

                    <button
                      type="button"
                      onClick={() => setIngredientGroups((prev) => {
                        const updated = [...prev];
                        updated[gi] = { ...updated[gi], items: [...updated[gi].items, ""] };
                        return updated;
                      })}
                      className="text-xs underline underline-offset-2 ml-6"
                      style={{ fontFamily: "'Mochibop', serif", color: "#7a4a33", opacity: 0.6 }}
                    >
                      + Add ingredient
                    </button>
                  </div>
                ))}

                <button
                  type="button"
                  onClick={() => setIngredientGroups((prev) => [...prev, { group: "", items: [""] }])}
                  className="flex items-center gap-2 text-xs px-4 py-2 rounded-2xl border-2 transition-colors"
                  style={{ fontFamily: "'Mochibop', serif", color: "#7a4a33", borderColor: "#ffd1dc", backgroundColor: "white" }}
                >
                  🗂️ Add ingredient group
                </button>
              </div>
            )}
          </div>

          {/* ── Link to Inventory ── */}
          <div className="rounded-2xl p-4 space-y-3" style={{ backgroundColor: "#fff6e7", border: "2px dashed #ffd1dc" }}>
            <div>
              <label className={labelClass} style={labelStyle}>🔗 Link to Inventory Ingredients</label>
              <p className="text-[11px] leading-relaxed" style={{ fontFamily: "'Mochibop', serif", color: "#7a4a33", opacity: 0.5 }}>
                Link this recipe to inventory so the recipe book can check stock availability.
              </p>
            </div>

            {ingredientsLoading ? (
              <p className="text-xs italic" style={{ fontFamily: "'Mochibop', serif", color: "#7a4a33", opacity: 0.4 }}>Loading inventory...</p>
            ) : ingredients.length === 0 ? (
              <div className="rounded-2xl px-4 py-3" style={{ backgroundColor: "#fef9c3", border: "2px solid #fde68a" }}>
                <p className="text-xs font-semibold mb-1" style={{ fontFamily: "'Mochibop', serif", color: "#92400e" }}>⚠️ No ingredients yet!</p>
                <p className="text-[11px]" style={{ fontFamily: "'Mochibop', serif", color: "#92400e", opacity: 0.8 }}>
                  Go to the <a href="/admin/inventory" className="underline font-bold">Inventory tab</a> first~
                </p>
              </div>
            ) : (
              <>
                {linkedIngredients.length > 0 && (
                  <div className="flex gap-2 items-center px-1">
                    {["Ingredient", "Amount", "Unit", ""].map((h, i) => (
                      <p key={i} className={`text-[10px] uppercase tracking-widest font-bold ${i === 0 ? "flex-1" : i === 1 ? "w-20" : i === 2 ? "w-24" : "w-6"}`}
                        style={{ fontFamily: "'Mochibop', serif", color: "#7a4a33", opacity: 0.4 }}>{h}</p>
                    ))}
                  </div>
                )}
                <div className="space-y-2">
                  {linkedIngredients.map((li: LinkedIngredient, i: number) => (
                    <div key={i} className="flex gap-2 items-center">
                      <select
                        value={li.ingredient_id}
                        onChange={(e) => updateLinkedIngredient(i, "ingredient_id", Number(e.target.value))}
                        style={{ ...inputStyle, flex: 1 }}
                      >
                        {ingredients.map((ing: Ingredient) => <option key={ing.id} value={ing.id}>{ing.name}</option>)}
                      </select>
                      <input
                        type="number"
                        value={li.amount_required || ""}
                        onChange={(e) => updateLinkedIngredient(i, "amount_required", Number(e.target.value))}
                        style={{ ...inputStyle, width: "5rem" }}
                        placeholder="0" min={0} step={0.01}
                      />
                      <select
                        value={li.unit}
                        onChange={(e) => updateLinkedIngredient(i, "unit", e.target.value)}
                        style={{ ...inputStyle, width: "6rem" }}
                      >
                        {UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
                      </select>
                      <button type="button" onClick={() => removeLinkedIngredient(i)} className="text-xl px-1 shrink-0" style={{ color: "#f5a8bc" }}>×</button>
                    </div>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={addLinkedIngredient}
                  className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-2xl border-2"
                  style={{ fontFamily: "'Mochibop', serif", color: "#7a4a33", borderColor: "#ffd1dc", backgroundColor: "white" }}
                >
                  + Link an ingredient
                </button>
                {linkedIngredients.length > 0 && (
                  <p className="text-[10px]" style={{ fontFamily: "'Mochibop', serif", color: "#7a4a33", opacity: 0.4 }}>
                    {linkedIngredients.length} ingredient(s) linked ✨
                  </p>
                )}
              </>
            )}
          </div>

          {/* Steps */}
          <div>
            <label className={labelClass} style={labelStyle}>Steps ({Array.isArray(form.steps) ? form.steps.length : 0})</label>
            <div className="space-y-2">
              {Array.isArray(form.steps) && form.steps.map((step: string, i: number) => (
                <div key={i} className="flex gap-2 items-start">
                  <div className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 mt-2.5"
                    style={{ backgroundColor: "#ffd1dc", color: "#7a4a33", fontFamily: "'Mochibop', serif" }}>{i + 1}</div>
                  <textarea
                    value={step}
                    onChange={(e) => handleArrayField("steps", i, e.target.value)}
                    style={{ ...inputStyle, resize: "none" } as React.CSSProperties}
                    rows={2}
                    placeholder={`Step ${i + 1}...`}
                  />
                  <button
                    type="button"
                    onClick={() => removeArrayItem("steps", i)}
                    disabled={form.steps.length === 1}
                    className="text-xl px-1 shrink-0 mt-1.5 disabled:opacity-20"
                    style={{ color: "#f5a8bc" }}
                  >×</button>
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={() => addArrayItem("steps")}
              className="mt-2 text-xs underline underline-offset-2"
              style={{ fontFamily: "'Mochibop', serif", color: "#7a4a33", opacity: 0.6 }}
            >
              + Add step
            </button>
          </div>

          {/* Notes */}
          <div>
            <label className={labelClass} style={labelStyle}>Baker's Note (optional)</label>
            <textarea
              value={form.notes ?? ""}
              onChange={(e) => handleField("notes", e.target.value)}
              style={{ ...inputStyle, resize: "none" } as React.CSSProperties}
              rows={2}
              placeholder="Any tips or variations~"
            />
          </div>

          {/* Submit */}
          <div className="flex gap-3 pt-1">
            <button
              type="submit"
              disabled={loading}
              className="flex-1 py-3 rounded-2xl font-bold text-sm transition-all disabled:opacity-50"
              style={{ backgroundColor: "#ffd1dc", color: "#7a4a33", fontFamily: "'Mochibop', serif", border: "2px solid #f5a8bc", boxShadow: "0 4px 12px rgba(255,209,220,0.4)" }}
            >
              {loading ? "Saving..." : editingId !== null ? "Update Recipe ✨" : "Add Recipe 🍞"}
            </button>
            {editingId !== null && (
              <button
                type="button"
                onClick={handleCancel}
                className="px-5 py-3 rounded-2xl font-bold text-sm"
                style={{ backgroundColor: "white", color: "#7a4a33", fontFamily: "'Mochibop', serif", border: "2px solid #ffd1dc" }}
              >
                Cancel
              </button>
            )}
          </div>
        </form>
      </div>

      {/* ── Recipe List ── */}
      <div>
        <div className="flex items-center gap-3 mb-4">
          <div className="w-8 h-8 rounded-xl flex items-center justify-center text-base" style={{ backgroundColor: "#ffd1dc" }}>📋</div>
          <h2 style={{ fontFamily: "'SuperJoyful', serif", fontWeight: "normal", fontSize: "1.2rem", color: "#7a4a33" }}>
            All Recipes ({recipes.length})
          </h2>
        </div>

        <div className="flex gap-2 mb-4">
          <div className="flex-1 relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm">🔍</span>
            <input value={search} onChange={(e) => setSearch(e.target.value)} style={{ ...inputStyle, paddingLeft: "2.2rem" }} placeholder="Search recipes..." />
          </div>
          <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)} style={{ ...inputStyle, width: "8rem" }}>
            <option>All</option>
            {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
          </select>
        </div>

        {fetching ? (
          <div className="text-center py-12" style={{ fontFamily: "'Mochibop', serif", color: "#7a4a33", opacity: 0.4 }}>Loading recipes... 🍪</div>
        ) : filteredRecipes.length === 0 ? (
          <div className="text-center py-12" style={{ fontFamily: "'Mochibop', serif", color: "#7a4a33", opacity: 0.4 }}>No recipes found 🥺</div>
        ) : (
          <div className="space-y-2">
            {filteredRecipes.map((recipe: Recipe) => (
              <div key={recipe.id} className="rounded-2xl px-4 py-3 border-2 transition-all" style={{ backgroundColor: "white", borderColor: "#ffd1dc" }}>
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="text-2xl shrink-0">{recipe.emoji}</span>
                    <div className="min-w-0">
                      <p className="text-sm font-bold truncate" style={{ fontFamily: "'Mochibop', serif", color: "#7a4a33" }}>{recipe.title}</p>
                      <p className="text-[11px]" style={{ fontFamily: "'Mochibop', serif", color: "#7a4a33", opacity: 0.5 }}>
                        {recipe.category} · {recipe.difficulty} · {recipe.bake} bake
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <button
                      onClick={() => handleEdit(recipe)}
                      className="text-xs px-3 py-1.5 rounded-xl border-2 transition-colors"
                      style={{ fontFamily: "'Mochibop', serif", color: "#7a4a33", borderColor: "#ffd1dc", backgroundColor: "white" }}
                    >Edit</button>
                    <button
                      onClick={() => setDeleteConfirmId(recipe.id!)}
                      className="text-xs px-3 py-1.5 rounded-xl border-2 transition-colors"
                      style={{ fontFamily: "'Mochibop', serif", color: "#dc2626", borderColor: "#fecaca", backgroundColor: "#fef2f2" }}
                    >Delete</button>
                  </div>
                </div>
                {deleteConfirmId === recipe.id && (
                  <div className="mt-3 pt-3 flex items-center justify-between gap-3" style={{ borderTop: "2px dashed #ffd1dc" }}>
                    <p className="text-xs font-semibold" style={{ fontFamily: "'Mochibop', serif", color: "#dc2626" }}>Delete this recipe? 🥺</p>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setDeleteConfirmId(null)}
                        className="text-xs px-3 py-1.5 rounded-xl border-2"
                        style={{ fontFamily: "'Mochibop', serif", color: "#7a4a33", borderColor: "#ffd1dc", backgroundColor: "white" }}
                      >Cancel</button>
                      <button
                        onClick={() => handleDelete(recipe.id!)}
                        className="text-xs px-3 py-1.5 rounded-xl"
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
    </div>
  );
}