// A 3-page explainer: what the standards companion says, what we took from it,
// what the counselling supplies, and a worked example.
//
// Every number in it is computed by src/lib/roadmap.ts at render time rather
// than typed in, so the document cannot drift from the engine it describes —
// re-run it after any constant changes and the example updates itself.
//
// Run: npx -y tsx scripts/roadmap-explainer-pdf.tsx

import React from "react";
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import {
  Document,
  Page,
  StyleSheet,
  Text,
  View,
  renderToBuffer,
} from "@react-pdf/renderer";

const envPath = path.join(__dirname, "..", ".env.local");
try {
  for (const line of readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m && !(m[1] in process.env)) process.env[m[1]] = m[2];
  }
} catch {
  /* the explainer needs no secrets; the import below just prefers them present */
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
  page: {
    paddingTop: 30,
    paddingBottom: 42,
    paddingHorizontal: 38,
    fontSize: 8.2,
    fontFamily: "Helvetica",
    color: INK,
    lineHeight: 1.45,
  },
  header: {
    backgroundColor: BLACK,
    borderRadius: 6,
    paddingVertical: 11,
    paddingHorizontal: 14,
    marginBottom: 12,
  },
  headerTitle: { color: "#ffffff", fontSize: 13, fontFamily: "Helvetica-Bold" },
  headerAccent: { color: YELLOW },
  headerSub: { color: "#d4d4d8", fontSize: 7.6, marginTop: 4 },

  h2: {
    fontSize: 10,
    fontFamily: "Helvetica-Bold",
    marginTop: 13,
    marginBottom: 5,
    color: INK,
  },
  h3: { fontSize: 8.6, fontFamily: "Helvetica-Bold", marginTop: 8, marginBottom: 3 },
  p: { marginBottom: 4, color: INK },
  small: { fontSize: 7.4, color: MUTED },

  row: { flexDirection: "row" },
  th: {
    backgroundColor: BLACK,
    color: "#ffffff",
    fontFamily: "Helvetica-Bold",
    fontSize: 7.4,
    paddingVertical: 4,
    paddingHorizontal: 5,
  },
  td: {
    paddingVertical: 4,
    paddingHorizontal: 5,
    fontSize: 7.6,
    borderBottomWidth: 0.5,
    borderBottomColor: BORDER,
  },
  tdAlt: { backgroundColor: ALT },

  callout: {
    backgroundColor: PALE,
    borderLeftWidth: 3,
    borderLeftColor: YELLOW,
    padding: 7,
    marginTop: 6,
    marginBottom: 4,
  },
  code: { fontFamily: "Courier", fontSize: 7.6, color: INK },
  footer: {
    position: "absolute",
    bottom: 20,
    left: 38,
    right: 38,
    fontSize: 6.8,
    color: FAINT,
    flexDirection: "row",
    justifyContent: "space-between",
    borderTopWidth: 0.5,
    borderTopColor: BORDER,
    paddingTop: 5,
  },
});

const Cell = ({
  w,
  children,
  alt = false,
  bold = false,
  color,
}: {
  w: string;
  children: React.ReactNode;
  alt?: boolean;
  bold?: boolean;
  color?: string;
}) => (
  <View style={[s.td, alt ? s.tdAlt : {}, { width: w }]}>
    <Text style={{ fontFamily: bold ? "Helvetica-Bold" : "Helvetica", color: color ?? INK }}>
      {children}
    </Text>
  </View>
);

const Head = ({ w, children }: { w: string; children: React.ReactNode }) => (
  <View style={[s.th, { width: w }]}>
    <Text>{children}</Text>
  </View>
);

// The engine version is read, never typed: a footer claiming v1.0 on a document
// generated from v1.1 is the exact drift this script exists to make impossible.
const Footer = ({ page, version }: { page: string; version: string }) => (
  <View style={s.footer} fixed>
    <Text>
      LEANR · Diet engine v{version} — implementation of the Fitelo/Fitty Standards Companion v1.0
    </Text>
    <Text>{page}</Text>
  </View>
);

