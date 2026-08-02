import { NextRequest, NextResponse } from "next/server";
import { ROOT_DOMAINS, extractSubdomain } from "./lib/subdomain";

export function middleware(req: NextRequest) {
  const hostname = req.headers.get("host") || "";
  const subdomain = extractSubdomain(hostname);

  // Root domain (marketing site / merchant signup) — no store context.
  if (!subdomain) {
    return NextResponse.next();
  }

  const url = req.nextUrl.clone();
  url.pathname = `/store${url.pathname}`;

  const response = NextResponse.rewrite(url);
  response.headers.set("x-store-subdomain", subdomain);
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
