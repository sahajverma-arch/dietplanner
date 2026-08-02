// A 2-page proposal: counting steps and training intensity toward energy.
//
// RULE 2 (session cost by intensity x duration x weight) IS NOW ADOPTED —
// see kcalPerSession() in src/lib/counselling/energy.ts, which implements
// exactly the formula and tables below. Rule 1 (steps replacing q54c for the
// NEAT multiplier) is still just a proposal; nothing in src/ reads q106 yet.
// This file's own model is left as originally drafted — a record of what was
// proposed and approved — and does not import from energy.ts, so it keeps
// running standalone even as the real implementation evolves.
//
// Run: npx -y tsx scripts/activity-energy-proposal-pdf.tsx

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
const BAD = "#b91c1c";
const GOOD = "#15803d";

const s = StyleSheet.create({
  page: {
    paddingTop: 24,
    paddingBottom: 34,
    paddingHorizontal: 34,
    fontSize: 7.5,
    fontFamily: "Helvetica",
    color: INK,
    lineHeight: 1.32,
  },
  header: { backgroundColor: BLACK, borderRadius: 6, paddingVertical: 8, paddingHorizontal: 12, marginBottom: 8 },
  headerTitle: { color: "#ffffff", fontSize: 12.5, fontFamily: "Helvetica-Bold" },
  headerAccent: { color: YELLOW },
  headerSub: { color: "#d4d4d8", fontSize: 7.4, marginTop: 3.5 },

  h2: { fontSize: 9, fontFamily: "Helvetica-Bold", marginTop: 7.5, marginBottom: 3, color: INK },
  h3: { fontSize: 8.4, fontFamily: "Helvetica-Bold", marginTop: 7, marginBottom: 2.5 },
  p: { marginBottom: 2.5, color: INK },
  small: { fontSize: 6.9, color: MUTED },

  row: { flexDirection: "row" },
  th: { backgroundColor: BLACK, color: "#ffffff", fontFamily: "Helvetica-Bold", fontSize: 6.9, paddingVertical: 2.8, paddingHorizontal: 4.5 },
  td: { paddingVertical: 2.8, paddingHorizontal: 4.5, fontSize: 7.1, borderBottomWidth: 0.5, borderBottomColor: BORDER },
  tdAlt: { backgroundColor: ALT },

  callout: { backgroundColor: PALE, borderLeftWidth: 3, borderLeftColor: YELLOW, padding: 5, marginTop: 4, marginBottom: 3 },
  bad: { backgroundColor: "#fef2f2", borderLeftWidth: 3, borderLeftColor: BAD, padding: 5, marginTop: 4, marginBottom: 3 },
  code: { fontFamily: "Courier", fontSize: 7.4, color: INK },
  footer: {
    position: "absolute", bottom: 18, left: 36, right: 36, fontSize: 6.6, color: FAINT,
    flexDirection: "row", justifyContent: "space-between",
    borderTopWidth: 0.5, borderTopColor: BORDER, paddingTop: 4,
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
    <Text>LEANR · Activity and energy — PROPOSAL, not implemented · for approval</Text>
    <Text>{page}</Text>
  </View>
);

// ---------------------------------------------------------------------------
// The proposed rules, modelled here and nowhere else.
// ---------------------------------------------------------------------------

/**
 * NEAT multiplier from the MEASURED step band rather than the self-described
 * category. Anchored so the current midpoint (Lightly active, x1.35) lands on
 * the 5,000-8,000 band, which is where most of this book of clients sits — the
 * intent is to remove a subjective input, not to quietly re-baseline everyone.
 */
const STEP_NEAT: Record<string, number> = {
  "<3,000": 1.15,
  "3,000–5,000": 1.25,
  "5,000–8,000": 1.35,
  "8,000–10,000": 1.45,
  "10,000–12,000": 1.55,
  ">12,000": 1.65,
};

/** Compendium-of-Physical-Activities style MET values, by reported intensity. */
const INTENSITY_MET: Record<string, number> = {
  "Very light": 2.5,
  Light: 3.0,
  Moderate: 5.0,
  Hard: 7.0,
  "Very hard": 9.0,
};

/** Midpoint of each reported duration band, in hours. */
const DURATION_H: Record<string, number> = {
  "Less than 30 minutes": 0.375,
  "30–45 minutes": 0.625,
  "45–60 minutes": 0.875,
  "60–90 minutes": 1.25,
  "More than 90 minutes": 1.75,
};

const NEAT_FALLBACK: Record<string, number> = {
  "Mostly seated": 1.2, "Lightly active": 1.35, "Moderately active": 1.45,
  Active: 1.55, "Highly physical": 1.7,
};

type A = Record<string, unknown>;
const str = (a: A, id: string) => (typeof a[id] === "string" ? (a[id] as string) : "");

function proposed(a: A, bmr: number, weight: number) {
  const band = str(a, "q106");
  const neat = STEP_NEAT[band] ?? NEAT_FALLBACK[str(a, "q54c")] ?? 1.2;
  const met = INTENSITY_MET[str(a, "q44e")] ?? 3.0;
  const hours = DURATION_H[str(a, "q44b")] ?? 0.625;
  const days = Number(str(a, "q44a")) || 0;
  // (MET - 1) because the resting hour is already inside BMR x NEAT. Counting
  // the gross figure bills that hour twice.
  const perSession = (met - 1) * weight * hours;
  const trainingPerDay = (days * perSession) / 7;
  return {
    neat, met, hours, days,
    perSession: Math.round(perSession),
    trainingPerDay: Math.round(trainingPerDay),
    tdee: Math.round(bmr * neat + trainingPerDay),
    usedFallback: !STEP_NEAT[band],
  };
}

async function main() {
  const { energyEstimate } = await import("../src/lib/counselling/energy");
  const { roadmapInput } = await import("../src/lib/counselling/roadmap-input");
  const { buildRoadmap } = await import("../src/lib/roadmap");
  const { PRIYA, RAHUL, SNEHA, AADI } = await import("./test-clients");

  const CLIENTS = [
    { name: "Priya", a: PRIYA as unknown as A },
    { name: "Rahul", a: RAHUL as unknown as A },
    { name: "Sneha", a: SNEHA as unknown as A },
    { name: "Aadi", a: AADI as unknown as A },
  ].map(({ name, a }) => {
    const e = energyEstimate(a as never);
    const weight = Number(str(a, "q9_weight"));
    const p = proposed(a, e.bmr!, weight);
    const base = roadmapInput(a as never);
    const now = buildRoadmap(base)!;
    // Same client, same category, same measurements — only TDEE differs.
    const next = buildRoadmap({ ...base, tdee: p.tdee })!;
    return { name, a, e, weight, p, now, next };
  });

  const doc = (
    <Document title="Counting steps and training intensity toward energy — proposal">
      {/* ------------------------------------------------------------- 1 */}
      <Page size="A4" style={s.page}>
        <View style={s.header}>
          <Text style={s.headerTitle}>
            Steps and training intensity — <Text style={s.headerAccent}>what we ask, and what we ignore</Text>
          </Text>
          <Text style={s.headerSub}>
            Proposal for approval · nothing here is implemented · every figure computed from the four
            test clients and the live engine
          </Text>
        </View>

        <Text style={s.p}>
          The counselling asks a client how many steps they take, how they track them, how many days
          a week they train, for how long, and how hard. Energy estimation uses two of those and
          discards the rest. The result is that a measured number loses to a self-description, and a
          long hard session counts the same as a short easy one.
        </Text>

        <Text style={s.h2}>What the counselling records, and what the engine uses</Text>
        <View style={s.row}>
          <Head w="12%">Question</Head><Head w="40%">What it captures</Head>
          <Head w="26%">Used in energy today</Head><Head w="22%">Where it goes</Head>
        </View>
        {[
          ["q54c", "Self-described everyday activity — five words", "YES — sets the whole NEAT multiplier", "energy.ts NEAT_FACTOR", true],
          ["q106", "Average daily step count, six bands (REQUIRED)", "No", "shown, never counted", false],
          ["q54f", "Tracking source — phone, watch, tracker, estimate", "No", "shown, never counted", false],
          ["q112 / q112a", "Exact weekday and weekend step counts", "No", "shown, never counted", false],
          ["q111 / q111a", "Sitting hours, standing/moving hours", "No", "shown, never counted", false],
          ["q44a", "Training days per week", "YES — x250 kcal flat, per day", "energy.ts KCAL_PER_SESSION", true],
          ["q44b", "Session duration, five bands", "No", "shown, never counted", false],
          ["q44e", "Session intensity, five levels", "No", "shown, never counted", false],
          ["q43", "What the training actually is", "Only to gate the protein goal", "protein-intake.ts", false],
        ].map(([id, cap, used, where, on], i) => (
          <View style={s.row} key={id as string}>
            <Cell w="12%" alt={i % 2 === 1} bold>{id}</Cell>
            <Cell w="40%" alt={i % 2 === 1}>{cap}</Cell>
            <Cell w="26%" alt={i % 2 === 1} bold={Boolean(on)} color={on ? GOOD : BAD}>{used}</Cell>
            <Cell w="22%" alt={i % 2 === 1} color={MUTED}>{where}</Cell>
          </View>
        ))}

        <Text style={s.h2}>Defect 1 — a word outranks a measurement</Text>
        <Text style={s.p}>
          The NEAT multiplier comes entirely from q54c, five words a client picks about themselves.
          The step count they actually walk sits unused beside it. Two of our four test clients
          report the identical measured band and receive materially different prescriptions:
        </Text>
        <View style={s.bad}>
          {CLIENTS.filter((c) => ["Priya", "Sneha"].includes(c.name)).map((c) => (
            <Text key={c.name} style={s.code}>
              {c.name.padEnd(6)} {str(c.a, "q106").padEnd(12)} steps · &quot;{str(c.a, "q54c")}&quot;
              {" ".repeat(Math.max(1, 18 - str(c.a, "q54c").length))}x{c.e.activityFactor} ={" "}
              {Math.round(c.e.bmr! * c.e.activityFactor!)} kcal NEAT
            </Text>
          ))}
          <Text style={[s.small, { marginTop: 3 }]}>
            Same measured steps.{" "}
            {Math.abs(
              Math.round(CLIENTS[0].e.bmr! * CLIENTS[0].e.activityFactor!) -
                Math.round(CLIENTS[2].e.bmr! * CLIENTS[2].e.activityFactor!)
            )}{" "}
            kcal/day apart, of which part is a real BMR difference and part is purely the adjective
            each one chose. A client who describes herself modestly is prescribed a smaller diet for
            it.
          </Text>
        </View>

        <Text style={s.h2}>Defect 2 — training is counted by days, not by work</Text>
        <Text style={s.p}>
          Every session is worth 250 kcal regardless of whether it is 25 minutes of yoga or 90
          minutes of heavy lifting. Duration and intensity are both asked, both stored, and neither
          reaches the arithmetic — so counting sessions rewards frequency over effort:
        </Text>
        <View style={s.bad}>
          {CLIENTS.filter((c) => ["Sneha", "Rahul"].includes(c.name)).map((c) => (
            <Text key={c.name} style={s.code}>
              {c.name.padEnd(6)} {str(c.a, "q44a")} days x {str(c.a, "q44b").padEnd(16)}
              {str(c.a, "q44e").padEnd(10)} credited {Math.round((Number(str(c.a, "q44a")) * 250) / 7)} kcal/day
            </Text>
          ))}
          <Text style={[s.small, { marginTop: 3 }]}>
            The lighter, shorter programme earns more credit than the heavier, longer one — and that
            credit is subtracted from what the client is allowed to eat.
          </Text>
        </View>

        <Text style={s.h2}>Why we cannot simply add step calories on top</Text>
        <Text style={s.p}>
          The obvious fix — compute kcal from steps and add them to TDEE — double-counts. The NEAT
          multiplier already describes the whole non-training day, walking included, and BMR already
          covers the resting cost of every hour including the training hour. energy.ts carries this
          warning for training and the same trap applies to steps. So the proposal REPLACES inputs
          rather than adding a term: steps decide the multiplier instead of the adjective, and
          sessions are costed net of the resting hour they occupy.
        </Text>

        <Footer page="Page 1 of 2" />
      </Page>

      {/* ------------------------------------------------------------- 2 */}
      <Page size="A4" style={s.page}>
        <View style={s.header}>
          <Text style={s.headerTitle}>
            The proposal — <Text style={s.headerAccent}>and exactly what it moves</Text>
          </Text>
          <Text style={s.headerSub}>
            Two rule changes in src/lib/counselling/energy.ts · everything downstream follows
            automatically, because the roadmap already takes TDEE as an input
          </Text>
        </View>

        <Text style={s.h2}>Rule 1 — NEAT from the measured step band</Text>
        <View style={s.row}>
          {Object.keys(STEP_NEAT).map((b) => <Head w="16.6%" key={b}>{b}</Head>)}
        </View>
        <View style={s.row}>
          {Object.entries(STEP_NEAT).map(([b, v], i) => (
            <Cell w="16.6%" key={b} alt={i % 2 === 1} bold>x{v}</Cell>
          ))}
        </View>
        <Text style={[s.small, { marginTop: 3 }]}>
          q54c becomes the FALLBACK, used only where the client answered &quot;Don&apos;t Know&quot;
          to steps. Where q54f says the source is a phone or an estimate, the band is treated as
          soft: the dietitian sees both figures and the disagreement is flagged rather than silently
          resolved. A phone in a pocket undercounts, and the counselling already says so.
        </Text>

        <Text style={s.h2}>Rule 2 — sessions costed by intensity and duration</Text>
        <Text style={[s.code, { marginBottom: 3 }]}>
          kcal per session = (MET − 1) × body weight kg × hours
        </Text>
        <View style={s.row}>
          <Head w="34%">Intensity (q44e)</Head><Head w="16%">MET</Head>
          <Head w="34%">Duration (q44b)</Head><Head w="16%">Hours</Head>
        </View>
        {Object.entries(INTENSITY_MET).map(([k, v], i) => {
          const d = Object.entries(DURATION_H)[i];
          return (
            <View style={s.row} key={k}>
              <Cell w="34%" alt={i % 2 === 1}>{k}</Cell>
              <Cell w="16%" alt={i % 2 === 1} bold>{v}</Cell>
              <Cell w="34%" alt={i % 2 === 1}>{d ? d[0] : ""}</Cell>
              <Cell w="16%" alt={i % 2 === 1} bold>{d ? d[1] : ""}</Cell>
            </View>
          );
        })}
        <Text style={[s.small, { marginTop: 3 }]}>
          The −1 is the resting hour already inside BMR. Omitting it bills that hour twice and
          inflates every trainer&apos;s allowance by roughly 60–90 kcal a day.
        </Text>

        <Text style={s.h2}>What it does to the four test clients</Text>
        <View style={s.row}>
          <Head w="11%">Client</Head><Head w="15%">NEAT now → new</Head><Head w="17%">Training/day now → new</Head>
          <Head w="16%">TDEE now → new</Head><Head w="17%">Daily target now → new</Head><Head w="12%">Change</Head><Head w="12%">Carbs</Head>
        </View>
        {CLIENTS.map((c, i) => {
          const dTarget = c.next.targetKcal - c.now.targetKcal;
          return (
            <View style={s.row} key={c.name}>
              <Cell w="11%" alt={i % 2 === 1} bold>{c.name}</Cell>
              <Cell w="15%" alt={i % 2 === 1}>x{c.e.activityFactor} → x{c.p.neat}</Cell>
              <Cell w="17%" alt={i % 2 === 1}>
                {Math.round((c.e.trainingDays * 250) / 7)} → {c.p.trainingPerDay} kcal
              </Cell>
              <Cell w="16%" alt={i % 2 === 1}>{c.e.tdee} → {c.p.tdee}</Cell>
              <Cell w="17%" alt={i % 2 === 1} bold>{c.now.targetKcal} → {c.next.targetKcal}</Cell>
              <Cell w="12%" alt={i % 2 === 1} bold color={dTarget > 0 ? GOOD : dTarget < 0 ? BAD : MUTED}>
                {dTarget > 0 ? "+" : ""}{dTarget} kcal
              </Cell>
              <Cell w="12%" alt={i % 2 === 1}>
                {c.now.macros.carbs_g} → {c.next.macros.carbs_g} g
              </Cell>
            </View>
          );
        })}

        <View style={s.callout}>
          <Text style={{ fontFamily: "Helvetica-Bold", marginBottom: 2 }}>
            These are not small changes, and one of them is a correction of a real under-feed.
          </Text>
          <Text>
            {CLIENTS.filter((c) => c.next.targetKcal > c.now.targetKcal).map((c) => c.name).join(" and ")}{" "}
            were being told to eat below what their recorded training and step count justify, because
            they described themselves as &quot;Mostly seated&quot; while walking{" "}
            {str(CLIENTS[1].a, "q106")} steps and training{" "}
            {str(CLIENTS[1].a, "q44a")} days a week. That is the shape of error that produces a
            hungry, non-adherent client whose next counselling records them as a dropout.
          </Text>
        </View>

        <Text style={s.h2}>What follows automatically, and what does not</Text>
        <Text style={s.p}>
          <Text style={{ fontFamily: "Helvetica-Bold" }}>Follows automatically:</Text> the daily
          calorie target (a fixed % off TDEE), the transition trigger, carbohydrate as the residual,
          fibre, and the plan the model is told to build. The engine already takes BMR and TDEE as
          inputs, so no roadmap code changes — the numbers above came from the live engine with only
          TDEE swapped.{"\n"}
          <Text style={{ fontFamily: "Helvetica-Bold" }}>Does not change:</Text> protein, which is
          dosed on body weight, and the target weight. Also unchanged — and this is worth a
          decision — <Text style={{ fontFamily: "Helvetica-Bold" }}>the timeline</Text>, which is
          computed from a 0.5–1.0%/week rate assumption and never from the deficit actually
          prescribed. A client whose TDEE rises {Math.max(...CLIENTS.map((c) => c.p.tdee - c.e.tdee!))} kcal
          keeps exactly the same predicted finish date, which is arguably the next thing to fix.
        </Text>

        <Text style={s.h2}>Where it becomes visible</Text>
        <Text style={s.p}>
          <Text style={{ fontFamily: "Helvetica-Bold" }}>In the form,</Text> under the step and
          training questions: a live line reading the energy those answers are worth — &quot;7,000
          steps ≈ x1.35 everyday activity&quot; and &quot;4 × 60–90 min moderate ≈ 234 kcal/day&quot;
          — so the dietitian sees the consequence of an answer while the client is still on the call
          to correct it.{"\n"}
          <Text style={{ fontFamily: "Helvetica-Bold" }}>In the review,</Text> an activity row in the
          energy breakdown: BMR, plus everyday movement, plus training, totalling the TDEE the whole
          roadmap is built on — currently the review shows the TDEE without showing where it came
          from.
        </Text>

        <Text style={s.h2}>What I need approved</Text>
        <Text style={s.p}>
          1. The step→multiplier ladder in Rule 1 — the values, and that measured steps outrank the
          self-description.{"\n"}
          2. The MET values and duration midpoints in Rule 2, and the (MET − 1) net convention.{"\n"}
          3. That clients whose targets RISE is the intended outcome, not a regression.{"\n"}
          4. Whether the timeline should follow the prescribed deficit rather than a fixed rate
          assumption — a larger change, and out of scope unless you want it.
        </Text>
        <Text style={s.small}>
          Nothing above is written to the app. On approval the change is confined to
          src/lib/counselling/energy.ts plus its test, with the two display additions described
          above; the engine, the plan prompt and the PDF need no edits.
        </Text>

        <Footer page="Page 2 of 2" />
      </Page>
    </Document>
  );

  const buf = await renderToBuffer(doc);
  const out = path.join(__dirname, "..", "test-output");
  mkdirSync(out, { recursive: true });
  const file = path.join(out, "activity-energy-proposal.pdf");
  writeFileSync(file, buf);
  console.log(`Wrote ${file} (${Math.round(buf.length / 1024)} KB)`);

  console.log("\nSummary of the modelled change:");
  for (const c of CLIENTS) {
    console.log(
      `  ${c.name.padEnd(6)} TDEE ${c.e.tdee} -> ${c.p.tdee}   ` +
        `target ${c.now.targetKcal} -> ${c.next.targetKcal} kcal ` +
        `(${c.next.targetKcal - c.now.targetKcal >= 0 ? "+" : ""}${c.next.targetKcal - c.now.targetKcal})`
    );
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
