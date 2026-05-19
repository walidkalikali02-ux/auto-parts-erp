import type { Metadata } from "next";
import "./globals.css";
import { Sidebar } from "@/components/layout/Sidebar";

export const metadata: Metadata = {
  title: "AutoParts ERP | نظام قطع الغيار",
  description: "نظام إدارة موارد قطع غيار السيارات",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ar" dir="rtl" className="h-full">
      <body className="h-full flex" style={{ background: "var(--color-surface)" }}>
        <Sidebar />
        <main className="flex-1 flex flex-col min-h-full overflow-auto">
          {children}
        </main>
      </body>
    </html>
  );
}
