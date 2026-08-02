"use client";

import { useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";

export default function SignupPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [storeName, setStoreName] = useState("");
  const [subdomain, setSubdomain] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const supabase = getSupabaseBrowserClient();
    const { data, error: signUpError } = await supabase.auth.signUp({ email, password });

    if (signUpError) {
      setError(signUpError.message);
      return;
    }

    // If email confirmation is enabled in your Supabase project, there's no
    // session yet at this point — the user has to confirm their email first,
    // then come back and log in before a store can be created.
    if (!data.session) {
      setError(
        "Account created — check your email to confirm it, then log in to create your store."
      );
      return;
    }

    const res = await fetch("/api/stores", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ subdomain, name: storeName }),
    });

    if (!res.ok) {
      const body = await res.json();
      setError(body.error || "Failed to create store");
      return;
    }

    setDone(true);
  }

  if (done) {
    return (
      <main style={{ fontFamily: "system-ui", padding: "3rem" }}>
        <h1>Store created</h1>
        <p>
          Visit <code>{subdomain}.yourapp.com/login</code> to sign in to your new admin dashboard.
        </p>
      </main>
    );
  }

  return (
    <main style={{ fontFamily: "system-ui", padding: "3rem", maxWidth: 400 }}>
      <h1>Create your store</h1>
      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
        <input type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        <input
          placeholder="Store name"
          value={storeName}
          onChange={(e) => setStoreName(e.target.value)}
          required
        />
        <input
          placeholder="Subdomain (e.g. khaledsstore)"
          value={subdomain}
          onChange={(e) => setSubdomain(e.target.value.toLowerCase())}
          required
        />
        {error && <p style={{ color: "crimson" }}>{error}</p>}
        <button type="submit">Create store</button>
      </form>
    </main>
  );
}
