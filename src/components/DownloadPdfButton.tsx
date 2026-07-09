"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function DownloadPdfButton({ path }: { path: string }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);

  async function handleDownload() {
    setBusy(true);
    setError(false);
    const supabase = createClient();
    const { data, error } = await supabase.storage
      .from("diet-pdfs")
      .createSignedUrl(path, 60 * 60);
    setBusy(false);
    if (error || !data?.signedUrl) {
      setError(true);
      return;
    }
    window.open(data.signedUrl, "_blank");
  }

  return (
    <button
      type="button"
      onClick={handleDownload}
      disabled={busy}
      className="btn-secondary !px-3 !py-1.5 text-xs"
      title={error ? "Could not create download link — try again" : "Download PDF"}
    >
      {busy ? "…" : error ? "Retry PDF" : "⬇ PDF"}
    </button>
  );
}
