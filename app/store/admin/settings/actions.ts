"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { getOwnedStore } from "@/lib/get-store";
import { stripe } from "@/lib/stripe";
import { getBaseUrl } from "@/lib/get-base-url";
import { uploadImage } from "@/lib/upload-image";

export async function updateStoreProfile(formData: FormData) {
  const store = await getOwnedStore();
  if (!store) throw new Error("Not authorized");

  const name = String(formData.get("name") || "").trim();
  if (!name) throw new Error("Name is required");

  const tagline = String(formData.get("tagline") || "").trim() || null;
  const notificationEmail = String(formData.get("notificationEmail") || "").trim() || null;
  if (notificationEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(notificationEmail)) {
    throw new Error("Enter a valid notification email");
  }

  const accentColorRaw = String(formData.get("accentColor") || "").trim();
  if (accentColorRaw && !/^#[0-9a-fA-F]{6}$/.test(accentColorRaw)) {
    throw new Error("Accent color must be a hex value like #4f46e5");
  }
  const accentColor = accentColorRaw || null;

  const logoFile = formData.get("logo");
  let logoUrl = store.logo_url;
  if (logoFile instanceof File && logoFile.size > 0) {
    logoUrl = await uploadImage(logoFile, `${store.id}/logo`);
  }

  await db.query(
    "update stores set name = $1, logo_url = $2, accent_color = $3, tagline = $4, notification_email = $5 where id = $6",
    [name, logoUrl, accentColor, tagline, notificationEmail, store.id]
  );

  revalidatePath("/admin/settings");
}

export async function connectStripe() {
  const store = await getOwnedStore();
  if (!store) throw new Error("Not authorized");

  let accountId = store.stripe_account_id;

  if (!accountId) {
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
