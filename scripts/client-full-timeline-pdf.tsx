// The full losing-phase timeline for a single real client, week by week from
// week 1 through the slowest-case finish — not the 4-week window the review
// page shows, and not just the protein ramp's settle week. Pulled live from
// the saved counselling draft (form_drafts, by clientCode) and run through
// the same roadmapFor()/weekTargets() the app itself calls.
//
// Consecutive weeks with identical kcal/protein/fat/carbs collapse into one
// row — for most categories that's most of the table, since only Category 3
// ramps calories and the protein ladder settles in a handful of weeks.
//
// Run: npx -y tsx scripts/client-full-timeline-pdf.tsx [clientCode]   (default TEST-UI-001)

import React from "react";
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";
import { Document, Page, StyleSheet, Text, View, renderToBuffer } from "@react-pdf/renderer";

const envPath = path.join(__dirname, "..", ".env.local");
for (const line of readFileSync(envPath, "utf8").split(/\r?\n/)) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m && !(m[1] in process.env)) process.env[m[1]] = m[2];
}

const YELLOW = "#FFED00";
const BLACK = "#0A0A0A";
const INK = "#18181b";
const MUTED = "#71717a";
const BORDER = "#e4e4e7";
const ALT = "#fafafa";
const PALE = "#FEFCE8";

const s = StyleSheet.create({
  page: {
    paddingTop: 24, paddingBottom: 32, paddingHorizontal: 32,
    fontSize: 7.6, fontFamily: "Helvetica", color: INK, lineHeight: 1.32,
  },
  intro: { fontSize: 7.2, color: MUTED, marginBottom: 10 },
  header: { backgroundColor: BLACK, borderRadius: 5, paddingVertical: 8, paddingHorizontal: 12, marginBottom: 8 },
  headerTitle: { color: "#ffffff", fontSize: 13, fontFamily: "Helvetica-Bold" },
  headerAccent: { color: YELLOW },
  headerSub: { color: "#d4d4d8", fontSize: 7.2, marginTop: 3 },
  h2: { fontSize: 9, fontFamily: "Helvetica-Bold", marginTop: 8, marginBottom: 3, color: INK },
  small: { fontSize: 6.8, color: MUTED },
  row: { flexDirection: "row" },
  th: { backgroundColor: BLACK, color: "#ffffff", fontFamily: "Helvetica-Bold", fontSize: 6.8, paddingVertical: 3, paddingHorizontal: 4 },
  td: { paddingVertical: 3, paddingHorizontal: 4, fontSize: 7.2, borderBottomWidth: 0.4, borderBottomColor: BORDER },
  tdAlt: { backgroundColor: ALT },
  milestone: { backgroundColor: PALE },
  fact: { width: "16.6%" },
  factLabel: { fontSize: 6.2, color: MUTED, textTransform: "uppercase" },
  factValue: { fontSize: 9.5, fontFamily: "Helvetica-Bold", color: INK, marginTop: 1 },
  footer: {
    position: "absolute", bottom: 16, left: 32, right: 32, fontSize: 6.4, color: MUTED,
    flexDirection: "row", justifyContent: "space-between",
    borderTopWidth: 0.4, borderTopColor: BORDER, paddingTop: 4,
  },
});

const Cell = ({
  w, children, alt = false, bold = false, milestone = false,
}: { w: string; children: React.ReactNode; alt?: boolean; bold?: boolean; milestone?: boolean }) => (
  <View style={[s.td, alt ? s.tdAlt : {}, milestone ? s.milestone : {}, { width: w }]}>
    <Text style={{ fontFamily: bold ? "Helvetica-Bold" : "Helvetica" }}>{children}</Text>
  </View>
);
const Head = ({ w, children }: { w: string; children: React.ReactNode }) => (
  <View style={[s.th, { width: w }]}><Text>{children}</Text></View>
);
const Fact = ({ label, value }: { label: string; value: string }) => (
  <View style={s.fact}>
    <Text style={s.factLabel}>{label}</Text>
    <Text style={s.factValue}>{value}</Text>
  </View>
);

