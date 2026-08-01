// Interview preparation brief for the LEANR diet platform.
//
// Written to be REHEARSED, not read aloud: the pitch, the system you may be
// asked to whiteboard, the decisions worth defending, three stories that carry
// real numbers, a question drill, and the gaps you should raise before an
// interviewer finds them.
//
// Engine figures are computed at render time, so the brief cannot quote a
// constant the code no longer holds.
//
// Run: npx -y tsx scripts/interview-prep-pdf.tsx

import React from "react";
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { Document, Page, StyleSheet, Text, View, renderToBuffer } from "@react-pdf/renderer";

const envPath = path.join(__dirname, "..", ".env.local");
try {
  for (const line of readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m && !(m[1] in process.env)) process.env[m[1]] = m[2];
  }
} catch {
  /* none needed */
}

const YELLOW = "#FFED00";
const BLACK = "#0A0A0A";
const INK = "#18181b";
const MUTED = "#71717a";
const FAINT = "#a1a1aa";
const BORDER = "#e4e4e7";
const ALT = "#fafafa";
const PALE = "#FEFCE8";
const GOOD = "#15803d";
const WARN = "#b45309";

const s = StyleSheet.create({
  page: { paddingTop: 22, paddingBottom: 30, paddingHorizontal: 32, fontSize: 7.3, fontFamily: "Helvetica", color: INK, lineHeight: 1.33 },
  header: { backgroundColor: BLACK, borderRadius: 5, paddingVertical: 7, paddingHorizontal: 11, marginBottom: 7 },
  headerTitle: { color: "#ffffff", fontSize: 12, fontFamily: "Helvetica-Bold" },
  headerAccent: { color: YELLOW },
  headerSub: { color: "#d4d4d8", fontSize: 6.9, marginTop: 3 },

  h2: { fontSize: 8.8, fontFamily: "Helvetica-Bold", marginTop: 7, marginBottom: 2.5 },
  h3: { fontSize: 7.6, fontFamily: "Helvetica-Bold", marginTop: 5, marginBottom: 1.5 },
  p: { marginBottom: 2.5 },
  small: { fontSize: 6.6, color: MUTED },
  q: { fontFamily: "Helvetica-Bold", marginTop: 4, marginBottom: 1 },

  row: { flexDirection: "row" },
  th: { backgroundColor: BLACK, color: "#ffffff", fontFamily: "Helvetica-Bold", fontSize: 6.5, paddingVertical: 2.5, paddingHorizontal: 4 },
  td: { paddingVertical: 2.4, paddingHorizontal: 4, fontSize: 6.8, borderBottomWidth: 0.4, borderBottomColor: BORDER },
  tdAlt: { backgroundColor: ALT },

  quote: { backgroundColor: PALE, borderLeftWidth: 2.5, borderLeftColor: YELLOW, padding: 5, marginTop: 3, marginBottom: 3 },
  code: { fontFamily: "Courier", fontSize: 6.6, color: INK },
  footer: {
    position: "absolute", bottom: 14, left: 32, right: 32, fontSize: 6.2, color: FAINT,
    flexDirection: "row", justifyContent: "space-between", borderTopWidth: 0.4, borderTopColor: BORDER, paddingTop: 3.5,
  },
});

const Cell = ({ w, children, alt = false, bold = false, color }: { w: string; children: React.ReactNode; alt?: boolean; bold?: boolean; color?: string }) => (
  <View style={[s.td, alt ? s.tdAlt : {}, { width: w }]}>
    <Text style={{ fontFamily: bold ? "Helvetica-Bold" : "Helvetica", color: color ?? INK }}>{children}</Text>
  </View>
);
const Head = ({ w, children }: { w: string; children: React.ReactNode }) => (
  <View style={[s.th, { width: w }]}><Text>{children}</Text></View>
);
const Footer = ({ page }: { page: string }) => (
  <View style={s.footer} fixed>
    <Text>LEANR diet platform · interview brief · rehearse, do not read</Text>
    <Text>{page}</Text>
  </View>
);
const QA = ({ q, children }: { q: string; children: React.ReactNode }) => (
  <View>
    <Text style={s.q}>Q · {q}</Text>
    <Text style={s.p}>{children}</Text>
  </View>
);

