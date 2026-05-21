import type { Metadata } from "next";
import "./globals.css";
import { Sidebar } from "@/components/layout/Sidebar";
import { createClient } from "@/lib/supabase-server";
import { PWARegister } from "@/components/PWARegister";
import { ToastProvider } from "@/components/notifications/ToastProvider";

export const metadata: Metadata = {
  title: "AutoParts ERP | نظام قطع الغيار",
  description: "نظام إدارة موارد قطع غيار السيارات",
  manifest: "/manifest.json",
  appleWebApp: { capable: true, statusBarStyle: "default", title: "AutoParts ERP" },
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { data: profile } = user
    ? await supabase.from("profiles").select("role").eq("id", user.id).single()
    : { data: null };

  const isLoginPage = false; // middleware handles redirect

  return (
    <html lang="ar" dir="rtl" className="h-full">
      <head>
        <link rel="apple-touch-icon" href="/icon-192.png" />
        <meta name="theme-color" content="#B5892A" />
      </head>
      <body className="h-full flex" style={{ background: "var(--color-surface)" }}>
        {user ? (
          <>
            <Sidebar user={user} isSuperadmin={profile?.role === "superadmin"} />
            <main className="flex-1 flex flex-col min-h-full overflow-auto">
              {children}
            </main>
          </>
        ) : (
          <main className="flex-1 flex flex-col min-h-full overflow-auto">
            {children}
          </main>
        )}
        <PWARegister />
        <ToastProvider>{null}</ToastProvider>
      </body>
    </html>
  );
}
