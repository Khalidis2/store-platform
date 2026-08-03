import { NextRequest, NextResponse } from "next/server";
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { ROOT_DOMAINS, extractSubdomain } from "./lib/subdomain";
import { COOKIE_DOMAIN } from "./lib/cookie-domain";

function buildResponse(req: NextRequest, subdomain: string | null) {
  if (!subdomain) return NextResponse.next({ request: req });

  const url = req.nextUrl.clone();
  url.pathname = `/store${url.pathname}`;
  const response = NextResponse.rewrite(url, { request: req });
  response.headers.set("x-store-subdomain", subdomain);
  return response;
}

export async function middleware(req: NextRequest) {
  const hostname = req.headers.get("host") || "";
  const subdomain = extractSubdomain(hostname);

  let response = buildResponse(req, subdomain);

  // Refreshes the Supabase session here, in middleware, where cookies CAN
  // be written — Server Components can only read cookies, so without this
  // a session nearing expiry never gets refreshed until a Server Action or
  // Route Handler happens to run, and silently fails (logging the user out)
  // once the access token actually expires.
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return req.cookies.get(name)?.value;
        },
        set(name: string, value: string, options: CookieOptions) {
          req.cookies.set(name, value);
          response = buildResponse(req, subdomain);
          response.cookies.set({ name, value, ...options, domain: COOKIE_DOMAIN });
        },
        remove(name: string, options: CookieOptions) {
          req.cookies.set(name, "");
          response = buildResponse(req, subdomain);
          response.cookies.set({ name, value: "", ...options, domain: COOKIE_DOMAIN });
        },
      },
    }
  );

  await supabase.auth.getUser();

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
