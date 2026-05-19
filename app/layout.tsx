import type { Metadata } from "next";
import "./globals.css";
import { Sidebar } from "@/components/layout/Sidebar";
import { createClient } from "@/lib/supabase-server";

export const metadata: Metadata = {
  title: "AutoParts ERP | نظام قطع الغيار",
  description: "نظام إدارة موارد قطع غيار السيارات",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const isLoginPage = false; // middleware handles redirect

  return (
    <html lang="ar" dir="rtl" className="h-full">
      <body className="h-full flex" style={{ background: "var(--color-surface)" }}>
        {user ? (
          <>
            <Sidebar user={user} />
            <main className="flex-1 flex flex-col min-h-full overflow-auto">
              {children}
            </main>
          </>
        ) : (
          <main className="flex-1 flex flex-col min-h-full overflow-auto">
            {children}
          </main>
        )}
      </body>
    </html>
  );
}
