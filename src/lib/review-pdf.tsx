// The counselling review page, as a PDF a dietitian can save or hand to a
// client. Every number is computed by the exact same functions the review
// page (ClientDossier.tsx) calls — energyEstimate, estimateProteinIntake,
// roadmapFor, redFlags, audit, toIntake — so the PDF can never disagree with
// what was on screen when it was downloaded.

import React from "react";
import { Document, Image, Page, StyleSheet, Text, View, renderToBuffer } from "@react-pdf/renderer";
import { LOGO_DATA_URI, LOGO_ASPECT } from "./logo";
import { energyEstimate, bmiBand } from "./counselling/energy";
import { estimateProteinIntake, proteinTarget } from "./protein-intake";
import { redFlags, audit, toIntake, weeklyDayRulesText } from "./counselling/assessment";
import { roadmapFor, roadmapAtGoal, displayProteinTarget } from "./counselling/roadmap-input";
import { weekTargets, settleWeek, type Roadmap } from "./roadmap";
import { val, list, type Answers } from "./counselling/questions";

const YELLOW = "#FFED00";
const BLACK = "#0A0A0A";
const INK = "#18181b";
const MUTED = "#71717a";
const FAINT = "#a1a1aa";
const BORDER = "#e4e4e7";
const ALT = "#fafafa";
const PALE = "#FEFCE8";
const RED = "#b91c1c";
const RED_PALE = "#fef2f2";
const AMBER = "#92400e";
const AMBER_PALE = "#fffbeb";
const PROTEIN = "#2563eb";
const CARBS = "#d97706";
const FAT = "#dc2626";

const LOGO_W = 84;
const LOGO_H = LOGO_W / LOGO_ASPECT;

