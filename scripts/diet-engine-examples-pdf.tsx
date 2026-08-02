// Worked Examples — one detailed page per q76 category, computed live.
//
// The handbook (diet-engine-handbook-pdf.tsx) states the arithmetic once,
// against Priya. This walks all FOUR categories end to end — Priya (1),
// Sneha (2), Rahul (3), Aadi (4) — each with real numbers plugged into every
// formula, so a dietitian can see how the SAME engine produces four
// different calorie strategies from four different q76 answers.
//
// Every calculation is shown in three steps, in this order: the raw numbers
// it starts from, the general formula, then that formula worked through with
// those numbers to the result. All of it is read from roadmapFor() /
// weekTargets() at render time, the same functions the counselling API
// calls — nothing here is transcribed or invented for illustration.
//
// Run: npx -y tsx scripts/diet-engine-examples-pdf.tsx

import React from "react";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { Document, Page, StyleSheet, Text, View, renderToBuffer } from "@react-pdf/renderer";

const YELLOW = "#FFED00";
const BLACK = "#0A0A0A";
const INK = "#18181b";
const MUTED = "#71717a";
const FAINT = "#a1a1aa";
const BORDER = "#e4e4e7";
const ALT = "#fafafa";
const PALE = "#FEFCE8";
const STOP = "#b91c1c";
const WARN = "#92400e";

