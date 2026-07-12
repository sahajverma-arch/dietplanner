import { createSign } from "node:crypto";
import { NextResponse } from "next/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const maxDuration = 60;

// Pulls the ops "Raw_Counselling" Google Sheet (CSV export URL) into
// public.counselling_appointments. Called daily by QStash with the
// x-cron-secret header, or manually by a signed-in admin ("Sync now").
// Upserts ONLY sheet columns, so our workflow status is never overwritten.

// Sheet columns by position (header row is validated before parsing):
// 0 clientCode | 1 displayName | 2 counsellingScheduledOn | 3 Category |
// 4 <status, unnamed> | 5 Counselling Date | 6 Emp Code | 7 First Call |
// 8 Call Date | 9 Talktime | 10 Plan Name | 11 Type

function parseCsv(text: string): string[][] {
  const out: string[][] = [];
  let row: string[] = [], field = "", inQ = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQ) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else inQ = false;
      } else field += c;
    } else if (c === '"') inQ = true;
    else if (c === ",") { row.push(field); field = ""; }
    else if (c === "\n" || c === "\r") {
      if (field !== "" || row.length) { row.push(field); out.push(row); row = []; field = ""; }
      if (c === "\r" && text[i + 1] === "\n") i++;
    } else field += c;
  }
  if (field !== "" || row.length) { row.push(field); out.push(row); }
  return out;
}

// Sheets serializes empty date cells as 30 Dec 1899. Accepts
// "2026-01-16 10:00:00", "1/16/2026 10:00:00" and date-only variants.
function parseSheetDateTime(raw: string): string | null {
  const s = (raw || "").trim();
  if (!s || s.includes("1899")) return null;

  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{1,2}):(\d{2})(?::(\d{2}))?)?/);
  if (m) {
    return `${m[1]}-${m[2]}-${m[3]} ${pad(m[4] ?? "0")}:${m[5] ?? "00"}:${m[6] ?? "00"}`;
  }
  m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?/);
  if (m) {
    return `${m[3]}-${pad(m[1])}-${pad(m[2])} ${pad(m[4] ?? "0")}:${m[5] ?? "00"}:${m[6] ?? "00"}`;
  }
  return null;
}
const pad = (v: string) => v.padStart(2, "0");
const dateOnly = (v: string | null) => (v ? v.slice(0, 10) : null);

// ---------------------------------------------------------------------------
// Sheet access. Preferred: a Google service account (sheet stays private —
// share it only with the service account's email). Fallback: the public CSV
// export URL, used until the service account is configured.
// ---------------------------------------------------------------------------

async function googleAccessToken(email: string, privateKey: string): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString("base64url");
  const unsigned =
    `${b64({ alg: "RS256", typ: "JWT" })}.` +
    b64({
      iss: email,
      scope: "https://www.googleapis.com/auth/spreadsheets.readonly",
      aud: "https://oauth2.googleapis.com/token",
      iat: now,
      exp: now + 3600,
    });
  const signer = createSign("RSA-SHA256");
  signer.update(unsigned);
  // Vercel env vars store the key single-line with literal \n sequences
  const jwt = `${unsigned}.${signer.sign(privateKey.replace(/\\n/g, "\n")).toString("base64url")}`;

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  });
  const json = (await res.json()) as { access_token?: string; error_description?: string };
  if (!res.ok || !json.access_token) {
    throw new Error(`Google token exchange failed: ${json.error_description ?? res.status}`);
  }
  return json.access_token;
}

