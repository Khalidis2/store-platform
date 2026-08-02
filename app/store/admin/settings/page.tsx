import { getCurrentStore } from "@/lib/get-store";
import { updateStoreName } from "./actions";

export default async function SettingsPage() {
  const store = await getCurrentStore();
  if (!store) return null;

  return (
    <main>
      <h1>Store settings</h1>

      <form
        action={updateStoreName}
        style={{ display: "flex", flexDirection: "column", gap: "0.75rem", maxWidth: 400, marginTop: "1rem" }}
      >
        <label>
          Store name
          <input name="name" defaultValue={store.name} required style={{ display: "block", width: "100%" }} />
        </label>
        <button type="submit" style={{ alignSelf: "start" }}>
          Save
        </button>
      </form>

      <h2 style={{ marginTop: "2rem" }}>Payments</h2>
      <p style={{ color: "#666" }}>
        {store.is_live
          ? "Stripe connected — this store can accept payments."
          : "Stripe not connected yet. Built in Phase 4 (Stripe Connect)."}
      </p>
    </main>
  );
}
