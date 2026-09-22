"use client";
import { useEffect, useState } from "react";
import { Recipe, categoryColors, difficultyDots } from "@/app/data/recipes";
import { supabase } from "@/lib/supabase";
import { checkStock } from "@/lib/unitConversion";

type StockStatus = "available" | "low" | "unavailable" | "unchecked";

type RawStock = {
  amount_required: number;
  unit: string;
  ingredient: {
    quantity: number;
    low_stock_threshold: number;
    unit: string;
  } | null;
};

export default function BookCard({
  recipe,
  onClick,
}: {
  recipe: Recipe;
  onClick: () => void;
}) {
  const [hovered, setHovered] = useState(false);
  const [stockStatus, setStockStatus] = useState<StockStatus>("unchecked");
  const spineColor = categoryColors[recipe.category] || "#a08060";

  useEffect(() => {
    async function checkStockStatus() {
      if (!recipe.id) return;

      const { data } = await supabase
        .from("recipe_ingredients")
        .select(
          "amount_required, unit, ingredient:ingredients(quantity, low_stock_threshold, unit)"
        )
        .eq("recipe_id", recipe.id);

      if (!data || data.length === 0) {
        setStockStatus("unchecked");
        return;
      }

      let anyUnavailable = false;
      let anyLow = false;

      for (const d of data as unknown as RawStock[]) {
        if (!d.ingredient) { anyUnavailable = true; continue; }

        const result = checkStock(
          d.ingredient.quantity,
          d.ingredient.unit,
          d.amount_required,
          d.unit
        );

        if (!result.compatible || !result.sufficient) anyUnavailable = true;
        else if (d.ingredient.quantity <= d.ingredient.low_stock_threshold) anyLow = true;
      }

      if (anyUnavailable) setStockStatus("unavailable");
      else if (anyLow) setStockStatus("low");
      else setStockStatus("available");
    }

    checkStockStatus();
  }, [recipe.id]);

  const stockBadge: Record<StockStatus, { label: string; bg: string; color: string } | null> = {
    available:  { label: "✓ In Stock",   bg: "#dcfce7", color: "#16a34a" },
    low:        { label: "⚡ Low Stock",  bg: "#fef9c3", color: "#ca8a04" },
    unavailable:{ label: "✗ Can't Make", bg: "#fee2e2", color: "#dc2626" },
    unchecked:  null,
  };

  const badge = stockBadge[stockStatus];

  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="cursor-pointer relative"
      style={{
        transition: "transform 0.25s ease, box-shadow 0.25s ease",
        transform: hovered ? "translateY(-6px) rotate(-1.5deg)" : "none",
      }}
    >
      {/* Card */}
      <div
        className="rounded-3xl overflow-hidden border-2 relative"
        style={{
          backgroundColor: "#fff6e7",
          borderColor: hovered ? "#ffd1dc" : "#f3ead9",
          boxShadow: hovered
            ? "0 12px 32px rgba(255, 209, 220, 0.6), 0 4px 12px rgba(122, 74, 51, 0.15)"
            : "0 4px 12px rgba(122, 74, 51, 0.08), 0 1px 4px rgba(122, 74, 51, 0.05)",
        }}
      >
        {/* Unavailable overlay */}
        {stockStatus === "unavailable" && (
          <div
            className="absolute inset-0 z-10 flex items-center justify-center"
            style={{ backgroundColor: "rgba(255,255,255,0.5)", backdropFilter: "blur(2px)" }}
          >
            <span
              className="text-[9px] font-bold px-2 py-1 rounded-full text-white shadow-md"
              style={{
                backgroundColor: "#ef4444",
                transform: "rotate(-8deg)",
                fontFamily: "'Mochibop', serif",
              }}
            >
              Out of Stock
            </span>
          </div>
        )}

        {/* Colored top strip */}
        <div
          className="h-2 w-full"
          style={{ backgroundColor: spineColor }}
        />

        {/* Content */}
        <div className="p-3 flex flex-col gap-2">
          {/* Emoji */}
          <div
            className="w-10 h-10 rounded-2xl flex items-center justify-center text-xl"
            style={{ backgroundColor: "#f3ead9" }}
          >
            {recipe.emoji}
          </div>

          {/* Title */}
          <p
            className="text-xs leading-snug text-cozy-brown line-clamp-2"
            style={{ fontFamily: "'SuperJoyful', serif" }}
          >
            {recipe.title}
          </p>

          {/* Category pill */}
          <span
            className="self-start text-[9px] px-2 py-0.5 rounded-full"
            style={{
              backgroundColor: "#ffd1dc",
              color: "#7a4a33",
              fontFamily: "'Mochibop', serif",
            }}
          >
            {recipe.category}
          </span>

          {/* Stock badge */}
          {badge && (
            <span
              className="self-start text-[9px] font-bold px-2 py-0.5 rounded-full"
              style={{
                backgroundColor: badge.bg,
                color: badge.color,
                fontFamily: "'Mochibop', serif",
              }}
            >
              {badge.label}
            </span>
          )}

          {/* Difficulty dots + bake time */}
          <div className="flex items-center justify-between mt-1">
            <div className="flex gap-1">
              {[1, 2, 3].map((d) => (
                <div
                  key={d}
                  className="w-1.5 h-1.5 rounded-full"
                  style={{
                    backgroundColor:
                      d <= difficultyDots[recipe.difficulty]
                        ? "#7a4a33"
                        : "#d4c4b0",
                  }}
                />
              ))}
            </div>
            <p
              className="text-[9px] text-cozy-sub"
              style={{ fontFamily: "'Mochibop', serif" }}
            >
              {recipe.bake}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}