async function main() {
  const R = await import("../src/lib/roadmap");
  const { roadmapFor, roadmapAtGoal } = await import("../src/lib/counselling/roadmap-input");
  const { PRIYA } = await import("./test-clients");
  const ex = roadmapFor(PRIYA as never)!;
  const goal = roadmapAtGoal(PRIYA as never, ex)!;
  const w1 = R.weekTargets(ex, 1);
  const pct = (n: number) => `${Math.round(n * 100)}%`;

  const doc = (
    <Document title="LEANR diet platform — interview brief">
      {/* ------------------------------------------------------------ 1 */}
      <Page size="A4" style={s.page}>
        <View style={s.header}>
          <Text style={s.headerTitle}>
            LEANR diet platform — <Text style={s.headerAccent}>interview brief</Text>
          </Text>
          <Text style={s.headerSub}>
            The pitch · the system · what to defend · three stories with numbers · a question drill ·
            the gaps to raise first
          </Text>
        </View>

        <Text style={s.h2}>The 30-second pitch</Text>
        <View style={s.quote}>
          <Text>
            A platform for dietitians running clinical weight-loss consultations. It captures a
            55–65 minute structured counselling, computes the client&rsquo;s calorie and macro
            prescription from published clinical standards, and uses an LLM to compose a culturally
            appropriate 7-day Indian meal plan against those numbers — then re-costs every meal
            against a food-composition database and produces a PDF the dietitian reviews before the
            client sees it.{" "}
            <Text style={{ fontFamily: "Helvetica-Bold" }}>
              The interesting problem is the boundary: the arithmetic is deterministic and the prose
              is generative, and deciding which side each number lives on is the whole design.
            </Text>
          </Text>
        </View>

        <Text style={s.h2}>The system, if asked to whiteboard it</Text>
        <Text style={s.code}>
          Ops Google Sheet ──(daily cron)──▶ appointments table{"\n"}
          {"                                        "}│{"\n"}
          {"  "}Dietitian ──▶ counselling form ({SECTION_COUNT} sections, autosaved per keystroke){"\n"}
          {"                    "}│{"\n"}
          {"                    "}▼{"\n"}
          {"        "}┌── DIET ENGINE (pure arithmetic) ──▶ kcal · protein · fat · carbs · fibre{"\n"}
          {"        "}│{"    "}BMI band, target weight, timeline, deficit strategy, protein ramp{"\n"}
          {"        "}│{"\n"}
          {"        "}├── AI CLINICAL REVIEW ──▶ 5 outcomes, incl. PAUSE (422, nothing persisted){"\n"}
          {"        "}│{"\n"}
          {"        "}└── PLAN GENERATION (~11 resumable steps, one per request){"\n"}
          {"                    "}│{"  "}engine numbers applied to model output, not requested from it{"\n"}
          {"                    "}▼{"\n"}
          {"          "}GROUNDING ──▶ ~7,900-food Postgres table, fuzzy match + portion resolution{"\n"}
          {"                    "}│{"\n"}
          {"                    "}▼{"\n"}
          {"          "}DRAFT ──▶ dietitian reviews / revises ──▶ PDF in private bucket
        </Text>

        <Text style={s.h2}>Stack and scale</Text>
        <View style={s.row}>
          <Head w="25%">Layer</Head><Head w="35%">Choice</Head><Head w="40%">Why, if pushed</Head>
        </View>
        {[
          ["Frontend", "Next.js 14 App Router · TS · Tailwind", "Server components keep the clinical logic off the client"],
          ["Data / auth / files", "Supabase — Postgres, Auth, Storage", "Row Level Security per dietitian; one dependency, not three"],
          ["AI", "NVIDIA NIM, Llama 3.1 70B + fallback model", "Server-side only; models get retired, so a fallback is mandatory"],
          ["PDF", "@react-pdf/renderer, server-rendered", "Private bucket, short-lived signed URLs"],
          ["Scale", `${SRC_LOC} LOC app · ${MIGRATIONS} migrations · ${SUITES} test suites · ${ROUTES} API routes`, "Counselling is data, not code: 15 sections, 332 fields"],
        ].map(([a, b, c], i) => (
          <View style={s.row} key={a as string}>
            <Cell w="25%" alt={i % 2 === 1} bold>{a}</Cell>
            <Cell w="35%" alt={i % 2 === 1}>{b}</Cell>
            <Cell w="40%" alt={i % 2 === 1} color={MUTED}>{c}</Cell>
          </View>
        ))}

        <Text style={s.h2}>The five decisions worth defending</Text>
        <View style={s.row}>
          <Head w="27%">Decision</Head><Head w="36%">Why</Head><Head w="37%">What it cost</Head>
        </View>
        {[
          ["Engine computes, model writes", "The model demonstrably chose its own numbers — it pulled a week-2 protein figure into a week-1 plan because a review mentioned it", "The prompt must still SEE the numbers, or the prose argues for a different plan than the one issued"],
          ["Ground macros post-generation", "The model composes menus well and estimates calories badly", "A meal keeps the model's estimate unless EVERY item resolves — partial substitution undercounts"],
          ["Stepped generation", "Generation is ~10 model calls over minutes; the platform caps a function at 60s", "State machine in the DB, idempotent steps, a resumable row instead of a lost tab"],
          ["Refuse rather than degrade", "An allergen in a plan is not a quality issue, it is a safety one", "Hard 422s and refusals a user cannot override"],
          ["Counselling as data", "105 clinical questions whose wording changes constantly", "A schema interpreter to build and test, instead of forms"],
        ].map(([a, b, c], i) => (
          <View style={s.row} key={a as string}>
            <Cell w="27%" alt={i % 2 === 1} bold>{a}</Cell>
            <Cell w="36%" alt={i % 2 === 1}>{b}</Cell>
            <Cell w="37%" alt={i % 2 === 1} color={MUTED}>{c}</Cell>
          </View>
        ))}

        <Footer page="Page 1 of 3" />
      </Page>

      {/* ------------------------------------------------------------ 2 */}
      <Page size="A4" style={s.page}>
        <View style={s.header}>
          <Text style={s.headerTitle}>
            Three stories — <Text style={s.headerAccent}>each carries a number</Text>
          </Text>
          <Text style={s.headerSub}>
            Interviewers remember specifics. Lead with the symptom, land on the number, close on the
            principle.
          </Text>
        </View>

        <Text style={s.h2}>1 · The software manufactured the plateau it would later diagnose</Text>
        <Text style={s.p}>
          <Text style={{ fontFamily: "Helvetica-Bold" }}>Symptom:</Text> the roadmap said a client
          faced 28–55 weeks of weight loss, but every number in the prescription stopped changing
          around week 5.{"\n"}
          <Text style={{ fontFamily: "Helvetica-Bold" }}>Cause:</Text> every engine figure is
          downstream of body weight, and the roadmap re-derived from the intake record, which is
          never updated. Follow-ups wrote the new weight to a different column entirely.{"\n"}
          <Text style={{ fontFamily: "Helvetica-Bold" }}>Number:</Text> a prescribed{" "}
          {pct(R.DEFICIT_FIRST_TIMER)} deficit decays to about 6% by goal weight — the client stops
          losing, and the next counselling classifies them &ldquo;plateaued&rdquo; for it.{"\n"}
          <Text style={{ fontFamily: "Helvetica-Bold" }}>Fix:</Text> re-base on the weight recorded
          for the week being planned — not the client&rsquo;s latest, so regenerating an old week
          cannot use a future weight. The intake record stays immutable.{"\n"}
          <Text style={{ fontFamily: "Helvetica-Bold" }}>Principle:</Text> in a stateful clinical
          product, ask what decays. A number that was right at capture is not right forever, and
          nothing about the output looks wrong while it rots.
        </Text>

        <Text style={s.h2}>2 · Counting days instead of work</Text>
        <Text style={s.p}>
          Training was credited at a flat 250 kcal per session. Duration and intensity are both
          asked, both stored, and neither reached the arithmetic — so 5 light 30–45 minute sessions
          earned 179 kcal/day while 4 moderate 60–90 minute sessions earned 143. Separately, the
          activity multiplier came from a five-word self-description while the measured step count
          sat unused: two clients reporting the identical step band differed by 318 kcal/day of
          allowance because of the adjective each chose.{"\n"}
          <Text style={{ fontFamily: "Helvetica-Bold" }}>Principle:</Text> audit the inputs you
          already collect before adding new ones. The fix was not more data — it was using what the
          form had been capturing all along, and replacing an input rather than adding a term, so as
          not to double-count.
        </Text>

        <Text style={s.h2}>3 · Where the engine refuses</Text>
        <Text style={s.p}>
          A weight-loss plan for an underweight client, or a target computed from a TDEE below BMR,
          is a confident, well-formatted, entirely wrong prescription — the most dangerous kind of
          software error, because nothing about it looks wrong. The engine raises hard stops for
          both, refuses a plan containing a recorded allergen, and holds protein where a kidney or
          liver condition is recorded rather than dosing off the g/kg band.{"\n"}
          <Text style={{ fontFamily: "Helvetica-Bold" }}>The subtle one worth telling:</Text> the
          hard stop existed but did not stop anything — the engine simply returned null and
          generation fell through to a legacy path. A guardrail that logs and proceeds is not a
          guardrail.
        </Text>

        <Text style={s.h2}>The worked example — memorise this client</Text>
        <View style={s.row}>
          <Head w="30%">Figure</Head><Head w="70%">Value</Head>
        </View>
        {[
          ["Profile", `BMI ${ex.bmi} ${ex.band} · ${ex.category.label.split(" —")[0]} · TDEE ${ex.tdee} kcal · eats ${ex.current!.kcal} kcal measured`],
          ["Target weight", `${ex.targetWeightKg} kg (BMI ${R.BMI_TARGET}, mid-range not top) · ${ex.weightToLoseKg} kg to lose`],
          ["Timeline", `${ex.timeline!.fastestWeeks}–${ex.timeline!.slowestWeeks} weeks at ${pct(R.RATE_SLOW)}–${pct(R.RATE_FAST)} body weight/week`],
          ["Daily target", `${ex.targetKcal} kcal while losing (${pct(R.DEFICIT_FIRST_TIMER)} off TDEE)`],
          ["Week 1 is built to", `${w1.kcal} kcal · P ${w1.protein_g} · F ${w1.fat_g} · C ${w1.carbs_g} g`],
          ["Protein ramp", `${ex.current!.protein_g} g measured → ${ex.proteinPath.join(" → ")} g over ${ex.proteinPath.length} weeks`],
          ["At goal weight", `${goal.targetKcal} kcal maintenance — ${goal.targetKcal - ex.targetKcal} MORE than while losing`],
          ["Why more", `daily need falls ${ex.tdee - goal.tdee} kcal, but the ${ex.tdee - ex.targetKcal} kcal deficit comes off — the deficit is larger`],
        ].map(([a, b], i) => (
          <View style={s.row} key={a as string}>
            <Cell w="30%" alt={i % 2 === 1} bold>{a}</Cell>
            <Cell w="70%" alt={i % 2 === 1}>{b}</Cell>
          </View>
        ))}
        <Text style={s.small}>
          If you can walk this client end to end from memory, you can answer almost any question
          about the product without notes.
        </Text>

        <Footer page="Page 2 of 3" />
      </Page>

      {/* ------------------------------------------------------------ 3 */}
      <Page size="A4" style={s.page}>
        <View style={s.header}>
          <Text style={s.headerTitle}>
            Question drill — <Text style={s.headerAccent}>and the gaps to raise yourself</Text>
          </Text>
          <Text style={s.headerSub}>
            Answers are compressed on purpose: say the first sentence, then stop and let them ask
          </Text>
        </View>

        <QA q="Why not let the LLM decide the calories and macros?">
          Because it does, and it is wrong in ways that look right. A client measured at 76 g protein
          with an 86 g target got a plan written to 92 g, because the clinical review mentioned 92 as
          a week-2 figure and the model pulled it forward. Anything derivable by arithmetic from a
          measurement is computed and applied; the model composes menus and prose, which is what it
          is actually good at.
        </QA>

        <QA q="How do you know the generated plan is safe?">
          Layered, and each layer refuses rather than warns. Forbidden foods are listed in the
          prompt, checked against the returned meals, fed back for correction, and if an allergen
          survives the plan is refused rather than shipped. Structure is Zod-validated with a
          corrective retry. Numbers are overwritten by the engine. Then an independent AI clinical
          review can PAUSE generation entirely — 422, nothing persisted, the counselling stays a
          draft.
        </QA>

        <QA q="What would you do differently?">
          Persist the computed roadmap with the plan. It is recomputed from the intake on every
          render, so the day a clinical constant changes, every historical plan silently re-explains
          itself with today&rsquo;s numbers and there is no record of what the client was actually
          given. In a clinical product that is an audit problem, not a caching one. It is the first
          thing I would fix.
        </QA>

        <QA q="How do you test something whose output is non-deterministic?">
          Split it. The engine is pure arithmetic and pinned by hand-derived assertions traceable to
          the published standard — a drifting constant changes every prescription silently, so the
          expected values are worked by hand, not captured from output. The generative half is
          tested on its contract: schema validity, allergen absence, day-to-day variety, and whether
          the grounded macros land inside the prescribed band.
        </QA>

        <QA q="Biggest technical constraint?">
          A 60-second serverless function ceiling against a generation that takes minutes. It became
          a state machine: a row created up front, one unit of work per request, each step persisted
          before returning. A failed step retries alone instead of discarding the run, and a closed
          tab leaves a resumable job.
        </QA>

        <QA q="How do you handle model deprecation?">
          A primary and a fallback model, configured separately, with the fallback tried on timeout
          or validation failure. This is from experience — a model went 410 Gone mid-project. There
          is a benchmark script to verify a model against the real workload before relying on it.
        </QA>

        <Text style={s.h2}>Raise these before they find them</Text>
        <View style={s.row}>
          <Head w="30%">Gap</Head><Head w="70%">How to frame it</Head>
        </View>
        {[
          ["Roadmap not persisted", "Known, prioritised, and I can describe the migration. Shows I know the difference between a bug and an audit gap."],
          ["Timeline ignores the deficit", "It is a fixed 0.5–1.0%/week rate assumption, so changing TDEE does not move the predicted finish date. Inconsistent, and I would fix it next."],
          ["Protein dosing convention", "Adjusted body weight is a convention used because lean mass is unknown. Capture body fat and it should dose on lean mass instead."],
          ["Fibre has a target, no measurement", "The intake prices calories and three macros only, so fibre is prescribed against nothing."],
          ["Self-reported everything", "Steps, portions, adherence. The counselling records the tracking source precisely because a phone undercounts and an estimate is a guess."],
        ].map(([a, b], i) => (
          <View style={s.row} key={a as string}>
            <Cell w="30%" alt={i % 2 === 1} bold color={WARN}>{a}</Cell>
            <Cell w="70%" alt={i % 2 === 1}>{b}</Cell>
          </View>
        ))}

        <Text style={s.h2}>Two things to get right in the room</Text>
        <Text style={s.p}>
          <Text style={{ fontFamily: "Helvetica-Bold", color: GOOD }}>Be exact about your role.</Text>{" "}
          Say what you specified, what you reviewed, and what someone else built. Interviewers probe
          ownership claims, and a clean boundary is more impressive than a vague large one — the
          clinical-specification and quality-gate work stands on its own.{"\n"}
          <Text style={{ fontFamily: "Helvetica-Bold", color: GOOD }}>Bring usage numbers.</Text>{" "}
          Everything here is about the system, not its impact. Dietitians using it, consultations per
          week, time to produce a plan before and after, adherence or dropout movement — one real
          metric outperforms every architectural detail on these three pages.
        </Text>

        <Footer page="Page 3 of 3" />
      </Page>
    </Document>
  );

  const buf = await renderToBuffer(doc);
  const out = path.join(__dirname, "..", "test-output");
  mkdirSync(out, { recursive: true });
  const file = path.join(out, "interview-brief.pdf");
  writeFileSync(file, buf);
  console.log(`Wrote ${file} (${Math.round(buf.length / 1024)} KB)`);
}

// Static project stats, measured once and quoted in the stack table.
const SRC_LOC = "19,000";
const MIGRATIONS = 9;
const SUITES = 13;
const ROUTES = 5;
const SECTION_COUNT = 15;

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
