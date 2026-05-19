"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const nav = [
  {
    label: "لوحة التحكم",
    href: "/",
    icon: (
      <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" />
        <rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" />
      </svg>
    ),
  },
  {
    label: "كتالوج القطع",
    href: "/catalog",
    icon: (
      <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
      </svg>
    ),
  },
  {
    label: "التوافق",
    href: "/compatibility",
    icon: (
      <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <circle cx="12" cy="12" r="3" />
        <path d="M12 1v4M12 19v4M4.22 4.22l2.83 2.83M16.95 16.95l2.83 2.83M1 12h4M19 12h4M4.22 19.78l2.83-2.83M16.95 7.05l2.83-2.83" />
      </svg>
    ),
  },
  {
    label: "المخزون",
    href: "/inventory",
    icon: (
      <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
      </svg>
    ),
  },
  {
    label: "أوامر البيع",
    href: "/orders/sales",
    icon: (
      <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
      </svg>
    ),
  },
  {
    label: "أوامر الشراء",
    href: "/orders/purchase",
    icon: (
      <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
      </svg>
    ),
  },
  {
    label: "العملاء",
    href: "/customers",
    icon: (
      <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" /><circle cx="9" cy="7" r="4" />
        <path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" />
      </svg>
    ),
  },
  {
    label: "الموردون",
    href: "/suppliers",
    icon: (
      <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0H5m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
      </svg>
    ),
  },
];

export function Sidebar() {
  const path = usePathname();

  const isActive = (href: string) =>
    href === "/" ? path === "/" : path.startsWith(href);

  return (
    <aside
      className="flex flex-col w-[220px] min-h-full flex-shrink-0"
      style={{
        background: "#fff",
        borderLeft: "1px solid var(--color-border)",
        borderRight: "none",
      }}
    >
      {/* Logo */}
      <div
        className="flex flex-col items-center justify-center py-6 px-4 gap-1"
        style={{ borderBottom: "1px solid var(--color-border-light)" }}
      >
        {/* Arabic geometric emblem */}
        <svg width="36" height="36" viewBox="0 0 36 36" fill="none">
          <polygon points="18,2 34,10 34,26 18,34 2,26 2,10" fill="var(--color-gold-dim)" stroke="var(--color-gold)" strokeWidth="1.5" />
          <polygon points="18,8 28,13 28,23 18,28 8,23 8,13" fill="none" stroke="var(--color-gold)" strokeWidth="1" opacity="0.5" />
          <circle cx="18" cy="18" r="4" fill="var(--color-gold)" />
        </svg>
        <span className="font-arabic text-base font-bold mt-1" style={{ color: "var(--color-ink)", letterSpacing: "0.02em" }}>
          قطع الغيار
        </span>
        <span className="text-xs" style={{ color: "var(--color-ink-muted)" }}>نظام ERP</span>
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-3 px-2 flex flex-col gap-0.5">
        {nav.map((item) => {
          const active = isActive(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all"
              style={{
                color: active ? "var(--color-ink)" : "var(--color-ink-muted)",
                background: active ? "var(--color-gold-bg)" : "transparent",
                borderRight: active ? "2px solid var(--color-gold)" : "2px solid transparent",
              }}
            >
              <span style={{ color: active ? "var(--color-gold)" : "inherit" }}>{item.icon}</span>
              <span className="font-arabic">{item.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="px-4 py-4" style={{ borderTop: "1px solid var(--color-border-light)" }}>
        <div className="flex items-center gap-2">
          <div
            className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold"
            style={{ background: "var(--color-gold-dim)", color: "var(--color-gold)" }}
          >
            م
          </div>
          <div>
            <p className="text-xs font-arabic font-medium" style={{ color: "var(--color-ink-2)" }}>المدير</p>
            <p className="text-xs" style={{ color: "var(--color-ink-muted)" }}>Admin</p>
          </div>
        </div>
      </div>
    </aside>
  );
}
