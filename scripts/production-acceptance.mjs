const root = process.env.PLATFORM_ROOT_URL?.trim();
const storeSubdomain = process.env.ACCEPTANCE_STORE_SUBDOMAIN?.trim();

if (!root) throw new Error("PLATFORM_ROOT_URL is required");
if (!storeSubdomain) throw new Error("ACCEPTANCE_STORE_SUBDOMAIN is required");

const rootUrl = new URL(root);
if (rootUrl.protocol !== "https:") throw new Error("PLATFORM_ROOT_URL must use HTTPS");
if (rootUrl.hostname.endsWith(".vercel.app")) throw new Error("Production acceptance requires a custom domain");
if (!/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(storeSubdomain)) {
  throw new Error("ACCEPTANCE_STORE_SUBDOMAIN is invalid");
}

const tenantUrl = new URL(rootUrl.toString());
tenantUrl.hostname = `${storeSubdomain}.${rootUrl.hostname}`;

const checks = [];

async function check(name, fn) {
  try {
    await fn();
    checks.push({ name, status: "pass" });
  } catch (error) {
    checks.push({ name, status: "fail", error: error instanceof Error ? error.message : "unknown error" });
  }
}

async function expectStatus(url, expected, init) {
  const response = await fetch(url, { ...init, redirect: "manual", signal: AbortSignal.timeout(10000) });
  if (!expected.includes(response.status)) {
    throw new Error(`${url} returned ${response.status}; expected ${expected.join(" or ")}`);
  }
  return response;
}

await check("root health", async () => {
  const response = await expectStatus(new URL("/api/health", rootUrl), [200]);
  const body = await response.json();
  if (body.status !== "ok") throw new Error("health response is not ok");
});

await check("database readiness", async () => {
  const response = await expectStatus(new URL("/api/ready", rootUrl), [200]);
  const body = await response.json();
  if (body.status !== "ready") throw new Error("readiness response is not ready");
});

await check("signup route", async () => {
  await expectStatus(new URL("/signup", rootUrl), [200, 307, 308]);
});

await check("tenant storefront route", async () => {
  await expectStatus(new URL("/", tenantUrl), [200]);
});

await check("stripe webhook rejects unsigned request", async () => {
  const response = await fetch(new URL("/api/webhooks/stripe", rootUrl), {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: "{}",
    redirect: "manual",
    signal: AbortSignal.timeout(10000),
  });
  if (response.status >= 200 && response.status < 300) {
    throw new Error(`unsigned Stripe webhook returned ${response.status}`);
  }
});

await check("aftership webhook rejects unsigned request", async () => {
  const response = await fetch(new URL("/api/webhooks/aftership", rootUrl), {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: "{}",
    redirect: "manual",
    signal: AbortSignal.timeout(10000),
  });
  if (response.status >= 200 && response.status < 300) {
    throw new Error(`unsigned AfterShip webhook returned ${response.status}`);
  }
});

for (const result of checks) {
  const prefix = result.status === "pass" ? "PASS" : "FAIL";
  console.log(`${prefix} ${result.name}${result.error ? `: ${result.error}` : ""}`);
}

const failures = checks.filter((result) => result.status === "fail");
if (failures.length > 0) {
  process.exitCode = 1;
} else {
  console.log(`PASS production acceptance smoke (${checks.length}/${checks.length})`);
}
