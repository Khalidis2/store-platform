import { describe, expect, it } from "vitest";
import { buildMerchantOnboarding, isStoreReadyToPublish } from "@/lib/merchant-onboarding";
import type { Store } from "@/lib/get-store";

function store(overrides: Partial<Store> = {}): Store {
  return {
    id: "00000000-0000-4000-8000-000000000001",
    subdomain: "demo",
    name: "Demo",
    owner_user_id: "00000000-0000-4000-8000-000000000002",
    stripe_account_id: "acct_test",
    is_live: true,
    status: "draft",
    platform_fee_percent: null,
    logo_url: null,
    accent_color: null,
    tagline: null,
    notification_email: "orders@example.com",
    branding_configured: true,
    shipping_flat_cents: 0,
    free_shipping_threshold_cents: null,
    shipping_configured: true,
    contact_email: "support@example.com",
    contact_phone: null,
    shipping_policy: "Shipping policy",
    returns_policy: "Returns policy",
    privacy_policy: "Privacy policy",
    terms_policy: "Terms policy",
    created_at: new Date().toISOString(),
    ...overrides,
  };
}

describe("merchant onboarding", () => {
  it("requires all pre-publish setup steps", () => {
    const steps = buildMerchantOnboarding(store(), 1);
    expect(steps.filter((step) => step.key !== "publish").every((step) => step.complete)).toBe(true);
    expect(isStoreReadyToPublish(store(), 1)).toBe(true);
  });

  it("treats zero-cost delivery as configured only after an explicit save", () => {
    expect(isStoreReadyToPublish(store({ shipping_configured: false }), 1)).toBe(false);
  });

  it("requires complete policy content and an active product", () => {
    expect(isStoreReadyToPublish(store({ privacy_policy: null }), 1)).toBe(false);
    expect(isStoreReadyToPublish(store(), 0)).toBe(false);
  });

  it("tracks final store publication separately from setup readiness", () => {
    const draft = buildMerchantOnboarding(store({ status: "draft" }), 1);
    const active = buildMerchantOnboarding(store({ status: "active" }), 1);
    expect(draft.find((step) => step.key === "publish")?.complete).toBe(false);
    expect(active.find((step) => step.key === "publish")?.complete).toBe(true);
  });
});
