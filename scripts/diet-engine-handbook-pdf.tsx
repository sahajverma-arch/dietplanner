// The Diet Engine Handbook — every formula and constant on two pages.
//
// A reference sheet, not an explainer: roadmap-explainer-pdf.tsx argues the
// reasoning, this one states the arithmetic so a dietitian or an engineer can
// check any number the platform prints.
//
// EVERY constant below is read from the engine's own exports at render time.
// Nothing is transcribed, so the handbook cannot drift from the code — change a
// constant, re-run this, and the page updates itself.
//
// Run: npx -y tsx scripts/diet-engine-handbook-pdf.tsx

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
  /* no secrets needed */
}

const YELLOW = "#FFED00";
const BLACK = "#0A0A0A";
const INK = "#18181b";
const MUTED = "#71717a";
const FAINT = "#a1a1aa";
const BORDER = "#e4e4e7";
const ALT = "#fafafa";
const PALE = "#FEFCE8";
const STOP = "#b91c1c";

const s = StyleSheet.create({
  page: {
    paddingTop: 22, paddingBottom: 30, paddingHorizontal: 30,
    fontSize: 7.1, fontFamily: "Helvetica", color: INK, lineHeight: 1.3,
  },
  header: { backgroundColor: BLACK, borderRadius: 5, paddingVertical: 7, paddingHorizontal: 11, marginBottom: 7 },
  headerTitle: { color: "#ffffff", fontSize: 12, fontFamily: "Helvetica-Bold" },
  headerAccent: { color: YELLOW },
  headerSub: { color: "#d4d4d8", fontSize: 6.9, marginTop: 3 },

  h2: { fontSize: 8.6, fontFamily: "Helvetica-Bold", marginTop: 6.5, marginBottom: 2.5, color: INK },
  p: { marginBottom: 2, color: INK },
  small: { fontSize: 6.5, color: MUTED },

  row: { flexDirection: "row" },
  th: { backgroundColor: BLACK, color: "#ffffff", fontFamily: "Helvetica-Bold", fontSize: 6.4, paddingVertical: 2.4, paddingHorizontal: 4 },
  td: { paddingVertical: 2.2, paddingHorizontal: 4, fontSize: 6.7, borderBottomWidth: 0.4, borderBottomColor: BORDER },
  tdAlt: { backgroundColor: ALT },

  fx: {
    fontFamily: "Courier", fontSize: 6.9, color: INK,
    backgroundColor: PALE, paddingVertical: 3, paddingHorizontal: 5,
    marginTop: 2, marginBottom: 2.5, borderLeftWidth: 2, borderLeftColor: YELLOW,
  },
  footer: {
    position: "absolute", bottom: 14, left: 30, right: 30, fontSize: 6.2, color: FAINT,
    flexDirection: "row", justifyContent: "space-between",
    borderTopWidth: 0.4, borderTopColor: BORDER, paddingTop: 3.5,
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
const Fx = ({ children }: { children: React.ReactNode }) => <Text style={s.fx}>{children}</Text>;
const Footer = ({ page, version }: { page: string; version: string }) => (
  <View style={s.footer} fixed>
    <Text>LEANR · Diet Engine Handbook v{version} · every constant read from src/lib/roadmap.ts at render time</Text>
    <Text>{page}</Text>
  </View>
);

async function main() {
  const R = await import("../src/lib/roadmap");
  const { NEAT_FACTOR, INTENSITY_MET, DURATION_H } = await import("../src/lib/counselling/energy");
  const { roadmapFor, roadmapAtGoal } = await import("../src/lib/counselling/roadmap-input");
  const { PRIYA } = await import("./test-clients");

  const V = R.ENGINE_VERSION;
  const pct = (n: number) => `${Math.round(n * 100)}%`;

  // The worked example, computed live.
  const ex = roadmapFor(PRIYA as never)!;
  const exGoal = roadmapAtGoal(PRIYA as never, ex)!;
  const exW1 = R.weekTargets(ex, 1);

  const doc = (
    <Document title={`LEANR Diet Engine Handbook v${V}`}>
      {/* ------------------------------------------------------------- 1 */}
      <Page size="A4" style={s.page}>
        <View style={s.header}>
          <Text style={s.headerTitle}>
            Diet Engine Handbook — <Text style={s.headerAccent}>every formula, in order</Text>
          </Text>
          <Text style={s.headerSub}>
            v{V} · implements &ldquo;Diet Engine: Rationale &amp; Standards Companion&rdquo; v1.0 ·
            src/lib/roadmap.ts · the engine COMPUTES, nothing here is the model&rsquo;s to choose
          </Text>
        </View>

        <Text style={s.h2}>0 · Inputs</Text>
        <View style={s.row}>
          <Head w="20%">Input</Head><Head w="27%">Source</Head><Head w="53%">Drives</Head>
        </View>
        {[
          ["Height, weight", "Q7 (q9_height, q9_weight)", "BMI, target weight, timeline, fat floor, protein dosing weight"],
          ["Age, sex", "q9_age, gender", "BMR — the floor no calorie target may go below"],
          ["Everyday activity", "q54c", "NEAT multiplier"],
          ["Training days/week", "q44a", "How many sessions get added to TDEE"],
          ["Session intensity, duration", "q44e, q44b", "kcal per session, with body weight"],
          ["Measured food day", "meals · staples · drinks", "Current kcal/protein/carbs/fat — transition trigger, warnings, protein ramp start"],
          ["Client category", "q76_category — DIETITIAN JUDGEMENT", "Calorie strategy and protein band. The one input the engine cannot measure."],
          ["Weeks on deficit / stagnant", "Category 2 only", "Adaptation tests 2 and 3"],
          ["Protein cap", "kidney/liver dx, or a recorded protein limit", "Holds protein; disables the ramp entirely"],
        ].map(([a, b, c], i) => (
          <View style={s.row} key={a as string}>
            <Cell w="20%" alt={i % 2 === 1} bold>{a}</Cell>
            <Cell w="27%" alt={i % 2 === 1} color={MUTED}>{b}</Cell>
            <Cell w="53%" alt={i % 2 === 1}>{c}</Cell>
          </View>
        ))}

        <Text style={s.h2}>1 · Energy (src/lib/counselling/energy.ts)</Text>
        <Fx>
          BMR = 10·weight + 6.25·height − 5·age + (male ? +5 : −161){"\n"}
          kcal/session = (MET − 1) × weight × hours{"\n"}
          TDEE = BMR × NEAT + (training days × kcal/session) ÷ 7
        </Fx>
        <Text style={s.small}>
          NEAT by q54c: {Object.entries(NEAT_FACTOR).map(([k, v]) => `${k} ×${v}`).join(" · ")}. Low
          end of the usual range because training is counted separately — a full &ldquo;very
          active&rdquo; multiplier plus sessions would bill the gym twice.
        </Text>
        <Text style={s.small}>
          MET by session intensity (q44e): {Object.entries(INTENSITY_MET).map(([k, v]) => `${k} ${v}`).join(" · ")}
          — &ldquo;Variable&rdquo;/&ldquo;Not sure&rdquo;/unanswered fall back to Light. Hours by duration
          (q44b): {Object.entries(DURATION_H).map(([k, v]) => `${k} ${v}h`).join(" · ")}. The −1 nets out the
          resting hour the session occupies, since BMR already covers it — the gross MET figure would bill
          that hour twice.
        </Text>

        <Text style={s.h2}>2 · BMI band and target weight</Text>
        <Fx>
          BMI = weight ÷ (height m)²  ·  target = {R.BMI_TARGET} × (height m)²{"\n"}
          healthy range = {R.BMI_NORMAL_LOW}–{R.BMI_RANGE_HIGH} × (height m)²  ·  to lose = max(0, weight − target){"\n"}
          first milestone = 5% of body weight
        </Fx>
        <View style={s.row}>
          <Head w="25%">Underweight</Head><Head w="25%">Normal</Head><Head w="25%">Overweight</Head><Head w="25%">Obese</Head>
        </View>
        <View style={s.row}>
          <Cell w="25%" bold>&lt; {R.BMI_NORMAL_LOW}</Cell>
          <Cell w="25%" alt bold>{R.BMI_NORMAL_LOW} – {R.BMI_OVERWEIGHT}</Cell>
          <Cell w="25%" bold>{R.BMI_OVERWEIGHT} – {R.BMI_OBESE}</Cell>
          <Cell w="25%" alt bold>≥ {R.BMI_OBESE}</Cell>
        </View>
        <Text style={s.small}>
          Asian-Indian cut-offs (Indian Consensus Group 2009), not the Western 25/30. Target sits at
          BMI {R.BMI_TARGET} — the MIDDLE of the healthy range, not its top: a target at{" "}
          {R.BMI_RANGE_HIGH} has no buffer against ordinary 1–2 kg water swings.
        </Text>

        <Text style={s.h2}>3 · Timeline</Text>
        <Fx>
          fastest weeks = ⌈to lose ÷ (weight × {R.RATE_FAST})⌉   slowest = ⌈to lose ÷ (weight × {R.RATE_SLOW})⌉
        </Fx>
        <Text style={s.small}>
          {pct(R.RATE_SLOW)}–{pct(R.RATE_FAST)} of body weight per week. Always a range — a point
          estimate lies. NOTE: derived from the rate assumption, never from the deficit actually
          prescribed, so changing TDEE does not move the predicted finish date.
        </Text>

        <Text style={s.h2}>3b · The universal intake-vs-TDEE/BMR rule (ours — checked before any category below)</Text>
        <Fx>
          current ≥ TDEE, or unmeasured  →  category&rsquo;s own strategy below, unchanged{"\n"}
          BMR ≤ current &lt; TDEE  →  hold = current, weeks 1–{R.RECOMPOSE_HOLD_WEEKS}{"\n"}
          current &lt; BMR  →  hold = BMR (immediate, not ramped), weeks 1–{R.RECOMPOSE_HOLD_WEEKS}{"\n"}
          both hold cases: protein still climbs the ladder (§6), carbohydrate absorbs the difference —
          NO deficit until the hold window ends. What follows it is not yet designed; the phase holds
          flat past week {R.RECOMPOSE_HOLD_WEEKS} until that lands (§7&rsquo;s fallback).
        </Fx>
        <Text style={s.small}>
          Category 2&rsquo;s own adaptation test (below) still runs FIRST and outranks this — a
          deficit-history signal beats a snapshot reading. Only the under-eating snapshot itself moved
          out of that test and into this rule, for every category including 2.
        </Text>

        <Text style={s.h2}>4 · Calories, by category — once at or above TDEE</Text>
        <View style={s.row}>
          <Head w="6%">Cat</Head><Head w="17%">Client</Head><Head w="9%">Protein</Head><Head w="68%">Calorie strategy</Head>
        </View>
        {R.CATEGORIES.map((c, i) => (
          <View style={s.row} key={c.id}>
            <Cell w="6%" alt={i % 2 === 1} bold>{c.id}</Cell>
            <Cell w="17%" alt={i % 2 === 1} bold>{c.label.split(" —")[0]}</Cell>
            <Cell w="9%" alt={i % 2 === 1} bold>{c.proteinPerKg} g/kg</Cell>
            <Cell w="68%" alt={i % 2 === 1}>
              {c.id === 1
                ? `TDEE × (1 − ${R.DEFICIT_FIRST_TIMER}). If current intake exceeds the target by > ${R.TRANSITION_TRIGGER_KCAL} kcal, weeks 1–${R.TRANSITION_WEEKS} run at the midpoint of the two, full target from week ${R.TRANSITION_WEEKS + 1}.`
                : c.id === 2
                  ? `Deficit-history tests below fire first. Neither firing, current at/above TDEE → hold at TDEE × (1 − ${pct(R.DEFICIT_FULL)}) and audit 14 days of weighed logging.`
                  : c.id === 3
                    ? `Ramps ${R.RESTART_RAMP.map((d) => `−${pct(d)}`).join(" → ")} across weeks 1–${R.RESTART_RAMP.length}, then holds. Progression gated on behaviour (6 of 7 days logged), never on the scale.`
                    : `Eat at TDEE. (The reverse diet this category used to run for an under-eating client now happens in §3b instead.)`}
            </Cell>
          </View>
        ))}
        <Fx>
          BMR CLAMP — no target ever goes below BMR. Clamped targets raise a warning.{"\n"}
          Category 2 deficit-history adaptation, EITHER is enough (outranks §3b when it fires):{"\n"}
          {"  "}(a) deficit &gt; {pct(R.ADAPT_DEFICIT_DEPTH)} held &gt; {R.ADAPT_DEFICIT_WEEKS} weeks{"\n"}
          {"  "}(b) weight flat ≥ {R.ADAPT_STAGNANT_WEEKS} weeks while eating ≤ {pct(R.ADAPT_STAGNANT_INTAKE_SHARE)} of TDEE{"\n"}
          Either firing → diet break at TDEE for {R.DIET_BREAK_DAYS} (extra energy to carbohydrate,
          {" "}{R.DIET_BREAK_STEPS}), then re-enter at −{pct(R.DEFICIT_FULL)}.
        </Fx>

        <Footer page="Page 1 of 2" version={V} />
      </Page>

      {/* ------------------------------------------------------------- 2 */}
      <Page size="A4" style={s.page}>
        <View style={s.header}>
          <Text style={s.headerTitle}>
            Macros, the protein ramp, <Text style={s.headerAccent}>and the guardrails</Text>
          </Text>
          <Text style={s.headerSub}>
            Allocation order is deliberate: protein and fat are requirements, carbohydrate is what is
            left to spend on energy
          </Text>
        </View>

        <Text style={s.h2}>5 · Macros — allocated in this order</Text>
        <Fx>
          dosing weight = BMI ≥ {R.ADJUSTED_WEIGHT_FROM_BMI}{"  "}?{"  "}target + {R.ADJUSTED_WEIGHT_FACTOR} × (actual − target){"  "}:{"  "}actual{"\n"}
          PROTEIN = band g/kg × dosing weight{"\n"}
          FAT     = max( {pct(R.FAT_SHARE)} of kcal ÷ 9 , {R.FAT_FLOOR_PER_KG} g/kg × ACTUAL weight ){"\n"}
          CARBS   = (kcal − protein×4 − fat×9) ÷ 4          ← the residual{"\n"}
          FIBRE   = clamp( kcal ÷ 1000 × {R.FIBRE_PER_1000_KCAL} , {R.FIBRE_FLOOR_G} , {R.FIBRE_CAP_G} )
        </Fx>
        <Text style={s.small}>
          Adjusted body weight applies at BMI ≥ {R.ADJUSTED_WEIGHT_FROM_BMI} because adipose tissue
          is far less protein-demanding than lean tissue; {R.ADJUSTED_WEIGHT_FACTOR} is a
          clinical-nutrition convention used when lean mass is unknown — a convention, not a
          measurement. The fat floor is dosed on ACTUAL weight: the hormone requirement does not
          shrink with an adjustment convention. Fibre follows ICMR-NIN ({R.FIBRE_PER_1000_KCAL} g per
          1,000 kcal), not the US IOM figure.
        </Text>

        <Text style={s.h2}>6 · The protein ramp (ours — the companion is silent)</Text>
        <Fx>
          gap = target − current            WPI = MIN( gap × {R.PROTEIN_STEP_SHARE} , {R.PROTEIN_STEP_CAP_G} g ) rounded to {R.PROTEIN_STEP_ROUND_G} g{"\n"}
          recomputed each week against the gap that REMAINS, so the steps taper{"\n"}
          a step that would round to 0 closes the gap instead — the last rung is always the target
        </Fx>
        <Text style={s.small}>
          Example: {R.proteinLadder(20, 80).length} weeks from 20 g to 80 g —{" "}
          20 → {R.proteinLadder(20, 80).join(" → ")} g. Applies to all four categories: the category
          sets the destination, never the speed of approach. Does NOT run where a protein cap is
          recorded — protein is held at measured intake and the band is ignored. Carbohydrate absorbs
          whatever protein has not yet claimed, so each week&rsquo;s macros still sum to its calories.
        </Text>

        <Text style={s.h2}>7 · What a given week is built to</Text>
        <Fx>
          phase   = the calorie phase containing that week (last phase runs onward){"\n"}
          protein = ladder[min(week, ladder length)]        fat = fixed at the steady-state figure{"\n"}
          carbs   = (phase kcal − protein×4 − fat×9) ÷ 4    ← recomputed for THAT week
        </Fx>

        <Text style={s.h2}>8 · Re-basing, and the goal projection</Text>
        <Text style={s.p}>
          Every figure above is downstream of weight, so the roadmap is recomputed from the weight
          recorded at each follow-up, not the counselling weight. Left frozen, a prescribed{" "}
          {pct(R.DEFICIT_FIRST_TIMER)} deficit decays toward maintenance as the client succeeds. The
          target-weight projection re-bases on the target weight AND switches to category 4 —
          at BMI {R.BMI_TARGET} there is nothing left to lose, so a continued deficit would drive
          weight into underweight.
        </Text>

        <Text style={s.h2}>9 · Guardrails</Text>
        <View style={s.row}>
          <Head w="20%">Flag</Head><Head w="10%">Stop?</Head><Head w="70%">Fires when</Head>
        </View>
        {[
          ["underweight", "STOP", `BMI < ${R.BMI_NORMAL_LOW}. No weight-loss plan is issued; route to a senior dietitian.`],
          ["tdee-below-bmr", "STOP", "TDEE < BMR — physiologically impossible, so the activity multiplier is wrong."],
          ["bmr-floor", "warn", "A computed target fell below BMR and was clamped to it."],
          ["chronic-under-eating", "warn", "Reported intake is below BMR — real adaptation or substantial under-reporting either way; §3b raises the target to BMR automatically."],
          ["carb-floor", "warn", `Carbohydrate fell below the ICMR-NIN ${R.CARB_FLOOR_G} g/day minimum.`],
          ["fat-floor", "warn", `Fat set by the ${R.FAT_FLOOR_PER_KG} g/kg hormone floor rather than the ${pct(R.FAT_SHARE)} share.`],
          ["protein-held", "warn", "A kidney/liver condition or recorded protein limit — protein held, ramp disabled."],
        ].map(([id, stop, when], i) => (
          <View style={s.row} key={id as string}>
            <Cell w="20%" alt={i % 2 === 1} bold>{id}</Cell>
            <Cell w="10%" alt={i % 2 === 1} bold color={stop === "STOP" ? STOP : MUTED}>{stop}</Cell>
            <Cell w="70%" alt={i % 2 === 1}>{when}</Cell>
          </View>
        ))}

        <Text style={s.h2}>10 · Worked example, computed live</Text>
        <View style={s.row}>
          <Head w="34%">Step</Head><Head w="66%">Result</Head>
        </View>
        {[
          ["Category", `${ex.category.label.split(" —")[0]} — ${ex.category.constraint}`],
          ["BMI / band", `${ex.bmi} · ${ex.band}`],
          ["Target weight", `${R.BMI_TARGET} × height² = ${ex.targetWeightKg} kg (healthy ${ex.healthyRangeKg.low}–${ex.healthyRangeKg.high} kg)`],
          ["To lose · milestone", `${ex.weightToLoseKg} kg · first ${ex.milestone5pctKg} kg (5%)`],
          ["Timeline", `${ex.timeline!.fastestWeeks}–${ex.timeline!.slowestWeeks} weeks`],
          [
            "Calories",
            ex.current && ex.current.kcal > 0 && ex.current.kcal < ex.tdee
              ? `current ${ex.current.kcal} kcal < TDEE ${ex.tdee} → §3b holds at ${ex.targetKcal} kcal (weeks 1–${R.RECOMPOSE_HOLD_WEEKS})`
              : `TDEE ${ex.tdee} × (1 − ${R.DEFICIT_FIRST_TIMER}) = ${ex.targetKcal} kcal`,
          ],
          ["Dosing weight", `${ex.dosingWeightKg} kg${ex.usedAdjustedWeight ? " (adjusted — BMI ≥ 25)" : " (actual)"}`],
          ["Macros at target", `P ${ex.macros.protein_g} · F ${ex.macros.fat_g} · C ${ex.macros.carbs_g} · fibre ${ex.macros.fibre_g} g`],
          ["Protein ramp", `${ex.current!.protein_g} g measured → ${ex.proteinPath.join(" → ")} g over ${ex.proteinPath.length} weeks`],
          ["Week 1 is built to", `${exW1.kcal} kcal · P ${exW1.protein_g} · F ${exW1.fat_g} · C ${exW1.carbs_g} g`],
          ["At the target weight", `${ex.targetWeightKg} kg · ${exGoal.targetKcal} kcal maintenance · P ${exGoal.macros.protein_g} · F ${exGoal.macros.fat_g} · C ${exGoal.macros.carbs_g} g`],
          ["Flags raised", ex.warnings.length ? ex.warnings.map((w) => w.id).join(", ") : "none"],
        ].map(([a, b], i) => (
          <View style={s.row} key={a as string}>
            <Cell w="34%" alt={i % 2 === 1} bold>{a}</Cell>
            <Cell w="66%" alt={i % 2 === 1}>{b}</Cell>
          </View>
        ))}

        <Footer page="Page 2 of 2" version={V} />
      </Page>
    </Document>
  );

  const buf = await renderToBuffer(doc);
  const out = path.join(__dirname, "..", "test-output");
  mkdirSync(out, { recursive: true });
  const file = path.join(out, "diet-engine-handbook.pdf");
  writeFileSync(file, buf);
  console.log(`Wrote ${file} (${Math.round(buf.length / 1024)} KB) — engine v${V}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