const s = StyleSheet.create({
  page: {
    paddingTop: 28,
    paddingBottom: 34,
    paddingHorizontal: 32,
    fontSize: 8.2,
    fontFamily: "Helvetica",
    color: INK,
    lineHeight: 1.35,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: BLACK,
    borderRadius: 6,
    paddingVertical: 10,
    paddingHorizontal: 14,
    marginBottom: 10,
  },
  headerName: { color: "#ffffff", fontSize: 15, fontFamily: "Helvetica-Bold" },
  headerFacts: { color: "#d4d4d8", fontSize: 7.6, marginTop: 3 },
  headerRight: { alignItems: "flex-end" },
  scoreChip: {
    backgroundColor: YELLOW,
    color: BLACK,
    fontSize: 8,
    fontFamily: "Helvetica-Bold",
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 10,
  },
  headerMeta: { color: "#a1a1aa", fontSize: 6.8, marginTop: 4 },

  section: {
    borderWidth: 0.6,
    borderColor: BORDER,
    borderRadius: 6,
    padding: 10,
    marginBottom: 8,
  },
  sectionAccent: { borderColor: YELLOW, borderWidth: 1, backgroundColor: PALE },
  sectionStop: { borderColor: RED, backgroundColor: RED_PALE },
  h2: { fontSize: 10.5, fontFamily: "Helvetica-Bold", marginBottom: 5, color: INK },
  h2Sub: { fontSize: 7, color: MUTED, fontFamily: "Helvetica" },
  h3: { fontSize: 8.6, fontFamily: "Helvetica-Bold", marginTop: 5, marginBottom: 3, color: INK },
  headRow: { flexDirection: "row", alignItems: "baseline", justifyContent: "space-between" },

  grid: { flexDirection: "row", flexWrap: "wrap", marginHorizontal: -3 },
  cell: {
    width: "25%",
    paddingHorizontal: 3,
    marginBottom: 6,
  },
  cellInner: { backgroundColor: ALT, borderRadius: 4, padding: 6 },
  cellLabel: { fontSize: 6.4, fontFamily: "Helvetica-Bold", color: MUTED, textTransform: "uppercase" },
  cellValue: { fontSize: 12, fontFamily: "Helvetica-Bold", marginTop: 1 },
  cellSub: { fontSize: 6.6, color: MUTED, marginTop: 1 },

  factsRow: { flexDirection: "row", marginBottom: 2.5 },
  factsLabel: { width: 78, fontSize: 7.4, color: MUTED },
  factsValue: { flex: 1, fontSize: 7.6, color: INK },

  flagItem: { marginBottom: 3 },
  flagLabel: { fontSize: 7.6, fontFamily: "Helvetica-Bold" },
  flagBody: { fontSize: 7.4, color: INK },

  weekGrid: { flexDirection: "row", marginHorizontal: -2, marginTop: 2 },
  weekCell: { flex: 1, marginHorizontal: 2, backgroundColor: ALT, borderRadius: 4, padding: 5 },
  weekCellChanged: { backgroundColor: PALE, borderWidth: 0.6, borderColor: YELLOW },
  weekLabel: { fontSize: 6.2, fontFamily: "Helvetica-Bold", color: MUTED, textTransform: "uppercase" },
  weekKcal: { fontSize: 11, fontFamily: "Helvetica-Bold", marginTop: 1 },
  weekDeficit: { fontSize: 6.4, color: MUTED, marginTop: 1 },
  weekMacros: { fontSize: 6.6, color: MUTED, marginTop: 2 },

  phaseRow: { flexDirection: "row", marginTop: 3 },
  phaseBadge: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: "#e4e4e7",
    color: MUTED,
    fontSize: 6,
    fontFamily: "Helvetica-Bold",
    textAlign: "center",
    paddingTop: 2.4,
    marginRight: 5,
  },
  phaseLabel: { fontSize: 7.4, fontFamily: "Helvetica-Bold" },
  phaseKcal: { fontSize: 7.4, fontFamily: "Helvetica-Bold", color: MUTED },
  phaseNote: { fontSize: 6.8, color: MUTED, marginTop: 1 },

  deltaRow: {
    flexDirection: "row",
    alignItems: "baseline",
    backgroundColor: ALT,
    borderRadius: 4,
    paddingVertical: 3,
    paddingHorizontal: 6,
    marginTop: 2,
  },
  deltaLabel: { width: 62, fontSize: 7.2, color: MUTED },
  deltaVal: { fontSize: 7.2, color: MUTED, marginRight: 4 },
  deltaTo: { fontSize: 7.4, fontFamily: "Helvetica-Bold", marginRight: 4 },
  deltaChange: { marginLeft: "auto", fontSize: 7, fontFamily: "Helvetica-Bold" },

  footer: {
    position: "absolute",
    bottom: 16,
    left: 32,
    right: 32,
    fontSize: 6.4,
    color: FAINT,
    flexDirection: "row",
    justifyContent: "space-between",
    borderTopWidth: 0.4,
    borderTopColor: BORDER,
    paddingTop: 4,
  },
});

const round = (n: number) => Math.round(n);

// ---------------------------------------------------------------------------

export interface ReviewPdfArgs {
  answers: Answers;
  dietitianName: string;
  generatedOn: string;
}

export async function renderReviewPdf(args: ReviewPdfArgs): Promise<Buffer> {
  return renderToBuffer(<ReviewDocument {...args} />);
}

