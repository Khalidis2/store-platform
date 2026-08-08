import { getCurrentStore } from "@/lib/get-store";
import { updateStoreProfile, connectStripe } from "./actions";
import { setStoreStatus } from "./lifecycle-actions";

export default async function SettingsPage() {
  const store = await getCurrentStore();
  if (!store) return null;

  const canMerchantToggle = store.status === "draft" || store.status === "active";

  return (
    <main>
      <h1>Store settings</h1>

      <section style={{ margin: "1rem 0 2rem" }}>
        <h2>Store status</h2>
        <p>
          Current status: <strong>{store.status}</strong>
        </p>
        {store.status === "suspended" ? (
          <p style={{ color: "crimson" }}>This store has been suspended by the platform owner.</p>
        ) : store.status === "closed" ? (
          <p style={{ color: "#666" }}>This store is closed. Contact the platform owner to reopen it.</p>
        ) : (
          <form action={setStoreStatus}>
            <input type="hidden" name="status" value={store.status === "active" ? "draft" : "active"} />
            <button type="submit" disabled={!canMerchantToggle || (store.status === "draft" && !store.is_live)}>
              {store.status === "active" ? "Unpublish store" : "Publish store"}
            </button>
            {store.status === "draft" && !store.is_live && (
              <span style={{ marginLeft: "0.5rem", color: "#a66" }}>Complete Stripe onboarding before publishing.</span>
            )}
          </form>
        )}
      </section>

      <form
        action={updateStoreProfile}
        style={{ display: "flex", flexDirection: "column", gap: "0.75rem", maxWidth: 400, marginTop: "1rem" }}
      >
        <label>
          Store name
          <input name="name" defaultValue={store.name} required style={{ display: "block", width: "100%" }} />
        </label>
        <label>
          Order notification email
          <input
            name="notificationEmail"
            type="email"
            defaultValue={store.notification_email ?? ""}
            placeholder="orders@example.com"
            style={{ display: "block", width: "100%" }}
          />
          <span style={{ color: "#666", fontSize: "0.8rem" }}>New paid-order notifications are sent here.</span>
        </label>
        <label>
          Logo (optional)
          {store.logo_url && (
            <div style={{ margin: "0.25rem 0" }}>
              <img src={store.logo_url} alt="Current logo" style={{ height: 40 }} />
            </div>
          )}
          <input type="file" name="logo" accept="image/jpeg,image/png,image/webp,image/gif" style={{ display: "block", width: "100%" }} />
          <span style={{ color: "#666", fontSize: "0.8rem" }}>JPEG, PNG, WEBP, or GIF, up to 5MB. Leave blank to keep the current logo.</span>
        </label>
        <label>
          Tagline (optional)
          <input name="tagline" defaultValue={store.tagline ?? ""} placeholder="Shown next to your store name" style={{ display: "block", width: "100%" }} />
        </label>
        <label>
          Accent color
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <input type="color" name="accentColor" defaultValue={store.accent_color ?? "#111111"} style={{ width: 48, height: 32, padding: 0, border: "1px solid #ccc" }} />
            <span style={{ color: "#666", fontSize: "0.85rem" }}>Used for buttons on your storefront</span>
          </div>
        </label>
        <button type="submit" style={{ alignSelf: "start" }}>Save</button>
      </form>

      <h2 style={{ marginTop: "2rem" }}>Payments</h2>

      {store.is_live ? (
        <p style={{ color: "#2a2" }}>Stripe connected — this store can accept payments once published.</p>
      ) : store.stripe_account_id ? (
        <>
          <p style={{ color: "#a66" }}>Stripe onboarding started but not finished — verification, trade license, or bank details may still be needed.</p>
          <form action={connectStripe}><button type="submit">Continue Stripe setup</button></form>
        </>
      ) : (
        <>
          <p style={{ color: "#666" }}>Connect Stripe to start accepting payments. You'll need a valid UAE trade license to complete onboarding — Stripe's UAE Connect configuration doesn't currently support unlicensed individuals.</p>
          <form action={connectStripe}><button type="submit">Connect Stripe</button></form>
        </>
      )}
    </main>
  );
}
