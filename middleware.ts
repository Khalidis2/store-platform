import { NextRequest, NextResponse } from "next/server";

// Update this to your real root domain once you have one.
const ROOT_DOMAINS = ["localhost:3000", "yourapp.com", "www.yourapp.com"];

export function middleware(req: NextRequest) {
  const hostname = req.headers.get("host") || "";

  // Root domain (marketing site / merchant signup) — no store context.
  if (ROOT_DOMAINS.includes(hostname)) {
    return NextResponse.next();
  }

  // e.g. "khaledsstore.yourapp.com" -> "khaledsstore"
  const subdomain = hostname.split(".")[0];

  const url = req.nextUrl.clone();
  url.pathname = `/store${url.pathname}`;

  const response = NextResponse.rewrite(url);
  response.headers.set("x-store-subdomain", subdomain);
  return response;
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
