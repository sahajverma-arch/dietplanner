import Link from "next/link";

export default function AppHeader({
  email,
  isAdmin = false,
}: {
  email: string;
  isAdmin?: boolean;
}) {
  return (
    <header className="sticky top-0 z-20 border-b border-zinc-800 bg-black/95 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
        <Link href="/" className="flex items-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="LEANR by Fitelo" className="h-9 w-auto" />
        </Link>
        <div className="flex items-center gap-3">
          {isAdmin && (
            <Link
              href="/admin"
              className="rounded bg-brand/15 px-2.5 py-1 text-xs font-semibold text-brand hover:bg-brand/25"
            >
              Admin
            </Link>
          )}
          <span className="hidden text-sm text-zinc-400 sm:inline">{email}</span>
          <form action="/auth/signout" method="post">
            <button className="btn-secondary !px-3 !py-1.5 text-xs">Sign out</button>
          </form>
        </div>
      </div>
    </header>
  );
}
