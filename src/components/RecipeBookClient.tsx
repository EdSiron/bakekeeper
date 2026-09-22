"use client";
import { useState } from "react";
import { Recipe } from "@/app/data/recipes";
import BookCard from "@/components/BookCard";
import RecipeModal from "@/components/RecipeModal";

const CATEGORIES = ["All", "Breads", "Cookies", "Pastries", "Cakes", "Bars"];

export default function RecipeBookClient({
  initialRecipes,
}: {
  initialRecipes: Recipe[];
}) {
  const [selected, setSelected] = useState<Recipe | null>(null);
  const [activeCategory, setActiveCategory] = useState("All");
  const [search, setSearch] = useState("");

  const filtered = initialRecipes.filter((r) => {
    const matchCat = activeCategory === "All" || r.category === activeCategory;
    const matchSearch = r.title.toLowerCase().includes(search.toLowerCase());
    return matchCat && matchSearch;
  });

  return (
    <div
      className="min-h-screen"
      style={{
        backgroundColor: "#fff6e7",
        fontFamily: "'Mochibop', serif",
      }}
    >
      {/* Blob decorations */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
        <div
          className="absolute -top-32 -left-32 w-96 h-96 opacity-30"
          style={{
            background: "#ffd1dc",
            borderRadius: "60% 40% 70% 30% / 50% 60% 40% 50%",
            filter: "blur(40px)",
          }}
        />
        <div
          className="absolute top-1/3 -right-24 w-80 h-80 opacity-20"
          style={{
            background: "#f3ead9",
            borderRadius: "40% 60% 30% 70% / 60% 40% 70% 30%",
            filter: "blur(50px)",
          }}
        />
        <div
          className="absolute -bottom-20 left-1/3 w-72 h-72 opacity-25"
          style={{
            background: "#ffd1dc",
            borderRadius: "70% 30% 50% 50% / 40% 60% 40% 60%",
            filter: "blur(45px)",
          }}
        />
      </div>

      <div className="relative z-10">
        {/* ── Header ── */}
        <header className="pt-12 pb-6 px-6 text-center">
          {/* Decorative top line */}
          <div className="flex items-center justify-center gap-3 mb-4">
            <div className="h-px w-16 bg-cozy-pink-dark/40" />
            <span className="text-cozy-brown/50 text-sm">✦</span>
            <div className="h-px w-16 bg-cozy-pink-dark/40" />
          </div>

          {/* Badge */}
          <div className="inline-flex items-center gap-2 bg-cozy-pink/40 border border-cozy-pink-dark/20 rounded-full px-4 py-1.5 mb-5">
            <span className="text-base">🍰</span>
            <span
              className="text-xs text-cozy-brown tracking-widest uppercase"
              style={{ fontFamily: "'Mochibop', serif" }}
            >
              Baked with love
            </span>
          </div>

          {/* Main Title */}
          <h1
            className="text-cozy-brown leading-none mb-2"
            style={{
              fontFamily: "'SuperJoyful', serif",
              fontWeight: "normal",
              fontSize: "clamp(2.5rem, 8vw, 5rem)",
            }}
          >
            BakeKeeper
          </h1>

          <p
            className="text-cozy-brown/50 text-sm max-w-sm mx-auto mt-3 leading-relaxed"
            style={{ fontFamily: "'Mochibop', serif" }}
          >
            A little collection of recipes baked with warmth & care
          </p>

          {/* Decorative bottom line */}
          {/* Decorative bottom line */}
          <div className="flex items-center justify-center gap-3 mt-5">
            <div className="h-px w-12 bg-cozy-pink-dark/30" />
            <span className="text-cozy-brown/30 text-xs">✦ ✦ ✦</span>
            <div className="h-px w-12 bg-cozy-pink-dark/30" />
          </div>

          {/* Admin Button */}
          <div className="mt-5">
            <a
              href="/admin"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-2xl border-2 text-xs transition-all"
              style={{
                fontFamily: "'Mochibop', serif",
                backgroundColor: "white",
                borderColor: "#ffd1dc",
                color: "#7a4a33",
                boxShadow: "0 2px 8px rgba(255,209,220,0.3)",
                textDecoration: "none",
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLAnchorElement).style.backgroundColor =
                  "#ffd1dc";
                (e.currentTarget as HTMLAnchorElement).style.boxShadow =
                  "0 4px 12px rgba(255,209,220,0.6)";
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLAnchorElement).style.backgroundColor =
                  "white";
                (e.currentTarget as HTMLAnchorElement).style.boxShadow =
                  "0 2px 8px rgba(255,209,220,0.3)";
              }}
            >
              <span>🗂️</span>
              <span>Admin Panel</span>
            </a>
          </div>
        </header>

        {/* ── Search ── */}
        <div className="px-6 max-w-md mx-auto mb-6">
          <div className="relative">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-base z-10">
              🔍
            </span>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search a recipe..."
              className="w-full pl-10 pr-4 py-3 rounded-2xl border-2 border-cozy-pink/50 bg-white/70 backdrop-blur-sm text-cozy-brown placeholder-cozy-brown/30 text-sm focus:outline-none focus:border-cozy-pink transition-colors"
              style={{ fontFamily: "'Mochibop', serif" }}
            />
          </div>
        </div>

        {/* ── Category Filters ── */}
        <div className="px-6 mb-8">
          <div className="flex gap-2 flex-wrap justify-center">
            {CATEGORIES.map((cat) => {
              const active = activeCategory === cat;
              return (
                <button
                  key={cat}
                  onClick={() => setActiveCategory(cat)}
                  className="px-4 py-2 rounded-2xl text-sm font-medium transition-all duration-200 border-2"
                  style={{
                    fontFamily: "'Mochibop', serif",
                    backgroundColor: active ? "#ffd1dc" : "white",
                    borderColor: active ? "#f5a8bc" : "#ffd1dc",
                    color: "#7a4a33",
                    boxShadow: active
                      ? "0 4px 12px rgba(255, 209, 220, 0.5)"
                      : "none",
                    transform: active ? "translateY(-1px)" : "none",
                  }}
                >
                  {cat}
                </button>
              );
            })}
          </div>
        </div>

        {/* ── Stats Bar ── */}
        <div className="px-6 max-w-2xl mx-auto mb-6">
          <div
            className="rounded-2xl px-5 py-3 flex items-center justify-between border"
            style={{
              backgroundColor: "#f3ead9",
              borderColor: "#ffd1dc",
            }}
          >
            <p
              className="text-sm text-cozy-brown"
              style={{ fontFamily: "'Mochibop', serif" }}
            >
              ✨ {filtered.length}{" "}
              {filtered.length === 1 ? "recipe" : "recipes"}{" "}
              {activeCategory !== "All" ? `in ${activeCategory}` : "available"}
            </p>
            <div className="flex gap-1">
              {["🍞", "🍪", "🥐", "🎂", "🍫"].map((e, i) => (
                <span
                  key={i}
                  className="text-base opacity-60 hover:opacity-100 transition-opacity"
                >
                  {e}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* ── Recipe Grid ── */}
        <div className="px-6 pb-16 max-w-5xl mx-auto">
          {filtered.length === 0 ? (
            <div className="text-center py-20">
              <div className="text-5xl mb-4">🥺</div>
              <p
                className="text-cozy-brown/50 text-lg"
                style={{
                  fontFamily: "'SuperJoyful', serif",
                  fontWeight: "normal",
                }}
              >
                No recipes found!
              </p>
              <p
                className="text-cozy-sub text-sm mt-2"
                style={{ fontFamily: "'Mochibop', serif" }}
              >
                Try searching for something else~
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
              {filtered.map((recipe) => (
                <BookCard
                  key={recipe.id}
                  recipe={recipe}
                  onClick={() => setSelected(recipe)}
                />
              ))}
            </div>
          )}
        </div>

        {/* ── Footer ── */}
        <footer
          className="border-t py-8 text-center"
          style={{ borderColor: "#ffd1dc", backgroundColor: "#f3ead9" }}
        >
          <p
            className="text-cozy-brown/60 text-sm"
            style={{ fontFamily: "'Mochibop', serif" }}
          >
            Made with lots of love · BakeKeeper
          </p>
          <div className="flex items-center justify-center gap-2 mt-2">
            <div className="h-px w-8 bg-cozy-pink-dark/30" />
            <span className="text-cozy-brown/30 text-xs">♡</span>
            <div className="h-px w-8 bg-cozy-pink-dark/30" />
          </div>
        </footer>
      </div>

      {/* ── Modal ── */}
      {selected && (
        <RecipeModal recipe={selected} onClose={() => setSelected(null)} />
      )}
    </div>
  );
}
