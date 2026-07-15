import React from "react";
import {
  Document,
  Image,
  Page,
  StyleSheet,
  Text,
  View,
  renderToBuffer,
} from "@react-pdf/renderer";
import type { DietPlan } from "./nim";
import { LOGO_DATA_URI, LOGO_ASPECT } from "./logo";

// ---- LEANR brand + macro palette -------------------------------------------
const YELLOW = "#FFED00";
const YELLOW_PALE = "#FEFCE8";
const BLACK = "#0A0A0A";
const INK = "#18181b";
const MUTED = "#71717a";
const FAINT = "#a1a1aa";
const BORDER = "#e4e4e7";
const ROW_ALT = "#fafafa";
const PROTEIN = "#2563eb";
const CARBS = "#d97706";
const FAT = "#dc2626";

const LOGO_W = 88;
const LOGO_H = LOGO_W / LOGO_ASPECT;

// Fixed column widths (usable width ≈ 515pt)
const W_TIME = 34;
const W_MEAL = 64;
const W_CAL = 44;
const W_MACRO = 38;
const W_PCT = 32;

const styles = StyleSheet.create({
  page: {
    paddingTop: 32,
    paddingBottom: 52,
    paddingHorizontal: 40,
    fontSize: 8.5,
    fontFamily: "Helvetica",
    color: INK,
  },

  // Header band
  header: {
    backgroundColor: BLACK,
    borderRadius: 8,
    paddingVertical: 14,
    paddingHorizontal: 18,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  headerTitle: { color: "#ffffff", fontSize: 14, fontFamily: "Helvetica-Bold" },
  headerName: { color: YELLOW },
  headerSub: { color: "#d4d4d8", fontSize: 8.5, marginTop: 5 },
  headerRight: { alignItems: "flex-end", marginLeft: 16 },
  headerPlanLine: { color: "#a1a1aa", fontSize: 7.5, marginTop: 5 },

  // Target stat boxes
  metaRow: { flexDirection: "row", gap: 10, marginTop: 12 },
  metaBox: {
    flex: 1,
    borderWidth: 1,
    borderColor: BORDER,
    borderTopWidth: 3,
    borderTopColor: YELLOW,
    borderRadius: 5,
    paddingVertical: 6,
    paddingHorizontal: 8,
  },
  metaLabel: { fontSize: 6.5, color: MUTED, textTransform: "uppercase", letterSpacing: 0.4 },
  metaValue: { fontSize: 11, fontFamily: "Helvetica-Bold", marginTop: 2 },

  // Legend + disclaimer
  legendRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 10,
    marginBottom: 4,
  },
  legendItems: { flexDirection: "row", gap: 14 },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 4 },
  legendDot: { width: 6, height: 6, borderRadius: 3 },
  legendLabel: { fontSize: 8, fontFamily: "Helvetica-Bold" },
  // flex + right-align so the note wraps in its own space instead of running
  // into the legend labels.
  disclaimer: { flex: 1, fontSize: 7, color: FAINT, textAlign: "right", marginLeft: 16 },

  summary: {
    backgroundColor: YELLOW_PALE,
    borderRadius: 5,
    padding: 9,
    lineHeight: 1.45,
    marginTop: 8,
    fontSize: 8.5,
  },

  // Day table
  dayBlock: { marginTop: 12 },
  dayHeader: {
    backgroundColor: BLACK,
    borderTopLeftRadius: 5,
    borderTopRightRadius: 5,
    paddingVertical: 6,
    paddingHorizontal: 10,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  dayTitle: { color: YELLOW, fontFamily: "Helvetica-Bold", fontSize: 10 },
  dayMacros: { color: "#e4e4e7", fontSize: 8 },
  table: {
    borderWidth: 1,
    borderColor: BORDER,
    borderTopWidth: 0,
    borderBottomLeftRadius: 5,
    borderBottomRightRadius: 5,
  },
  thRow: {
    flexDirection: "row",
    backgroundColor: ROW_ALT,
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
  },
  th: {
    fontSize: 7,
    color: MUTED,
    fontFamily: "Helvetica-Bold",
    paddingVertical: 5,
    paddingHorizontal: 5,
  },
  tdRow: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: "#f0f0f1" },
  td: { paddingVertical: 5, paddingHorizontal: 5, fontSize: 8 },
  tdTime: { width: W_TIME, color: MUTED },
  tdMeal: { width: W_MEAL, fontFamily: "Helvetica-Bold" },
  tdFoods: { flex: 1, color: "#3f3f46", lineHeight: 1.35 },
  tdNotes: { color: FAINT, fontSize: 7, marginTop: 1.5 },
  num: { textAlign: "right" },
  totalRow: { flexDirection: "row", backgroundColor: YELLOW_PALE },
  totalLabel: { fontFamily: "Helvetica-Bold" },

  // Section chip
  sectionTitle: {
    alignSelf: "flex-start",
    backgroundColor: YELLOW,
    color: BLACK,
    fontSize: 9,
    fontFamily: "Helvetica-Bold",
    textTransform: "uppercase",
    letterSpacing: 0.6,
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 3,
    marginTop: 14,
    marginBottom: 6,
  },
  bullet: { flexDirection: "row", marginBottom: 2.5 },
  bulletDot: { width: 10, color: "#a16207" },
  bulletText: { flex: 1, lineHeight: 1.35 },

  footer: {
    position: "absolute",
    bottom: 18,
    left: 40,
    right: 40,
    borderTopWidth: 1,
    borderTopColor: BORDER,
    paddingTop: 5,
  },
  footerText: { fontSize: 6.8, color: FAINT, textAlign: "center", lineHeight: 1.4 },
});

