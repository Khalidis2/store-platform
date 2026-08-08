import Link from "next/link";
import { notFound } from "next/navigation";
import { getCurrentStore } from "@/lib/get-store";

export default async function ContactPage() {
  const store = await getCurrentStore();
  if (!store || store.status !== "active") notFound();
  if (!store.contact_email && !store.contact_phone) notFound();

  return (
    <main style={{ maxWidth: 760, margin: "0 auto", padding: "2rem 1rem" }}>
      <h1>Contact {store.name}</h1>
      {store.contact_email && <p>Email: <a href={`mailto:${store.contact_email}`}>{store.contact_email}</a></p>}
      {store.contact_phone && <p>Phone: <a href={`tel:${store.contact_phone}`}>{store.contact_phone}</a></p>}
      <p style={{ marginTop: "2rem" }}><Link href="/">Back to store</Link></p>
    </main>
  );
}
