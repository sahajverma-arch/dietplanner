import {
  fitnessAssessment,
  fitnessBand,
  type FitnessAssessment,
} from "@/lib/counselling/fitness-assessment";
import type { Answers } from "@/lib/counselling/questions";

/**
 * The coach's physical assessment, scored.
 *
 * Shown while the session is being recorded so the coach sees the running
 * total, and on the client page afterwards as the record of what was measured.
 * Stays out of the way entirely until something has been recorded — most
 * clients are counselled before a coach ever sees them.
 */
export default function FitnessScore({
  answers,
  compact = false,
}: {
  answers: Answers;
  /** Denser layout for the client page, where it sits among other cards. */
  compact?: boolean;
}) {
  const assessment = fitnessAssessment(answers);
  if (!assessment.recorded) return null;
  return <FitnessScoreCard assessment={assessment} compact={compact} />;
}

function FitnessScoreCard({
  assessment,
  compact,
}: {
  assessment: FitnessAssessment;
  compact: boolean;
}) {
  const band = fitnessBand(assessment);
  const share = assessment.possible > 0 ? assessment.total / assessment.possible : 0;
  const tone =
    band === null
      ? "border-zinc-700 bg-zinc-900/60"
      : share >= 0.65
        ? "border-emerald-500/30 bg-emerald-500/5"
        : share >= 0.45
          ? "border-amber-500/30 bg-amber-500/5"
          : "border-red-500/30 bg-red-500/5";

  return (
    <div className={`${compact ? "card" : "card mt-4"} border ${tone}`}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-sm font-semibold">Physical assessment</h3>
        <span className="text-xs text-zinc-500">
          {assessment.completed < 6
            ? `${assessment.completed} of 6 tests done`
            : assessment.assessedOn || "all 6 tests done"}
        </span>
      </div>

      <div className="mt-3 flex items-baseline gap-2">
        <span className="text-2xl font-bold">{assessment.total}</span>
        <span className="text-sm text-zinc-400">/ {assessment.possible}</span>
        {band && (
          <span className="ml-1 rounded-full bg-zinc-800 px-2.5 py-0.5 text-xs font-semibold text-zinc-300">
            {band}
          </span>
        )}
      </div>

      <div className="mt-3 space-y-1.5">
        {assessment.tests.map((t) => (
          <div key={t.key} className="flex items-center gap-2 text-xs">
            <span className="w-40 shrink-0 text-zinc-400">{t.label}</span>
            {t.points === null ? (
              <span className="text-zinc-600">not done</span>
            ) : (
              <>
                {/* Four pips read faster than a number when scanning six rows. */}
                <span className="flex gap-0.5" aria-label={`${t.points} of 4`}>
                  {[1, 2, 3, 4].map((n) => (
                    <span
                      key={n}
                      className={`h-1.5 w-5 rounded-full ${
                        n <= (t.points ?? 0) ? "bg-brand" : "bg-zinc-800"
                      }`}
                    />
                  ))}
                </span>
                <span className="tabular-nums text-zinc-300">{t.points}</span>
                {t.measured && <span className="text-zinc-600">{t.measured}</span>}
                {t.overridden && (
                  <span className="rounded bg-zinc-800 px-1.5 text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
                    by coach
                  </span>
                )}
              </>
            )}
          </div>
        ))}
      </div>

      {assessment.completed < 6 && (
        <p className="mt-2.5 text-[11px] text-zinc-600">
          The score counts only the tests done, so a client who could not attempt one is not
          marked down for it.
        </p>
      )}
    </div>
  );
}