function ReviewDocument({ answers, dietitianName, generatedOn }: ReviewPdfArgs) {
  const energy = energyEstimate(answers);
  const intake = estimateProteinIntake(answers);
  const target = proteinTarget(answers, intake);
  const flags = redFlags(answers);
  const score = audit(answers);
  const form = toIntake(answers, null);
  const roadmap = roadmapFor(answers);
  const atGoal = roadmapAtGoal(answers, roadmap);
  const displayTarget = displayProteinTarget(roadmap, intake, target);
  const dayRules = weeklyDayRulesText(answers);

  const name = val(answers, "name").trim() || "This client";
  const facts = [
    val(answers, "q9_age") ? `${val(answers, "q9_age")} yrs` : "",
    val(answers, "gender"),
    val(answers, "q1_occupation") || val(answers, "q54"),
    [val(answers, "q34b"), val(answers, "q34a")].filter(Boolean).join(", "),
    val(answers, "clientCode") ? `Code ${val(answers, "clientCode")}` : "",
  ]
    .filter(Boolean)
    .join("  ·  ");
  const goal = val(answers, "q2");
  const motivations = list(answers, "q1");

  const escalations = flags.filter((f) => f.escalate);
  const cautions = flags.filter((f) => !f.escalate);

  const clinicalRows: [string, string][] = [
    ["Conditions", form.conditions.join(", ")],
    ["Medications", form.medications],
    ["Supplements", form.supplements],
    ["Allergies", form.allergies],
    ["Intolerances", form.intolerances],
    ["Digestion", form.digestion],
    ["Labs", form.labNotes],
  ];
  const plateRows: [string, string][] = [
    ["Food pattern", form.dietType],
    ["Cuisines", form.cuisines],
    ["Never serve", [form.allergies, val(answers, "q36")].filter(Boolean).join(", ")],
    ["Loves", form.likes],
    ["Day rules", dayRules],
    ["Cooking", form.cookingTime],
    ["Eats out", form.eatingOutPerWeek ? `${form.eatingOutPerWeek} / week` : ""],
    ["Meals a day", form.mealsPerDay],
  ];
  const movementRows: [string, string][] = [
    ["Daily activity", form.activityLevel],
    ["Training", form.exercise],
    ["Counted as", energy.activityFactor ? `×${energy.activityFactor} on BMR` : ""],
    ["Work", form.workSchedule],
    ["Sleep", form.sleepHours],
    ["Water", form.waterIntakeLitres],
    ["Alcohol", form.alcohol],
    ["Tobacco", form.smoking],
  ];
  const bodyRows: [string, string][] = [
    ["Height", val(answers, "q9_height") ? `${val(answers, "q9_height")} cm` : ""],
    ["Weight now", val(answers, "q9_weight") ? `${val(answers, "q9_weight")} kg` : ""],
    ["Highest ever", val(answers, "q9_weight_high") ? `${val(answers, "q9_weight_high")} kg` : ""],
    ["A year ago", val(answers, "q9_weight_1y") ? `${val(answers, "q9_weight_1y")} kg` : ""],
    ["Comfortable at", val(answers, "q9_weight_comfort") ? `${val(answers, "q9_weight_comfort")} kg` : ""],
    ["Body fat", val(answers, "q15_bf") ? `${val(answers, "q15_bf")} %` : ""],
    ["Muscle mass", val(answers, "q15_muscle") ? `${val(answers, "q15_muscle")} kg` : ""],
    ["Waist / hip", [val(answers, "q15_waist"), val(answers, "q15_hip")].filter(Boolean).join(" / ")],
  ];

  return (
    <Document title={`${name} — Counselling review`}>
      <Page size="A4" style={s.page} wrap>
        <View style={s.header} fixed>
          <Image src={LOGO_DATA_URI} style={{ width: LOGO_W, height: LOGO_H, marginRight: 12 }} />
          <View style={{ flex: 1 }}>
            <Text style={s.headerName}>{name}</Text>
            {facts && <Text style={s.headerFacts}>{facts}</Text>}
            {(goal || motivations.length > 0) && (
              <Text style={s.headerFacts}>
                {[goal, motivations.join(", ")].filter(Boolean).join("  ·  ")}
              </Text>
            )}
          </View>
          <View style={s.headerRight}>
            <Text style={s.scoreChip}>
              Counselling {score.score}/100 · {score.band}
            </Text>
            <Text style={s.headerMeta}>Prepared by {dietitianName || "your dietitian"}</Text>
            <Text style={s.headerMeta}>{generatedOn}</Text>
          </View>
        </View>

        <KpiGrid energy={energy} intake={intake} />

        {escalations.length > 0 && (
          <View style={[s.section, s.sectionStop]}>
            <Text style={[s.h2, { color: RED }]}>
              ⚠ {escalations.length} clinical red flag{escalations.length > 1 ? "s" : ""} — escalate
              before the plan is finalised
            </Text>
            {escalations.map((f) => (
              <View key={f.id} style={s.flagItem}>
                <Text style={s.flagBody}>
                  <Text style={s.flagLabel}>{f.label}</Text> — {f.action}
                </Text>
              </View>
            ))}
          </View>
        )}

        {roadmap && <RoadmapSection roadmap={roadmap} atGoal={atGoal} />}

        <NowVsAim energy={energy} intake={intake} target={displayTarget} />

        {(cautions.length > 0 || clinicalRows.some(([, v]) => v)) && (
          <View style={s.section}>
            <Text style={s.h2}>Clinical picture</Text>
            {cautions.map((f) => (
              <View key={f.id} style={s.flagItem}>
                <Text style={[s.flagBody, { color: AMBER }]}>
                  <Text style={s.flagLabel}>{f.label}</Text> — {f.action}
                </Text>
              </View>
            ))}
            <Facts rows={clinicalRows} />
          </View>
        )}

        {bodyRows.some(([, v]) => v) && (
          <View style={s.section}>
            <View style={s.headRow}>
              <Text style={s.h2}>Body</Text>
              {energy.bmi && (
                <Text style={s.h2Sub}>
                  BMI {energy.bmi.toFixed(1)} · {bmiBand(energy.bmi)}
                </Text>
              )}
            </View>
            <Facts rows={bodyRows} />
          </View>
        )}

        {plateRows.some(([, v]) => v) && (
          <View style={s.section}>
            <Text style={s.h2}>What can go on the plate</Text>
            <Facts rows={plateRows} />
          </View>
        )}

        {movementRows.some(([, v]) => v) && (
          <View style={s.section}>
            <Text style={s.h2}>Movement &amp; lifestyle</Text>
            <Facts rows={movementRows} />
          </View>
        )}

        <View style={s.footer} fixed>
          <Text>LEANR by Fitelo · First counselling — client summary · macros grounded in ICMR-NIN/INDB and USDA</Text>
          <Text render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} />
        </View>
      </Page>
    </Document>
  );
}

