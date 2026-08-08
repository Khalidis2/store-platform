"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { getOwnedStore } from "@/lib/get-store";
import { stripe } from "@/lib/stripe";
import { getBaseUrl } from "@/lib/get-base-url";
import { uploadImage } from "@/lib/upload-image";

function moneyInputToCents(value: FormDataEntryValue | null, options: { optional?: boolean } = {}) {
  const raw = String(value ?? "").trim();
  if (!raw && options.optional) return null;
  const amount = Number(raw);
  if (!Number.isFinite(amount) || amount < 0) throw new Error("Enter a valid AED amount");
  const cents = Math.round(amount * 100);
  if (!Number.isSafeInteger(cents)) throw new Error("AED amount is too large");
  return cents;
}

function optionalText(value: FormDataEntryValue | null, maxLength: number) {
  const text = String(value ?? "").trim();
  if (!text) return null;
  if (text.length > maxLength) throw new Error(`Text must be ${maxLength} characters or fewer`);
  return text;
}

function revalidateSetup() {
  revalidatePath("/admin");
  revalidatePath("/admin/onboarding");
  revalidatePath("/admin/settings");
}

export async function updateStoreProfile(formData: FormData) {
  const store = await getOwnedStore();
  if (!store) throw new Error("Not authorized");
  const name = String(formData.get("name") || "").trim();
  if (!name) throw new Error("Name is required");
  const tagline = String(formData.get("tagline") || "").trim() || null;
  const notificationEmail = String(formData.get("notificationEmail") || "").trim() || null;
  if (notificationEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(notificationEmail)) throw new Error("Enter a valid notification email");
  const accentColorRaw = String(formData.get("accentColor") || "").trim();
  if (accentColorRaw && !/^#[0-9a-fA-F]{6}$/.test(accentColorRaw)) throw new Error("Accent color must be a hex value like #4f46e5");
  const accentColor = accentColorRaw || null;
  const logoFile = formData.get("logo");
  let logoUrl = store.logo_url;
  if (logoFile instanceof File && logoFile.size > 0) logoUrl = await uploadImage(logoFile, `${store.id}/logo`);
  await db.query("update stores set name = $1, logo_url = $2, accent_color = $3, tagline = $4, notification_email = $5, branding_configured = true where id = $6", [name, logoUrl, accentColor, tagline, notificationEmail, store.id]);
  revalidateSetup();
}

export async function updateShippingSettings(formData: FormData) {
  const store = await getOwnedStore();
  if (!store) throw new Error("Not authorized");
  const flatShippingCents = moneyInputToCents(formData.get("shippingFlat"));
  const freeShippingThresholdCents = moneyInputToCents(formData.get("freeShippingThreshold"), { optional: true });
  if (freeShippingThresholdCents === 0) throw new Error("Free shipping threshold must be greater than AED 0.00 or left blank");
  await db.query("update stores set shipping_flat_cents = $1, free_shipping_threshold_cents = $2, shipping_configured = true where id = $3", [flatShippingCents, freeShippingThresholdCents, store.id]);
  revalidateSetup();
}

export async function updateContactAndPolicies(formData: FormData) {
  const store = await getOwnedStore();
  if (!store) throw new Error("Not authorized");
  const contactEmail = optionalText(formData.get("contactEmail"), 320);
  if (contactEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactEmail)) throw new Error("Enter a valid contact email");
  const contactPhone = optionalText(formData.get("contactPhone"), 40);
  const shippingPolicy = optionalText(formData.get("shippingPolicy"), 20000);
  const returnsPolicy = optionalText(formData.get("returnsPolicy"), 20000);
  const privacyPolicy = optionalText(formData.get("privacyPolicy"), 20000);
  const termsPolicy = optionalText(formData.get("termsPolicy"), 20000);
  await db.query(`update stores set contact_email = $1, contact_phone = $2, shipping_policy = $3, returns_policy = $4, privacy_policy = $5, terms_policy = $6 where id = $7`, [contactEmail, contactPhone, shippingPolicy, returnsPolicy, privacyPolicy, termsPolicy, store.id]);
  revalidateSetup();
  revalidatePath("/contact");
  revalidatePath("/policies/shipping");
  revalidatePath("/policies/returns");
  revalidatePath("/policies/privacy");
  revalidatePath("/policies/terms");
}

export async function connectStripe() {
  const store = await getOwnedStore();
  if (!store) throw new Error("Not authorized");
  let accountId = store.stripe_account_id;
  if (!accountId) {
    const account = await stripe.accounts.create({ type: "custom", country: "AE", capabilities: { transfers: { requested: true } } });
    accountId = account.id;
    await db.query("update stores set stripe_account_id = $1 where id = $2", [accountId, store.id]);
  }
  const baseUrl = await getBaseUrl();
  const accountLink = await stripe.accountLinks.create({ account: accountId, refresh_url: `${baseUrl}/admin/settings`, return_url: `${baseUrl}/admin/settings`, type: "account_onboarding" });
  redirect(accountLink.url);
}
