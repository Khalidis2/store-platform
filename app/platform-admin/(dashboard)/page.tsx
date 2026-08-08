import { db } from "@/lib/db";
import { setPlatformStoreStatus, updateStoreFee } from "./actions";

const DEFAULT_FEE_PERCENT = 5;

type Store = {
  id: string;
  name: string;
  subdomain: string;
  is_live: boolean;
  status: "draft" | "active" | "suspended" | "closed";
  platform_fee_percent: number | null;
};

export default async function PlatformAdminHome() {
  const { rows: stores } = await db.query<Store>(
    "select id, name, subdomain, is_live, status, platform_fee_percent from stores order by created_at desc"
  );

  return (
    <main>
      <h1>Stores</h1>
      <p style={{ color: "#666" }}>
        Blank fee defaults to {DEFAULT_FEE_PERCENT}%. Suspended and closed stores cannot accept storefront orders.
      </p>
      <table cellPadding={8} style={{ borderCollapse: "collapse", width: "100%", marginTop: "1rem" }}>
        <thead>
          <tr style={{ textAlign: "left", borderBottom: "1px solid #ddd" }}>
            <th>Store</th>
            <th>Subdomain</th>
            <th>Status</th>
            <th>Stripe ready</th>
            <th>Fee %</th>
            <th>Lifecycle</th>
          </tr>
        </thead>
        <tbody>
          {stores.map((s) => (
            <tr key={s.id} style={{ borderBottom: "1px solid #eee" }}>
              <td>{s.name}</td>
              <td>{s.subdomain}</td>
              <td><strong>{s.status}</strong></td>
              <td>{s.is_live ? "Yes" : "No"}</td>
              <td>
                <form action={updateStoreFee} style={{ display: "flex", gap: "0.5rem" }}>
                  <input type="hidden" name="storeId" value={s.id} />
                  <input
                    name="feePercent"
                    type="number"
                    step="0.1"
                    min="0"
                    max="100"
                    placeholder={String(DEFAULT_FEE_PERCENT)}
                    defaultValue={s.platform_fee_percent ?? ""}
                    style={{ width: 70 }}
                  />
                  <button type="submit">Save</button>
                </form>
              </td>
              <td>
                {s.status === "suspended" || s.status === "closed" ? (
                  <form action={setPlatformStoreStatus}>
                    <input type="hidden" name="storeId" value={s.id} />
                    <input type="hidden" name="status" value="draft" />
                    <button type="submit">Reopen as draft</button>
                  </form>
                ) : (
                  <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                    <form action={setPlatformStoreStatus}>
                      <input type="hidden" name="storeId" value={s.id} />
                      <input type="hidden" name="status" value="suspended" />
                      <button type="submit">Suspend</button>
                    </form>
                    <form action={setPlatformStoreStatus}>
                      <input type="hidden" name="storeId" value={s.id} />
                      <input type="hidden" name="status" value="closed" />
                      <button type="submit">Close</button>
                    </form>
                  </div>
                )}
              </td>
            </tr>
          ))}
          {stores.length === 0 && (
            <tr>
              <td colSpan={6} style={{ color: "#666" }}>
                No stores yet.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </main>
  );
}
