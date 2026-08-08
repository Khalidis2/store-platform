import { describe, expect, it } from "vitest";
import { getPolicyContent, isPolicySlug } from "@/lib/store-policies";

const store = {
  shipping_policy: "Ships across the UAE.",
  returns_policy: "Returns within 7 days.",
  privacy_policy: "Privacy text.",
  terms_policy: "Terms text.",
} as any;

describe("store policies", () => {
  it("recognizes only supported policy slugs", () => {
    expect(isPolicySlug("shipping")).toBe(true);
    expect(isPolicySlug("returns")).toBe(true);
    expect(isPolicySlug("privacy")).toBe(true);
    expect(isPolicySlug("terms")).toBe(true);
    expect(isPolicySlug("admin")).toBe(false);
  });

  it("maps public policy routes to the correct merchant content", () => {
    expect(getPolicyContent(store, "shipping").content).toBe("Ships across the UAE.");
    expect(getPolicyContent(store, "returns").title).toBe("Returns & refunds");
  });
});
