"use client";
import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { AuthProvider, useAuth } from "@/context/AuthContext";

const navItems = [
  { href: "/admin", label: "Recipes", emoji: "📖", desc: "Manage recipe book" },
  { href: "/admin/inventory", label: "Inventory", emoji: "🧂", desc: "Track ingredients" },
  { href: "/admin/orders", label: "Orders", emoji: "🧾", desc: "Orders & revenue" },
  { href: "/admin/reports", label: "Reports", emoji: "📊", desc: "Track revenue & expenses" },
];

function AdminSidebar({
  sidebarOpen,
  setSidebarOpen,
}: {
  sidebarOpen: boolean;
  setSidebarOpen: (v: boolean) => void;
}) {
  const { setAuthed } = useAuth();
  const pathname = usePathname();

  return (
    <>
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 lg:hidden"
          style={{ backgroundColor: "rgba(122,74,51,0.3)", backdropFilter: "blur(4px)" }}
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <aside
        className={`
          fixed top-0 left-0 h-screen z-50 flex flex-col
          transition-transform duration-300 ease-in-out
          w-64 overflow-y-auto
          ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}
          lg:sticky lg:top-0 lg:translate-x-0 lg:shrink-0
        `}
        style={{
          backgroundColor: "#ffd1dc",
          borderRight: "2px solid #f5a8bc",
          fontFamily: "'Mochibop', serif",
        }}
      >
        {/* Blob decoration inside sidebar */}
        <div
          className="absolute top-0 right-0 w-32 h-32 opacity-30 pointer-events-none"
          style={{
            background: "#fff6e7",
            borderRadius: "0 0 0 100%",
            filter: "blur(20px)",
          }}
        />

        {/* Header */}
        <div
          className="px-6 py-7 shrink-0 relative z-10"
          style={{ borderBottom: "2px dashed rgba(122,74,51,0.15)" }}
        >
          <div className="flex items-center gap-3 mb-3">
            <div
              className="w-11 h-11 rounded-2xl flex items-center justify-center text-2xl shrink-0"
              style={{ backgroundColor: "rgba(255,255,255,0.6)" }}
            >
              🍞
            </div>
            <div>
              <p
                className="text-[9px] tracking-[3px] uppercase"
                style={{ color: "#7a4a33", opacity: 0.6 }}
              >
                BakeKeeper
              </p>
              <h1
                className="leading-tight"
                style={{
                  fontFamily: "'SuperJoyful', serif",
                  fontWeight: "normal",
                  fontSize: "1.15rem",
                  color: "#7a4a33",
                }}
              >
                Admin Panel
              </h1>
            </div>
          </div>
          <p className="text-[11px] leading-relaxed" style={{ color: "#7a4a33", opacity: 0.6 }}>
            Manage your baking business ✨
          </p>
        </div>

        {/* Nav label */}
        <div className="px-6 pt-5 pb-2 shrink-0">
          <p
            className="text-[9px] tracking-[3px] uppercase"
            style={{ color: "#7a4a33", opacity: 0.4 }}
          >
            ✦ Navigation
          </p>
        </div>

        {/* Nav Items */}
        <nav className="flex-1 px-3 space-y-1.5 relative z-10">
          {navItems.map((item) => {
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setSidebarOpen(false)}
                className="flex items-center gap-3 px-4 py-3 rounded-2xl transition-all duration-200 group"
                style={{
                  backgroundColor: active
                    ? "rgba(255,255,255,0.7)"
                    : "transparent",
                  boxShadow: active
                    ? "0 4px 12px rgba(122,74,51,0.1)"
                    : "none",
                  border: active
                    ? "2px solid rgba(255,255,255,0.8)"
                    : "2px solid transparent",
                }}
              >
                <span
                  className="w-8 h-8 rounded-xl flex items-center justify-center text-base shrink-0 transition-all"
                  style={{
                    backgroundColor: active
                      ? "#ffd1dc"
                      : "rgba(255,255,255,0.4)",
                  }}
                >
                  {item.emoji}
                </span>
                <div className="min-w-0 flex-1">
                  <p
                    className="text-sm leading-tight"
                    style={{
                      color: "#7a4a33",
                      fontWeight: active ? "bold" : "normal",
                      fontFamily: "'Mochibop', serif",
                    }}
                  >
                    {item.label}
                  </p>
                  <p
                    className="text-[10px] leading-tight mt-0.5 truncate"
                    style={{ color: "#7a4a33", opacity: 0.5 }}
                  >
                    {item.desc}
                  </p>
                </div>
                {active && (
                  <span className="text-xs" style={{ color: "#7a4a33" }}>
                    ♡
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        {/* Divider */}
        <div
          className="mx-5 my-3 shrink-0"
          style={{ borderTop: "2px dashed rgba(122,74,51,0.15)" }}
        />

        {/* Footer */}
        <div className="px-3 pb-6 space-y-1.5 shrink-0 relative z-10">
          <Link
            href="/"
            className="flex items-center gap-3 px-4 py-2.5 rounded-2xl transition-all text-sm"
            style={{ color: "#7a4a33" }}
            onMouseEnter={(e) =>
              (e.currentTarget.style.backgroundColor = "rgba(255,255,255,0.5)")
            }
            onMouseLeave={(e) =>
              (e.currentTarget.style.backgroundColor = "transparent")
            }
          >
            <span
              className="w-8 h-8 rounded-xl flex items-center justify-center text-base shrink-0"
              style={{ backgroundColor: "rgba(255,255,255,0.4)" }}
            >
              📖
            </span>
            <span style={{ fontFamily: "'Mochibop', serif" }}>
              View Recipe Book
            </span>
          </Link>
          <button
            onClick={() => setAuthed(false)}
            className="w-full flex items-center gap-3 px-4 py-2.5 rounded-2xl transition-all text-sm text-left"
            style={{ color: "#7a4a33" }}
            onMouseEnter={(e) =>
              (e.currentTarget.style.backgroundColor = "rgba(255,255,255,0.5)")
            }
            onMouseLeave={(e) =>
              (e.currentTarget.style.backgroundColor = "transparent")
            }
          >
            <span
              className="w-8 h-8 rounded-xl flex items-center justify-center text-base shrink-0"
              style={{ backgroundColor: "rgba(255,255,255,0.4)" }}
            >
              🔓
            </span>
            <span style={{ fontFamily: "'Mochibop', serif" }}>Logout</span>
          </button>
        </div>
      </aside>
    </>
  );
}

function AdminTopbar({ setSidebarOpen }: { setSidebarOpen: (v: boolean) => void }) {
  const { setAuthed } = useAuth();
  const pathname = usePathname();
  const current = navItems.find((n) => n.href === pathname);

  return (
    <>
      {/* Mobile */}
      <header
        className="lg:hidden sticky top-0 z-30 px-4 py-3 flex items-center justify-between shrink-0"
        style={{
          backgroundColor: "#ffd1dc",
          borderBottom: "2px solid #f5a8bc",
          fontFamily: "'Mochibop', serif",
        }}
      >
        <div className="flex items-center gap-3">
          <div
            className="w-8 h-8 rounded-xl flex items-center justify-center text-base"
            style={{ backgroundColor: "rgba(255,255,255,0.6)" }}
          >
            🍞
          </div>
          <div>
            <p className="text-[9px] tracking-[3px] uppercase" style={{ color: "#7a4a33", opacity: 0.6 }}>
              BakeKeeper
            </p>
            <h1
              className="leading-tight"
              style={{ fontFamily: "'SuperJoyful', serif", fontWeight: "normal", fontSize: "1rem", color: "#7a4a33" }}
            >
              Admin Panel
            </h1>
          </div>
        </div>
        <button
          onClick={() => setSidebarOpen(true)}
          className="p-2 rounded-xl transition-colors"
          style={{ color: "#7a4a33", backgroundColor: "rgba(255,255,255,0.5)" }}
        >
          <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
            <path d="M3 12h18M3 6h18M3 18h18" strokeLinecap="round" />
          </svg>
        </button>
      </header>

      {/* Desktop */}
      <header
        className="hidden lg:flex sticky top-0 z-30 px-8 py-4 items-center justify-between shrink-0"
        style={{
          backgroundColor: "rgba(255,246,231,0.85)",
          backdropFilter: "blur(12px)",
          borderBottom: "2px solid #ffd1dc",
          fontFamily: "'Mochibop', serif",
        }}
      >
        <div>
          <h2
            className="leading-tight"
            style={{ fontFamily: "'SuperJoyful', serif", fontWeight: "normal", fontSize: "1.1rem", color: "#7a4a33" }}
          >
            {current?.emoji} {current?.label || "Admin"}
          </h2>
          <p className="text-[11px] mt-0.5" style={{ color: "#7a4a33", opacity: 0.6 }}>
            {current?.desc || "Manage your baking business"} ✨
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/"
            className="text-xs underline underline-offset-2 transition-opacity hover:opacity-70"
            style={{ color: "#7a4a33", fontFamily: "'Mochibop', serif" }}
          >
            ← Recipe Book
          </Link>
          <button
            onClick={() => setAuthed(false)}
            className="text-xs px-4 py-2 rounded-2xl border-2 transition-all"
            style={{
              borderColor: "#ffd1dc",
              color: "#7a4a33",
              backgroundColor: "white",
              fontFamily: "'Mochibop', serif",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#ffd1dc")}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "white")}
          >
            Logout 🔓
          </button>
        </div>
      </header>
    </>
  );
}

function AdminShell({ children }: { children: React.ReactNode }) {
  const { authed } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  if (!authed) {
    return (
      <div
        className="min-h-screen"
        style={{ backgroundColor: "#fff6e7", fontFamily: "'Mochibop', serif" }}
      >
        {children}
      </div>
    );
  }

  return (
    <div
      className="h-screen overflow-hidden flex"
      style={{ backgroundColor: "#fff6e7", fontFamily: "'Mochibop', serif" }}
    >
      <AdminSidebar sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} />
      <div className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden">
        <AdminTopbar setSidebarOpen={setSidebarOpen} />
        <main className="flex-1 overflow-y-auto" style={{ backgroundColor: "#fff6e7" }}>
          {children}
        </main>
      </div>
    </div>
  );
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <AdminShell>{children}</AdminShell>
    </AuthProvider>
  );
}