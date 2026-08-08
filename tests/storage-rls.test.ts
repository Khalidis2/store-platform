import { describe, expect, it } from "vitest";
import fs from "fs";
import path from "path";

const migration = fs.readFileSync(
  path.resolve(__dirname, "../migrations/019_phase24_storage_rls_hardening.sql"),
  "utf8"
);

describe("store-images Storage RLS", () => {
  it("removes the old bucket-wide authenticated write policies", () => {
    expect(migration).toContain('drop policy if exists "store-images: authenticated insert"');
    expect(migration).toContain('drop policy if exists "store-images: authenticated update"');
    expect(migration).toContain('drop policy if exists "store-images: authenticated delete"');
  });

  it("requires the first object folder to be a store owned by auth.uid()", () => {
    const ownershipCheck = "stores.id::text = (storage.foldername(name))[1]";
    const userCheck = "stores.owner_user_id = auth.uid()";

    expect(migration.match(new RegExp(ownershipCheck.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g"))?.length).toBeGreaterThanOrEqual(5);
    expect(migration.match(new RegExp(userCheck.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g"))?.length).toBeGreaterThanOrEqual(5);
  });

  it("applies tenant checks to insert, select, update, and delete", () => {
    expect(migration).toContain('create policy "store-images: owner insert"');
    expect(migration).toContain('create policy "store-images: owner select"');
    expect(migration).toContain('create policy "store-images: owner update"');
    expect(migration).toContain('create policy "store-images: owner delete"');
  });
});