/** Returns all sheet rows (header first) via whichever access method is configured. */
async function fetchSheetRows(): Promise<string[][]> {
  const saEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const saKey = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
  const sheetId = process.env.COUNSELLING_SHEET_ID;
  const range = process.env.COUNSELLING_SHEET_RANGE || "Raw_Counselling";

  if (saEmail && saKey && sheetId) {
    const token = await googleAccessToken(saEmail, saKey);
    const res = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodeURIComponent(range)}`,
      { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" }
    );
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`Sheets API failed (${res.status}): ${body.slice(0, 200)}`);
    }
    const json = (await res.json()) as { values?: string[][] };
    return json.values ?? [];
  }

  const csvUrl = process.env.COUNSELLING_SHEET_CSV_URL;
  if (!csvUrl) {
    throw new Error(
      "Sheet access not configured — set GOOGLE_SERVICE_ACCOUNT_EMAIL/KEY + COUNSELLING_SHEET_ID, or COUNSELLING_SHEET_CSV_URL"
    );
  }
  const res = await fetch(csvUrl, { cache: "no-store" });
  if (!res.ok) throw new Error(`sheet CSV fetch failed (${res.status})`);
  return parseCsv(await res.text());
}

async function isCallerAuthorized(request: Request): Promise<boolean> {
  const secret = process.env.CRON_SECRET;
  const provided =
    request.headers.get("x-cron-secret") ??
    request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ??
    // Fallback for schedulers where adding headers is awkward: the secret may
    // be passed as ?secret= in the URL instead.
    new URL(request.url).searchParams.get("secret");
  if (secret && provided === secret) return true;

  // Fallback: a signed-in admin may trigger a manual sync
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return false;
  const { data: me } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  return me?.role === "admin";
}

export async function POST(request: Request) {
  if (!(await isCallerAuthorized(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) {
    return NextResponse.json(
      { error: "SUPABASE_SERVICE_ROLE_KEY not configured" },
      { status: 500 }
    );
  }

  let rows: string[][];
  try {
    rows = await fetchSheetRows();
  } catch (e) {
    return NextResponse.json(
      { error: `Could not read sheet: ${e instanceof Error ? e.message : e}` },
      { status: 502 }
    );
  }

  const header = rows.shift() ?? [];
  if ((header[0] ?? "").trim() !== "clientCode") {
    return NextResponse.json(
      { error: `Unexpected sheet format — first header cell is "${header[0]}", expected "clientCode". Check the sheet ID/range points at Raw_Counselling.` },
      { status: 422 }
    );
  }

  // Last occurrence wins for duplicate (client, emp, slot) rows in the sheet
  const byKey = new Map<string, Record<string, unknown>>();
  let skipped = 0;
  for (const r of rows) {
    const clientCode = (r[0] ?? "").trim();
    const empCode = (r[6] ?? "").trim();
    const scheduledOn = parseSheetDateTime(r[2] ?? "");
    if (!clientCode || !empCode || !scheduledOn) {
      skipped++;
      continue;
    }
    byKey.set(`${clientCode}|${empCode.toUpperCase()}|${scheduledOn}`, {
      client_code: clientCode,
      display_name: (r[1] ?? "").trim() || null,
      scheduled_on: scheduledOn,
      category: (r[3] ?? "").trim() || null,
      sheet_status: (r[4] ?? "").trim() || null,
      counselling_date: dateOnly(parseSheetDateTime(r[5] ?? "")),
      emp_code: empCode.toUpperCase(),
      first_call: parseSheetDateTime(r[7] ?? ""),
      call_date: dateOnly(parseSheetDateTime(r[8] ?? "")),
      talktime: parseInt((r[9] ?? "0").replace(/,/g, ""), 10) || 0,
      plan_name: (r[10] ?? "").trim() || null,
      plan_type: (r[11] ?? "").trim() || null,
      synced_at: new Date().toISOString(),
    });
  }

  const records = Array.from(byKey.values());
  const supabase = createServiceClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceKey, {
    auth: { persistSession: false },
  });

  const BATCH = 500;
  for (let i = 0; i < records.length; i += BATCH) {
    const { error } = await supabase
      .from("counselling_appointments")
      .upsert(records.slice(i, i + BATCH), {
        onConflict: "client_code,emp_code,scheduled_on",
      });
    if (error) {
      return NextResponse.json(
        { error: `Upsert failed at batch ${i}: ${error.message}` },
        { status: 500 }
      );
    }
  }

  console.log(`sync-counselling: ${records.length} rows upserted, ${skipped} skipped`);
  return NextResponse.json({ upserted: records.length, skipped });
}
