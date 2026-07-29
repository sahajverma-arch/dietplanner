import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "LEANR Diet Platform",
  description:
    "Counselling, AI-generated weekly diet plans and client follow-ups for dietitians. By LEANR × Fitelo.",
};

/**
 * Sets the theme before the first paint.
 *
 * This has to run inline and synchronously — React cannot do it, because by
 * the time it hydrates the browser has already painted, and a dietitian who
 * chose light would get a black flash on every navigation.
 *
 * Dark is the default. The app has always been dark and everyone using it is
 * used to that, so light is opted into rather than decided by a system setting
 * overnight.
 */
const THEME_SCRIPT = `try{var t=localStorage.getItem("leanr-theme");document.documentElement.dataset.theme=t==="light"?"light":"dark"}catch(e){document.documentElement.dataset.theme="dark"}`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-theme="dark" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body className="min-h-screen bg-zinc-950 text-zinc-100 antialiased">{children}</body>
    </html>
  );
}