const s = StyleSheet.create({
  page: {
    paddingTop: 22, paddingBottom: 30, paddingHorizontal: 30,
    fontSize: 7.1, fontFamily: "Helvetica", color: INK, lineHeight: 1.3,
  },
  intro: { fontSize: 7, color: MUTED, marginBottom: 10 },
  header: { backgroundColor: BLACK, borderRadius: 5, paddingVertical: 7, paddingHorizontal: 11, marginBottom: 7 },
  headerTitle: { color: "#ffffff", fontSize: 12, fontFamily: "Helvetica-Bold" },
  headerAccent: { color: YELLOW },
  headerSub: { color: "#d4d4d8", fontSize: 6.9, marginTop: 3 },

  h2: { fontSize: 8.6, fontFamily: "Helvetica-Bold", marginTop: 6.5, marginBottom: 2.5, color: INK },
  h3: { fontSize: 7.3, fontFamily: "Helvetica-Bold", marginTop: 3.5, marginBottom: 1.5, color: INK },
  p: { marginBottom: 1.6, color: INK },
  small: { fontSize: 6.5, color: MUTED },

  row: { flexDirection: "row" },
  th: { backgroundColor: BLACK, color: "#ffffff", fontFamily: "Helvetica-Bold", fontSize: 6.4, paddingVertical: 2.4, paddingHorizontal: 4 },
  td: { paddingVertical: 2.2, paddingHorizontal: 4, fontSize: 6.7, borderBottomWidth: 0.4, borderBottomColor: BORDER },
  tdAlt: { backgroundColor: ALT },

  // A calc box always has three rows, in order: given -> formula -> calc.
  calc: {
    backgroundColor: PALE, paddingVertical: 3, paddingHorizontal: 5,
    marginTop: 2, marginBottom: 3, borderLeftWidth: 2, borderLeftColor: YELLOW,
  },
  calcLine: { flexDirection: "row", marginBottom: 1 },
  calcTag: { width: 42, fontFamily: "Helvetica-Bold", fontSize: 6, color: MUTED, textTransform: "uppercase" },
  calcVal: { flex: 1, fontFamily: "Courier", fontSize: 6.7, color: INK },
  calcResult: { flex: 1, fontFamily: "Courier-Bold", fontSize: 6.9, color: INK },

  adapt: {
    fontFamily: "Courier", fontSize: 6.9, color: INK,
    backgroundColor: "#fef2f2", paddingVertical: 3, paddingHorizontal: 5,
    marginTop: 2, marginBottom: 2.5, borderLeftWidth: 2, borderLeftColor: STOP,
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

/** Every quantity in this document is shown the same way: what it starts
 * from, the general rule, then that rule worked through with those numbers. */
const Calc = ({ given, formula, calc }: { given: string; formula: string; calc: string }) => (
  <View style={s.calc}>
    <View style={s.calcLine}><Text style={s.calcTag}>given</Text><Text style={s.calcVal}>{given}</Text></View>
    <View style={s.calcLine}><Text style={s.calcTag}>formula</Text><Text style={s.calcVal}>{formula}</Text></View>
    <View style={s.calcLine}><Text style={s.calcTag}>calc</Text><Text style={s.calcResult}>{calc}</Text></View>
  </View>
);
const Adapt = ({ children }: { children: React.ReactNode }) => <Text style={s.adapt}>{children}</Text>;
const Footer = ({ version }: { version: string }) => (
  <View style={s.footer} fixed>
    <Text>LEANR · Diet Engine — Worked Examples v{version} · every figure read from roadmapFor() at render time</Text>
    <Text render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} />
  </View>
);

const str = (v: string | string[] | undefined): string => (typeof v === "string" ? v : "");
const r1 = (n: number) => Math.round(n * 10) / 10;

/**
 * Re-traces proteinLadder()'s own arithmetic, one row per week, purely to
 * show the working — it uses the same live constants and the same
 * current/target the engine used, so it always lands on the same rungs as
 * roadmap.proteinPath.
 */
function proteinTrace(
  current: number | null,
  target: number,
  share: number,
  cap: number,
  roundTo: number
): { week: number; before: number; gap: number; raw: number; step: number; after: number }[] {
  if (current === null || current <= 0 || current >= target) return [];
  const rows: { week: number; before: number; gap: number; raw: number; step: number; after: number }[] = [];
  let at = current;
  let week = 1;
  while (at < target && week <= 52) {
    const gap = target - at;
    const raw = Math.min(gap * share, cap);
    let step = Math.round(raw / roundTo) * roundTo;
    if (step <= 0 || step >= gap) step = gap;
    const after = Math.round(at + step);
    rows.push({ week, before: Math.round(at), gap: Math.round(gap), raw: r1(raw), step, after });
    at = after;
    week++;
  }
  return rows;
}

async function main() {
  const R = await import("../src/lib/roadmap");
  const { energyEstimate, INTENSITY_MET, DURATION_H } = await import("../src/lib/counselling/energy");
  const { roadmapFor, roadmapAtGoal } = await import("../src/lib/counselling/roadmap-input");
  const { PRIYA, RAHUL, SNEHA, AADI } = await import("./test-clients");

  const V = R.ENGINE_VERSION;

  const CLIENTS = [
    { label: "Priya Test", code: "TEST-001", persona: "32F, vegetarian — PCOS + hypothyroid, severe peanut allergy, first-timer", answers: PRIYA },
    { label: "Sneha Test", code: "TEST-003", persona: "35F, eggetarian, working mother — dieting 11 weeks, weight flat for 4", answers: SNEHA },
    { label: "Rahul Test", code: "TEST-002", persona: "29M, non-vegetarian, desk job — lost weight once before and regained it", answers: RAHUL },
    { label: "Aadi Test", code: "TEST-004", persona: "27M, eggetarian — near goal weight, training for muscle gain", answers: AADI },
  ] as const;

  // Build each client's live roadmap through the SAME path the app uses
  // (roadmapFor reads current intake, category and weeks-on-plan off the
  // answers itself — buildRoadmap alone can't see those).
  const worked = CLIENTS.map(({ label, code, persona, answers }) => {
    const energy = energyEstimate(answers as never);
    const ex = roadmapFor(answers as never)!;
    const exGoal = roadmapAtGoal(answers as never, ex);
    const exW1 = R.weekTargets(ex, 1);
    const weight = Number(str(answers.q9_weight));
    const height = Number(str(answers.q9_height));
    const age = Number(str(answers.q9_age));
    const gender = str(answers.gender);
    const activityLabel = str(answers.q54c);
    const trainingDays = Number(str(answers.q44a)) || 0;
    const heightMStr = (height / 100).toFixed(2);
    const genderTerm = gender.toLowerCase() === "male" ? "+ 5" : "- 161";
    const intensityLabel = str(answers.q44e) || "(unanswered)";
    const durationLabel = str(answers.q44b) || "(unanswered)";
    const met = INTENSITY_MET[str(answers.q44e)] ?? INTENSITY_MET.Light;
    const hours = DURATION_H[str(answers.q44b)] ?? DURATION_H["30–45 minutes"];
    const fatFromShare = Math.round((ex.targetKcal * R.FAT_SHARE) / 9);
    const fatFloor = Math.round(R.FAT_FLOOR_PER_KG * weight);
    const trace = proteinTrace(
      ex.current?.protein_g ?? null,
      ex.macros.protein_g,
      R.PROTEIN_STEP_SHARE,
      R.PROTEIN_STEP_CAP_G,
      R.PROTEIN_STEP_ROUND_G
    );
    return { label, code, persona, answers, energy, ex, exGoal, exW1, weight, height, age, gender, activityLabel, trainingDays, heightMStr, genderTerm, intensityLabel, durationLabel, met, hours, fatFromShare, fatFloor, trace };
  });

  const doc = (
    <Document title={`LEANR Diet Engine — Worked Examples v${V}`}>
      <Page size="A4" style={s.page}>
        <Text style={s.intro}>
          All four q76 counselling categories, computed live via roadmapFor() and weekTargets() — the exact
          functions the counselling API calls, not a re-derivation for print. Every box below reads the same
          way: GIVEN the numbers, FORMULA in general terms, then CALC — that formula worked through with those
          numbers to the result. Companion to the Diet Engine Handbook v{V}.
        </Text>

        {worked.map((w, i) => {
          const { label, code, persona, answers, ex, exGoal, exW1, energy, weight, height, age, gender, activityLabel, trainingDays, heightMStr, genderTerm, intensityLabel, durationLabel, met, hours, fatFromShare, fatFloor, trace } = w;
          const cat = ex.category;
          const tdee = ex.tdee;

          // The one calorie-strategy formula that differs by category — the
          // phases table right after it shows how that plays out week by week.
          let headline: { given: string; formula: string; calc: string };
          if (cat.id === 1) {
            const target = Math.round(tdee * (1 - R.DEFICIT_FIRST_TIMER));
            headline = {
              given: `TDEE = ${tdee} kcal`,
              formula: `target = TDEE × (1 - ${R.DEFICIT_FIRST_TIMER})`,
              calc: `= ${tdee} × ${1 - R.DEFICIT_FIRST_TIMER} = ${target} kcal`,
            };
          } else if (cat.id === 2) {
            const adapted = !!ex.adaptation?.adapted;
            const reentry = Math.round(tdee * (1 - R.DEFICIT_FULL));
            headline = adapted
              ? {
                  given: `TDEE = ${tdee} kcal · adaptation test = ADAPTED`,
                  formula: `diet break = TDEE, ${R.DIET_BREAK_DAYS} · then re-entry = TDEE × (1 - ${R.DEFICIT_FULL})`,
                  calc: `diet break = ${tdee} kcal · re-entry = ${tdee} × ${1 - R.DEFICIT_FULL} = ${reentry} kcal`,
                }
              : {
                  given: `TDEE = ${tdee} kcal · adaptation test = NOT ADAPTED`,
                  formula: `held = TDEE × (1 - ${R.DEFICIT_FULL}), unchanged for 14 days`,
                  calc: `= ${tdee} × ${1 - R.DEFICIT_FULL} = ${reentry} kcal`,
                };
          } else if (cat.id === 3) {
            const steps = R.RESTART_RAMP.map((d) => Math.round(tdee * (1 - d)));
            headline = {
              given: `TDEE = ${tdee} kcal`,
              formula: `ramp = TDEE×(1-${R.RESTART_RAMP[0]}) -> TDEE×(1-${R.RESTART_RAMP[1]}) -> TDEE×(1-${R.RESTART_RAMP[2]})`,
              calc: `= ${tdee}×${1 - R.RESTART_RAMP[0]} -> ${tdee}×${1 - R.RESTART_RAMP[1]} -> ${tdee}×${1 - R.RESTART_RAMP[2]} = ${steps.join(" -> ")} kcal`,
            };
          } else {
            const currentKcal = ex.current?.kcal ?? null;
            const gap = currentKcal ? tdee - currentKcal : 0;
            headline =
              gap > R.REVERSE_TRIGGER_KCAL
                ? {
                    given: `TDEE = ${tdee} kcal · current = ${currentKcal} kcal · gap = ${gap} kcal (over the ${R.REVERSE_TRIGGER_KCAL} kcal trigger)`,
                    formula: `reverse diet = current + ${R.REVERSE_STEP_KCAL} kcal/week, until TDEE`,
                    calc: `= ${currentKcal} + ${R.REVERSE_STEP_KCAL}×n, capped at ${tdee} kcal — see phases below`,
                  }
                : {
                    given: `TDEE = ${tdee} kcal`,
                    formula: `target = TDEE`,
                    calc: `= ${tdee} kcal`,
                  };
          }

          return (
            <View key={code} break={i > 0}>
              <View style={s.header}>
                <Text style={s.headerTitle}>
                  Category {cat.id} · <Text style={s.headerAccent}>{cat.label.split(" —")[0]}</Text>
                </Text>
                <Text style={s.headerSub}>
                  {label} ({code}) — {persona} · constraint: {cat.constraint}
                </Text>
              </View>

              <Text style={s.h2}>Inputs, as answered in the counselling</Text>
              <View style={s.row}>
                <Head w="9%">Age</Head><Head w="9%">Sex</Head><Head w="11%">Height</Head><Head w="11%">Weight</Head>
                <Head w="20%">Activity (q54c)</Head><Head w="14%">Training (q44a)</Head>
                <Head w="13%">Intensity (q44e)</Head><Head w="13%">Duration (q44b)</Head>
              </View>
              <View style={s.row}>
                <Cell w="9%" bold>{age}</Cell>
                <Cell w="9%">{gender}</Cell>
                <Cell w="11%">{height} cm</Cell>
                <Cell w="11%">{weight} kg</Cell>
                <Cell w="20%">{activityLabel} (×{energy.activityFactor})</Cell>
                <Cell w="14%">{trainingDays} day{trainingDays === 1 ? "" : "s"}/week</Cell>
                <Cell w="13%">{intensityLabel}</Cell>
                <Cell w="13%">{durationLabel}</Cell>
              </View>

              <Text style={s.h2}>Measured food day (Q28/Q50/Q112, priced against the foods table)</Text>
              <View style={s.row}>
                <Head w="25%">Calories</Head><Head w="25%">Protein</Head><Head w="25%">Carbs</Head><Head w="25%">Fat</Head>
              </View>
              <View style={s.row}>
                <Cell w="25%" alt bold>{ex.current ? `${ex.current.kcal} kcal` : "not measured"}</Cell>
                <Cell w="25%" alt>{ex.current ? `${ex.current.protein_g} g` : "—"}</Cell>
                <Cell w="25%" alt>{ex.current ? `${ex.current.carbs_g} g` : "—"}</Cell>
                <Cell w="25%" alt>{ex.current ? `${ex.current.fat_g} g` : "—"}</Cell>
              </View>

              <Text style={s.h2}>1 · Energy</Text>
              <Calc
                given={`weight ${weight} kg · height ${height} cm · age ${age} · sex ${gender}`}
                formula="BMR = 10×weight + 6.25×height - 5×age + (male ? +5 : -161)"
                calc={`= 10×${weight} + 6.25×${height} - 5×${age} ${genderTerm} = ${energy.bmr} kcal`}
              />
              <Calc
                given={`intensity "${intensityLabel}" = MET ${met} · duration "${durationLabel}" = ${hours} h · weight ${weight} kg`}
                formula="kcal/session = (MET - 1) × weight × hours   (the -1 nets out the resting hour BMR already covers)"
                calc={`= (${met} - 1) × ${weight} × ${hours} = ${energy.kcalPerSession} kcal/session`}
              />
              <Calc
                given={`BMR ${energy.bmr} kcal · activity "${activityLabel}" = ×${energy.activityFactor} · training ${trainingDays} d/wk × ${energy.kcalPerSession} kcal/session`}
                formula="TDEE = BMR × NEAT + (training days × kcal/session) ÷ 7"
                calc={`= ${energy.bmr} × ${energy.activityFactor} + (${trainingDays} × ${energy.kcalPerSession}) ÷ 7 = ${energy.tdee} kcal`}
              />

              <Text style={s.h2}>2 · BMI, target weight, timeline</Text>
              <Calc
                given={`weight ${weight} kg · height ${heightMStr} m`}
                formula="BMI = weight ÷ height²"
                calc={`= ${weight} ÷ ${heightMStr}² = ${ex.bmi} -> ${ex.band}`}
              />
              <Calc
                given={`height ${heightMStr} m`}
                formula={`target weight = ${R.BMI_TARGET} × height²  (the middle of the healthy range, not its top)`}
                calc={`= ${R.BMI_TARGET} × ${heightMStr}² = ${ex.targetWeightKg} kg (healthy ${ex.healthyRangeKg.low}–${ex.healthyRangeKg.high} kg)`}
              />
              <Calc
                given={`weight ${weight} kg · target ${ex.targetWeightKg} kg`}
                formula="to lose = max(0, weight - target) · first milestone = 5% × weight"
                calc={`= ${weight} - ${ex.targetWeightKg} = ${ex.weightToLoseKg} kg  ·  0.05×${weight} = ${ex.milestone5pctKg} kg`}
              />
              {ex.timeline ? (
                <Calc
                  given={`to lose ${ex.weightToLoseKg} kg · weight ${weight} kg`}
                  formula={`fastest = ceil(to lose ÷ (weight × ${R.RATE_FAST})) · slowest = ceil(to lose ÷ (weight × ${R.RATE_SLOW}))`}
                  calc={`= ceil(${ex.weightToLoseKg} ÷ ${r1(weight * R.RATE_FAST)}) – ceil(${ex.weightToLoseKg} ÷ ${r1(weight * R.RATE_SLOW)}) = ${ex.timeline.fastestWeeks}–${ex.timeline.slowestWeeks} weeks`}
                />
              ) : (
                <Text style={s.small}>Already at or under target weight — no loss timeline to project.</Text>
              )}

              <Text style={s.h2}>3 · Calorie strategy — this category&rsquo;s formula</Text>
              <Calc given={headline.given} formula={headline.formula} calc={headline.calc} />
              <Text style={s.h3}>How that plays out week by week</Text>
              <View style={s.row}>
                <Head w="18%">Phase</Head><Head w="12%">Weeks</Head><Head w="12%">kcal</Head><Head w="58%">Why</Head>
              </View>
              {ex.phases.map((p, pi) => (
                <View style={s.row} key={p.label}>
                  <Cell w="18%" alt={pi % 2 === 1} bold>{p.label}</Cell>
                  <Cell w="12%" alt={pi % 2 === 1}>{p.toWeek ? `${p.fromWeek}–${p.toWeek}` : `${p.fromWeek}+`}</Cell>
                  <Cell w="12%" alt={pi % 2 === 1} bold>{p.kcal}</Cell>
                  <Cell w="58%" alt={pi % 2 === 1}>{p.note}</Cell>
                </View>
              ))}
              {ex.adaptation && (
                <Adapt>
                  given: current {ex.current?.kcal ?? 0} kcal · BMR {energy.bmr} kcal · TDEE {tdee} kcal · weeks on
                  current plan {str(answers.q76_weeks_on_plan) || "—"} · weeks stagnant {str(answers.q76_weeks_stagnant) || "—"}
                  {"\n"}verdict: {ex.adaptation.adapted ? "ADAPTED" : "NOT ADAPTED"} —{" "}
                  {ex.adaptation.reasons.length
                    ? ex.adaptation.reasons.map((r) => `\n  - ${r}`).join("")
                    : "no test fired (deficit not deep/long enough, weight not flat while under-eating)"}
                  {"\n"}action: {ex.adaptation.action}
                </Adapt>
              )}

              <Text style={s.h2}>4 · Macros at target ({ex.targetKcal} kcal)</Text>
              {ex.usedAdjustedWeight && (
                <Calc
                  given={`target weight ${ex.targetWeightKg} kg · actual weight ${weight} kg (BMI >= ${R.ADJUSTED_WEIGHT_FROM_BMI})`}
                  formula={`dosing weight = target + ${R.ADJUSTED_WEIGHT_FACTOR} × (actual - target)`}
                  calc={`= ${ex.targetWeightKg} + ${R.ADJUSTED_WEIGHT_FACTOR}×(${weight} - ${ex.targetWeightKg}) = ${ex.dosingWeightKg} kg`}
                />
              )}
              <Calc
                given={`band ${cat.proteinPerKg} g/kg (category ${cat.id}) · dosing weight ${ex.dosingWeightKg} kg`}
                formula="PROTEIN = band × dosing weight"
                calc={`= ${cat.proteinPerKg} × ${ex.dosingWeightKg} = ${ex.macros.protein_g} g`}
              />
              <Calc
                given={`target kcal ${ex.targetKcal} · actual weight ${weight} kg`}
                formula={`FAT = max(${Math.round(R.FAT_SHARE * 100)}% of kcal ÷ 9, ${R.FAT_FLOOR_PER_KG} g/kg × actual weight)`}
                calc={`= max(${fatFromShare}, ${fatFloor}) = ${ex.macros.fat_g} g`}
              />
              <Calc
                given={`kcal ${ex.targetKcal} · protein ${ex.macros.protein_g} g · fat ${ex.macros.fat_g} g`}
                formula="CARBS = (kcal - protein×4 - fat×9) ÷ 4  ← the residual"
                calc={`= (${ex.targetKcal} - ${ex.macros.protein_g}×4 - ${ex.macros.fat_g}×9) ÷ 4 = ${ex.macros.carbs_g} g`}
              />
              <Calc
                given={`target kcal ${ex.targetKcal}`}
                formula={`FIBRE = clamp(kcal ÷ 1000 × ${R.FIBRE_PER_1000_KCAL}, ${R.FIBRE_FLOOR_G}, ${R.FIBRE_CAP_G})`}
                calc={`= clamp(${ex.targetKcal}÷1000×${R.FIBRE_PER_1000_KCAL}, ${R.FIBRE_FLOOR_G}, ${R.FIBRE_CAP_G}) = ${ex.macros.fibre_g} g`}
              />

              <Text style={s.h2}>5 · Protein ramp — the route to {ex.macros.protein_g} g</Text>
              <Calc
                given={`current ${ex.current?.protein_g ?? 0} g · target ${ex.macros.protein_g} g`}
                formula={`gap = target - current · step = min(gap × ${R.PROTEIN_STEP_SHARE}, ${R.PROTEIN_STEP_CAP_G} g), rounded to ${R.PROTEIN_STEP_ROUND_G} g · recomputed each week against what remains`}
                calc={
                  trace.length
                    ? `${ex.current?.protein_g ?? 0} -> ${ex.proteinPath.join(" -> ")} g over ${ex.proteinPath.length} weeks`
                    : `already at/above target, or nothing measured — ${ex.macros.protein_g} g applies from week 1`
                }
              />
              {trace.length > 0 && (
                <>
                  <View style={s.row}>
                    <Head w="10%">Week</Head><Head w="18%">Before</Head><Head w="18%">Gap</Head>
                    <Head w="27%">Step</Head><Head w="27%">After</Head>
                  </View>
                  {trace.map((t, ti) => (
                    <View style={s.row} key={t.week}>
                      <Cell w="10%" alt={ti % 2 === 1} bold>{t.week}</Cell>
                      <Cell w="18%" alt={ti % 2 === 1}>{t.before} g</Cell>
                      <Cell w="18%" alt={ti % 2 === 1}>{t.gap} g</Cell>
                      <Cell w="27%" alt={ti % 2 === 1}>min({t.gap}×{R.PROTEIN_STEP_SHARE}, {R.PROTEIN_STEP_CAP_G})={t.raw} {"->"} {t.step} g</Cell>
                      <Cell w="27%" alt={ti % 2 === 1} bold>{t.before} + {t.step} = {t.after} g</Cell>
                    </View>
                  ))}
                </>
              )}

              <Text style={s.h2}>6 · What week 1 is built to, and the projection at goal weight</Text>
              <View style={s.row}>
                <Head w="20%"> </Head><Head w="20%">kcal</Head><Head w="20%">Protein</Head><Head w="20%">Fat</Head><Head w="20%">Carbs</Head>
              </View>
              <View style={s.row}>
                <Cell w="20%" bold>Week 1</Cell>
                <Cell w="20%">{exW1.kcal}</Cell>
                <Cell w="20%">{exW1.protein_g} g</Cell>
                <Cell w="20%">{exW1.fat_g} g</Cell>
                <Cell w="20%">{exW1.carbs_g} g</Cell>
              </View>
              <View style={s.row}>
                <Cell w="20%" alt bold>At goal ({exGoal ? `${exGoal.targetWeightKg} kg` : "n/a"})</Cell>
                <Cell w="20%" alt>{exGoal ? exGoal.targetKcal : "—"}</Cell>
                <Cell w="20%" alt>{exGoal ? `${exGoal.macros.protein_g} g` : "—"}</Cell>
                <Cell w="20%" alt>{exGoal ? `${exGoal.macros.fat_g} g` : "—"}</Cell>
                <Cell w="20%" alt>{exGoal ? `${exGoal.macros.carbs_g} g` : "—"}</Cell>
              </View>
              {!exGoal && (
                <Text style={s.small}>
                  No goal-weight projection — this client is already at or under their target weight, so there is
                  nothing to project a maintenance plan onto.
                </Text>
              )}

              <Text style={s.h2}>Flags raised</Text>
              {ex.warnings.length === 0 ? (
                <Text style={s.p}>none</Text>
              ) : (
                ex.warnings.map((wn) => (
                  <Text key={wn.id} style={s.p}>
                    <Text style={{ fontFamily: "Helvetica-Bold", color: wn.stop ? STOP : WARN }}>
                      {wn.stop ? "STOP  " : "warn  "}
                    </Text>
                    {wn.label} — {wn.detail}
                  </Text>
                ))
              )}

              <Footer version={V} />
            </View>
          );
        })}

        <View break>
          <Text style={s.h2}>Reference — the two lookup tables behind kcal/session</Text>
          <Text style={s.p}>
            Every &ldquo;1 · Energy&rdquo; box above looked up a MET value and an hours value from these
            two tables (src/lib/counselling/energy.ts) and multiplied them against that client&rsquo;s own
            body weight. They are reproduced here once, together, rather than repeated on each page.
          </Text>

          <Text style={s.h3}>Table 1 — Intensity (q44e) to MET</Text>
          <View style={s.row}>
            {Object.keys(INTENSITY_MET).map((k) => <Head w="20%" key={k}>{k}</Head>)}
          </View>
          <View style={s.row}>
            {Object.entries(INTENSITY_MET).map(([k, v], i) => (
              <Cell w="20%" key={k} alt={i % 2 === 1} bold>{v}</Cell>
            ))}
          </View>
          <Text style={s.small}>
            &ldquo;Variable&rdquo;, &ldquo;Not sure&rdquo;, or no answer at all all fall back to Light (MET
            {" "}{INTENSITY_MET.Light}) rather than erroring.
          </Text>

          <Text style={s.h3}>Table 2 — Duration (q44b) to hours</Text>
          <View style={s.row}>
            {Object.keys(DURATION_H).map((k) => <Head w="20%" key={k}>{k}</Head>)}
          </View>
          <View style={s.row}>
            {Object.values(DURATION_H).map((v, i) => (
              <Cell w="20%" key={v} alt={i % 2 === 1} bold>{v} h</Cell>
            ))}
          </View>
          <Text style={s.small}>
            Each figure is the midpoint of its band (e.g. &ldquo;30 to 45 minutes&rdquo; to 0.625 h).
            &ldquo;Variable&rdquo; or no answer falls back to 30 to 45 minutes ({DURATION_H["30–45 minutes"]} h).
          </Text>

          <Text style={s.h2}>How the two combine</Text>
          <Calc
            given="MET from Table 1 · hours from Table 2 · body weight in kg"
            formula="kcal/session = (MET - 1) x weight x hours"
            calc="e.g. Rahul: Moderate (MET 5.0), 60-90 min (1.25 h), 82 kg = (5 - 1) x 82 x 1.25 = 410 kcal/session"
          />
          <Text style={s.p}>
            The &ldquo;- 1&rdquo; is what keeps this from double-billing: MET already measures the total
            cost of an activity relative to sitting still, but BMR x NEAT already pays for that resting
            hour everywhere else in the day. Subtracting 1 MET removes exactly that overlap, so a training
            hour is charged for the EXTRA effort over resting, not for the whole hour twice. This is Rule 2
            from scripts/activity-energy-proposal-pdf.tsx, adopted into the live engine — it replaced a
            flat 250 kcal for every session regardless of how hard or how long it was.
          </Text>
        </View>
      </Page>
    </Document>
  );

  const buf = await renderToBuffer(doc);
  const out = path.join(__dirname, "..", "test-output");
  mkdirSync(out, { recursive: true });
  const file = path.join(out, "diet-engine-worked-examples.pdf");
  writeFileSync(file, buf);
  console.log(`Wrote ${file} (${Math.round(buf.length / 1024)} KB) — engine v${V}, ${worked.length} categories`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