// ---------------------------------------------------------------------------

function KpiGrid({
  energy,
  intake,
}: {
  energy: ReturnType<typeof energyEstimate>;
  intake: ReturnType<typeof estimateProteinIntake>;
}) {
  const stats: { label: string; value: string; sub: string }[] = [
    {
      label: "BMI",
      value: energy.bmi ? energy.bmi.toFixed(1) : "—",
      sub: energy.bmi ? bmiBand(energy.bmi) : "needs height & weight",
    },
    {
      label: "BMR at rest",
      value: energy.bmr ? String(energy.bmr) : "—",
      sub: energy.bmr ? "kcal/day" : `needs ${energy.missing.join(", ")}`,
    },
    {
      label: "TDEE whole day",
      value: energy.tdee ? String(energy.tdee) : "—",
      sub: energy.activityFactor
        ? `×${energy.activityFactor} activity${energy.trainingDays ? ` · ${energy.trainingDays} training d/wk` : ""}`
        : "needs the above",
    },
    {
      label: "Eats now",
      value: intake.kcalPerDay > 0 ? String(intake.kcalPerDay) : "—",
      sub: intake.kcalPerDay > 0 ? "kcal/day measured" : "record the meals",
    },
    {
      label: "Protein now",
      value: intake.gramsPerDay > 0 ? String(intake.gramsPerDay) : "—",
      sub: intake.gramsPerDay > 0 ? `${intake.gramsPerKg} g/kg measured` : "record the meals",
    },
    {
      label: "Carbs now",
      value: intake.carbsPerDay > 0 ? String(intake.carbsPerDay) : "—",
      sub: intake.carbsPerDay > 0 ? "g/day measured" : "record the meals",
    },
    {
      label: "Fat now",
      value: intake.fatPerDay > 0 ? String(intake.fatPerDay) : "—",
      sub: intake.fatPerDay > 0 ? "g/day measured" : "record the meals",
    },
  ];
  return (
    <View style={s.grid}>
      {stats.map((st) => (
        <View key={st.label} style={s.cell}>
          <View style={s.cellInner}>
            <Text style={s.cellLabel}>{st.label}</Text>
            <Text style={s.cellValue}>{st.value}</Text>
            <Text style={s.cellSub}>{st.sub}</Text>
          </View>
        </View>
      ))}
    </View>
  );
}

