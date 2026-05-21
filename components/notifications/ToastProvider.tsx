"use client";
import { createContext, useContext, useState, useCallback, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

interface Toast {
  id:    string;
  type:  string;
  title: string;
  body:  string | null;
  link:  string | null;
}

interface ToastCtx { addToast: (t: Omit<Toast, "id">) => void; }

const Ctx = createContext<ToastCtx>({ addToast: () => {} });
export const useToast = () => useContext(Ctx);

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

const typeColor: Record<string, string> = {
  new_order:       "var(--color-blue)",
  order_delivered: "var(--color-green)",
  order_returned:  "var(--color-amber)",
  order_cancelled: "var(--color-red)",
  low_stock:       "var(--color-amber)",
  out_of_stock:    "var(--color-red)",
  payment_received:"var(--color-green)",
  po_received:     "var(--color-gold)",
  system:          "var(--color-ink-muted)",
};

function ToastItem({ toast, onDismiss }: { toast: Toast; onDismiss: () => void }) {
  const router  = useRouter();
  const timerRef = useRef<NodeJS.Timeout>();

  useEffect(() => {
    timerRef.current = setTimeout(onDismiss, 5000);
    return () => clearTimeout(timerRef.current);
  }, [onDismiss]);

  function handleClick() {
    if (toast.link) router.push(toast.link);
    onDismiss();
  }

  const color = typeColor[toast.type] ?? "var(--color-ink-muted)";

  return (
    <div
      className="flex items-start gap-3 p-4 rounded-xl shadow-lg cursor-pointer transition-all"
      style={{
        background:   "#fff",
        border:       `1px solid ${color}33`,
        borderRight:  `4px solid ${color}`,
        minWidth:     300,
        maxWidth:     380,
        animation:    "slideInRight 0.25s ease",
      }}
      onClick={handleClick}
      onMouseEnter={() => clearTimeout(timerRef.current)}
      onMouseLeave={() => { timerRef.current = setTimeout(onDismiss, 2000); }}
    >
      <span className="text-xl flex-shrink-0 mt-0.5">
        {typeIcon[toast.type] ?? "🔔"}
      </span>
      <div className="flex-1 min-w-0">
        <p className="font-arabic text-sm font-semibold truncate"
          style={{ color: "var(--color-ink)" }}>
          {toast.title}
        </p>
        {toast.body && (
          <p className="font-arabic text-xs mt-0.5 line-clamp-2"
            style={{ color: "var(--color-ink-muted)" }}>
            {toast.body}
          </p>
        )}
      </div>
      <button
        className="text-sm flex-shrink-0"
        style={{ color: "var(--color-ink-faint)" }}
        onClick={(e) => { e.stopPropagation(); onDismiss(); }}
      >
        ✕
      </button>
    </div>
  );
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = useCallback((t: Omit<Toast, "id">) => {
    const id = crypto.randomUUID();
    setToasts((prev) => [...prev, { ...t, id }]);
  }, []);

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  // Subscribe to real-time notifications and show toasts
  useEffect(() => {
    let channel: ReturnType<typeof supabase.channel> | null = null;

    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      channel = supabase
        .channel(`toasts:${user.id}`)
        .on(
          "postgres_changes",
          {
            event:  "INSERT",
            schema: "public",
            table:  "notifications",
            filter: `user_id=eq.${user.id}`,
          },
          (payload) => {
            const n = payload.new as Toast;
            addToast({ type: n.type, title: n.title, body: n.body, link: n.link });
          }
        )
        .subscribe();
    })();

    return () => { channel?.unsubscribe(); };
  }, [addToast]);

  return (
    <Ctx.Provider value={{ addToast }}>
      {children}
      {/* Toast container — bottom-left */}
      <div
        style={{
          position:      "fixed",
          bottom:        24,
          left:          24,
          zIndex:        9999,
          display:       "flex",
          flexDirection: "column",
          gap:           10,
          pointerEvents: "none",
        }}
      >
        {toasts.map((t) => (
          <div key={t.id} style={{ pointerEvents: "all" }}>
            <ToastItem toast={t} onDismiss={() => dismiss(t.id)} />
          </div>
        ))}
      </div>

      <style>{`
        @keyframes slideInRight {
          from { opacity: 0; transform: translateX(-20px); }
          to   { opacity: 1; transform: translateX(0); }
        }
      `}</style>
    </Ctx.Provider>
  );
}
