import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentStore } from "@/lib/get-store";
import { getSupabaseServerClient } from "@/lib/supabase-server";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const store = await getCurrentStore();
  if (!store) redirect("/");

  const supabase = getSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  // Tenant-isolation guard: being logged in isn't enough — this user must
  // specifically own THIS store, or they could view/edit another merchant's
  // admin panel just by knowing their subdomain.
  if (user.id !== store.owner_user_id) redirect("/login");

  return (
    <div style={{ fontFamily: "system-ui" }}>
      <nav style={{ display: "flex", gap: "1.5rem", padding: "1rem 2rem", borderBottom: "1px solid #ddd" }}>
        <Link href="/admin">Dashboard</Link>
        <Link href="/admin/products">Products</Link>
        <Link href="/admin/orders">Orders</Link>
        <Link href="/admin/settings">Settings</Link>
      </nav>
      <div style={{ padding: "2rem" }}>{children}</div>
    </div>
  );
}
