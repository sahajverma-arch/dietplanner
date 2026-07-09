"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const router = useRouter();

  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setMessage(null);
    const supabase = createClient();

    if (mode === "signin") {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        setError(error.message);
      } else {
        router.push("/");
        router.refresh();
        return;
      }
    } else {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { full_name: fullName } },
      });
      if (error) {
        setError(error.message);
      } else if (data.session) {
        router.push("/");
        router.refresh();
        return;
      } else {
        setMessage(
          "Account created. Check your inbox to confirm your email, then sign in."
        );
        setMode("signin");
      }
    }
    setBusy(false);
  }

  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/logo.png"
            alt="LEANR by Fitelo"
            className="mx-auto mb-4 h-20 w-auto"
          />
          <p className="mt-1 text-sm text-zinc-400">
            Counselling, AI diet plans and weekly follow-ups — in one place.
          </p>
        </div>

        <div className="card">
          <div className="mb-5 grid grid-cols-2 gap-1 rounded-lg bg-zinc-800 p-1">
            {(["signin", "signup"] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => {
                  setMode(m);
                  setError(null);
                  setMessage(null);
                }}
                className={`rounded-md py-1.5 text-sm font-semibold transition ${
                  mode === m ? "bg-brand text-black shadow-sm" : "text-zinc-400"
                }`}
              >
                {m === "signin" ? "Sign in" : "Create account"}
              </button>
            ))}
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === "signup" && (
              <div>
                <label className="label">Full name</label>
                <input
                  className="input"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Dr. Priya Sharma"
                  required
                />
              </div>
            )}
            <div>
              <label className="label">Email</label>
              <input
                className="input"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@clinic.com"
                required
              />
            </div>
            <div>
              <label className="label">Password</label>
              <input
                className="input"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                minLength={6}
                required
              />
            </div>

            {error && (
              <p className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-400">{error}</p>
            )}
            {message && (
              <p className="rounded-lg bg-brand/10 px-3 py-2 text-sm text-brand">
                {message}
              </p>
            )}

            <button className="btn-primary w-full" disabled={busy}>
              {busy ? "Please wait…" : mode === "signin" ? "Sign in" : "Create account"}
            </button>
          </form>
        </div>
      </div>
    </main>
  );
}
