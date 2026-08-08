import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const actions = fs.readFileSync(path.resolve("app/platform-admin/(dashboard)/actions.ts"), "utf8");
const page = fs.readFileSync(path.resolve("app/platform-admin/(dashboard)/page.tsx"), "utf8");
const audit = fs.readFileSync(path.resolve("app/store/admin/audit-log/page.tsx"), "utf8");

describe("platform store lifecycle", () => {
  it("rechecks platform-admin authorization in the lifecycle action", () => {
    expect(actions).toContain("getPlatformAdminUser()");
    expect(actions).toContain("setPlatformStoreStatus");
  });

  it("supports suspend, close, and reopen-to-draft only", () => {
    expect(actions).toContain('["suspended", "closed", "draft"]');
    expect(actions).toContain('requested === "draft"');
    expect(actions).toContain('currentStatus !== "suspended"');
    expect(actions).toContain('currentStatus !== "closed"');
  });

  it("audits platform lifecycle changes", () => {
    expect(actions).toContain('action: requested === "suspended" ? "suspend_store"');
    expect(actions).toContain('actorRole: "platform_admin"');
    expect(actions).toContain("oldStatus: currentStatus");
    expect(actions).toContain("newStatus: requested");
  });

  it("shows status and lifecycle controls in platform admin", () => {
    expect(page).toContain("<th>Status</th>");
    expect(page).toContain("Suspend");
    expect(page).toContain("Close");
    expect(page).toContain("Reopen as draft");
  });

  it("renders lifecycle events in the merchant audit log", () => {
    expect(audit).toContain("suspend_store");
    expect(audit).toContain("close_store");
    expect(audit).toContain("reopen_store");
  });
});