export interface PdfArgs {
  plan: DietPlan;
  clientName: string;
  weekNumber: number;
  dietitianName: string;
  generatedOn: string;
  startDateIso: string;
  dietType: string;
  conditions: string[];
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function addDays(iso: string, days: number): Date {
  const d = new Date(iso);
  d.setDate(d.getDate() + days);
  return d;
}

function dayLabel(iso: string, offset: number): string {
  const d = addDays(iso, offset);
  return `${WEEKDAYS[d.getDay()]}, ${String(d.getDate()).padStart(2, "0")} ${MONTHS[d.getMonth()]}`;
}

function dateRange(iso: string): string {
  const a = addDays(iso, 0);
  const b = addDays(iso, 6);
  return `${String(a.getDate()).padStart(2, "0")} ${MONTHS[a.getMonth()]} – ${String(
    b.getDate()
  ).padStart(2, "0")} ${MONTHS[b.getMonth()]} ${b.getFullYear()}`;
}

function titleCase(s: string): string {
  return s.replace(/(^|[\s-])\w/g, (c) => c.toUpperCase());
}

type Sums = { cal: number; p: number; c: number; f: number };

function daySums(day: DietPlan["days"][number]): Sums {
  return day.meals.reduce<Sums>(
    (a, m) => ({
      cal: a.cal + (m.calories || 0),
      p: a.p + (m.protein_g || 0),
      c: a.c + (m.carbs_g || 0),
      f: a.f + (m.fat_g || 0),
    }),
    { cal: 0, p: 0, c: 0, f: 0 }
  );
}

const r = Math.round;
const pct = (part: number, total: number) => (total > 0 ? `${r((part / total) * 100)}%` : "—");

function MacroHeaderCells() {
  return (
    <>
      <Text style={[styles.th, styles.num, { width: W_CAL }]}>Calories</Text>
      <Text style={[styles.th, styles.num, { width: W_MACRO, color: PROTEIN }]}>Protein</Text>
      <Text style={[styles.th, styles.num, { width: W_MACRO, color: CARBS }]}>Carbs</Text>
      <Text style={[styles.th, styles.num, { width: W_MACRO, color: FAT }]}>Fat</Text>
    </>
  );
}

/** "8:30" -> "08:30" so meals sort correctly; missing times go last. */
function mealSortKey(time: string): string {
  const t = (time || "").trim();
  if (!t) return "99:99";
  return /^\d:/.test(t) ? `0${t}` : t;
}

function DayTable({
  day,
  label,
}: {
  day: DietPlan["days"][number];
  label: string;
}) {
  const sums = daySums(day);
  // Display in clock order — the model sometimes appends late additions
  // (e.g. an afternoon tea) after the last meal.
  const meals = [...day.meals].sort((a, b) =>
    mealSortKey(a.time).localeCompare(mealSortKey(b.time))
  );
  return (
    <View style={styles.dayBlock}>
      <View style={styles.dayHeader} wrap={false} minPresenceAhead={120}>
        <Text style={styles.dayTitle}>{label}</Text>
        <Text style={styles.dayMacros}>
          {r(sums.cal)} kcal  |  P {r(sums.p)}g  |  C {r(sums.c)}g  |  F {r(sums.f)}g
        </Text>
      </View>
      <View style={styles.table}>
        <View style={styles.thRow}>
          <Text style={[styles.th, { width: W_TIME }]}>Time</Text>
          <Text style={[styles.th, { width: W_MEAL }]}>Meal</Text>
          <Text style={[styles.th, { flex: 1 }]}>Foods</Text>
          <MacroHeaderCells />
          <Text style={[styles.th, styles.num, { width: W_PCT }]}>Cal%</Text>
        </View>

        {meals.map((meal, mi) => (
          <View key={mi} style={styles.tdRow} wrap={false}>
            <Text style={[styles.td, styles.tdTime]}>{meal.time || "—"}</Text>
            <Text style={[styles.td, styles.tdMeal]}>{meal.name}</Text>
            <View style={[styles.td, styles.tdFoods]}>
              <Text>
                {meal.items
                  .map((i) => (i.quantity ? `${i.food} (${i.quantity})` : i.food))
                  .join(", ")}
              </Text>
              {meal.notes ? <Text style={styles.tdNotes}>{meal.notes}</Text> : null}
            </View>
            <Text style={[styles.td, styles.num, { width: W_CAL }]}>{r(meal.calories || 0)}</Text>
            <Text style={[styles.td, styles.num, { width: W_MACRO, color: PROTEIN, fontFamily: "Helvetica-Bold" }]}>
              {r(meal.protein_g || 0)}g
            </Text>
            <Text style={[styles.td, styles.num, { width: W_MACRO, color: CARBS, fontFamily: "Helvetica-Bold" }]}>
              {r(meal.carbs_g || 0)}g
            </Text>
            <Text style={[styles.td, styles.num, { width: W_MACRO, color: FAT, fontFamily: "Helvetica-Bold" }]}>
              {r(meal.fat_g || 0)}g
            </Text>
            <Text style={[styles.td, styles.num, { width: W_PCT, color: MUTED }]}>
              {pct(meal.calories || 0, sums.cal)}
            </Text>
          </View>
        ))}

        <View style={styles.totalRow} wrap={false}>
          <Text style={[styles.td, { width: W_TIME }]} />
          <Text style={[styles.td, styles.totalLabel, { width: W_MEAL }]}>Daily Total</Text>
          <Text style={[styles.td, { flex: 1 }]} />
          <Text style={[styles.td, styles.num, styles.totalLabel, { width: W_CAL }]}>
            {r(sums.cal)}
          </Text>
          <Text style={[styles.td, styles.num, styles.totalLabel, { width: W_MACRO, color: PROTEIN }]}>
            {r(sums.p)}g
          </Text>
          <Text style={[styles.td, styles.num, styles.totalLabel, { width: W_MACRO, color: CARBS }]}>
            {r(sums.c)}g
          </Text>
          <Text style={[styles.td, styles.num, styles.totalLabel, { width: W_MACRO, color: FAT }]}>
            {r(sums.f)}g
          </Text>
          <Text style={[styles.td, styles.num, { width: W_PCT, color: MUTED }]}>100%</Text>
        </View>
      </View>
    </View>
  );
}

function WeeklySummary({ plan, startDateIso }: { plan: DietPlan; startDateIso: string }) {
  const rows = plan.days.map((day, i) => ({ label: dayLabel(startDateIso, i), ...daySums(day) }));
  const avg: Sums = {
    cal: rows.reduce((a, x) => a + x.cal, 0) / rows.length,
    p: rows.reduce((a, x) => a + x.p, 0) / rows.length,
    c: rows.reduce((a, x) => a + x.c, 0) / rows.length,
    f: rows.reduce((a, x) => a + x.f, 0) / rows.length,
  };
  const W_DAY_CAL = 50;
  const W_G = 46;
  const W_P = 36;

  const line = (s: Sums, label: string, highlight: boolean, key?: string | number) => (
    <View key={key} style={highlight ? styles.totalRow : styles.tdRow} wrap={false}>
      <Text style={[styles.td, { flex: 1 }, highlight ? styles.totalLabel : {}]}>{label}</Text>
      <Text style={[styles.td, styles.num, styles.totalLabel, { width: W_DAY_CAL }]}>{r(s.cal)}</Text>
      <Text style={[styles.td, styles.num, { width: W_G, color: PROTEIN }]}>{r(s.p)}</Text>
      <Text style={[styles.td, styles.num, { width: W_G, color: CARBS }]}>{r(s.c)}</Text>
      <Text style={[styles.td, styles.num, { width: W_G, color: FAT }]}>{r(s.f)}</Text>
      <Text style={[styles.td, styles.num, { width: W_P, color: PROTEIN }]}>{pct(s.p * 4, s.cal)}</Text>
      <Text style={[styles.td, styles.num, { width: W_P, color: CARBS }]}>{pct(s.c * 4, s.cal)}</Text>
      <Text style={[styles.td, styles.num, { width: W_P, color: FAT }]}>{pct(s.f * 9, s.cal)}</Text>
    </View>
  );

  return (
    <View>
      <Text style={styles.sectionTitle} minPresenceAhead={120}>
        Weekly Summary
      </Text>
      <View style={[styles.table, { borderTopWidth: 1, borderRadius: 5 }]}>
        <View style={styles.thRow}>
          <Text style={[styles.th, { flex: 1 }]}>Day</Text>
          <Text style={[styles.th, styles.num, { width: W_DAY_CAL }]}>Calories</Text>
          <Text style={[styles.th, styles.num, { width: W_G, color: PROTEIN }]}>Protein (g)</Text>
          <Text style={[styles.th, styles.num, { width: W_G, color: CARBS }]}>Carbs (g)</Text>
          <Text style={[styles.th, styles.num, { width: W_G, color: FAT }]}>Fat (g)</Text>
          <Text style={[styles.th, styles.num, { width: W_P, color: PROTEIN }]}>P%</Text>
          <Text style={[styles.th, styles.num, { width: W_P, color: CARBS }]}>C%</Text>
          <Text style={[styles.th, styles.num, { width: W_P, color: FAT }]}>F%</Text>
        </View>
        {rows.map((row, i) => line(row, row.label, false, i))}
        {line(avg, "Weekly Avg", true, "avg")}
      </View>
    </View>
  );
}

function PlanDocument({
  plan,
  clientName,
  weekNumber,
  dietitianName,
  startDateIso,
  dietType,
  conditions,
}: PdfArgs) {
  const conditionText = conditions.length > 0 ? conditions.join(", ") : "None";
  return (
    <Document title={`Diet plan — ${clientName} — Week ${weekNumber}`}>
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <Text style={styles.headerTitle}>
              <Text style={styles.headerName}>{clientName}</Text> — Weekly Diet Plan
            </Text>
            <Text style={styles.headerSub}>
              Week {weekNumber} · {dateRange(startDateIso)} · Prepared by {dietitianName}
            </Text>
            <Text style={styles.headerPlanLine}>
              Diet: {titleCase(dietType || "—")}  |  Medical: {conditionText}
            </Text>
          </View>
          <View style={styles.headerRight}>
            <Image src={LOGO_DATA_URI} style={{ width: LOGO_W, height: LOGO_H }} />
          </View>
        </View>

        {/* Daily targets */}
        <View style={styles.metaRow}>
          <View style={styles.metaBox}>
            <Text style={styles.metaLabel}>Daily calories</Text>
            <Text style={styles.metaValue}>{r(plan.daily_calories)} kcal</Text>
          </View>
          <View style={styles.metaBox}>
            <Text style={styles.metaLabel}>Protein</Text>
            <Text style={[styles.metaValue, { color: PROTEIN }]}>{r(plan.macros.protein_g)} g</Text>
          </View>
          <View style={styles.metaBox}>
            <Text style={styles.metaLabel}>Carbohydrates</Text>
            <Text style={[styles.metaValue, { color: CARBS }]}>{r(plan.macros.carbs_g)} g</Text>
          </View>
          <View style={styles.metaBox}>
            <Text style={styles.metaLabel}>Fat</Text>
            <Text style={[styles.metaValue, { color: FAT }]}>{r(plan.macros.fat_g)} g</Text>
          </View>
        </View>

        {/* Legend + disclaimer */}
        <View style={styles.legendRow}>
          <View style={styles.legendItems}>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: PROTEIN }]} />
              <Text style={[styles.legendLabel, { color: PROTEIN }]}>Protein</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: CARBS }]} />
              <Text style={[styles.legendLabel, { color: CARBS }]}>Carbohydrates</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: FAT }]} />
              <Text style={[styles.legendLabel, { color: FAT }]}>Fat</Text>
            </View>
          </View>
          <Text style={styles.disclaimer}>
            Nutrition data: ICMR-NIN IFCT/INDB &amp; USDA FoodData Central where
            matched; otherwise estimated from standard portions.
          </Text>
        </View>

        {plan.summary ? <Text style={styles.summary}>{plan.summary}</Text> : null}

        {/* Day tables */}
        {plan.days.map((day, di) => (
          <DayTable key={di} day={day} label={dayLabel(startDateIso, di)} />
        ))}

        {/* Weekly summary */}
        <WeeklySummary plan={plan} startDateIso={startDateIso} />

        {/* Guidelines — hydration gets its own bullet, so model guidelines
            that repeat it are dropped; cap keeps the section tight. */}
        {plan.guidelines.length > 0 && (
          <View>
            <Text style={styles.sectionTitle} minPresenceAhead={60}>
              Guidelines
            </Text>
            {plan.guidelines
              .filter((g) => !plan.hydration || !/hydrat|\bwater\b/i.test(g))
              .slice(0, 6)
              .map((g, i) => (
                <View key={i} style={styles.bullet} wrap={false}>
                  <Text style={styles.bulletDot}>•</Text>
                  <Text style={styles.bulletText}>{g}</Text>
                </View>
              ))}
            {plan.hydration ? (
              <View style={styles.bullet} wrap={false}>
                <Text style={styles.bulletDot}>•</Text>
                <Text style={styles.bulletText}>Hydration: {plan.hydration}</Text>
              </View>
            ) : null}
          </View>
        )}

        {/* Foods to avoid */}
        {plan.foods_to_avoid.length > 0 && (
          <View>
            <Text style={styles.sectionTitle} minPresenceAhead={60}>
              Foods to Avoid
            </Text>
            {plan.foods_to_avoid.map((f, i) => (
              <View key={i} style={styles.bullet} wrap={false}>
                <Text style={styles.bulletDot}>•</Text>
                <Text style={styles.bulletText}>{f}</Text>
              </View>
            ))}
          </View>
        )}

        <View style={styles.footer} fixed>
          <Text style={styles.footerText}>
            Generated by LEANR Diet Platform  |  Diet Preference: {titleCase(dietType || "—")}  |
            {"  "}Medical Condition: {conditionText}  |  Prepared by {dietitianName}
          </Text>
          <Text style={styles.footerText}>
            Created with AI assistance and reviewed by your dietitian. Not a substitute for medical
            advice — consult your doctor before major dietary changes.
          </Text>
        </View>
      </Page>
    </Document>
  );
}

export async function renderPlanPdf(args: PdfArgs): Promise<Buffer> {
  return renderToBuffer(<PlanDocument {...args} />);
}
