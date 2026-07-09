import Link from "next/link";

export interface ClientCardData {
  id: string;
  fullName: string;
  goal: string | null;
  dietType: string | null;
  weightKg: number | null;
  latestWeek: number;
  lastPlanAt: string | null;
}

export default function ClientCard({ client }: { client: ClientCardData }) {
  return (
    <Link
      href={`/clients/${client.id}`}
      className="card block transition hover:-translate-y-0.5 hover:border-brand/40 hover:shadow-md"
    >
      <div className="flex items-center gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand/10 text-lg font-bold text-brand">
          {client.fullName.slice(0, 1).toUpperCase()}
        </div>
        <div className="min-w-0">
          <div className="truncate font-semibold">{client.fullName}</div>
          <div className="truncate text-xs capitalize text-zinc-400">
            {client.goal || "No goal set"}
          </div>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2 text-xs">
        {client.dietType && (
          <span className="rounded-full bg-brand/10 px-2.5 py-1 font-medium capitalize text-brand">
            {client.dietType}
          </span>
        )}
        {client.weightKg && (
          <span className="rounded-full bg-zinc-800 px-2.5 py-1 font-medium text-zinc-300">
            {client.weightKg} kg
          </span>
        )}
        <span
          className={`rounded-full px-2.5 py-1 font-medium ${
            client.latestWeek > 0
              ? "bg-sky-500/10 text-sky-400"
              : "bg-amber-500/10 text-amber-400"
          }`}
        >
          {client.latestWeek > 0 ? `Week ${client.latestWeek}` : "No plan yet"}
        </span>
      </div>

      {client.lastPlanAt && (
        <div className="mt-3 text-xs text-zinc-500">
          Last plan:{" "}
          {new Date(client.lastPlanAt).toLocaleDateString("en-GB", {
            day: "numeric",
            month: "short",
            year: "numeric",
          })}
        </div>
      )}
    </Link>
  );
}
