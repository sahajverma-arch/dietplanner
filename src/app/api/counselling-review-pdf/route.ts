import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { renderReviewPdf } from "@/lib/review-pdf";
import { val, type Answers } from "@/lib/counselling/questions";

export const runtime = "nodejs";
export const maxDuration = 30;

const BodySchema = z.object({
  answers: z.record(z.union([z.string(), z.array(z.string())])),
});

// Renders whatever is currently on the review page — the client sends the
// exact `answers` it already has in memory (autosaved or not, real draft or
// preview fixture), so the PDF can never disagree with what was on screen
// when the dietitian clicked the button. No storage upload: this document
// has no client/plan row to attach to yet, so it streams straight back.
export async function POST(request: Request) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const parsed = BodySchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Malformed counselling answers" }, { status: 400 });
  }
  const answers = parsed.data.answers as Answers;

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name")
    .eq("id", user.id)
    .maybeSingle();

  const buffer = await renderReviewPdf({
    answers,
    dietitianName: profile?.full_name?.trim() || "",
    generatedOn: new Date().toLocaleString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }),
  });

  const name = val(answers, "name").trim() || "client";
  const fileSafeName = name.replace(/[^a-z0-9]+/gi, "-").replace(/^-+|-+$/g, "").toLowerCase();

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${fileSafeName || "client"}-counselling-review.pdf"`,
    },
  });
}
