"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

function GoogleIcon() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M23.49 12.27c0-.79-.07-1.54-.2-2.27H12v4.51h6.47a5.57 5.57 0 0 1-2.4 3.58v3h3.86c2.26-2.09 3.56-5.17 3.56-8.82z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.86-3c-1.08.72-2.45 1.16-4.07 1.16-3.13 0-5.78-2.11-6.73-4.96H1.29v3.09A11.99 11.99 0 0 0 12 24z"
      />
      <path
        fill="#FBBC05"
        d="M5.27 14.29A7.19 7.19 0 0 1 4.9 12c0-.8.14-1.57.37-2.29V6.62H1.29a11.99 11.99 0 0 0 0 10.76l3.98-3.09z"
      />
      <path
        fill="#EA4335"
        d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.69 1.29 6.62l3.98 3.09C6.22 6.86 8.87 4.75 12 4.75z"
      />
    </svg>
  );
}

function LoginCard() {
  const searchParams = useSearchParams();
  const urlError = searchParams.get("error");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function signInWithGoogle() {
    setBusy(true);
    setError(null);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
        queryParams: {
          // Pre-filters the Google account picker to the Fitelo workspace.
          // Real enforcement happens server-side (DB trigger + callback check).
          hd: "fitelo.co",
          prompt: "select_account",
        },
      },
    });
    if (error) {
      setError(error.message);
      setBusy(false);
    }
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
          <h1 className="mb-1 text-center text-lg font-semibold">Sign in</h1>
          <p className="mb-5 text-center text-sm text-zinc-400">
            Use your Fitelo Google account (@fitelo.co)
          </p>

          <button
            type="button"
            onClick={signInWithGoogle}
            disabled={busy}
            className="flex w-full items-center justify-center gap-3 rounded-lg border border-zinc-700 bg-white px-4 py-2.5 text-sm font-semibold text-zinc-900 transition hover:bg-zinc-100 disabled:opacity-60"
          >
            <GoogleIcon />
            {busy ? "Redirecting to Google…" : "Continue with Google"}
          </button>

          {(error || urlError) && (
            <p className="mt-4 rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-400">
              {error || urlError}
            </p>
          )}

          <p className="mt-5 text-center text-xs text-zinc-500">
            Personal Gmail and non-Fitelo accounts are not allowed. Contact your
            admin if you can&apos;t sign in.
          </p>
        </div>
      </div>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginCard />
    </Suspense>
  );
}
