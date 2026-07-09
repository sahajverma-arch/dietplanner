import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "LEANR Diet Platform",
  description:
    "Counselling, AI-generated weekly diet plans and client follow-ups for dietitians. By LEANR × Fitelo.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-zinc-950 text-zinc-100 antialiased">
        {children}
      </body>
    </html>
  );
}
