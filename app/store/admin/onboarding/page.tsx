import Link from "next/link";
import { db } from "@/lib/db";
import { getCurrentStore } from "@/lib/get-store";
import { buildMerchantOnboarding } from "@/lib/merchant-onboarding";

export default async function MerchantOnboardingPage() {
  const store = await getCurrentStore();
  if (!store) return null;

  const { rows } = await db.query<{ count: string }>(
    "select count(*)::text as count from products where store_id = $1 and status = 'active'",
    [store.id]
  );
  const steps = buildMerchantOnboarding(store, Number(rows[0]?.count ?? 0));
  const completed = steps.filter((step) => step.complete).length;

  return (
    <main style={{ maxWidth: 760 }}>
      <h1>Store setup</h1>
      <p style={{ color: "#666" }}>
        {completed} of {steps.length} steps complete. Finish the required setup before publishing your storefront.
      </p>

      <ol style={{ padding: 0, listStyle: "none", display: "grid", gap: "0.75rem", marginTop: "1.5rem" }}>
        {steps.map((step, index) => (
          <li key={step.key} style={{ border: "1px solid #ddd", borderRadius: 8, padding: "1rem" }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: "1rem", alignItems: "start" }}>
              <div>
                <strong>{step.complete ? "✓" : index + 1}. {step.title}</strong>
                <p style={{ color: "#666", marginBottom: 0 }}>{step.description}</p>
              </div>
              <Link href={step.href}>{step.complete ? "Review" : "Complete"}</Link>
            </div>
          </li>
        ))}
      </ol>
    </main>
  );
}
