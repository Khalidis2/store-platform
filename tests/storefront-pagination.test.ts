import fs from "fs";
import path from "path";
import { describe, expect, it } from "vitest";
import {
  STOREFRONT_PAGE_SIZE,
  getStorefrontSortSql,
  parseStorefrontPage,
  parseStorefrontSort,
  storefrontPageHref,
} from "@/lib/storefront-catalog";

describe("storefront catalog controls", () => {
  it("uses 24 products per page", () => {
    expect(STOREFRONT_PAGE_SIZE).toBe(24);
  });

  it("normalizes invalid page and sort values", () => {
    expect(parseStorefrontPage(undefined)).toBe(1);
    expect(parseStorefrontPage("0")).toBe(1);
    expect(parseStorefrontPage("abc")).toBe(1);
    expect(parseStorefrontPage("3")).toBe(3);
    expect(parseStorefrontSort("price-asc")).toBe("price-asc");
    expect(parseStorefrontSort("price-desc")).toBe("price-desc");
    expect(parseStorefrontSort("drop table products")).toBe("newest");
  });

  it("maps only known sort modes to SQL", () => {
    expect(getStorefrontSortSql("newest")).toBe("created_at desc");
    expect(getStorefrontSortSql("price-asc")).toContain("price_cents asc");
    expect(getStorefrontSortSql("price-desc")).toContain("price_cents desc");
  });

  it("preserves filters while paging", () => {
    expect(
      storefrontPageHref({ q: "coffee", category: "Gear", sort: "price-asc", page: 2 })
    ).toBe("/?q=coffee&category=Gear&sort=price-asc&page=2");
  });
});

describe("storefront lifecycle visibility", () => {
  it("limits the grid and detail page to active stores and products", () => {
    const root = path.resolve(__dirname, "..");
    const storefront = fs.readFileSync(path.join(root, "app/store/(shop)/page.tsx"), "utf8");
    const detail = fs.readFileSync(path.join(root, "app/store/(shop)/products/[id]/page.tsx"), "utf8");

    expect(storefront).toContain('store.status !== "active"');
    expect(storefront).toContain("status = 'active'");
    expect(detail).toContain('store.status !== "active"');
    expect(detail).toContain("status = 'active'");
  });
});
