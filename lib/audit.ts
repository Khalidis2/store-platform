import { db } from "./db";

/**
 * Records a "who did what, when" entry for the highest-stakes actions
 * only (refunds, product deletion, platform-admin fee changes) — not
 * every mutation, that'd bury the entries worth actually reviewing.
 * store_id is always the *affected* store, even for a platform-admin
 * actor who doesn't own it — a merchant should be able to see when a
 * platform admin touched their store, not just their own actions.
 */
export async function logAction(params: {
  storeId: string;
  actorUserId: string;
  actorRole: "merchant" | "platform_admin";
  action: string;
  targetType?: string;
  targetId?: string;
  metadata?: Record<string, unknown>;
}) {
  await db.query(
    `insert into audit_log (store_id, actor_user_id, actor_role, action, target_type, target_id, metadata)
     values ($1, $2, $3, $4, $5, $6, $7)`,
    [
      params.storeId,
      params.actorUserId,
      params.actorRole,
      params.action,
      params.targetType ?? null,
      params.targetId ?? null,
      JSON.stringify(params.metadata ?? {}),
    ]
  );
}
