import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase-server";
import { SuperadminSidebar } from "@/components/superadmin/SuperadminSidebar";

export const metadata = { title: "SuperAdmin | AutoParts ERP" };

export default async function SuperadminLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, full_name_ar")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "superadmin") redirect("/");

  return (
    <div className="h-full flex" style={{ background: "var(--color-surface)" }}>
      <SuperadminSidebar user={user} profile={profile} />
      <main className="flex-1 flex flex-col min-h-full overflow-auto">
        {children}
      </main>
    </div>
  );
}
