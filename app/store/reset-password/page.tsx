"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";

export default function ResetPasswordPage() {
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const supabase = getSupabaseBrowserClient();
    // Clicking the reset link redirects here with a recovery token in the
    // URL fragment — the browser client picks that up automatically and
    // establishes a session, so updateUser() here just works without any
    // extra token-handling on our part.
    const { error } = await supabase.auth.updateUser({ password });

    if (error) {
      setError(error.message);
      return;
    }

    setDone(true);
    setTimeout(() => router.push("/admin"), 1500);
  }

  if (done) {
    return (
      <main style={{ fontFamily: "system-ui", padding: "3rem", maxWidth: 400 }}>
        <h1>Password updated</h1>
        <p>Redirecting to your dashboard...</p>
      </main>
    );
  }

  return (
    <main style={{ fontFamily: "system-ui", padding: "3rem", maxWidth: 400 }}>
      <h1>Set a new password</h1>
      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
        <input
          type="password"
          placeholder="New password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          minLength={6}
        />
        {error && <p style={{ color: "crimson" }}>{error}</p>}
        <button type="submit">Update password</button>
      </form>
    </main>
  );
}
