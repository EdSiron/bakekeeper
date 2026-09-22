"use client";

type FilterTabsProps = {
  categories: string[];
  active: string;
  onChange: (category: string) => void;
};

export default function FilterTabs({ categories, active, onChange }: FilterTabsProps) {
  return (
    <div className="flex gap-2 px-4 pt-4 pb-2 overflow-x-auto no-scrollbar">
      {categories.map((cat) => (
        <button
          key={cat}
          onClick={() => onChange(cat)}
          className={`shrink-0 px-4 py-1.5 rounded-full border-2 border-cozy-brown text-sm cursor-pointer transition-all duration-200
            ${active === cat
              ? "bg-cozy-brown text-cozy-cream font-bold"
              : "bg-transparent text-cozy-brown font-normal"
            }`}
          style={{ fontFamily: "Mochibop, serif" }}
        >
          {cat}
        </button>
      ))}
    </div>
  );
}