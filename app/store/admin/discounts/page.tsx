import { db } from "@/lib/db";
import { getCurrentStore } from "@/lib/get-store";
import { createDiscount, setDiscountActive } from "./actions";

type Discount = {
  id: string;
  code: string;
  discount_type: "percent" | "fixed";
  discount_value: number;
  starts_at: Date | null;
  ends_at: Date | null;
  max_redemptions: number | null;
  is_active: boolean;
  redeemed_count: string;
  reserved_count: string;
};

function valueLabel(discount: Discount) {
  return discount.discount_type === "percent"
    ? `${discount.discount_value}%`
    : `AED ${(discount.discount_value / 100).toFixed(2)}`;
}

export default async function DiscountsPage() {
  const store = await getCurrentStore();
  if (!store) return null;

  const { rows: discounts } = await db.query<Discount>(
    `select d.*,
            count(r.id) filter (where r.status = 'redeemed')::text as redeemed_count,
            count(r.id) filter (where r.status = 'reserved')::text as reserved_count
       from discounts d
       left join discount_redemptions r on r.discount_id = d.id
      where d.store_id = $1
      group by d.id
      order by d.created_at desc`,
    [store.id]
  );

  return (
    <main>
      <h1>Discount codes</h1>
      <p style={{ color: "#666", maxWidth: 720 }}>
        Codes apply to merchandise subtotal. Delivery is calculated separately. Validity times below use UAE time.
      </p>

      <form action={createDiscount} style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", alignItems: "end", margin: "1.5rem 0" }}>
        <label>Code<input name="code" placeholder="WELCOME10" required style={{ display: "block" }} /></label>
        <label>Type<select name="discountType" defaultValue="percent" style={{ display: "block" }}><option value="percent">Percent</option><option value="fixed">Fixed AED</option></select></label>
        <label>Value<input name="value" type="number" min="0.01" step="0.01" required style={{ display: "block", width: 100 }} /></label>
        <label>Starts (optional)<input name="startsAt" type="datetime-local" style={{ display: "block" }} /></label>
        <label>Ends (optional)<input name="endsAt" type="datetime-local" style={{ display: "block" }} /></label>
        <label>Usage limit<input name="maxRedemptions" type="number" min="1" step="1" placeholder="Unlimited" style={{ display: "block", width: 110 }} /></label>
        <button type="submit">Create code</button>
      </form>

      <table cellPadding={8} style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead><tr style={{ textAlign: "left", borderBottom: "1px solid #ddd" }}><th>Code</th><th>Discount</th><th>Window</th><th>Uses</th><th>Status</th><th></th></tr></thead>
        <tbody>
          {discounts.map((d) => (
            <tr key={d.id} style={{ borderBottom: "1px solid #eee" }}>
              <td><strong>{d.code}</strong></td>
              <td>{valueLabel(d)}</td>
              <td style={{ color: "#666", fontSize: "0.9rem" }}>{d.starts_at ? new Date(d.starts_at).toLocaleString("en-AE", { timeZone: "Asia/Dubai" }) : "Now"} → {d.ends_at ? new Date(d.ends_at).toLocaleString("en-AE", { timeZone: "Asia/Dubai" }) : "No expiry"}</td>
              <td>{d.redeemed_count}{d.max_redemptions ? ` / ${d.max_redemptions}` : ""}{Number(d.reserved_count) > 0 ? ` (+${d.reserved_count} reserved)` : ""}</td>
              <td>{d.is_active ? "Active" : "Disabled"}</td>
              <td><form action={setDiscountActive}><input type="hidden" name="discountId" value={d.id} /><input type="hidden" name="isActive" value={d.is_active ? "false" : "true"} /><button type="submit">{d.is_active ? "Disable" : "Enable"}</button></form></td>
            </tr>
          ))}
          {discounts.length === 0 && <tr><td colSpan={6} style={{ color: "#666" }}>No discount codes yet.</td></tr>}
        </tbody>
      </table>
    </main>
  );
}
