"use client";
import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useLanguage } from "@/components/providers/LanguageProvider";
import { useNotifications } from "./useNotifications";
import { t } from "@/lib/translations";

const typeIcon: Record<string, string> = {
  new_order:       "🛒",
  order_delivered: "✅",
  order_returned:  "↩️",
  order_cancelled: "❌",
  low_stock:       "⚠️",
  out_of_stock:    "🚫",
  payment_received:"💰",
  po_received:     "📦",
  system:          "🔔",
};

function timeAgo(date: string, language: "ar" | "en") {
  const diff = Date.now() - new Date(date).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1)   return language === "ar" ? "الآن" : "Now";
  if (mins < 60)  return language === "ar" ? `${mins} د` : `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs  < 24)  return language === "ar" ? `${hrs} س` : `${hrs}h`;
  return language === "ar" ? `${Math.floor(hrs / 24)} ي` : `${Math.floor(hrs / 24)}d`;
}

export function NotificationBell() {
  const router = useRouter();
  const { language } = useLanguage();
  const { notifications, unread, markRead, markAllRead } = useNotifications();
  const [open, setOpen] = useState(false);
  const ref  = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  function handleClick(n: { id: string; is_read: boolean; link: string | null }) {
    if (!n.is_read) markRead(n.id);
    if (n.link) { setOpen(false); router.push(n.link); }
  }

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="relative flex items-center justify-center rounded-lg transition-all"
        title={t("notif.title", language)}
        style={{
          width:      36,
          height:     36,
          background: open ? "var(--color-gold-bg)" : "transparent",
          color:      "var(--color-ink-muted)",
        }}
        onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "var(--color-surface)"; }}
        onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = open ? "var(--color-gold-bg)" : "transparent"; }}
      >
        <svg width="18" height="18" fill="none" viewBox="0 0 24 24"
          stroke="currentColor" strokeWidth={1.8}>
          <path d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
        </svg>

        {/* Unread badge */}
        {unread > 0 && (
          <span
            className="absolute flex items-center justify-center font-bold"
            style={{
              top: 3, left: 3,
              minWidth: 16, height: 16,
              borderRadius: 8,
              background: "var(--color-red)",
              color:      "#fff",
              fontSize:   10,
              lineHeight: 1,
              padding:    "0 4px",
            }}
          >
            {unread > 9 ? "9+" : unread}
          </span>
        )}

        {/* Live pulse dot when unread */}
        {unread > 0 && (
          <span style={{
            position:   "absolute",
            top:        4,
            left:       4,
            width:      8,
            height:     8,
            borderRadius: "50%",
            background: "var(--color-red)",
            animation:  "pulse 2s infinite",
          }} />
        )}
      </button>

      {open && (
        <div
          className="absolute card overflow-hidden"
          style={{
            top:       "calc(100% + 8px)",
            left:      "50%",
            transform: "translateX(-50%)",
            width:     340,
            maxHeight: 480,
            zIndex:    50,
            boxShadow: "0 8px 32px rgba(0,0,0,.14)",
            animation: "fadeInDown 0.15s ease",
          }}
        >
          {/* Header */}
          <div
            className="flex items-center justify-between px-4 py-3"
            style={{ borderBottom: "1px solid var(--color-border-light)" }}
          >
            <div className="flex items-center gap-2">
              <h3 className="font-arabic font-semibold text-sm"
                style={{ color: "var(--color-ink)" }}>
                {t("notif.title", language)}
              </h3>
              {unread > 0 && (
                <span className="badge text-xs"
                  style={{ background: "var(--color-red-bg)", color: "var(--color-red)" }}>
                  {unread} {t("notif.new", language)}
                </span>
              )}
            </div>
            <div className="flex items-center gap-3">
              {unread > 0 && (
                <button
                  className="font-arabic text-xs"
                  style={{ color: "var(--color-gold)" }}
                  onClick={markAllRead}
                >
                  {t("action.mark_all_read", language)}
                </button>
              )}
              <button
                className="font-arabic text-xs"
                style={{ color: "var(--color-ink-muted)" }}
                onClick={() => { setOpen(false); router.push("/notifications"); }}
              >
                {t("action.view_all", language)}
              </button>
            </div>
          </div>

          {/* List */}
          <div style={{ overflowY: "auto", maxHeight: 400 }}>
            {notifications.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-10">
                <span className="text-3xl opacity-20">🔔</span>
                <p className="font-arabic text-sm"
                  style={{ color: "var(--color-ink-muted)" }}>
                  {t("notif.no_notifications", language)}
                </p>
              </div>
            ) : (
              notifications.slice(0, 15).map((n) => (
                <button
                  key={n.id}
                  className="w-full text-right flex items-start gap-3 px-4 py-3 transition-all"
                  style={{
                    borderBottom: "1px solid var(--color-border-light)",
                    background:   n.is_read ? "#fff" : "var(--color-gold-bg)",
                  }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "var(--color-surface)"; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = n.is_read ? "#fff" : "var(--color-gold-bg)"; }}
                  onClick={() => handleClick(n)}
                >
                  <span className="text-lg flex-shrink-0 mt-0.5">
                    {typeIcon[n.type] ?? "🔔"}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="font-arabic text-sm font-medium truncate"
                      style={{ color: "var(--color-ink)" }}>
                      {n.title}
                    </p>
                    {n.body && (
                      <p className="font-arabic text-xs mt-0.5 line-clamp-2"
                        style={{ color: "var(--color-ink-muted)" }}>
                        {n.body}
                      </p>
                    )}
                    <p className="font-mono text-xs mt-1"
                      style={{ color: "var(--color-ink-faint)" }}>
                      {timeAgo(n.created_at, language)}
                    </p>
                  </div>
                  {!n.is_read && (
                    <div
                      className="w-2 h-2 rounded-full flex-shrink-0 mt-2"
                      style={{ background: "var(--color-gold)" }}
                    />
                  )}
                </button>
              ))
            )}
          </div>

          {notifications.length > 15 && (
            <div className="px-4 py-3 text-center"
              style={{ borderTop: "1px solid var(--color-border-light)" }}>
              <button
                className="font-arabic text-xs"
                style={{ color: "var(--color-gold)" }}
                onClick={() => { setOpen(false); router.push("/notifications"); }}
              >
                {t("action.view_all", language)} ({notifications.length})
              </button>
            </div>
          )}
        </div>
      )}

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50%       { opacity: .5; transform: scale(1.5); }
        }
        @keyframes fadeInDown {
          from { opacity: 0; transform: translateX(-50%) translateY(-8px); }
          to   { opacity: 1; transform: translateX(-50%) translateY(0); }
        }
      `}</style>
    </div>
  );
}