// ---------------------------------------------------------------------------

const WEEKS = [1, 2, 3, 4];

function RoadmapSection({ roadmap, atGoal }: { roadmap: Roadmap; atGoal: Roadmap | null }) {
  const stops = roadmap.warnings.filter((w) => w.stop);
  const cautions = roadmap.warnings.filter((w) => !w.stop);
  const { macros } = roadmap;
  const macroKcal = macros.protein_g * 4 + macros.fat_g * 9 + macros.carbs_g * 4;
  const pct = (kcal: number) => (macroKcal > 0 ? Math.round((kcal / macroKcal) * 100) : 0);

  return (
    <View style={[s.section, s.sectionAccent]}>
      <View style={s.headRow}>
        <Text style={s.h2}>The roadmap</Text>
        <Text style={s.h2Sub}>computed, not written — diet engine v{roadmap.version}</Text>
      </View>
      <Text style={{ fontSize: 7.6, color: MUTED, marginBottom: 4 }}>
        <Text style={{ fontFamily: "Helvetica-Bold", color: INK }}>{roadmap.category.label}</Text>
        {" · "}
        {roadmap.category.constraint}
      </Text>

      {stops.length > 0 && (
        <View style={{ backgroundColor: RED_PALE, borderRadius: 4, padding: 5, marginBottom: 4 }}>
          {stops.map((w) => (
            <Text key={w.id} style={{ fontSize: 7, color: RED }}>
              ⚠ {w.label} — {w.detail}
            </Text>
          ))}
        </View>
      )}

      <View style={s.grid}>
        <Cell4
          label="Target weight"
          value={`${roadmap.targetWeightKg} kg`}
          sub={`healthy ${roadmap.healthyRangeKg.low}–${roadmap.healthyRangeKg.high} kg`}
        />
        <Cell4
          label="To lose"
          value={roadmap.weightToLoseKg > 0 ? `${roadmap.weightToLoseKg} kg` : "—"}
          sub={roadmap.weightToLoseKg > 0 ? `first milestone ${roadmap.milestone5pctKg} kg (5%)` : "already at target"}
        />
        <Cell4
          label="Timeline"
          value={roadmap.timeline ? `${roadmap.timeline.fastestWeeks}–${roadmap.timeline.slowestWeeks}` : "—"}
          sub={roadmap.timeline ? "weeks, at 0.5–1.0%/week" : "no loss required"}
        />
        <Cell4
          label="Daily target"
          value={`${roadmap.targetKcal}`}
          sub={roadmap.tdee > roadmap.targetKcal ? "kcal a day while losing" : "kcal a day, maintenance"}
        />
      </View>

      <Text style={s.h3}>The first four weeks — against a {roadmap.tdee} kcal daily need</Text>
      <View style={s.weekGrid}>
        {WEEKS.map((w) => {
          const t = weekTargets(roadmap, w);
          const previous = w > 1 ? weekTargets(roadmap, w - 1) : null;
          const changed = previous !== null && (previous.kcal !== t.kcal || previous.protein_g !== t.protein_g);
          const deficit = Math.round(((roadmap.tdee - t.kcal) / roadmap.tdee) * 100);
          return (
            <View key={w} style={[s.weekCell, changed || w === 1 ? s.weekCellChanged : {}]}>
              <Text style={s.weekLabel}>Week {w}</Text>
              <Text style={s.weekKcal}>{t.kcal}</Text>
              <Text style={s.weekDeficit}>
                {deficit > 0 ? `${deficit}% deficit` : deficit < 0 ? `${-deficit}% surplus` : "maintenance"}
              </Text>
              <Text style={s.weekMacros}>
                P{t.protein_g} · F{t.fat_g} · C{t.carbs_g}
              </Text>
            </View>
          );
        })}
      </View>

      {roadmap.phases.map((p, i) => (
        <View key={`${p.label}-${i}`} style={s.phaseRow}>
          <Text style={s.phaseBadge}>{i + 1}</Text>
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
              <Text style={s.phaseLabel}>{p.label}</Text>
              <Text style={s.phaseKcal}>{p.kcal} kcal</Text>
            </View>
            <Text style={s.phaseNote}>{p.note}</Text>
          </View>
        </View>
      ))}

      <DeltaTable roadmap={roadmap} />

      <View style={s.headRow}>
        <Text style={s.h3}>Macros while losing</Text>
        <Text style={s.h2Sub}>
          protein {roadmap.category.proteinPerKg} g/kg on {roadmap.dosingWeightKg} kg
          {roadmap.usedAdjustedWeight ? " adjusted" : ""}
        </Text>
      </View>
      <View style={s.grid}>
        <Cell4 label="Protein" value={`${macros.protein_g} g`} sub={`${pct(macros.protein_g * 4)}% of energy`} color={PROTEIN} />
        <Cell4 label="Fat" value={`${macros.fat_g} g`} sub={`${pct(macros.fat_g * 9)}% of energy`} color={FAT} />
        <Cell4 label="Carbohydrate" value={`${macros.carbs_g} g`} sub={`${pct(macros.carbs_g * 4)}% — the residual`} color={CARBS} />
        <Cell4 label="Fibre" value={`${macros.fibre_g} g`} sub="ICMR-NIN, 30 g floor" />
      </View>

      {roadmap.adaptation && (
        <View style={{ backgroundColor: ALT, borderRadius: 4, padding: 6, marginTop: 4 }}>
          <Text style={{ fontSize: 7.6, fontFamily: "Helvetica-Bold" }}>
            {roadmap.adaptation.adapted ? "Metabolically adapted" : "Not adapted — measure first"}
          </Text>
          {roadmap.adaptation.reasons.map((r) => (
            <Text key={r} style={{ fontSize: 6.8, color: MUTED, marginTop: 1 }}>
              · {r}
            </Text>
          ))}
          <Text style={{ fontSize: 6.8, fontFamily: "Helvetica-Bold", marginTop: 2 }}>
            {roadmap.adaptation.action}
          </Text>
        </View>
      )}

      {cautions.length > 0 && (
        <View style={{ marginTop: 4 }}>
          {cautions.map((w) => (
            <View key={w.id} style={{ backgroundColor: AMBER_PALE, borderRadius: 4, padding: 5, marginTop: 2 }}>
              <Text style={{ fontSize: 6.8, color: AMBER }}>
                {w.label} — {w.detail}
              </Text>
            </View>
          ))}
        </View>
      )}

      {atGoal && (
        <Text style={{ fontSize: 6.8, color: MUTED, marginTop: 5 }}>
          Projected at goal weight ({roadmap.targetWeightKg} kg, maintenance): {atGoal.targetKcal} kcal/day,{" "}
          {atGoal.macros.protein_g}g protein, {atGoal.macros.fat_g}g fat, {atGoal.macros.carbs_g}g carbs.
        </Text>
      )}

      <Text style={{ fontSize: 6.6, color: FAINT, marginTop: 4 }}>
        The timeline is optimistic by nature — real loss is rarely linear. Use the 5% milestone as the
        first target actually reached.
      </Text>
    </View>
  );
}

