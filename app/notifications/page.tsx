"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useLanguage } from "@/components/providers/LanguageProvider";
import { useNotifications } from "@/components/notifications/useNotifications";
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

const typeColor: Record<string, { bg: string; color: string }> = {
  new_order:       { bg: "var(--color-blue-bg)",   color: "var(--color-blue)"   },
  order_delivered: { bg: "var(--color-green-bg)",  color: "var(--color-green)"  },
  order_returned:  { bg: "var(--color-amber-bg)",  color: "var(--color-amber)"  },
  order_cancelled: { bg: "var(--color-red-bg)",    color: "var(--color-red)"    },
  low_stock:       { bg: "var(--color-amber-bg)",  color: "var(--color-amber)"  },
  out_of_stock:    { bg: "var(--color-red-bg)",    color: "var(--color-red)"    },
  payment_received:{ bg: "var(--color-green-bg)",  color: "var(--color-green)"  },
  po_received:     { bg: "var(--color-gold-bg)",   color: "var(--color-gold)"   },
  system:          { bg: "var(--color-surface-2)", color: "var(--color-ink-muted)" },
};

function matchFilter(type: string, filter: string) {
  if (filter === "all")       return true;
  if (filter === "unread")    return true; // filtered by is_read separately
  if (filter === "orders")    return ["new_order","order_delivered","order_returned","order_cancelled","po_received"].includes(type);
  if (filter === "inventory") return ["low_stock","out_of_stock"].includes(type);
  if (filter === "payments")  return type === "payment_received";
  return true;
}

