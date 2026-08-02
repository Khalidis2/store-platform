"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { getCurrentStore } from "@/lib/get-store";
import { stripe } from "@/lib/stripe";
import { getBaseUrl } from "@/lib/get-base-url";

export async function updateStoreName(formData: FormData) {
  const store = await getCurrentStore();
  if (!store) throw new Error("No store context");

  const name = String(formData.get("name") || "").trim();
  if (!name) throw new Error("Name is required");

  await db.query("update stores set name = $1 where id = $2", [name, store.id]);

  revalidatePath("/admin/settings");
}

export async function connectStripe() {
  const store = await getCurrentStore();
  if (!store) throw new Error("No store context");

  let accountId = store.stripe_account_id;

  if (!accountId) {
    // business_type is intentionally left unset — Stripe's hosted onboarding
    // form collects it (sole establishment, free zone LLC, etc.) along with
    // the UAE trade license, rather than us guessing it here.
    const account = await stripe.accounts.create({
      type: "custom",
      country: "AE",
      capabilities: {
        card_payments: { requested: true },
        transfers: { requested: true },
      },
    });
    accountId = account.id;
    await db.query("update stores set stripe_account_id = $1 where id = $2", [accountId, store.id]);
  }

  const baseUrl = getBaseUrl();
  const accountLink = await stripe.accountLinks.create({
    account: accountId,
    refresh_url: `${baseUrl}/admin/settings`,
    return_url: `${baseUrl}/admin/settings`,
    type: "account_onboarding",
  });

  redirect(accountLink.url);
}
