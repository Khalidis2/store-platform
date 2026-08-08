import { getCurrentStore } from "@/lib/get-store";
import { updateStoreProfile, updateShippingSettings, updateContactAndPolicies, connectStripe } from "./actions";
import { setStoreStatus } from "./lifecycle-actions";

export default async function SettingsPage() {
  const store = await getCurrentStore();
  if (!store) return null;
  const canMerchantToggle = store.status === "draft" || store.status === "active";
  const fieldStyle = { display: "block", width: "100%" } as const;

  return (
    <main>
      <h1>Store settings</h1>
      <section id="store-status" style={{ margin: "1rem 0 2rem" }}>
        <h2>Store status</h2>
        <p>Current status: <strong>{store.status}</strong></p>
        {store.status === "suspended" ? <p style={{ color: "crimson" }}>This store has been suspended by the platform owner.</p> : store.status === "closed" ? <p style={{ color: "#666" }}>This store is closed. Contact the platform owner to reopen it.</p> : (
          <form action={setStoreStatus}>
            <input type="hidden" name="status" value={store.status === "active" ? "draft" : "active"} />
            <button type="submit" disabled={!canMerchantToggle}>{store.status === "active" ? "Unpublish store" : "Publish store"}</button>
            {store.status === "draft" && <span style={{ marginLeft: "0.5rem", color: "#666" }}>Complete Store setup before publishing.</span>}
          </form>
        )}
      </section>

      <form id="branding" action={updateStoreProfile} style={{ display: "flex", flexDirection: "column", gap: "0.75rem", maxWidth: 520 }}>
        <h2>Branding</h2>
        <label>Store name<input name="name" defaultValue={store.name} required style={fieldStyle} /></label>
        <label>Order notification email<input name="notificationEmail" type="email" defaultValue={store.notification_email ?? ""} placeholder="orders@example.com" style={fieldStyle} /></label>
        <label>Logo (optional){store.logo_url && <div style={{ margin: "0.25rem 0" }}><img src={store.logo_url} alt="Current logo" style={{ height: 40 }} /></div>}<input type="file" name="logo" accept="image/jpeg,image/png,image/webp,image/gif" style={fieldStyle} /></label>
        <label>Tagline (optional)<input name="tagline" defaultValue={store.tagline ?? ""} style={fieldStyle} /></label>
        <label>Accent color<input type="color" name="accentColor" defaultValue={store.accent_color ?? "#111111"} /></label>
        <button type="submit" style={{ alignSelf: "start" }}>Save branding</button>
      </form>

      <section id="shipping" style={{ marginTop: "2rem" }}>
        <h2>UAE delivery</h2>
        <form action={updateShippingSettings} style={{ display: "flex", flexDirection: "column", gap: "0.75rem", maxWidth: 520 }}>
          <label>Flat delivery fee (AED)<input name="shippingFlat" type="number" min="0" step="0.01" defaultValue={(store.shipping_flat_cents / 100).toFixed(2)} required style={fieldStyle} /></label>
          <label>Free delivery from (AED, optional)<input name="freeShippingThreshold" type="number" min="0.01" step="0.01" defaultValue={store.free_shipping_threshold_cents === null ? "" : (store.free_shipping_threshold_cents / 100).toFixed(2)} style={fieldStyle} /></label>
          <button type="submit" style={{ alignSelf: "start" }}>Save delivery settings</button>
        </form>
      </section>

      <section id="policies" style={{ marginTop: "2rem" }}>
        <h2>Contact & policies</h2>
        <p style={{ color: "#666", maxWidth: 720 }}>Publish your own business contact details and policies. The platform does not generate legal terms for your business.</p>
        <form action={updateContactAndPolicies} style={{ display: "flex", flexDirection: "column", gap: "0.75rem", maxWidth: 720 }}>
          <label>Public contact email<input name="contactEmail" type="email" defaultValue={store.contact_email ?? ""} style={fieldStyle} /></label>
          <label>Public contact phone<input name="contactPhone" defaultValue={store.contact_phone ?? ""} style={fieldStyle} /></label>
          <label>Shipping policy<textarea name="shippingPolicy" rows={8} maxLength={20000} defaultValue={store.shipping_policy ?? ""} style={fieldStyle} /></label>
          <label>Returns & refund policy<textarea name="returnsPolicy" rows={8} maxLength={20000} defaultValue={store.returns_policy ?? ""} style={fieldStyle} /></label>
          <label>Privacy policy<textarea name="privacyPolicy" rows={8} maxLength={20000} defaultValue={store.privacy_policy ?? ""} style={fieldStyle} /></label>
          <label>Terms & conditions<textarea name="termsPolicy" rows={8} maxLength={20000} defaultValue={store.terms_policy ?? ""} style={fieldStyle} /></label>
          <button type="submit" style={{ alignSelf: "start" }}>Save contact & policies</button>
        </form>
      </section>

      <section id="payments" style={{ marginTop: "2rem" }}>
        <h2>Payments</h2>
        {store.is_live ? <p style={{ color: "#2a2" }}>Stripe connected — this store can accept payments once published.</p> : store.stripe_account_id ? <><p style={{ color: "#a66" }}>Stripe onboarding started but not finished.</p><form action={connectStripe}><button type="submit">Continue Stripe setup</button></form></> : <><p style={{ color: "#666" }}>Connect Stripe to start accepting payments.</p><form action={connectStripe}><button type="submit">Connect Stripe</button></form></>}
      </section>
    </main>
  );
}
