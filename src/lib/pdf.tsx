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

const YELLOW = "#FFED00"; // LEANR brand yellow (sampled from logo)
const YELLOW_PALE = "#FEFCE8";
const BLACK = "#0A0A0A";
const INK = "#18181b";
const MUTED = "#6b7280";
const BORDER = "#e4e4e7";

const LOGO_W = 92;
const LOGO_H = LOGO_W / LOGO_ASPECT;

const styles = StyleSheet.create({
  page: {
    paddingTop: 36,
    paddingBottom: 48,
    paddingHorizontal: 40,
    fontSize: 9.5,
    fontFamily: "Helvetica",
    color: INK,
  },
  header: {
    backgroundColor: BLACK,
    borderRadius: 8,
    paddingVertical: 16,
    paddingHorizontal: 18,
    marginBottom: 14,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  headerTitle: {
    color: YELLOW,
    fontSize: 17,
    fontFamily: "Helvetica-Bold",
    letterSpacing: 0.8,
  },
  headerSub: { color: "#d4d4d8", fontSize: 9.5, marginTop: 5 },
  logo: { width: LOGO_W, height: LOGO_H, marginLeft: 16 },
  metaRow: { flexDirection: "row", gap: 12, marginBottom: 12 },
  metaBox: {
    flex: 1,
    borderWidth: 1,
    borderColor: BORDER,
    borderTopWidth: 3,
    borderTopColor: YELLOW,
    borderRadius: 6,
    padding: 8,
  },
  metaLabel: { fontSize: 7.5, color: MUTED, textTransform: "uppercase" },
  metaValue: { fontSize: 11, fontFamily: "Helvetica-Bold", marginTop: 2 },
  sectionTitle: {
    alignSelf: "flex-start",
    backgroundColor: YELLOW,
    color: BLACK,
    fontSize: 9.5,
    fontFamily: "Helvetica-Bold",
    textTransform: "uppercase",
    letterSpacing: 0.6,
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 3,
    marginTop: 12,
    marginBottom: 6,
  },
  summary: {
    backgroundColor: YELLOW_PALE,
    borderRadius: 6,
    padding: 10,
    lineHeight: 1.5,
  },
  bullet: { flexDirection: "row", marginBottom: 3 },
  bulletDot: { width: 12, color: "#A16207" },
  bulletText: { flex: 1, lineHeight: 1.4 },
  dayCard: {
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 6,
    marginBottom: 10,
  },
  dayHeader: {
    backgroundColor: BLACK,
    borderTopLeftRadius: 5,
    borderTopRightRadius: 5,
    paddingVertical: 5,
    paddingHorizontal: 10,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  dayTitle: { color: YELLOW, fontFamily: "Helvetica-Bold", fontSize: 10.5 },
  dayCal: { color: "#d4d4d8", fontSize: 9 },
  mealRow: {
    flexDirection: "row",
    borderTopWidth: 1,
    borderTopColor: BORDER,
    paddingVertical: 6,
    paddingHorizontal: 10,
  },
  mealName: { width: 110 },
  mealNameText: { fontFamily: "Helvetica-Bold", fontSize: 9.5 },
  mealTime: { color: MUTED, fontSize: 8, marginTop: 1 },
  mealItems: { flex: 1 },
  mealItem: { lineHeight: 1.4 },
  mealNotes: { color: MUTED, fontSize: 8, marginTop: 2 },
  footer: {
    position: "absolute",
    bottom: 20,
    left: 40,
    right: 40,
    borderTopWidth: 1,
    borderTopColor: BORDER,
    paddingTop: 6,
    fontSize: 7.5,
    color: MUTED,
    textAlign: "center",
  },
});

export interface PdfArgs {
  plan: DietPlan;
  clientName: string;
  weekNumber: number;
  dietitianName: string;
  generatedOn: string;
}

function PlanDocument({ plan, clientName, weekNumber, dietitianName, generatedOn }: PdfArgs) {
  return (
    <Document title={`Diet plan — ${clientName} — Week ${weekNumber}`}>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <Text style={styles.headerTitle}>1-WEEK DIET PLAN — WEEK {weekNumber}</Text>
            <Text style={styles.headerSub}>
              {clientName} · Prepared by {dietitianName} · {generatedOn}
            </Text>
          </View>
          <Image src={LOGO_DATA_URI} style={styles.logo} />
        </View>

        <View style={styles.metaRow}>
          <View style={styles.metaBox}>
            <Text style={styles.metaLabel}>Daily calories</Text>
            <Text style={styles.metaValue}>{Math.round(plan.daily_calories)} kcal</Text>
          </View>
          <View style={styles.metaBox}>
            <Text style={styles.metaLabel}>Protein</Text>
            <Text style={styles.metaValue}>{Math.round(plan.macros.protein_g)} g</Text>
          </View>
          <View style={styles.metaBox}>
            <Text style={styles.metaLabel}>Carbs</Text>
            <Text style={styles.metaValue}>{Math.round(plan.macros.carbs_g)} g</Text>
          </View>
          <View style={styles.metaBox}>
            <Text style={styles.metaLabel}>Fat</Text>
            <Text style={styles.metaValue}>{Math.round(plan.macros.fat_g)} g</Text>
          </View>
        </View>

        <Text style={styles.sectionTitle}>Overview</Text>
        <Text style={styles.summary}>{plan.summary}</Text>

        {plan.guidelines.length > 0 && (
          <View>
            <Text style={styles.sectionTitle}>Guidelines</Text>
            {plan.guidelines.map((g, i) => (
              <View key={i} style={styles.bullet}>
                <Text style={styles.bulletDot}>•</Text>
                <Text style={styles.bulletText}>{g}</Text>
              </View>
            ))}
            {plan.hydration ? (
              <View style={styles.bullet}>
                <Text style={styles.bulletDot}>•</Text>
                <Text style={styles.bulletText}>Hydration: {plan.hydration}</Text>
              </View>
            ) : null}
          </View>
        )}

        <Text style={styles.sectionTitle}>Weekly Meal Plan</Text>
        {plan.days.map((day, di) => (
          <View key={di} style={styles.dayCard} wrap={false}>
            <View style={styles.dayHeader}>
              <Text style={styles.dayTitle}>{day.day}</Text>
              {day.total_calories ? (
                <Text style={styles.dayCal}>~{Math.round(day.total_calories)} kcal</Text>
              ) : null}
            </View>
            {day.meals.map((meal, mi) => (
              <View key={mi} style={styles.mealRow}>
                <View style={styles.mealName}>
                  <Text style={styles.mealNameText}>{meal.name}</Text>
                  {meal.time ? <Text style={styles.mealTime}>{meal.time}</Text> : null}
                </View>
                <View style={styles.mealItems}>
                  {meal.items.map((item, ii) => (
                    <Text key={ii} style={styles.mealItem}>
                      {item.food}
                      {item.quantity ? ` — ${item.quantity}` : ""}
                    </Text>
                  ))}
                  {meal.notes ? <Text style={styles.mealNotes}>{meal.notes}</Text> : null}
                </View>
              </View>
            ))}
          </View>
        ))}

        {plan.foods_to_avoid.length > 0 && (
          <View>
            <Text style={styles.sectionTitle}>Foods to Avoid</Text>
            {plan.foods_to_avoid.map((f, i) => (
              <View key={i} style={styles.bullet}>
                <Text style={styles.bulletDot}>•</Text>
                <Text style={styles.bulletText}>{f}</Text>
              </View>
            ))}
          </View>
        )}

        <Text style={styles.footer} fixed>
          LEANR by Fitelo · Generated with AI assistance and reviewed by your dietitian.
          Not a substitute for medical advice — consult your doctor before major dietary changes.
        </Text>
      </Page>
    </Document>
  );
}

export async function renderPlanPdf(args: PdfArgs): Promise<Buffer> {
  return renderToBuffer(<PlanDocument {...args} />);
}
