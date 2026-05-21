"use client";
import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";

export interface Notification {
  id:         string;
  type:       string;
  title:      string;
  body:       string | null;
  link:       string | null;
  is_read:    boolean;
  payload:    Record<string, unknown>;
  created_at: string;
}

export function useNotifications() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unread,        setUnread]        = useState(0);
  const [userId,        setUserId]        = useState<string | null>(null);

  // Load initial notifications from Supabase directly
  const load = useCallback(async (uid: string) => {
    const { data } = await supabase
      .from("notifications")
      .select("*")
      .eq("user_id", uid)
      .order("created_at", { ascending: false })
      .limit(50);

    const rows = (data ?? []) as Notification[];
    setNotifications(rows);
    setUnread(rows.filter((n) => !n.is_read).length);
  }, []);

  useEffect(() => {
    let channel: ReturnType<typeof supabase.channel> | null = null;

    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setUserId(user.id);
      await load(user.id);

      // Subscribe to real-time INSERT on notifications for this user
      channel = supabase
        .channel(`notifications:${user.id}`)
        .on(
          "postgres_changes",
          {
            event:  "INSERT",
            schema: "public",
            table:  "notifications",
            filter: `user_id=eq.${user.id}`,
          },
          (payload) => {
            const n = payload.new as Notification;
            setNotifications((prev) => [n, ...prev].slice(0, 50));
            setUnread((prev) => prev + 1);
          }
        )
        .on(
          "postgres_changes",
          {
            event:  "UPDATE",
            schema: "public",
            table:  "notifications",
            filter: `user_id=eq.${user.id}`,
          },
          (payload) => {
            const updated = payload.new as Notification;
            setNotifications((prev) =>
              prev.map((n) => n.id === updated.id ? updated : n)
            );
            // Recount unread
            setNotifications((prev) => {
              setUnread(prev.filter((n) => !n.is_read).length);
              return prev;
            });
          }
        )
        .subscribe();
    })();

    return () => { channel?.unsubscribe(); };
  }, [load]);

  const markRead = useCallback(async (id: string) => {
    await supabase.from("notifications").update({ is_read: true }).eq("id", id);
    setNotifications((prev) => prev.map((n) => n.id === id ? { ...n, is_read: true } : n));
    setUnread((prev) => Math.max(0, prev - 1));
  }, []);

  const markAllRead = useCallback(async () => {
    if (!userId) return;
    await supabase.from("notifications").update({ is_read: true })
      .eq("user_id", userId).eq("is_read", false);
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
    setUnread(0);
  }, [userId]);

  const deleteNotification = useCallback(async (id: string) => {
    await supabase.from("notifications").delete().eq("id", id);
    setNotifications((prev) => {
      const updated = prev.filter((n) => n.id !== id);
      setUnread(updated.filter((n) => !n.is_read).length);
      return updated;
    });
  }, []);

  return { notifications, unread, markRead, markAllRead, deleteNotification };
}