function timeAgo(date: string, language: "ar" | "en") {
  const diff = Date.now() - new Date(date).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1)    return language === "ar" ? "الآن" : "Now";
  if (mins < 60)   return language === "ar" ? `منذ ${mins} دقيقة` : `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs  < 24)   return language === "ar" ? `منذ ${hrs} ساعة` : `${hrs}h ago`;
  if (hrs  < 168)  return language === "ar" ? `منذ ${Math.floor(hrs / 24)} يوم` : `${Math.floor(hrs / 24)}d ago`;
  const locale = language === "ar" ? "ar-SA" : "en-US";
  return new Date(date).toLocaleDateString(locale);
}

export default function NotificationsPage() {
  const router = useRouter();
  const { language } = useLanguage();
  const { notifications, unread, markRead, markAllRead, deleteNotification } = useNotifications();
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");

  const filtered = notifications.filter((n) => {
    if (filter === "unread" && n.is_read) return false;
    if (!matchFilter(n.type, filter)) return false;
    if (search) {
      const s = search.toLowerCase();
      return n.title.includes(search) || n.body?.includes(search) || n.type.toLowerCase().includes(s);
    }
    return true;
  });

  // Group by date
  const groups: Record<string, typeof filtered> = {};
  filtered.forEach((n) => {
    const d = new Date(n.created_at);
    const now = new Date();
    let label: string;
    if (d.toDateString() === now.toDateString()) label = language === "ar" ? "اليوم" : "Today";
    else if (d.toDateString() === new Date(now.getTime() - 86400000).toDateString()) label = language === "ar" ? "أمس" : "Yesterday";
    else {
      const locale = language === "ar" ? "ar-SA" : "en-US";
      label = d.toLocaleDateString(locale, { weekday: "long", month: "long", day: "numeric" });
    }
    if (!groups[label]) groups[label] = [];
    groups[label].push(n);
  });

  const filterOptions = [
    { value: "all",       label: t("notif.filter.all", language) },
    { value: "unread",    label: t("notif.filter.unread", language) },
    { value: "orders",    label: t("notif.filter.orders", language) },
    { value: "inventory", label: t("notif.filter.inventory", language) },
    { value: "payments",  label: t("notif.filter.payments", language) },
  ];

  return (
    <div className="flex-1 p-8" style={{ maxWidth: 800, margin: "0 auto", width: "100%" }}>

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-arabic text-2xl font-bold mb-1"
            style={{ color: "var(--color-ink)" }}>
            {t("notif.title", language)}
          </h1>
          <p className="font-arabic text-sm" style={{ color: "var(--color-ink-muted)" }}>
            {unread > 0 ? `${unread} ${t("notif.unread_count", language)}` : t("notif.all_read", language)}
          </p>
        </div>
        {unread > 0 && (
          <button className="btn btn-gold text-sm" onClick={markAllRead}>
            <svg width="14" height="14" fill="none" viewBox="0 0 24 24"
              stroke="currentColor" strokeWidth={2}>
              <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className="font-arabic">{t("action.mark_all_read", language)}</span>
          </button>
        )}
      </div>

      {/* Filter + search */}
      <div className="card p-4 mb-6 flex gap-3 items-center flex-wrap">
        <div className="relative flex-1" style={{ minWidth: 200 }}>
          <svg width="14" height="14" fill="none" viewBox="0 0 24 24"
            stroke="currentColor" strokeWidth={2}
            className="absolute"
            style={{ top: "50%", right: 10, transform: "translateY(-50%)", color: "var(--color-ink-faint)" }}>
            <circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" />
          </svg>
          <input
            className="input"
            style={{ paddingRight: 34 }}
            placeholder={t("notif.search_placeholder", language)}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="flex gap-1 p-1 rounded-lg" style={{ background: "var(--color-surface)" }}>
          {filterOptions.map((f) => (
            <button
              key={f.value}
              className="px-3 py-1.5 rounded-md font-arabic text-xs transition-all"
              style={{
                background: filter === f.value ? "#fff" : "transparent",
                color:      filter === f.value ? "var(--color-ink)" : "var(--color-ink-muted)",
                boxShadow:  filter === f.value ? "0 1px 3px rgba(0,0,0,.08)" : "none",
              }}
              onClick={() => setFilter(f.value)}
            >
              {f.label}
              {f.value === "unread" && unread > 0 && (
                <span className="mr-1 badge text-xs"
                  style={{ background: "var(--color-red-bg)", color: "var(--color-red)", padding: "1px 5px" }}>
                  {unread}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Notifications grouped by date */}
      {filtered.length === 0 ? (
        <div className="card flex flex-col items-center gap-3 py-20">
          <span className="text-5xl opacity-20">🔔</span>
          <p className="font-arabic text-base" style={{ color: "var(--color-ink-muted)" }}>
            {search || filter !== "all" ? t("notif.no_results", language) : t("notif.no_notifications", language)}
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-6">
          {Object.entries(groups).map(([dateLabel, items]) => (
            <div key={dateLabel}>
              <p className="font-arabic text-xs font-semibold mb-3 px-1"
                style={{ color: "var(--color-ink-muted)" }}>
                {dateLabel}
              </p>
              <div className="card overflow-hidden">
                {items.map((n, idx) => {
                  const tc = typeColor[n.type] ?? typeColor.system;
                  const typeKey = `notif.type.${n.type}` as const;
                  return (
                    <div
                      key={n.id}
                      className="flex items-start gap-4 px-5 py-4 cursor-pointer transition-all group"
                      style={{
                        borderBottom: idx < items.length - 1 ? "1px solid var(--color-border-light)" : "none",
                        background:   n.is_read ? "#fff" : "var(--color-gold-bg)",
                      }}
                      onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "var(--color-surface)"; }}
                      onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = n.is_read ? "#fff" : "var(--color-gold-bg)"; }}
                      onClick={() => {
                        if (!n.is_read) markRead(n.id);
                        if (n.link) router.push(n.link);
                      }}
                    >
                      {/* Icon */}
                      <div
                        className="flex items-center justify-center rounded-full flex-shrink-0"
                        style={{ width: 40, height: 40, background: tc.bg }}
                      >
                        <span className="text-lg">{typeIcon[n.type] ?? "🔔"}</span>
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <p className="font-arabic text-sm font-semibold"
                            style={{ color: "var(--color-ink)" }}>
                            {n.title}
                          </p>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            <span className="badge text-xs"
                              style={{ background: tc.bg, color: tc.color }}>
                              {t(typeKey, language)}
                            </span>
                            {!n.is_read && (
                              <div className="w-2 h-2 rounded-full"
                                style={{ background: "var(--color-gold)" }} />
                            )}
                          </div>
                        </div>
                        {n.body && (
                          <p className="font-arabic text-sm mt-0.5"
                            style={{ color: "var(--color-ink-muted)" }}>
                            {n.body}
                          </p>
                        )}
                        <div className="flex items-center gap-3 mt-2">
                          <span className="font-mono text-xs"
                            style={{ color: "var(--color-ink-faint)" }}>
                            {timeAgo(n.created_at, language)}
                          </span>
                          {n.link && (
                            <span className="font-arabic text-xs"
                              style={{ color: "var(--color-gold)" }}>
                              {t("notif.view_details", language)}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                        {!n.is_read && (
                          <button
                            className="w-7 h-7 rounded flex items-center justify-center"
                            style={{ background: "var(--color-green-bg)", color: "var(--color-green)" }}
                            title={t("action.mark_read", language)}
                            onClick={(e) => { e.stopPropagation(); markRead(n.id); }}
                          >
                            <svg width="12" height="12" fill="none" viewBox="0 0 24 24"
                              stroke="currentColor" strokeWidth={2.5}>
                              <path d="M5 13l4 4L19 7" />
                            </svg>
                          </button>
                        )}
                        <button
                          className="w-7 h-7 rounded flex items-center justify-center"
                          style={{ background: "var(--color-red-bg)", color: "var(--color-red)" }}
                          title={t("action.delete", language)}
                          onClick={(e) => { e.stopPropagation(); deleteNotification(n.id); }}
                        >
                          <svg width="12" height="12" fill="none" viewBox="0 0 24 24"
                            stroke="currentColor" strokeWidth={2}>
                            <path d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
