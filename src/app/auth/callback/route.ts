import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Google OAuth lands here with a one-time code. Exchange it for a session,
// re-verify the fitelo.co domain (the DB trigger already blocks foreign
// signups; this also catches pre-existing non-fitelo accounts) and send the
// user in — via /onboarding when their profile is still incomplete.
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const providerError = searchParams.get("error_description") || searchParams.get("error");

  const toLogin = (message: string) =>
    NextResponse.redirect(`${origin}/login?error=${encodeURIComponent(message)}`);

  if (providerError) return toLogin(providerError);
  if (!code) return toLogin("Sign-in was cancelled. Please try again.");

  const supabase = createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    // The DB trigger rejects non-fitelo signups; Supabase surfaces that as a
    // generic "Database error saving new user".
    const friendly = /database error/i.test(error.message)
      ? "Only fitelo.co Google accounts can access this platform."
      : error.message;
    return toLogin(friendly);
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.email?.toLowerCase().endsWith("@fitelo.co")) {
    await supabase.auth.signOut();
    return toLogin("Only fitelo.co Google accounts can access this platform.");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("employee_code, phone")
    .eq("id", user.id)
    .maybeSingle();

  const complete = Boolean(profile?.employee_code?.trim() && profile?.phone?.trim());
  return NextResponse.redirect(`${origin}${complete ? "/" : "/onboarding"}`);
}
