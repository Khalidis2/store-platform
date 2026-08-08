import type { Store } from "./get-store";

export type MerchantOnboardingStep = {
  key: "branding" | "shipping" | "policies" | "payments" | "product" | "publish";
  title: string;
  description: string;
  href: string;
  complete: boolean;
};

export function hasRequiredPolicies(store: Store) {
  return Boolean(
    store.contact_email &&
      store.shipping_policy &&
      store.returns_policy &&
      store.privacy_policy &&
      store.terms_policy
  );
}

export function buildMerchantOnboarding(store: Store, activeProductCount: number): MerchantOnboardingStep[] {
  return [
    {
      key: "branding",
      title: "Review store branding",
      description: "Confirm your store name, notification email, logo, tagline, and accent color.",
      href: "/admin/settings#branding",
      complete: store.branding_configured,
    },
    {
      key: "shipping",
      title: "Configure UAE delivery",
      description: "Save your flat delivery fee and optional free-delivery threshold.",
      href: "/admin/settings#shipping",
      complete: store.shipping_configured,
    },
    {
      key: "policies",
      title: "Add contact and policies",
      description: "Publish contact details plus shipping, returns, privacy, and terms policies.",
      href: "/admin/settings#policies",
      complete: hasRequiredPolicies(store),
    },
    {
      key: "payments",
      title: "Connect Stripe",
      description: "Finish Stripe onboarding so the store can accept AED payments.",
      href: "/admin/settings#payments",
      complete: store.is_live,
    },
    {
      key: "product",
      title: "Publish your first product",
      description: "Create at least one product and set its lifecycle status to active.",
      href: "/admin/products",
      complete: activeProductCount > 0,
    },
    {
      key: "publish",
      title: "Publish your store",
      description: "Make the storefront public after every required setup step is complete.",
      href: "/admin/settings#store-status",
      complete: store.status === "active",
    },
  ];
}

export function isStoreReadyToPublish(store: Store, activeProductCount: number) {
  const setupSteps = buildMerchantOnboarding(store, activeProductCount).filter((step) => step.key !== "publish");
  return setupSteps.every((step) => step.complete);
}
