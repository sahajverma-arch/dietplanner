"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

// First sign-in: confirm the name Google supplied and collect the employee
// code + phone used for reporting/data mapping. Middleware sends incomplete
// profiles here and completed ones away, so this page needs no guard.
export default function OnboardingPage() {
  const router = useRouter();
  const [fullName, setFullName] = useState("");
  const [employeeCode, setEmployeeCode] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        router.replace("/login");
        return;
      }
      setEmail(user.email ?? "");
      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name, employee_code, phone")
        .eq("id", user.id)
        .maybeSingle();
      setFullName(profile?.full_name || (user.user_metadata?.full_name as string) || "");
      setEmployeeCode(profile?.employee_code || "");
      setPhone(profile?.phone || "");
      setLoading(false);
    })();
  }, [router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const name = fullName.trim();
    const code = employeeCode.trim().toUpperCase();
    const phoneDigits = phone.replace(/[^\d]/g, "");
    if (name.length < 3) return setError("Please enter your full name.");
    if (!code) return setError("Please enter your Fitelo employee code.");
    if (phoneDigits.length < 10) return setError("Please enter a valid 10-digit phone number.");

    setBusy(true);
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return router.replace("/login");

    const { error } = await supabase
      .from("profiles")
      .update({ full_name: name, employee_code: code, phone: phoneDigits })
      .eq("id", user.id);

    if (error) {
      setError(
        /duplicate|unique/i.test(error.message)
          ? "This employee code is already registered. Check the code or contact your admin."
          : error.message
      );
      setBusy(false);
      return;
    }
    router.push("/");
    router.refresh();
  }

  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="LEANR by Fitelo" className="mx-auto mb-4 h-20 w-auto" />
          <h1 className="text-lg font-semibold">Complete your profile</h1>
          <p className="mt-1 text-sm text-zinc-400">
            One-time setup — needed before you can use the platform.
          </p>
        </div>

        <div className="card">
          {loading ? (
            <p className="py-8 text-center text-sm text-zinc-400">Loading…</p>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="label">Fitelo email</label>
                <input className="input opacity-60" value={email} disabled />
              </div>
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
              <div>
                <label className="label">Employee code</label>
                <input
                  className="input"
                  value={employeeCode}
                  onChange={(e) => setEmployeeCode(e.target.value)}
                  placeholder="e.g. FIT1234"
                  required
                />
              </div>
              <div>
                <label className="label">Phone number</label>
                <input
                  className="input"
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="98765 43210"
                  required
                />
              </div>

              {error && (
                <p className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-400">{error}</p>
              )}

              <button className="btn-primary w-full" disabled={busy}>
                {busy ? "Saving…" : "Save & continue"}
              </button>
            </form>
          )}
        </div>
      </div>
    </main>
  );
}
