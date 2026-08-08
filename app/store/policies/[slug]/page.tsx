import Link from "next/link";
import { notFound } from "next/navigation";
import { getCurrentStore } from "@/lib/get-store";
import { getPolicyContent, isPolicySlug } from "@/lib/store-policies";

export default async function PolicyPage({ params }: { params: Promise<{ slug: string }> }) {
  const store = await getCurrentStore();
  if (!store || store.status !== "active") notFound();

  const { slug } = await params;
  if (!isPolicySlug(slug)) notFound();

  const policy = getPolicyContent(store, slug);
  if (!policy.content?.trim()) notFound();

  return (
    <main style={{ maxWidth: 760, margin: "0 auto", padding: "2rem 1rem" }}>
      <h1>{policy.title}</h1>
      <div style={{ whiteSpace: "pre-wrap", lineHeight: 1.6 }}>{policy.content}</div>
      <p style={{ marginTop: "2rem" }}><Link href="/">Back to store</Link></p>
    </main>
  );
}
