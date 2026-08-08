import { getCurrentStore } from "@/lib/get-store";
import { db } from "@/lib/db";

type AuditEntry = {
  id: string;
  actor_role: "merchant" | "platform_admin";
  action: string;
  target_type: string | null;
  target_id: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
};

const ACTION_LABELS: Record<string, string> = {
  refund: "Refunded an order",
  delete_product: "Deleted a product",
  update_fee: "Changed the platform fee",
  suspend_store: "Suspended the store",
  close_store: "Closed the store",
  reopen_store: "Reopened the store",
};

function describeMetadata(action: string, metadata: Record<string, unknown>): string {
  if (action === "refund") {
    return `AED ${(Number(metadata.amountCents) / 100).toFixed(2)} (order total refunded so far: AED ${(Number(metadata.cumulativeRefundedCents) / 100).toFixed(2)})`;
  }
  if (action === "delete_product") return String(metadata.name ?? "");
  if (action === "update_fee") {
    const oldFee = metadata.oldFeePercent == null ? "platform default" : `${metadata.oldFeePercent}%`;
    const newFee = metadata.newFeePercent == null ? "platform default" : `${metadata.newFeePercent}%`;
    return `${oldFee} → ${newFee}`;
  }
  if (["suspend_store", "close_store", "reopen_store"].includes(action)) {
    return `${String(metadata.oldStatus ?? "unknown")} → ${String(metadata.newStatus ?? "unknown")}`;
  }
  return JSON.stringify(metadata);
}

export default async function AuditLogPage() {
  const store = await getCurrentStore();
  if (!store) return null;

  const { rows: entries } = await db.query<AuditEntry>(
    `select id, actor_role, action, target_type, target_id, metadata, created_at
     from audit_log where store_id = $1 order by created_at desc limit 100`,
    [store.id]
  );

  return (
    <main>
      <h1>Activity log</h1>
      <p style={{ color: "#666" }}>
        High-impact merchant and platform-owner actions on this store, including refunds, product deletion, fee changes, and lifecycle restrictions.
      </p>
      <table cellPadding={8} style={{ borderCollapse: "collapse", width: "100%", marginTop: "1rem" }}>
        <thead><tr style={{ textAlign: "left", borderBottom: "1px solid #ddd" }}><th>When</th><th>Who</th><th>Action</th><th>Details</th></tr></thead>
        <tbody>
          {entries.map((e) => (
            <tr key={e.id} style={{ borderBottom: "1px solid #eee" }}>
              <td style={{ whiteSpace: "nowrap", color: "#666", fontSize: "0.9rem" }}>{new Date(e.created_at).toLocaleString()}</td>
              <td>{e.actor_role === "platform_admin" ? "Platform admin" : "You"}</td>
              <td>{ACTION_LABELS[e.action] ?? e.action}</td>
              <td>{describeMetadata(e.action, e.metadata)}</td>
            </tr>
          ))}
          {entries.length === 0 && <tr><td colSpan={4} style={{ color: "#666" }}>No activity recorded yet.</td></tr>}
        </tbody>
      </table>
    </main>
  );
}
