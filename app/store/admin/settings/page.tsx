import { getCurrentStore } from "@/lib/get-store";
import { updateStoreName, connectStripe } from "./actions";

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

      {store.is_live ? (
        <p style={{ color: "#2a2" }}>Stripe connected — this store can accept payments.</p>
      ) : store.stripe_account_id ? (
        <>
          <p style={{ color: "#a66" }}>
            Stripe onboarding started but not finished — verification, trade license, or bank
            details may still be needed.
          </p>
          <form action={connectStripe}>
            <button type="submit">Continue Stripe setup</button>
          </form>
        </>
      ) : (
        <>
          <p style={{ color: "#666" }}>
            Connect Stripe to start accepting payments. You'll need a valid UAE trade license to
            complete onboarding — Stripe's UAE Connect configuration doesn't currently support
            unlicensed individuals.
          </p>
          <form action={connectStripe}>
            <button type="submit">Connect Stripe</button>
          </form>
        </>
      )}
    </main>
  );
}
