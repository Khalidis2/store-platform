import Link from "next/link";
import { notFound } from "next/navigation";
import { getCurrentStore } from "@/lib/get-store";
import { CartProvider } from "@/lib/cart-context";
import { StoreProvider } from "@/lib/store-context";
import CartHeaderLink from "./CartHeaderLink";

export default async function ShopLayout({ children }: { children: React.ReactNode }) {
  const store = await getCurrentStore();
  if (!store) notFound();

  const accentColor = store.accent_color || "#111";

  return (
    <StoreProvider
      store={{
        id: store.id,
        name: store.name,
        isLive: store.is_live,
        logoUrl: store.logo_url,
        accentColor: store.accent_color,
        tagline: store.tagline,
      }}
    >
      <CartProvider storeId={store.id}>
      <div style={{ fontFamily: "system-ui", "--store-accent": accentColor } as React.CSSProperties}>
        <header
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            padding: "1rem 2rem",
            borderBottom: "1px solid #ddd",
          }}
        >
          <Link href="/" style={{ display: "flex", alignItems: "center", gap: "0.75rem", textDecoration: "none", color: "inherit" }}>
            {store.logo_url ? (
              <img src={store.logo_url} alt={store.name} style={{ height: 32, width: "auto" }} />
            ) : (
              <span style={{ fontWeight: 600 }}>{store.name}</span>
            )}
            {store.tagline && <span style={{ color: "#666", fontSize: "0.9rem" }}>{store.tagline}</span>}
          </Link>
          <CartHeaderLink />
        </header>
        {children}
      </div>
    </CartProvider>
    </StoreProvider>
  );
}
