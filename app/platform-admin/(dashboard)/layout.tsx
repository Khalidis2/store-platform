import { redirect } from "next/navigation";
import { getPlatformAdminUser } from "@/lib/platform-admin";

export default async function PlatformAdminLayout({ children }: { children: React.ReactNode }) {
  const admin = await getPlatformAdminUser();
  if (!admin) redirect("/platform-admin/login");

  return (
    <div style={{ fontFamily: "system-ui" }}>
      <nav style={{ padding: "1rem 2rem", borderBottom: "1px solid #ddd" }}>
        <strong>Platform Admin</strong>
      </nav>
      <div style={{ padding: "2rem" }}>{children}</div>
    </div>
  );
}
