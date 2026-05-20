"use client";
import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

const API = process.env.NEXT_PUBLIC_API_URL;

const typeIcon: Record<string, string> = {
  low_stock:       "⚠️",
  out_of_stock:    "🚫",
  overdue_payment: "💸",
  payment_received:"✅",
  system:          "🔔",
  order_confirmed: "📋",
};

async function getToken() {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? "";
}

export function NotificationBell() {
  const router = useRouter();
  const [open,          setOpen]          = useState(false);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [unread,        setUnread]        = useState(0);
  const [loading,       setLoading]       = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  async function load() {
    setLoading(true);
    const token = await getToken();
    const res = await fetch(`${API}/api/notifications`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) {
      const data = await res.json();
      setNotifications(data.notifications ?? []);
      setUnread(data.unread ?? 0);
    }
    setLoading(false);
  }

  async function markRead(id: string) {
    const token = await getToken();
    await fetch(`${API}/api/notifications/${id}/read`, {
      method: "PUT", headers: { Authorization: `Bearer ${token}` },
    });
    setNotifications((prev) => prev.map((n) => n.id === id ? { ...n, is_read: true } : n));
    setUnread((prev) => Math.max(0, prev - 1));
  }

  async function markAllRead() {
    const token = await getToken();
    await fetch(`${API}/api/notifications/read-all`, {
      method: "PUT", headers: { Authorization: `Bearer ${token}` },
    });
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
    setUnread(0);
  }

  // Generate alerts when opening
  async function generateAlerts() {
    const token = await getToken();
    await fetch(`${API}/api/notifications/generate`, {
      method: "POST", headers: { Authorization: `Bearer ${token}` },
    });
    load();
  }

  useEffect(() => { load(); }, []);

  // Close on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  function handleOpen() {
    if (!open) { setOpen(true); generateAlerts(); }
    else setOpen(false);
  }

  function handleClick(n: any) {
    if (!n.is_read) markRead(n.id);
    if (n.link) { setOpen(false); router.push(n.link); }
  }

  const timeAgo = (date: string) => {
    const diff = Date.now() - new Date(date).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1)   return "الآن";
    if (mins < 60)  return `${mins} د`;
    const hrs = Math.floor(mins / 60);
    if (hrs  < 24)  return `${hrs} س`;
    return `${Math.floor(hrs / 24)} ي`;
  };

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button
        onClick={handleOpen}
        className="relative flex items-center justify-center rounded-lg transition-all"
        style={{
          width: 36, height: 36,
          background: open ? "var(--color-gold-bg)" : "transparent",
          color: "var(--color-ink-muted)",
        }}
        onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "var(--color-surface)"; }}
        onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = open ? "var(--color-gold-bg)" : "transparent"; }}
      >
        <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
          <path d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
        </svg>
        {unread > 0 && (
          <span className="absolute flex items-center justify-center font-bold"
            style={{
              top: 4, left: 4, minWidth: 16, height: 16, borderRadius: 8,
              background: "var(--color-red)", color: "#fff",
              fontSize: 10, lineHeight: 1, padding: "0 4px",
            }}>
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute card overflow-hidden z-50"
          style={{
            top: "calc(100% + 8px)", left: "50%", transform: "translateX(-50%)",
            width: 340, maxHeight: 480,
            boxShadow: "0 8px 32px rgba(0,0,0,.14)",
          }}>
          <div className="flex items-center justify-between px-4 py-3"
            style={{ borderBottom: "1px solid var(--color-border-light)" }}>
            <h3 className="font-arabic font-semibold text-sm" style={{ color: "var(--color-ink)" }}>
              الإشعارات {unread > 0 && <span style={{ color: "var(--color-red)" }}>({unread})</span>}
            </h3>
            {unread > 0 && (
              <button className="font-arabic text-xs" style={{ color: "var(--color-gold)" }} onClick={markAllRead}>
                قراءة الكل
              </button>
            )}
          </div>

          <div style={{ overflowY: "auto", maxHeight: 400 }}>
            {loading ? (
              <div className="flex justify-center py-8">
                <svg className="animate-spin" width="20" height="20" fill="none" viewBox="0 0 24 24">
                  <circle cx="12" cy="12" r="10" stroke="var(--color-border)" strokeWidth="3" />
                  <path d="M12 2a10 10 0 0110 10" stroke="var(--color-gold)" strokeWidth="3" strokeLinecap="round" />
                </svg>
              </div>
            ) : notifications.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-10">
                <span className="text-3xl opacity-20">🔔</span>
                <p className="font-arabic text-sm" style={{ color: "var(--color-ink-muted)" }}>لا توجد إشعارات</p>
              </div>
            ) : (
              notifications.map((n) => (
                <button key={n.id}
                  className="w-full text-right px-4 py-3 flex items-start gap-3 transition-all"
                  style={{
                    borderBottom: "1px solid var(--color-border-light)",
                    background: n.is_read ? "#fff" : "var(--color-gold-bg)",
                    opacity: n.is_read ? 0.75 : 1,
                  }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "var(--color-surface)"; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = n.is_read ? "#fff" : "var(--color-gold-bg)"; }}
                  onClick={() => handleClick(n)}>
                  <span className="text-lg flex-shrink-0 mt-0.5">{typeIcon[n.type] ?? "🔔"}</span>
                  <div className="flex-1 min-w-0">
                    <p className="font-arabic text-sm font-medium truncate" style={{ color: "var(--color-ink)" }}>{n.title}</p>
                    {n.body && <p className="font-arabic text-xs mt-0.5 line-clamp-2" style={{ color: "var(--color-ink-muted)" }}>{n.body}</p>}
                    <p className="text-xs mt-1 font-mono" style={{ color: "var(--color-ink-faint)" }}>{timeAgo(n.created_at)}</p>
                  </div>
                  {!n.is_read && (
                    <div className="w-2 h-2 rounded-full flex-shrink-0 mt-1.5" style={{ background: "var(--color-gold)" }} />
                  )}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
