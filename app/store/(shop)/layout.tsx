import Link from "next/link";
import { notFound } from "next/navigation";
import { getCurrentStore } from "@/lib/get-store";
import { CartProvider } from "@/lib/cart-context";
import { StoreProvider } from "@/lib/store-context";
import CartHeaderLink from "./CartHeaderLink";

export default async function ShopLayout({ children }: { children: React.ReactNode }) {
  const store = await getCurrentStore();
  if (!store) notFound();

  return (
    <StoreProvider store={{ id: store.id, name: store.name, isLive: store.is_live }}>
      <CartProvider storeId={store.id}>
      <div style={{ fontFamily: "system-ui" }}>
        <header
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            padding: "1rem 2rem",
            borderBottom: "1px solid #ddd",
          }}
        >
          <Link href="/" style={{ fontWeight: 600, textDecoration: "none", color: "inherit" }}>
            {store.name}
          </Link>
          <CartHeaderLink />
        </header>
        {children}
      </div>
    </CartProvider>
    </StoreProvider>
  );
}
