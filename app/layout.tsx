import type { Metadata } from "next";
import { cookies } from "next/headers";
import "./globals.css";
import { Sidebar } from "@/components/layout/Sidebar";
import { LanguageProvider } from "@/components/providers/LanguageProvider";
import { createClient } from "@/lib/supabase-server";
import { PWARegister } from "@/components/PWARegister";
import { ToastProvider } from "@/components/notifications/ToastProvider";
import { getAppLanguage, LANGUAGE_COOKIE_NAME, LANGUAGE_META } from "@/lib/language";

export const metadata: Metadata = {
  title: "AutoParts ERP | نظام قطع الغيار",
  description: "نظام إدارة موارد قطع غيار السيارات",
  manifest: "/manifest.json",
  appleWebApp: { capable: true, statusBarStyle: "default", title: "AutoParts ERP" },
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = await cookies();
  const language = getAppLanguage(cookieStore.get(LANGUAGE_COOKIE_NAME)?.value);
  const { dir } = LANGUAGE_META[language];
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { data: profile } = user
    ? await supabase.from("profiles").select("role").eq("id", user.id).single()
    : { data: null };

  return (
    <html lang={language} dir={dir} className="h-full">
      <head>
        <link rel="apple-touch-icon" href="/icon-192.png" />
        <meta name="theme-color" content="#B5892A" />
      </head>
      <body className="h-full flex" style={{ background: "var(--color-surface)" }}>
        <LanguageProvider initialLanguage={language}>
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
        </LanguageProvider>
      </body>
    </html>
  );
}
