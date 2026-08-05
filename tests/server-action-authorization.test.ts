import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import path from "path";

/**
 * Regression test for the cross-tenant Server Action authorization bypass
 * (see ARCHITECTURE.md, "getCurrentStore() vs getOwnedStore()"). Next.js
 * Server Actions are directly invocable HTTP endpoints — the layout.tsx
 * ownership check that protects a normal page render does *not* run
 * before one executes. Every store-admin action must independently
 * re-verify ownership via getOwnedStore() (or getPlatformAdminUser() for
 * platform-admin actions), never the unchecked getCurrentStore().
 *
 * This is a static source check, not a runtime one, deliberately: Next.js
 * Server Action IDs are content-hashed per build, so there's no stable
 * endpoint to hit directly in a test the way an attacker would hit a
 * built app. Asserting the *pattern* is present is what's actually
 * maintainable here — see the exploit writeup in the PR that introduced
 * getOwnedStore() for how this was verified live, once, by hand.
 */

const root = path.resolve(__dirname, "..");

function read(relativePath: string) {
  return readFileSync(path.join(root, relativePath), "utf8");
}

function exportedActionNames(source: string): string[] {
  return [...source.matchAll(/export\s+async\s+function\s+(\w+)/g)].map((m) => m[1]);
}

describe("store-admin Server Action authorization", () => {
  const storeAdminActionFiles = [
    "app/store/admin/settings/actions.ts",
    "app/store/admin/orders/actions.ts",
    "app/store/admin/products/actions.ts",
  ];

  it.each(storeAdminActionFiles)("%s: every exported action calls getOwnedStore()", (file) => {
    const source = read(file);
    expect(source).toContain('"use server"');

    const actionNames = exportedActionNames(source);
    expect(actionNames.length).toBeGreaterThan(0);

    // Split on each export boundary so a violation in one function can't
    // hide behind a correct call in another function in the same file.
    // The leading chunk (imports, before the first export) is discarded.
    const bodies = source
      .split(/(?=export\s+async\s+function)/g)
      .filter((b) => /^export\s+async\s+function/.test(b));
    expect(bodies).toHaveLength(actionNames.length);

    for (const body of bodies) {
      expect(body).toContain("getOwnedStore()");
    }
  });

  it("store-admin action files never call the unchecked getCurrentStore()", () => {
    for (const file of storeAdminActionFiles) {
      const source = read(file);
      expect(source).not.toMatch(/[^.]getCurrentStore\(\)/);
    }
  });

  it("platform-admin actions re-check getPlatformAdminUser() independently", () => {
    const source = read("app/platform-admin/(dashboard)/actions.ts");
    expect(source).toContain('"use server"');
    expect(exportedActionNames(source).length).toBeGreaterThan(0);
    expect(source).toContain("getPlatformAdminUser()");
  });
});
