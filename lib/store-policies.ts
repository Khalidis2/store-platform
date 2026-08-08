import type { Store } from "./get-store";

export const POLICY_DEFINITIONS = {
  shipping: { title: "Shipping policy", field: "shipping_policy" },
  returns: { title: "Returns & refunds", field: "returns_policy" },
  privacy: { title: "Privacy policy", field: "privacy_policy" },
  terms: { title: "Terms & conditions", field: "terms_policy" },
} as const;

export type PolicySlug = keyof typeof POLICY_DEFINITIONS;

export function isPolicySlug(value: string): value is PolicySlug {
  return value in POLICY_DEFINITIONS;
}

export function getPolicyContent(store: Store, slug: PolicySlug) {
  const definition = POLICY_DEFINITIONS[slug];
  return {
    title: definition.title,
    content: store[definition.field],
  };
}
