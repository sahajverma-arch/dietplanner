// Support for the "Quick Counselling" form — a short intake asking only the
// questions that actually feed the roadmap engine (roadmap.ts) and the diet
// generator (nim.ts's exchangeBlock/weekdayFoodRules/forbidden-food block),
// instead of the full ~105-question LeanR bank.
//
// The hard part is missingRequired(): both /api/generate-plan and
// /api/plan-step reject a request the instant `intake.answers` is a non-null
// object unless every one of ~65 required questions is answered — checked by
// PRESENCE, not by whether the question matters to plan generation. Rather
// than relaxing that gate (risking the full form's safety net) or building a
// second generation pipeline, a quick-intake submission auto-fills every
// required question it didn't ask with a clearly-labeled sentinel, so the
// EXACT SAME missingRequired() check, /counselling/review page, and
// ClientDossier component the full form uses work completely unchanged.
// isQuickIntake() lets ClientDossier show a banner so a dietitian reviewing
// the record knows screening was abbreviated, not that the client had
// nothing to report.
import { SECTIONS, missingRequired, type Answers, type Question } from "./questions";

const ALL_QUESTIONS: Question[] = SECTIONS.flatMap((s) => s.questions);
const QUESTION_MAP = new Map(ALL_QUESTIONS.map((q) => [q.id, q]));

/** Look up a real question definition by id — used to render the quick
 * form's curated list with the exact same labels/options/showIf the full
 * form uses, instead of a hand-copied (and driftable) duplicate. */
export function findQuestion(id: string): Question | undefined {
  return QUESTION_MAP.get(id);
}

/** Set on a quick-intake draft's answers so ClientDossier can tell it apart
 * from a fully-screened client. Not a real question id — never read by
 * missingRequired(), roadmap.ts, or nim.ts. */
export const QUICK_INTAKE_MARKER_ID = "_quickIntake";
export const isQuickIntake = (a: Answers): boolean => a[QUICK_INTAKE_MARKER_ID] === "true";

/**
 * form_drafts.kind for a quick-intake draft — DELIBERATELY separate from the
 * full form's "first_counselling". They used to share that key (same
 * dietitian_id + appointment_id slot), on the reasoning that one appointment
 * is only ever counselled one way at a time — wrong: a dietitian who tried
 * the full form for an appointment, then switched to Quick Counselling for
 * the same slot (or the reverse), had the two forms silently share a draft,
 * so the quick form inherited stray full-form data (a whole week of typed
 * meal variants showing up in a submission that never asked for one) and the
 * full form could just as easily inherit a quick-intake draft's sentinel
 * answers. Two keys, two drafts, no crossover — /counselling/review is the
 * only place that reads either, since a client is either quick-intake or
 * fully screened, never both at once.
 */
export const QUICK_INTAKE_DRAFT_KIND = "quick_counselling";

/** What an auto-filled required question reads as — deliberately distinct
 * from any real clinical answer like "None" so it can never be mistaken for
 * one when the record is read back later. */
export const QUICK_INTAKE_SENTINEL = "Not collected — quick intake";

/**
 * Fills every required question the quick form doesn't ask with the
 * sentinel, iterating because some requirements only appear once an earlier
 * one is answered (a food picked in q27 requires its own allergy/intolerance
 * follow-up, a day-rule practice in q38 requires which days). A capped loop
 * guards against a genuine cycle rather than hanging.
 */
export function fillUnaskedRequired(answers: Answers): Answers {
  const a: Answers = { ...answers };
  for (let guard = 0; guard < 10; guard++) {
    const missing = missingRequired(a);
    if (missing.length === 0) break;
    for (const m of missing) {
      const q = QUESTION_MAP.get(m.questionId);
      a[m.questionId] = q?.type === "multi" || q?.type === "portions" ? [QUICK_INTAKE_SENTINEL] : QUICK_INTAKE_SENTINEL;
    }
  }
  return a;
}

const isSentinelValue = (v: string | string[] | undefined): boolean =>
  v === QUICK_INTAKE_SENTINEL || (Array.isArray(v) && v.length === 1 && v[0] === QUICK_INTAKE_SENTINEL);

/**
 * The counselling record is meant to show only what was actually answered —
 * a sentinel-filled question is not that, it just satisfies missingRequired()
 * so the shared submission/generation pipeline keeps working. Anything that
 * DISPLAYS the record back (the review page's cards, the full-record dump,
 * the printed PDF) should read this stripped copy instead of the raw
 * answers, or a quick-intake client's summary reads back "Not collected —
 * quick intake" as if it were dozens of real answers.
 *
 * Never use this for missingRequired()/generation — those need the fields
 * fillUnaskedRequired() added, or the submission is rejected downstream.
 */
export function stripSentinelFields(answers: Answers): Answers {
  const out: Answers = {};
  for (const [id, value] of Object.entries(answers)) {
    if (isSentinelValue(value)) continue;
    out[id] = value;
  }
  return out;
}
