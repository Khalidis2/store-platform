import { getCurrentStore } from "@/lib/get-store";
import { notFound } from "next/navigation";

export default async function StorefrontHome() {
  const store = await getCurrentStore();
  if (!store) notFound();

  return (
    <main style={{ fontFamily: "system-ui", padding: "3rem" }}>
      <h1>{store.name}</h1>
      <p>
        Store is {store.is_live ? "live and accepting orders" : "not yet live (Stripe onboarding pending)"}.
      </p>
      <p style={{ color: "#666" }}>
        This is the placeholder storefront for subdomain <code>{store.subdomain}</code>. Phase 2
        (admin) and Phase 3 (real storefront) build on top of this.
      </p>
    </main>
  );
}
