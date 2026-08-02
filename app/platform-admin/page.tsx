import { db } from "@/lib/db";
import { updateStoreFee } from "./actions";

const DEFAULT_FEE_PERCENT = 5;

type Store = {
  id: string;
  name: string;
  subdomain: string;
  is_live: boolean;
  platform_fee_percent: number | null;
};

export default async function PlatformAdminHome() {
  const { rows: stores } = await db.query<Store>(
    "select id, name, subdomain, is_live, platform_fee_percent from stores order by created_at desc"
  );

  return (
    <main>
      <h1>Stores</h1>
      <p style={{ color: "#666" }}>
        Blank fee defaults to {DEFAULT_FEE_PERCENT}% (set in{" "}
        <code>app/store/api/checkout/pay/route.ts</code>).
      </p>
      <table cellPadding={8} style={{ borderCollapse: "collapse", width: "100%", marginTop: "1rem" }}>
        <thead>
          <tr style={{ textAlign: "left", borderBottom: "1px solid #ddd" }}>
            <th>Store</th>
            <th>Subdomain</th>
            <th>Live</th>
            <th>Fee %</th>
          </tr>
        </thead>
        <tbody>
          {stores.map((s) => (
            <tr key={s.id} style={{ borderBottom: "1px solid #eee" }}>
              <td>{s.name}</td>
              <td>{s.subdomain}</td>
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
            </tr>
          ))}
          {stores.length === 0 && (
            <tr>
              <td colSpan={4} style={{ color: "#666" }}>
                No stores yet.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </main>
  );
}
