"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { supabase } from "@/lib/supabase";

const nav = [
  {
    label: "لوحة التحكم",
    href: "/superadmin",
    icon: (
      <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" />
        <rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" />
      </svg>
    ),
  },
  {
    label: "المستأجرون",
    href: "/superadmin/tenants",
    icon: (
      <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0H5m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
      </svg>
    ),
  },
  {
    label: "المستخدمون",
    href: "/superadmin/users",
    icon: (
      <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" /><circle cx="9" cy="7" r="4" />
        <path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" />
      </svg>
    ),
  },
  {
    label: "الاشتراكات",
    href: "/superadmin/plans",
    icon: (
      <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
      </svg>
    ),
  },
  {
    label: "العودة للمتجر",
    href: "/",
    icon: (
      <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path d="M10 19l-7-7m0 0l7-7m-7 7h18" />
      </svg>
    ),
  },
];

export function SuperadminSidebar({ user, profile }: { user: any; profile: any }) {
  const path = usePathname();

  const isActive = (href: string) =>
    href === "/superadmin" ? path === "/superadmin" : path.startsWith(href) && href !== "/";

  async function handleLogout() {
    await supabase.auth.signOut();
    window.location.href = "/login";
  }

  return (
    <aside
      className="flex flex-col w-[220px] min-h-full flex-shrink-0"
      style={{ background: "#0f1117", borderLeft: "none" }}
    >
      {/* Logo */}
      <div
        className="flex flex-col items-center justify-center py-6 px-4 gap-1"
        style={{ borderBottom: "1px solid rgba(255,255,255,0.08)" }}
      >
        <svg width="36" height="36" viewBox="0 0 36 36" fill="none">
          <polygon points="18,2 34,10 34,26 18,34 2,26 2,10" fill="rgba(181,137,42,0.15)" stroke="#b5892a" strokeWidth="1.5" />
          <polygon points="18,8 28,13 28,23 18,28 8,23 8,13" fill="none" stroke="#b5892a" strokeWidth="1" opacity="0.5" />
          <circle cx="18" cy="18" r="4" fill="#b5892a" />
        </svg>
        <span className="font-arabic text-sm font-bold mt-1" style={{ color: "#fff" }}>
          SuperAdmin
        </span>
        <span
          className="badge text-xs mt-0.5"
          style={{ background: "rgba(181,137,42,0.15)", color: "#b5892a", padding: "2px 8px" }}
        >
          SaaS Control Panel
        </span>
      </div>

      {/* Nav */}
      <nav className="flex-1 py-3 px-2 flex flex-col gap-0.5">
        {nav.map((item) => {
          const active = isActive(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all"
              style={{
                color: active ? "#fff" : "rgba(255,255,255,0.45)",
                background: active ? "rgba(181,137,42,0.12)" : "transparent",
                borderRight: active ? "2px solid #b5892a" : "2px solid transparent",
              }}
            >
              <span style={{ color: active ? "#b5892a" : "inherit" }}>{item.icon}</span>
              <span className="font-arabic">{item.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* User + Logout */}
      <div className="px-3 py-3" style={{ borderTop: "1px solid rgba(255,255,255,0.08)" }}>
        <div className="flex items-center gap-2 mb-2">
          <div
            className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
            style={{ background: "rgba(181,137,42,0.2)", color: "#b5892a" }}
          >
            {user?.email?.[0]?.toUpperCase() ?? "S"}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-arabic font-medium" style={{ color: "rgba(255,255,255,0.8)" }}>
              {profile?.full_name_ar ?? "Super Admin"}
            </p>
            <p className="text-xs truncate" style={{ color: "rgba(255,255,255,0.35)", direction: "ltr" }}>
              {user?.email}
            </p>
          </div>
        </div>
        <button
          onClick={handleLogout}
          className="flex items-center gap-2 w-full px-3 py-2 rounded-lg text-xs transition-all"
          style={{ color: "rgba(255,255,255,0.35)" }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLElement).style.background = "rgba(192,57,43,0.15)";
            (e.currentTarget as HTMLElement).style.color = "#e74c3c";
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLElement).style.background = "transparent";
            (e.currentTarget as HTMLElement).style.color = "rgba(255,255,255,0.35)";
          }}
        >
          <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
          </svg>
          <span className="font-arabic">تسجيل الخروج</span>
        </button>
      </div>
    </aside>
  );
}
