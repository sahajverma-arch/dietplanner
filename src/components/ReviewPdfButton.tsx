"use client";

import { useState } from "react";
import type { Answers } from "@/lib/counselling/questions";

/**
 * Downloads the review page as a PDF. Unlike DownloadPdfButton (which signs a
 * URL to an already-uploaded storage object), this counselling has no
 * client/plan row yet — the PDF is rendered on demand from the answers
 * already on screen and streamed straight back, so there is nothing to sign.
 */
export default function ReviewPdfButton({ answers }: { answers: Answers }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);

  async function handleDownload() {
    setBusy(true);
    setError(false);
    try {
      const res = await fetch("/api/counselling-review-pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answers }),
      });
      if (!res.ok) throw new Error("PDF generation failed");
      const blob = await res.blob();
      const filename =
        res.headers.get("Content-Disposition")?.match(/filename="([^"]+)"/)?.[1] ??
        "counselling-review.pdf";
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      setError(true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      onClick={handleDownload}
      disabled={busy}
      title={error ? "Could not generate the PDF — try again" : "Download this summary as a PDF"}
      className="text-xs font-medium text-zinc-400 underline-offset-4 hover:text-brand hover:underline disabled:opacity-50"
    >
      {busy ? "Preparing PDF…" : error ? "Retry PDF" : "⬇ Download PDF"}
    </button>
  );
}