function DeltaTable({ roadmap }: { roadmap: Roadmap }) {
  const now = roadmap.current;
  if (!now) return null;
  const target = weekTargets(roadmap, settleWeek(roadmap));
  const first = weekTargets(roadmap, 1);
  const step = (from: number, to: number) => (from !== to ? from : null);

  const rows: { label: string; from: number; via: number | null; to: number; unit: string }[] = [
    { label: "Energy", from: now.kcal, via: step(first.kcal, target.kcal), to: target.kcal, unit: "kcal" },
    { label: "Protein", from: now.protein_g, via: step(first.protein_g, target.protein_g), to: target.protein_g, unit: "g" },
    { label: "Carbohydrate", from: now.carbs_g, via: null, to: target.carbs_g, unit: "g" },
    { label: "Fat", from: now.fat_g, via: null, to: target.fat_g, unit: "g" },
  ];

  return (
    <View style={{ marginTop: 4 }}>
      <Text style={s.h3}>What actually changes — measured now → while losing</Text>
      {rows.map((r) => {
        const change = r.to - r.from;
        return (
          <View key={r.label} style={s.deltaRow}>
            <Text style={s.deltaLabel}>{r.label}</Text>
            <Text style={s.deltaVal}>{r.from}</Text>
            {r.via !== null && (
              <>
                <Text style={s.deltaVal}>→ {r.via}</Text>
              </>
            )}
            <Text style={s.deltaTo}>
              → {r.to} {r.unit}
            </Text>
            <Text style={[s.deltaChange, { color: change > 0 ? "#059669" : change < 0 ? AMBER : MUTED }]}>
              {change === 0 ? "no change" : `${change > 0 ? "+" : "−"}${Math.abs(change)} ${r.unit}`}
            </Text>
          </View>
        );
      })}
      <View style={s.deltaRow}>
        <Text style={s.deltaLabel}>Fibre</Text>
        <Text style={s.deltaVal}>not measured</Text>
        <Text style={s.deltaTo}>→ {roadmap.macros.fibre_g} g</Text>
      </View>
    </View>
  );
}

