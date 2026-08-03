"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";

export default function SignupPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [checkEmail, setCheckEmail] = useState(false);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const supabase = getSupabaseBrowserClient();
    const { data, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      // Where Supabase sends the user after they click the confirmation
      // link in their email — a dedicated step that finishes store setup
      // once a session exists, whether that happens instantly (email
      // confirmation disabled) or only after confirming (the common case).
      options: { emailRedirectTo: `${window.location.origin}/signup/complete` },
    });

    if (signUpError) {
      setError(signUpError.message);
      return;
    }

    // If email confirmation is enabled in your Supabase project, there's no
    // session yet — the user has to click the confirmation link first,
    // which lands them on /signup/complete once they do.
    if (!data.session) {
      setCheckEmail(true);
      return;
    }

    router.push("/signup/complete");
  }

  if (checkEmail) {
    return (
      <main style={{ fontFamily: "system-ui", padding: "3rem", maxWidth: 400 }}>
        <h1>Check your email</h1>
        <p>
          We sent a confirmation link to <strong>{email}</strong>. Click it to
          finish setting up your store.
        </p>
      </main>
    );
  }

  return (
    <main style={{ fontFamily: "system-ui", padding: "3rem", maxWidth: 400 }}>
      <h1>Create your account</h1>
      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
        <input type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        {error && <p style={{ color: "crimson" }}>{error}</p>}
        <button type="submit">Continue</button>
      </form>
    </main>
  );
}
