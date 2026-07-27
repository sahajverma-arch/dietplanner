/**
 * Drives a stepped plan generation from the browser.
 *
 * Generating a week is up to 10 model calls over several minutes, which no
 * longer fits in one request on a host that caps a function at 60s. So the
 * browser runs the loop: `start` creates the plan row, then `step` is called
 * until it reports done, each request doing exactly one unit of work.
 *
 * Every step persists to the row before returning, so a step that fails is
 * retried on its own rather than throwing the whole generation away — and a
 * closed tab leaves a resumable row instead of nothing.
 */

export interface PlanProgress {
  /** What the current step is doing, for the dietitian to read. */
  label: string;
  step: number;
  total: number;
}

export interface PlanRunResult {
  planId: string;
  clientId: string;
  week?: number;
}

type StartBody =
  | { source: "first"; form: unknown; appointmentId?: string }
  | { source: "followup"; clientId: string; followup: unknown }
  | { source: "regenerate"; clientId: string }
  | { source: "revise"; planId: string; instructions: string };

/** A step that fails transiently is worth retrying before giving up on it. */
const STEP_RETRIES = 2;
const RETRY_BACKOFF_MS = 1500;

class PlanStepError extends Error {
  paused: boolean;
  clientId?: string;
  constructor(message: string, paused = false, clientId?: string) {
    super(message);
    this.paused = paused;
    this.clientId = clientId;
  }
}

async function post(body: Record<string, unknown>) {
  const res = await fetch("/api/plan-step", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new PlanStepError(
      json.error || "Something went wrong — try again.",
      json.paused === true,
      json.clientId
    );
  }
  return json as {
    planId: string;
    clientId: string;
    week?: number;
    stage: string | null;
    done: boolean;
    label: string;
    step: number;
    total: number;
  };
}

export async function runPlanSteps(
  start: StartBody,
  onProgress: (p: PlanProgress) => void
): Promise<PlanRunResult> {
  const first = await post({ type: "start", ...start });
  onProgress({ label: first.label, step: first.step, total: first.total });
  return drive(first, onProgress);
}

/**
 * Finish a generation that stopped part-way. The row already holds everything
 * completed, so this simply continues the loop from wherever it got to.
 */
export async function resumePlanSteps(
  planId: string,
  onProgress: (p: PlanProgress) => void
): Promise<PlanRunResult> {
  const current = await post({ type: "step", planId });
  onProgress({ label: current.label, step: current.step, total: current.total });
  return drive(current, onProgress);
}

async function drive(
  start: Awaited<ReturnType<typeof post>>,
  onProgress: (p: PlanProgress) => void
): Promise<PlanRunResult> {
  let current = start;
  const { planId, clientId, week } = current;

  // A finite bound: the longest run is 11 steps, so anything beyond this is a
  // stage that is not advancing, and looping forever would be worse than
  // surfacing it.
  for (let guard = 0; guard < 30 && !current.done; guard++) {
    let lastError: unknown;
    let advanced = false;
    for (let attempt = 0; attempt <= STEP_RETRIES; attempt++) {
      try {
        current = await post({ type: "step", planId });
        advanced = true;
        break;
      } catch (e) {
        lastError = e;
        // A paused review or a rejected request will not succeed on a retry.
        if (e instanceof PlanStepError && e.paused) throw e;
        if (attempt < STEP_RETRIES) {
          await new Promise((r) => setTimeout(r, RETRY_BACKOFF_MS * (attempt + 1)));
        }
      }
    }
    if (!advanced) throw lastError;
    onProgress({ label: current.label, step: current.step, total: current.total });
  }

  if (!current.done) {
    throw new PlanStepError(
      "Generation stopped making progress. Your work is saved — reopen the client to resume."
    );
  }
  return { planId, clientId, week };
}

export { PlanStepError };