function Cell4({
  label,
  value,
  sub,
  color,
}: {
  label: string;
  value: string;
  sub: string;
  color?: string;
}) {
  return (
    <View style={s.cell}>
      <View style={s.cellInner}>
        <Text style={s.cellLabel}>{label}</Text>
        <Text style={[s.cellValue, color ? { color } : {}]}>{value}</Text>
        <Text style={s.cellSub}>{sub}</Text>
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------

function NowVsAim({
  energy,
  intake,
  target,
}: {
  energy: ReturnType<typeof energyEstimate>;
  intake: ReturnType<typeof estimateProteinIntake>;
  target: ReturnType<typeof proteinTarget>;
}) {
  const rows: { label: string; now: number; plan: number; unit: string }[] = [];
  if (intake.kcalPerDay > 0 && energy.tdee)
    rows.push({ label: "Energy", now: intake.kcalPerDay, plan: energy.tdee, unit: "kcal" });
  if (intake.gramsPerDay > 0 && target.targetG > 0)
    rows.push({ label: "Protein", now: intake.gramsPerDay, plan: target.targetG, unit: "g" });
  if (rows.length === 0) return null;

  return (
    <View style={s.section}>
      <Text style={s.h2}>Where they are, and where week 1 aims</Text>
      {rows.map((r) => {
        const delta = round(r.plan - r.now);
        return (
          <View key={r.label} style={s.deltaRow}>
            <Text style={s.deltaLabel}>{r.label}</Text>
            <Text style={s.deltaVal}>
              {r.now} {r.unit} now
            </Text>
            <Text style={s.deltaTo}>
              → {r.plan} {r.unit} aim
            </Text>
            <Text style={[s.deltaChange, { color: delta > 0 ? "#059669" : delta < 0 ? AMBER : MUTED }]}>
              {delta === 0 ? "no change" : `${delta > 0 ? "+" : "−"}${Math.abs(delta)} ${r.unit}`}
            </Text>
          </View>
        );
      })}
      <Text style={{ fontSize: 6.8, color: MUTED, marginTop: 4 }}>{target.explanation}</Text>
    </View>
  );
}

// ---------------------------------------------------------------------------

function Facts({ rows }: { rows: [string, string][] }) {
  const filled = rows.filter(([, v]) => v && v.trim());
  if (filled.length === 0) return null;
  return (
    <View style={{ marginTop: 3 }}>
      {filled.map(([label, value]) => (
        <View key={label} style={s.factsRow}>
          <Text style={s.factsLabel}>{label}</Text>
          <Text style={s.factsValue}>{value}</Text>
        </View>
      ))}
    </View>
  );
}
