"use client";

import { useEffect, useState } from "react";

type Theme = "dark" | "light";

const STORAGE_KEY = "leanr-theme";

/**
 * Switches the app between the dark and light themes.
 *
 * The theme itself is applied by an inline script in the root layout before
 * first paint; this only reads what that script decided and writes the choice
 * back. Which is why the initial state is null until mount — rendering "dark"
 * on the server and finding "light" in localStorage would flip the icon under
 * the dietitian's cursor a frame after they saw it.
 */
export default function ThemeToggle() {
  const [theme, setTheme] = useState<Theme | null>(null);

  useEffect(() => {
    setTheme(document.documentElement.dataset.theme === "light" ? "light" : "dark");
  }, []);

  const flip = () => {
    const next: Theme = theme === "light" ? "dark" : "light";
    document.documentElement.dataset.theme = next;
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      /* private browsing — the theme still applies for this session */
    }
    setTheme(next);
  };

  const goingLight = theme !== "light";

  return (
    <button
      type="button"
      onClick={flip}
      // Hidden from assistive tech until mounted, so it is never announced
      // with the wrong label.
      aria-hidden={theme === null}
      title={theme === null ? undefined : goingLight ? "Switch to light" : "Switch to dark"}
      aria-label={theme === null ? undefined : goingLight ? "Switch to light theme" : "Switch to dark theme"}
      className="rounded-lg border border-zinc-700 p-1.5 text-zinc-400 transition hover:bg-zinc-800 hover:text-zinc-100"
    >
      {goingLight ? <SunIcon /> : <MoonIcon />}
    </button>
  );
}

function SunIcon() {
  return (
    <svg
      className="h-4 w-4"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg
      className="h-4 w-4"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
    </svg>
  );
}
