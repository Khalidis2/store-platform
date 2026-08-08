import { describe, expect, it } from "vitest";
import fs from "fs";
import path from "path";

function source(relativePath: string) {
  return fs.readFileSync(path.resolve(__dirname, "..", relativePath), "utf8");
}

describe("production observability", () => {
  it("logs checkout lifecycle events", () => {
    const checkout = source("app/store/api/checkout/route.ts");
    const pay = source("app/store/api/checkout/pay/route.ts");
    expect(checkout).toContain('"checkout.order.created"');
    expect(pay).toContain('"inventory.reserved"');
    expect(pay).toContain('"checkout.session.created"');
    expect(pay).toContain('"checkout.payment.failed"');
  });

  it("logs webhook processing failures without raw payload logging", () => {
    const stripe = source("app/api/webhooks/stripe/route.ts");
    const aftership = source("app/api/webhooks/aftership/route.ts");
    expect(stripe).toContain('"webhook.stripe.failed"');
    expect(aftership).toContain('"webhook.aftership.failed"');
    expect(stripe).not.toContain("rawBody,");
    expect(aftership).not.toContain("rawBody,");
  });
});
