"use client";

import Link from "next/link";
import { useCart } from "@/lib/cart-context";

export default function CartHeaderLink() {
  const { itemCount } = useCart();
  return <Link href="/cart">Cart ({itemCount})</Link>;
}