async function main() {
  const R = await import("../src/lib/roadmap");
  const { roadmapFor, roadmapAtGoal } = await import("../src/lib/counselling/roadmap-input");

  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  const clientCode = process.argv[2] || "TEST-UI-001";

  const { data: drafts, error } = await supabase
    .from("form_drafts")
    .select("data, updated_at")
    .filter("data->answers->>clientCode", "eq", clientCode)
    .order("updated_at", { ascending: false })
    .limit(1);
  if (error) throw new Error(error.message);
  if (!drafts || drafts.length === 0) {
    throw new Error(`No saved counselling draft found with clientCode "${clientCode}".`);
  }
  const answers = (drafts[0].data as { answers: Record<string, string | string[]> }).answers;
  const name = String(answers.name ?? clientCode);

  const roadmap = roadmapFor(answers as never);
  if (!roadmap) {
    throw new Error(`roadmapFor() returned null for ${clientCode} — height, weight, BMR/TDEE or category still missing.`);
  }
  const atGoal = roadmapAtGoal(answers as never, roadmap);

  // The losing-phase table runs from week 1 through the slowest-case finish
  // — by definition the week she is at target weight, so nothing past it
  // belongs to "losing" any more. No timeline (already at/under target) falls
  // back to wherever the protein ladder settles, so the table still has rows.
  const lastWeek = roadmap.timeline?.slowestWeeks ?? Math.max(1, R.settleWeek(roadmap));

  type Row = { from: number; to: number; kcal: number; protein_g: number; fat_g: number; carbs_g: number };
  const rows: Row[] = [];
  for (let week = 1; week <= lastWeek; week++) {
    const t = R.weekTargets(roadmap, week);
    const last = rows[rows.length - 1];
    if (last && last.kcal === t.kcal && last.protein_g === t.protein_g && last.fat_g === t.fat_g && last.carbs_g === t.carbs_g) {
      last.to = week;
    } else {
      rows.push({ from: week, to: week, kcal: t.kcal, protein_g: t.protein_g, fat_g: t.fat_g, carbs_g: t.carbs_g });
    }
  }

  const fastest = roadmap.timeline?.fastestWeeks ?? null;
  const slowest = roadmap.timeline?.slowestWeeks ?? null;
  const milestoneNote = (from: number, to: number) => {
    const notes: string[] = [];
    if (fastest !== null && fastest >= from && fastest <= to) notes.push(`fastest-case finish ~wk ${fastest}`);
    if (slowest !== null && slowest >= from && slowest <= to) notes.push(`slowest-case finish ~wk ${slowest}`);
    return notes.join(" · ");
  };

  const doc = (
    <Document title={`${name} — full timeline (${clientCode})`}>
      <Page size="A4" style={s.page}>
        <View style={s.header}>
          <Text style={s.headerTitle}>
            {name} <Text style={s.headerAccent}>· full timeline</Text>
          </Text>
          <Text style={s.headerSub}>
            {clientCode} · Category {roadmap.category.id} — {roadmap.category.label.split(" —")[0]} ·
            {" "}engine v{roadmap.version}
          </Text>
        </View>
        <Text style={s.intro}>
          Every week of the losing phase, week 1 through the slowest-case finish (
          {lastWeek} weeks) — not the 4-week window the review page shows. Rows collapse runs of
          identical weeks: for this category, calories hold flat by design (only Category 3 ramps
          them) and protein holds once its ladder settles, so most of the timeline is one row.
          Computed live via weekTargets(), the same function the app calls.
        </Text>

        <View style={s.row}>
          <Fact label="Target weight" value={`${roadmap.targetWeightKg} kg`} />
          <Fact label="To lose" value={`${roadmap.weightToLoseKg} kg`} />
          <Fact label="5% milestone" value={`${roadmap.milestone5pctKg} kg`} />
          <Fact
            label="Timeline"
            value={roadmap.timeline ? `${roadmap.timeline.fastestWeeks}–${roadmap.timeline.slowestWeeks} wk` : "—"}
          />
          <Fact label="TDEE" value={`${roadmap.tdee} kcal`} />
          <Fact label="Steady target" value={`${roadmap.targetKcal} kcal`} />
        </View>

        <Text style={s.h2}>The losing phase, week by week</Text>
        <View style={s.row}>
          <Head w="18%">Weeks</Head>
          <Head w="14%">kcal</Head>
          <Head w="12%">Deficit</Head>
          <Head w="14%">Protein</Head>
          <Head w="12%">Fat</Head>
          <Head w="14%">Carbs</Head>
          <Head w="16%">Milestone</Head>
        </View>
        {rows.map((r, i) => {
          const note = milestoneNote(r.from, r.to);
          const deficit = Math.round(((roadmap.tdee - r.kcal) / roadmap.tdee) * 100);
          return (
            <View style={s.row} key={`${r.from}-${r.to}`}>
              <Cell w="18%" alt={i % 2 === 1} bold milestone={!!note}>
                {r.from === r.to ? `Week ${r.from}` : `Weeks ${r.from}–${r.to}`}
              </Cell>
              <Cell w="14%" alt={i % 2 === 1} milestone={!!note}>{r.kcal}</Cell>
              <Cell w="12%" alt={i % 2 === 1} milestone={!!note}>
                {deficit > 0 ? `${deficit}%` : deficit < 0 ? `+${-deficit}%` : "0%"}
              </Cell>
              <Cell w="14%" alt={i % 2 === 1} milestone={!!note}>{r.protein_g} g</Cell>
              <Cell w="12%" alt={i % 2 === 1} milestone={!!note}>{r.fat_g} g</Cell>
              <Cell w="14%" alt={i % 2 === 1} milestone={!!note}>{r.carbs_g} g</Cell>
              <Cell w="16%" alt={i % 2 === 1} milestone={!!note}>{note}</Cell>
            </View>
          );
        })}

        <Text style={s.h2}>After reaching {roadmap.targetWeightKg} kg — a projection, not automatic</Text>
        <Text style={s.small}>
          Nothing switches the plan across on its own; this is what re-counselling at goal weight
          would compute (Category 4 — maintenance), shown so the conversation can happen ahead of
          time.
        </Text>
        {atGoal ? (
          <View style={s.row}>
            <Head w="20%">At goal</Head><Head w="20%">kcal</Head><Head w="20%">Protein</Head><Head w="20%">Fat</Head><Head w="20%">Carbs</Head>
          </View>
        ) : null}
        {atGoal && (
          <View style={s.row}>
            <Cell w="20%" bold>{roadmap.targetWeightKg} kg · BMI 21</Cell>
            <Cell w="20%" alt>{atGoal.targetKcal} kcal</Cell>
            <Cell w="20%" alt>{atGoal.macros.protein_g} g</Cell>
            <Cell w="20%" alt>{atGoal.macros.fat_g} g</Cell>
            <Cell w="20%" alt>{atGoal.macros.carbs_g} g</Cell>
          </View>
        )}
        {!atGoal && (
          <Text style={s.small}>No projection — already at or under target weight.</Text>
        )}

        <View style={s.footer} fixed>
          <Text>LEANR · Diet Engine — full timeline · {name} · {clientCode}</Text>
          <Text render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} />
        </View>
      </Page>
    </Document>
  );

  const buf = await renderToBuffer(doc);
  const outDir = path.join(__dirname, "..", "test-output");
  mkdirSync(outDir, { recursive: true });
  const file = path.join(outDir, `${clientCode.toLowerCase()}-full-timeline.pdf`);
  writeFileSync(file, buf);
  console.log(`Wrote ${file} (${Math.round(buf.length / 1024)} KB) — ${rows.length} row(s) across ${lastWeek} weeks`);
}

main().catch((e) => {
  console.error("Failed:", e instanceof Error ? e.message : e);
  process.exit(1);
});
