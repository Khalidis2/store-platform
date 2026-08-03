"use client";

import { useEffect, useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";

export default function CompleteSignupPage() {
  const [checking, setChecking] = useState(true);
  const [authed, setAuthed] = useState(false);
  const [storeName, setStoreName] = useState("");
  const [subdomain, setSubdomain] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    // Clicking the email confirmation link redirects here with a session
    // token in the URL fragment — the browser client picks that up
    // automatically, same as the password reset flow.
    supabase.auth.getSession().then(({ data }) => {
      setAuthed(!!data.session);
      setChecking(false);
    });
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

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

  if (checking) {
    return <main style={{ fontFamily: "system-ui", padding: "3rem" }}>Loading...</main>;
  }

  if (!authed) {
    return (
      <main style={{ fontFamily: "system-ui", padding: "3rem", maxWidth: 400 }}>
        <h1>Confirm your email first</h1>
        <p>
          Click the confirmation link we sent you, then come back to this
          page — or <a href="/signup">sign up again</a> if you need a new
          link.
        </p>
      </main>
    );
  }

  if (done) {
    return (
      <main style={{ fontFamily: "system-ui", padding: "3rem" }}>
        <h1>Store created</h1>
        <p>
          Visit <code>{subdomain}.yourapp.com/login</code> to sign in to your
          new admin dashboard.
        </p>
      </main>
    );
  }

  return (
    <main style={{ fontFamily: "system-ui", padding: "3rem", maxWidth: 400 }}>
      <h1>Set up your store</h1>
      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
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