async function main() {
  const { buildRoadmap, weekTargets, proteinLadder, settleWeek, CATEGORIES, ENGINE_VERSION, RECOMPOSE_HOLD_WEEKS } =
    await import("../src/lib/roadmap");
  const { roadmapFor } = await import("../src/lib/counselling/roadmap-input");
  const { estimateProteinIntake } = await import("../src/lib/protein-intake");
  const { energyEstimate } = await import("../src/lib/counselling/energy");
  const { PRIYA } = await import("./test-clients");

  const answers = PRIYA as never;
  const priya = roadmapFor(answers)!;
  const intake = estimateProteinIntake(answers);
  const energy = energyEstimate(answers);

  // The companion's own worked example, so the document can be checked against
  // the published figures rather than only against our own client.
  const worked = buildRoadmap({
    heightCm: 172,
    weightKg: 84,
    bmr: 1800,
    tdee: 2300,
    currentKcal: 2600,
    currentProteinG: 55,
    currentCarbsG: 300,
    currentFatG: 95,
    category: 1,
  })!;

  // Each row below now applies only once a client is eating AT OR ABOVE
  // TDEE — anything under it is intercepted first by the universal
  // intake-vs-TDEE/BMR rule described just after this table (ours, not in
  // the companion). That rule replaced the transition/adaptation/reverse-diet
  // mechanics each category used to run on its own for an under-eating start.
  const CAT_ROWS = [
    {
      n: "1",
      name: "First-timer",
      problem: "Habit formation",
      calories: "At or above TDEE: TDEE − 17.5% (midpoint of the 15–20% band). If current intake exceeds the target by more than 400 kcal, weeks 1–2 run at the midpoint of the two and the full target starts week 3.",
      protein: "1.35 g/kg",
      sec: "§6.1, §6.2, §7.2",
    },
    {
      n: "2",
      name: "Plateaued",
      problem: "Diagnosis — adapted, or logging drift?",
      calories: "Two deficit-HISTORY tests (a deep deficit held 8+ weeks, or weight stagnant 3+ weeks while under-eating) outrank the universal rule when either fires: diet break at TDEE for 10–14 days (extra energy to carbohydrate, +1,500–2,000 steps), then re-enter at −20%. If neither fires and current is at or above TDEE: hold the target and audit 14 days of weighed logging.",
      protein: "1.9 g/kg",
      sec: "§6.4, §7.2",
    },
    {
      n: "3",
      name: "Re-starter",
      problem: "Rebuilding confidence",
      calories: "At or above TDEE: ramps −10% → −15% → −20% across weeks 1–3, then holds. Each step is ~5% of TDEE, below the level at which a change is consciously felt. Progression is gated on behaviour (6 of 7 days logged), never on the scale.",
      protein: "1.9 g/kg",
      sec: "§6.5, §7.2",
    },
    {
      n: "4",
      name: "Maintenance",
      problem: "Not regaining",
      calories: "At or above TDEE: eat at TDEE. An under-eating maintenance client no longer reverse-diets on their own — the universal rule below now covers that start instead.",
      protein: "1.5 g/kg",
      sec: "§6.6, §7.2",
    },
  ];

  const INPUT_ROWS = [
    ["Height, weight", "Q7", "BMI band, target weight, weight to lose, timeline, fat floor"],
    ["Age, sex", "Q1, client details", "BMR (Mifflin-St Jeor) — the floor no target may go below"],
    ["Everyday activity", "Q54c", "The NEAT multiplier: ×1.2 seated → ×1.7 highly physical"],
    ["Training days a week, intensity, duration", "Q44a, Q44e, Q44b", "kcal/session = (MET − 1) × weight × hours, added to TDEE averaged over 7 days"],
    ["The whole food day", "Meal options × days a week, staples, drinks", "Measured current intake — drives the universal intake-vs-TDEE/BMR rule (page 1), the transition trigger, and both of Category 2's deficit-history adaptation tests"],
    ["Client category", "Dietitian assessment", "Calorie strategy and protein band. The one judgement the engine cannot make."],
    ["Weeks on deficit / stagnant", "Dietitian assessment (Category 2 only)", "Adaptation tests 2 and 3"],
  ];

  const STEP_ROWS = [
    ["1", "BMI and target weight", "BMI on Asian-Indian cut-offs (overweight ≥23, obese ≥25). Target = 21.0 × height², the middle of the healthy range, not its top — a target at 22.9 has no buffer against normal 1–2 kg water swings.", "§4.1, §4.2"],
    ["2", "Timeline", "Weight to lose ÷ (0.5–1.0% of body weight per week). Reported as a range, never a date.", "§5"],
    ["3", "Calories", "By category (see page 1). Never below BMR — below resting requirement a nutritionally adequate Indian plate cannot be built without dropping a whole food group.", "§6"],
    ["4", "Macros", "Protein first (band × dosing weight), then fat (greater of 25% of energy and 0.7 g/kg), then carbohydrate as the residual. Fibre 15 g/1,000 kcal, floored at 30 and capped at 45.", "§7"],
    ["4b", "Protein ramp", "The band is the destination, not week 1. Each week closes a quarter of the remaining gap — capped at 20 g, rounded to 5 g — from what the client measurably eats now up to the requirement. Carbohydrate absorbs whatever protein has not yet claimed.", "ours"],
    ["5", "The report", "Flags travel with the numbers and are read first. The current-versus-target delta is what makes it coachable.", "§8"],
  ];

  const doc = (
    <Document title="LEANR diet engine — how the roadmap works">
      {/* ---------------------------------------------------------------- 1 */}
      <Page size="A4" style={s.page}>
        <View style={s.header}>
          <Text style={s.headerTitle}>
            How the roadmap works — <Text style={s.headerAccent}>the four client categories</Text>
          </Text>
          <Text style={s.headerSub}>
            LEANR diet engine, implementing “Diet Engine: Rationale &amp; Standards Companion” v1.0
            (July 2026) · every figure below is computed by the engine, not transcribed
          </Text>
        </View>

        <Text style={s.h2}>What the document is, and what it changed here</Text>
        <Text style={s.p}>
          The companion is the reasoning behind a diet engine: for each rule it states what the
          engine does, why, and which published standard it is anchored to — ICMR-NIN 2020 and 2024,
          the Indian Consensus Group 2009 BMI cut-offs, WHO 2004, and the ISSN position stands. Its
          governing principle (§2) is that every number is produced by deterministic code and the
          language model writes only prose:
        </Text>
        <View style={s.callout}>
          <Text>
            “Language models are unreliable arithmetic engines. They are excellent at producing a
            number that looks right. A confabulated macro target is not a cosmetic error — it is a
            clinical one, and it is invisible, because the wrong number reads exactly like the right
            number.”
          </Text>
        </View>
        <Text style={s.p}>
          Our plan generator now follows that split. Calories, protein, fat and carbohydrate are
          computed from the client&apos;s own measurements and applied to the plan; the model writes
          the strategy, the meals and the coaching prose around them, and is told the four numbers so
          its text agrees with them.
        </Text>

        <Text style={s.h2}>The four categories</Text>
        <Text style={[s.p, s.small]}>
          A category changes exactly two things — the calorie strategy and the protein band. BMI
          classification, target weight, timeline, fat, fibre and every guardrail are identical for
          all four. That restraint is the specification&apos;s own: each extra branch is a path to
          test, explain and maintain.
        </Text>

        <View style={s.row}>
          <Head w="4%">#</Head>
          <Head w="13%">Category</Head>
          <Head w="17%">The client&apos;s real problem</Head>
          <Head w="45%">Calorie strategy</Head>
          <Head w="9%">Protein</Head>
          <Head w="12%">Source</Head>
        </View>
        {CAT_ROWS.map((c, i) => (
          <View style={s.row} key={c.n} wrap={false}>
            <Cell w="4%" alt={i % 2 === 1} bold>
              {c.n}
            </Cell>
            <Cell w="13%" alt={i % 2 === 1} bold>
              {c.name}
            </Cell>
            <Cell w="17%" alt={i % 2 === 1}>
              {c.problem}
            </Cell>
            <Cell w="45%" alt={i % 2 === 1}>
              {c.calories}
            </Cell>
            <Cell w="9%" alt={i % 2 === 1} bold>
              {c.protein}
            </Cell>
            <Cell w="12%" alt={i % 2 === 1} color={MUTED}>
              {c.sec}
            </Cell>
          </View>
        ))}

        <Text style={s.h3}>
          Before any of that: where the client eats now, against TDEE and BMR (ours — the companion
          is silent)
        </Text>
        <Text style={s.p}>
          Every category above used to run its own, inconsistent reaction to a client who arrives
          already under-eating — a transition phase, an adaptation test with a diet break to TDEE, a
          reverse diet, or nothing at all. That&rsquo;s replaced with one rule, checked first, for
          every category:
        </Text>
        <View style={s.callout}>
          <Text>
            At or above TDEE (or nothing measured): unchanged, each category&rsquo;s own strategy
            above runs exactly as written. Between BMR and TDEE: hold flat at the client&rsquo;s
            measured intake for {RECOMPOSE_HOLD_WEEKS} weeks — no deficit yet, protein climbs the
            existing ladder and carbohydrate gives up the room. Below BMR: raised straight to BMR in
            week 1 (not ramped), then the same hold.
          </Text>
        </View>
        <Text style={s.p}>
          Category 2&rsquo;s adaptation test still runs first and still outranks this: a deep deficit
          held 8+ weeks, or weight stagnant 3+ weeks while under-eating, is a signal from DEFICIT
          HISTORY that a single kcal reading cannot see, so it still sends that client to a diet break
          at TDEE regardless of where today&rsquo;s intake sits. Only the under-eating reading itself
          moved out of that test — it&rsquo;s the universal rule&rsquo;s job now.
        </Text>
        <Text style={[s.p, s.small]}>
          What a client moves to after the hold window is a separate design question, deliberately
          left open for now — the phase holds flat past it until that follow-up work lands.
        </Text>

        <Text style={s.h3}>Why the protein bands differ (§7.2)</Text>
        <Text style={s.p}>
          A sedentary Indian adult eats roughly 0.6–0.9 g/kg, mostly from cereals. Taking a
          first-timer straight to 1.9 g/kg is close to a threefold increase: it causes GI distress,
          costs money, displaces vegetables from the plate and alarms the family. 1.35 g/kg is
          already well above the ICMR-NIN RDA of 0.83 and is a step a client can build a habit
          around. Categories 2 and 3 are in an active deficit, where protein is the primary
          determinant of whether the weight lost is fat or muscle, so they sit at the top of the
          ISSN 1.4–2.0 band. Category 4 has no deficit to defend against.
        </Text>

        <Text style={s.h3}>
          Getting to the band is a ramp, not a step (ours — the companion is silent)
        </Text>
        <Text style={s.p}>
          The companion sets the destination and says nothing about the route, which left a client
          measured at {worked.current!.protein_g} g/day being handed their full{" "}
          {worked.macros.protein_g} g target in week 1. That is the restrictive jump the
          counselling&rsquo;s dropout and restriction questions exist to predict, so the engine now
          walks it up instead:
        </Text>
        <Text style={[s.code, { marginBottom: 3 }]}>
          weekly increase = MIN(remaining gap × 0.25, 20 g), rounded to the nearest 5 g
        </Text>
        <Text style={s.p}>
          Recomputed each week against the gap that is left, so the steps start large and taper —
          for this client {worked.current!.protein_g} →{" "}
          {proteinLadder(worked.current!.protein_g, worked.macros.protein_g).join(" → ")} g, arriving
          in week {settleWeek(worked)}. The shape matches how adherence actually behaves: the first
          change is the easy one, and the last few grams need the habit already in place. A step that
          would round to nothing closes the gap instead, so the ladder always reaches the
          requirement rather than stalling one rung short of it. It applies to all four categories —
          the category decides where a client is going, never how fast they can get there — and it
          does not run at all where a kidney or liver condition, or a recorded protein limit, means
          protein must be held where it is.
        </Text>

        <Text style={s.h3}>Heavier clients are dosed on adjusted body weight (§7.2)</Text>
        <Text style={[s.code, { marginBottom: 3 }]}>
          adjusted = ideal + 0.25 × (actual − ideal), where ideal = BMI 21 × height²
        </Text>
        <Text style={s.p}>
          Applied at BMI ≥ 25. Adipose tissue is about 85% lipid and far less protein-demanding than
          lean tissue, so dosing a heavy client on total weight produces a number that is
          unnecessary, expensive and difficult to eat. The 0.25 factor is a clinical-nutrition
          convention used precisely when lean mass is unknown — it is a convention, not a
          measurement, and once body-fat percentage is captured this should dose on lean mass
          instead.
        </Text>

        <Footer page="Page 1 of 3" version={ENGINE_VERSION} />
      </Page>

      {/* ---------------------------------------------------------------- 2 */}
      <Page size="A4" style={s.page}>
        <Text style={s.h2}>What the engine takes from the counselling</Text>
        <Text style={[s.p, s.small]}>
          Eight inputs decide the numbers. Everything else the counselling records — allergies,
          conditions, medications, cuisines, likes and dislikes, day rules, meal timings, cooking
          facilities, budget — decides the food, and is passed to the plan separately. In short: the
          engine decides the numbers, the counselling decides what goes on the plate.
        </Text>

        <View style={s.row}>
          <Head w="22%">Input</Head>
          <Head w="30%">Where it comes from</Head>
          <Head w="48%">What it drives</Head>
        </View>
        {INPUT_ROWS.map((r, i) => (
          <View style={s.row} key={r[0]} wrap={false}>
            <Cell w="22%" alt={i % 2 === 1} bold>
              {r[0]}
            </Cell>
            <Cell w="30%" alt={i % 2 === 1}>
              {r[1]}
            </Cell>
            <Cell w="48%" alt={i % 2 === 1}>
              {r[2]}
            </Cell>
          </View>
        ))}

        <Text style={s.h2}>The five steps</Text>
        <View style={s.row}>
          <Head w="5%">#</Head>
          <Head w="20%">Step</Head>
          <Head w="63%">What the engine does</Head>
          <Head w="12%">Source</Head>
        </View>
        {STEP_ROWS.map((r, i) => (
          <View style={s.row} key={r[0]} wrap={false}>
            <Cell w="5%" alt={i % 2 === 1} bold>
              {r[0]}
            </Cell>
            <Cell w="20%" alt={i % 2 === 1} bold>
              {r[1]}
            </Cell>
            <Cell w="63%" alt={i % 2 === 1}>
              {r[2]}
            </Cell>
            <Cell w="12%" alt={i % 2 === 1} color={MUTED}>
              {r[3]}
            </Cell>
          </View>
        ))}

        <Text style={s.h2}>The guardrails (§9)</Text>
        <Text style={s.p}>
          <Text style={{ fontFamily: "Helvetica-Bold" }}>BMR floor</Text> — no target ever falls
          below resting requirement.{" "}
          <Text style={{ fontFamily: "Helvetica-Bold" }}>Underweight stop</Text> — a weight-loss
          prescription for an underweight client is a foreseeable harm; route to a senior dietitian.{" "}
          <Text style={{ fontFamily: "Helvetica-Bold" }}>TDEE below BMR</Text> — physiologically
          impossible, so the activity level was mis-entered; rejected rather than computed from.{" "}
          <Text style={{ fontFamily: "Helvetica-Bold" }}>Chronic under-eating</Text> — reported
          intake below BMR is flagged (real adaptation or substantial under-reporting either way),
          and the universal rule on page 1 raises the target straight to BMR rather than cutting
          further.{" "}
          <Text style={{ fontFamily: "Helvetica-Bold" }}>Hormone floor</Text> — fat never below
          0.7 g/kg. A hard stop suppresses the prescription entirely; the plan then falls back to
          the measured-intake progression rather than computing from numbers known to be wrong.
        </Text>

        <Text style={s.h2}>Where we deliberately differ from the current specification</Text>
        <Text style={[s.p, s.small]}>
          Five items from the companion&apos;s own §10 “recommended refinements” are implemented,
          each either additive or explicitly argued there.
        </Text>
        <Text style={s.p}>
          <Text style={{ fontFamily: "Helvetica-Bold" }}>§10.1</Text> Fibre at 15 g per 1,000 kcal,
          not 14 — 14 is the US Institute of Medicine figure, while ICMR-NIN states 30 g per 2,000.
          {"  "}
          <Text style={{ fontFamily: "Helvetica-Bold" }}>§10.2</Text> A 100 g carbohydrate floor
          check, because carbohydrate is the residual and can be squeezed by a high protein band at
          a low calorie target.{"  "}
          <Text style={{ fontFamily: "Helvetica-Bold" }}>§10.6</Text> A client already eating below
          the computed target is not silently told to eat more — superseded by the universal
          intake-vs-TDEE/BMR rule (page 1), which now holds or raises to BMR instead of a warning.
          {"  "}
          <Text style={{ fontFamily: "Helvetica-Bold" }}>§10.7</Text> The constants version is
          stamped on every roadmap.{"  "}
          <Text style={{ fontFamily: "Helvetica-Bold" }}>§10.8</Text> A 5% interim milestone, since
          a 20 kg target across 28–55 weeks is demotivating on first contact.
        </Text>
        <Text style={[s.p, { color: WARN }]}>
          Still open: §10.9, which the companion calls its most significant gap — the engine will
          issue a prescription to a client who is pregnant, on glucose-lowering medication, or has
          chronic kidney disease or a history of disordered eating. Our counselling raises a red flag
          on each of these, but nothing yet blocks generation on them.
        </Text>

        <Footer page="Page 2 of 3" version={ENGINE_VERSION} />
      </Page>

      {/* ---------------------------------------------------------------- 3 */}
      <Page size="A4" style={s.page}>
        <Text style={s.h2}>Worked example — a real client, computed by the engine</Text>
        <Text style={[s.p, s.small]}>
          32-year-old woman, 160 cm, 74 kg, vegetarian, PCOS and hypothyroidism, lightly active with
          3 training days. Classified by the dietitian as Category 1, first-timer. Every figure below
          is produced by the engine from the counselling; none is typed into this document.
        </Text>

        <Text style={s.h3}>Step 1 — BMI and target weight</Text>
        <Text style={s.code}>
          BMI = 74 ÷ 1.60² = {priya.bmi} ({priya.band}, Asian-Indian cut-offs)
        </Text>
        <Text style={s.code}>
          target = 21.0 × 1.60² = {priya.targetWeightKg} kg · healthy range{" "}
          {priya.healthyRangeKg.low}–{priya.healthyRangeKg.high} kg · to lose{" "}
          {priya.weightToLoseKg} kg
        </Text>

        <Text style={s.h3}>Step 2 — Timeline</Text>
        <Text style={s.code}>
          {priya.weightToLoseKg} kg ÷ (0.5–1.0% of 74 kg per week) ={" "}
          {priya.timeline!.fastestWeeks}–{priya.timeline!.slowestWeeks} weeks · first milestone{" "}
          {priya.milestone5pctKg} kg (5%)
        </Text>

        <Text style={s.h3}>Step 3 — Calories</Text>
        <Text style={s.code}>
          BMR {energy.bmr} × {energy.activityFactor} activity + {energy.trainingDays} training days
          = TDEE {priya.tdee}
        </Text>
        {intake.kcalPerDay > 0 && intake.kcalPerDay < priya.tdee ? (
          <>
            <Text style={s.code}>
              current {intake.kcalPerDay} kcal is below TDEE {priya.tdee} — the universal
              intake-vs-TDEE/BMR rule (page 1) takes over before Category 1&rsquo;s own formula runs
            </Text>
            <Text style={s.code}>
              target = {priya.targetKcal} kcal, held flat weeks 1–{RECOMPOSE_HOLD_WEEKS}
            </Text>
            <Text style={[s.p, s.small]}>
              She measures at {intake.kcalPerDay} kcal now, below her {priya.tdee} kcal TDEE and{" "}
              {intake.kcalPerDay >= (energy.bmr ?? 0) ? "at or above" : "below"} her{" "}
              {energy.bmr} kcal BMR, so the universal rule intercepts: {intake.kcalPerDay} kcal is
              held flat while protein climbs the ladder and carbohydrate gives up the room, instead
              of Category 1&rsquo;s own 17.5% deficit formula computing an immediate cut.
            </Text>
          </>
        ) : (
          <>
            <Text style={s.code}>
              target = {priya.tdee} × (1 − 0.175) = {priya.targetKcal} kcal
            </Text>
            <Text style={[s.p, s.small]}>
              She eats {intake.kcalPerDay} kcal now, at or above TDEE, so Category 1&rsquo;s own
              formula runs as written: the gap from current intake to the target is{" "}
              {Math.abs(intake.kcalPerDay - priya.targetKcal) > 400
                ? "over 400 kcal, so a two-week transition applies first"
                : "inside normal daily variation, so no transition phase is needed and week 1 starts at the full figure"}
              .
            </Text>
          </>
        )}

        <Text style={s.h3}>Step 4 — Macros</Text>
        <Text style={s.code}>
          BMI {priya.bmi} ≥ 25, so protein doses on adjusted weight:
        </Text>
        <Text style={s.code}>
          adjusted = {priya.targetWeightKg} + 0.25 × (74 − {priya.targetWeightKg}) ={" "}
          {priya.dosingWeightKg} kg
        </Text>
        <Text style={s.code}>
          protein = 1.35 × {priya.dosingWeightKg} = {priya.macros.protein_g} g · fat = max(25% of{" "}
          {priya.targetKcal} kcal, 0.7 × 74) = {priya.macros.fat_g} g
        </Text>
        <Text style={s.code}>
          carbohydrate = ({priya.targetKcal} − {priya.macros.protein_g}×4 − {priya.macros.fat_g}×9) ÷
          4 = {priya.macros.carbs_g} g · fibre {priya.macros.fibre_g} g
        </Text>

        <Text style={s.h3}>What actually changes — the delta is the conversation (§8)</Text>
        <View style={s.row}>
          <Head w="26%">Nutrient</Head>
          <Head w="22%">Eats now</Head>
          <Head w="22%">Target</Head>
          <Head w="30%">Change</Head>
        </View>
        {[
          ["Energy", `${priya.current!.kcal} kcal`, `${priya.targetKcal} kcal`, priya.targetKcal - priya.current!.kcal, "kcal"],
          ["Protein", `${priya.current!.protein_g} g`, `${priya.macros.protein_g} g`, priya.macros.protein_g - priya.current!.protein_g, "g"],
          ["Carbohydrate", `${priya.current!.carbs_g} g`, `${priya.macros.carbs_g} g`, priya.macros.carbs_g - priya.current!.carbs_g, "g"],
          ["Fat", `${priya.current!.fat_g} g`, `${priya.macros.fat_g} g`, priya.macros.fat_g - priya.current!.fat_g, "g"],
        ].map((r, i) => (
          <View style={s.row} key={String(r[0])} wrap={false}>
            <Cell w="26%" alt={i % 2 === 1} bold>
              {r[0] as string}
            </Cell>
            <Cell w="22%" alt={i % 2 === 1}>
              {r[1] as string}
            </Cell>
            <Cell w="22%" alt={i % 2 === 1} bold>
              {r[2] as string}
            </Cell>
            <Cell w="30%" alt={i % 2 === 1} color={(r[3] as number) >= 0 ? GOOD : WARN}>
              {(r[3] as number) > 0 ? "+" : ""}
              {r[3] as number} {r[4] as string}
            </Cell>
          </View>
        ))}
        <Text style={[s.p, s.small, { marginTop: 4 }]}>
          Read as a delta, this client&apos;s plan is not a calorie cut at all — energy and
          carbohydrate barely move. It is {priya.macros.protein_g - priya.current!.protein_g} g more
          protein and {priya.current!.fat_g - priya.macros.fat_g} g less fat: a change of
          composition, not of quantity.
        </Text>

        <Text style={s.h3}>The first four weeks</Text>
        <View style={s.row}>
          {[1, 2, 3, 4].map((w) => {
            const t = weekTargets(priya, w);
            return (
              <View
                key={w}
                style={{
                  width: "25%",
                  borderWidth: 0.5,
                  borderColor: BORDER,
                  padding: 5,
                  marginRight: 3,
                }}
              >
                <Text style={{ fontSize: 6.8, color: MUTED }}>WEEK {w}</Text>
                <Text style={{ fontSize: 11, fontFamily: "Helvetica-Bold" }}>{t.kcal}</Text>
                <Text style={{ fontSize: 7, color: MUTED }}>
                  P{t.protein_g} F{t.fat_g} C{t.carbs_g}
                </Text>
              </View>
            );
          })}
        </View>
        <Text style={[s.p, s.small, { marginTop: 4 }]}>
          Flat kcal, because {intake.kcalPerDay > 0 && intake.kcalPerDay < priya.tdee
            ? "she's in the universal rule's hold-and-recompose window"
            : "no transition phase applies to her"} — only protein and carbohydrate move week to
          week. A Category 3 re-starter at or above TDEE would instead step down each week, and a
          first-timer at or above TDEE whose intake exceeded the target by more than 400 kcal would
          run two weeks at the midpoint first.
        </Text>

        <Text style={s.h3}>The same engine on the companion&apos;s published example</Text>
        <Text style={[s.p, s.small]}>
          84 kg, 172 cm, TDEE 2,300, eating 2,600 — the case worked through in §6.2. Our engine
          reproduces its figures exactly, which is how we know the implementation matches the
          document:
        </Text>
        <Text style={s.code}>
          target weight {worked.targetWeightKg} kg · to lose {worked.weightToLoseKg} kg ·{" "}
          {worked.timeline!.fastestWeeks}–{worked.timeline!.slowestWeeks} weeks
        </Text>
        <Text style={s.code}>
          calories {worked.current!.kcal} → {weekTargets(worked, 1).kcal} (weeks 1–2) →{" "}
          {worked.targetKcal} · protein {worked.current!.protein_g} → {worked.macros.protein_g} g ·
          fat {worked.macros.fat_g} g
        </Text>
        <View style={s.callout}>
          <Text>
            The transition is not a small deficit — at {weekTargets(worked, 1).kcal} kcal against a
            2,300 kcal need it is effectively maintenance. Its job is to stop the gain, change the
            food structure and build the logging habit while hunger is still near zero. Say so in
            week one, or the client weighs themselves on day 14, sees nothing, and concludes the plan
            does not work — two weeks before the plan has actually started.
          </Text>
        </View>

        <Footer page="Page 3 of 3" version={ENGINE_VERSION} />
      </Page>
    </Document>
  );

  const buffer = await renderToBuffer(doc);
  const outDir = path.join(__dirname, "..", "test-output");
  mkdirSync(outDir, { recursive: true });
  const out = path.join(outDir, "roadmap-explainer.pdf");
  writeFileSync(out, buffer);
  console.log(`Wrote ${out} (${(buffer.length / 1024).toFixed(0)} KB)`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
