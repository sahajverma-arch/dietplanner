// Everything the counselling recorded, formatted for reading back.
//
// The client summary has to show the WHOLE consultation, not a curated ten
// fields — a dietitian sitting with the client will be asked about anything on
// it. So this walks the question bank itself rather than listing ids by hand:
// a question added, removed or made conditional tomorrow appears or disappears
// here with no further work, and nothing can silently go missing from the
// summary because someone forgot to add it.
//
// Only what was actually answered comes back, and only from sections that are
// visible for this client — an unanswered question is noise on a page whose
// whole job is to be read aloud.

import {
  answered,
  questionNumber,
  visibleQuestions,
  visibleSections,
  type Answers,
  type Question,
  type QuestionTag,
  type Stage,
} from "./questions";
import { decodeStaplePick } from "../protein-intake";
import { decodeVariants, macrosOf, variantLabel } from "./meal-variants";

const CM_PER_INCH = 2.54;

export interface RecordItem {
  id: string;
  /** Question number from the bank ("39"), or "" for the identity fields. */
  number: string;
  label: string;
  /** One display line per value — multi-selects and meal variants give several. */
  values: string[];
  tag?: QuestionTag;
}

export interface RecordSection {
  id: string;
  code: string;
  title: string;
  stage: Stage;
  items: RecordItem[];
}

/**
 * One question's answer as lines of readable text.
 *
 * The storage shapes that exist for the dietitian's convenience — staples
 * encoded as "Roti × 2", meal variants as JSON, height as bare centimetres —
 * are all unwound here, because the summary is read by a person and sometimes
 * out loud to the client.
 */
export function answerLines(q: Question, a: Answers): string[] {
  const raw = a[q.id];

  if (Array.isArray(raw)) {
    if (q.type === "portions") {
      return raw.map((entry) => {
        const pick = decodeStaplePick(entry);
        return pick ? `${pick.label} × ${pick.units}` : entry;
      });
    }
    return raw.filter((v) => v.trim());
  }

  const text = typeof raw === "string" ? raw.trim() : "";
  if (!text) return [];

  if (q.type === "mealVariants") {
    return decodeVariants(text)
      .filter((v) => v.items.length > 0)
      .map((v) => {
        const items = v.items
          .map((i) => (i.qty ? `${i.food} ${i.qty}` : i.food))
          .join(", ");
        const macros = macrosOf(v);
        const protein = macros.protein_g ? ` · ${Math.round(macros.protein_g)} g protein` : "";
        return `${variantLabel(v)} — ${items} · ${v.daysPerWeek}/7 days${protein}`;
      });
  }

  if (q.type === "height") {
    const cm = Number(text);
    if (Number.isFinite(cm) && cm > 0) {
      const inches = Math.round(cm / CM_PER_INCH);
      return [`${text} cm · ${Math.floor(inches / 12)} ft ${inches % 12} in`];
    }
  }

  if (q.type === "scale10") return [`${text} / 10`];

  return [text];
}

/** The whole counselling, section by section, answered questions only. */
export function counsellingRecord(a: Answers): RecordSection[] {
  return visibleSections(a)
    .map((section) => ({
      id: section.id,
      code: section.code,
      title: section.title,
      stage: section.stage,
      items: visibleQuestions(section, a)
        .filter((q) => answered(a, q.id))
        .map((q) => ({
          id: q.id,
          number: questionNumber(q.id),
          label: q.label,
          values: answerLines(q, a),
          tag: q.tag,
        }))
        .filter((item) => item.values.length > 0),
    }))
    .filter((section) => section.items.length > 0);
}

/** How many questions were answered in total — the header's "N answers". */
export const recordSize = (sections: RecordSection[]): number =>
  sections.reduce((n, s) => n + s.items.length, 0);

/**
 * A single answer, looked up for the curated panels at the top of the summary.
 * Returns "" rather than throwing when the question no longer exists, so the
 * page survives the question bank being edited underneath it.
 */
export const lineFor = (a: Answers, id: string): string => {
  const raw = a[id];
  if (Array.isArray(raw)) return raw.join(" · ");
  return typeof raw === "string" ? raw.trim() : "";
};
