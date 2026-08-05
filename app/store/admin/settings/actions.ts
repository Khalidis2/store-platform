"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { getOwnedStore } from "@/lib/get-store";
import { stripe } from "@/lib/stripe";
import { getBaseUrl } from "@/lib/get-base-url";

export async function updateStoreProfile(formData: FormData) {
  // Re-checked here, not just in the layout — Server Actions are directly
  // invocable and aren't protected by whatever layout wraps the page they
  // were imported from.
  const store = await getOwnedStore();
  if (!store) throw new Error("Not authorized");

  const name = String(formData.get("name") || "").trim();
  if (!name) throw new Error("Name is required");

  const logoUrl = String(formData.get("logoUrl") || "").trim() || null;
  const tagline = String(formData.get("tagline") || "").trim() || null;

  const accentColorRaw = String(formData.get("accentColor") || "").trim();
  if (accentColorRaw && !/^#[0-9a-fA-F]{6}$/.test(accentColorRaw)) {
    throw new Error("Accent color must be a hex value like #4f46e5");
  }
  const accentColor = accentColorRaw || null;

  await db.query(
    "update stores set name = $1, logo_url = $2, accent_color = $3, tagline = $4 where id = $5",
    [name, logoUrl, accentColor, tagline, store.id]
  );

  revalidatePath("/admin/settings");
}

export async function connectStripe() {
  const store = await getOwnedStore();
  if (!store) throw new Error("Not authorized");

  let accountId = store.stripe_account_id;

  if (!accountId) {
    // business_type is intentionally left unset — Stripe's hosted onboarding
    // form collects it (sole establishment, free zone LLC, etc.) along with
    // the UAE trade license, rather than us guessing it here.
    const account = await stripe.accounts.create({
      type: "custom",
      country: "AE",
      capabilities: {
        transfers: { requested: true },
      },
    });
    accountId = account.id;
    await db.query("update stores set stripe_account_id = $1 where id = $2", [accountId, store.id]);
  }

  const baseUrl = await getBaseUrl();
  const accountLink = await stripe.accountLinks.create({
    account: accountId,
    refresh_url: `${baseUrl}/admin/settings`,
    return_url: `${baseUrl}/admin/settings`,
    type: "account_onboarding",
  });

  redirect(accountLink.url);
}
