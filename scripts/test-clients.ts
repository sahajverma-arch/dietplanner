// Shared test-client counselling answers for the E2E scripts
// (e2e-test-plan.ts generates PDFs headlessly; seed-ui-test-draft.ts plants
// one of these as a saved draft so the real app UI can be tested).
//
// Both clients answer every mandatory question (see REQUIRED_IDS in
// src/lib/counselling/questions.ts) with valid option strings, so they pass
// the generation gate. Rahul additionally avoids non-veg and eggs on Tuesdays
// and Thursdays — exercising the day-of-week food rules.

export type Answers = Record<string, string | string[]>;

// ---------------------------------------------------------------------------
// Test client 1 — Priya Test: 32F, vegetarian, PCOS + hypothyroid,
// PEANUT ALLERGY (tests the allergen-must-never-appear enforcement).
// ---------------------------------------------------------------------------
export const PRIYA: Answers = {
  name: "Priya Test",
  clientCode: "TEST-001",
  gender: "Female",
  phone: "+91 90000 00001",
  email: "priya.test@example.com",

  q1: "Post-pregnancy weight has not budged in a year and my energy is low all day",
  q2: ["Reduce body fat", "Reduce belly fat", "Improve energy"],
  q3: "Fit into old clothes and stay energetic through the workday",
  q4: "I want to reduce fat while maintaining muscle",
  q5: ["Lower abdomen", "Overall body fat"],
  q6: "Yes", q6a: "62",
  q8: ["No fixed date"],
  q9: "9",
  q10: "This has bothered me for two years; I finally have time to fix it",

  q11: "74", q12: "160", q13: "32",
  q14: "70", q16: "76",
  q20: "Mainly after a specific event",
  q21: ["Postpartum", "Desk job"],
  q22: "Increased slightly",
  q25: "Yes", q26: "More than 3 months",
  q28: "Not sure",
  q30: "Body appearance",

  q31: "No",
  q37: "Higher body fat with low muscle",
  q38: "Yes",
  q39: "No",

  q41: ["PCOS/PCOD", "Hypothyroidism"],
  q42: "Specialist", q43: "2022 (PCOS), 2023 (thyroid)",
  q44: "Well controlled", q45: "Yes",
  q46: "No", q47: "No", q48: "No",
  q49: "No", q50: "No", q51: "No", q52: "No", q53: "No", q54: "No", q55: "No",

  q56: "Yes",
  q57: "Thyronorm 50 mcg, empty stomach 6:30 am, daily, hypothyroid, 3 years",
  q58: "No", q60: ["None"],

  q61: "Yes",
  q62: ["Vitamin D"],
  q63: "Doctor", q64: "60,000 IU sachet", q65: "Occasionally", q66: ["None"],
  q67: "No",

  q68: "Within 3 months",
  q69: "Yes", q71: "Yes",
  q72: ["Thyroid", "Vitamin D"],
  q72a: "TSH 6.2 (Jan 2026), Vitamin D 18 ng/mL",
  q73: "Yes",

  // PCOS + thyroid branches
  p1: "2022, after irregular cycles; confirmed on ultrasound",
  p2: "Not sure",
  p4: "None currently",
  t1: "Hypothyroidism",
  t2: "Thyronorm 50 mcg",
  t3: "Empty stomach 6:30 am, breakfast only after 7:15",
  t4: "TSH 6.2 (Jan 2026)",
  t5: "No",

  q74: "07:00", q75: "Tea", q77: "Tea", q78: "Milk tea with 1.5 tsp sugar",
  q79: "09:00", q80: "2 aloo parathas with butter and a bowl of curd",
  q81: "2 medium parathas, 1 tsp butter, 1 katori curd",
  q82: ["Shallow fried"],
  q83: "Self",
  q88: "2 biscuits with tea",
  q89: "13:30", q90: "3 rotis, aloo sabzi, dal, salad",
  q91: "3 rotis", q92: ["Dal"],
  q93: "Tea with 2 biscuits", q94: "Sometimes",
  q96: "Namkeen or bhujia while working",
  q97: "No",
  q102: "21:00", q103: "2 rotis with paneer sabzi or dal, rice sometimes",
  q104: "", q105: "23:30", q106: "Exactly my normal routine",

  q108: ["More restaurant food", "More sweets/snacks"],
  q109: "1–2", q110: "Once/week",
  q111: ["North Indian", "Chinese"],
  q112: "1",
  q113: "No",

  q115: "India, Delhi",
  q116: "Punjabi",
  q117: ["Roti", "Rice", "Poha"],
  q118: "Easily",
  q119: "No",
  q120: "Occasionally",

  q121: "Vegetarian",
  q122: "Paneer, rajma, curd, poha, seasonal fruit",
  q123: "Lauki, tinda, raw sprouts",
  q124: "Yes",
  q124a: "Peanuts — hives and throat itching within minutes",
  q125: ["None"], q126: "",
  q129: "Avocado, quinoa",
  q130: "Anything needing more than 30 minutes",

  q131: "1", q132: "Rarely",
  q133: ["Paneer", "Dal", "Curd", "Rajma/beans"],
  q134: "2–3 times/week",
  q135: "Yes",
  q136: "No",
  q140: "Yes", q141: ["Don't know what to eat"], q142: "Yes",

  q143: "Yes", q144: ["Walking", "Yoga"], q145: "3", q146: "30–45 min", q147: "Morning",
  q148: "Never", q149: "Beginner",
  q150: ["None"],
  q151: "6", q152: "Good", q154: "Stable",
  q156: "5,000–8,000", q157: "8–10",

  q158: "No", q162: "No", q163: "Home", q164: ["No equipment"], q165: "3",

  q166: "Desk job", q167: "Hybrid", q168: "09:30 – 18:00", q169: "No shift",
  q171: "Evening", q172: "Evening snack", q173: "Easily", q174: "Yes",

  q175: "Self", q176: "Full kitchen", q177: "Yes", q178: "10–15 minutes", q179: "Twice weekly",
  q180: "7",

  q181: "Mostly household foods", q182: ["Imported foods"],

  q183: ["Evening"], q185: "Less than 10 minutes", q186: "Food is finished",
  q187: "Sometimes",

  q189: ["Sweet", "Fried food"], q190: "Daily",
  q191: ["Stress", "Boredom"], q192: ["Eat more", "Crave sweets"],
  q193: "Rarely", q194: "Rarely", q195: "Rarely", q196: "Sometimes",

  q197: ["Bloating"], q198: "Few times/week", q200: "Once/day",
  q201: "Rarely", q202: "Rarely", q203: "No", q204: "No", q205: "No",

  q206: "1–1.5 L", q207: "Minimal", q209: "Never", q210: "No",

  q211: "23:30", q212: "07:00", q213: "6–7 hours", q214: "6",
  q215: "15–30 minutes", q217: "Sometimes", q218: "No", q219: "No", q220: "Rarely",

  q221: "7", q222: "Work", q223: "Moderately", q225: "30–60 min",

  q226: "Yes", q227: "No", q228: "More than 35 days", q229: "No", q230: "Yes",
  q231: "Yes", q232: "No", q233: "No", q234: "Not applicable",

  q236: "Occasionally", q237: "A glass of wine at family events", q239: "Never",
  q240: "2", q241: "12–3 PM",

  q242: "Rarely", q245: "Weekly",

  q246: "Yes",
  q247: ["Keto", "Intermittent fasting"],
  q248: "Keto worked for 6 weeks, then I could not sustain it",
  q249: ["Too restrictive", "No results"],
  q250: "Keto",

  q251: ["Follow most of it", "Struggle on weekends"],
  q252: "Two options", q253: "Cups/katoris", q254: "Few days/week",
  q255: ["Frequent accountability"],

  q256: ["Cravings", "Eating out", "Time"],
  q257: "Cravings", q258: "Eating out", q259: "Time",

  q260: ["Morning tea", "Roti"],
  q260a: "No",
  q261: "Evening namkeen habit, fried breakfasts and skipping protein",
  q262: "3–4 structured changes",
  q263: "8", q265: "7",

  s_objective: "Fat Loss",
  s_gaps: ["Low Protein", "Poor Protein Distribution"],
  s_blocking: "Low protein, evening namkeen snacking and fried breakfasts despite good readiness",
  s_restrictions:
    "PEANUT ALLERGY — never include peanuts in any form. Thyroid tablet 6:30 am, breakfast after 7:15. PCOS — low-GI carbs.",
  s_p1: "Protein at breakfast and lunch",
  s_p2: "Replace evening namkeen with a planned snack",
  s_p3: "Cut shallow-fried breakfasts to twice a week",
  s_doctor: "No",
  pt_goal: "Fat loss with muscle preservation",
  pt_coord: ["Fat loss", "Workout timing"],

  pl_structure: "Structured Meal Plan",
  pl_protein: "Paneer, dal, curd, Greek yogurt; clear protein at breakfast",
  pl_carb: "Keep roti at lunch; measured rice twice a week; low-GI focus for PCOS",
  pl_fat: "3 tsp oil per day, nothing deep-fried at home",
  pl_meals: "3 meals + snack",
  pl_meals_why: "Matches her routine; a planned evening snack replaces the namkeen habit",
  pl_priority1: "Protein breakfast (besan chilla / paneer poha) → full till lunch → count protein breakfasts per week",
  pl_priority2: "Evening snack swap to roasted chana or fruit → snack log",
  pl_priority3: "8,000 steps daily → step counter",
  pl_notes: "TEST CLIENT for end-to-end verification. The peanut allergy is the hard constraint.",
};

// ---------------------------------------------------------------------------
// Test client 2 — Rahul Test: 41M, non-vegetarian, type 2 diabetes +
// hypertension + high lipids, dislikes lauki/karela, and NO NON-VEG OR EGGS
// ON TUESDAYS & THURSDAYS (tests day-of-week rules + dislike stripping).
// ---------------------------------------------------------------------------
export const RAHUL: Answers = {
  name: "Rahul Test",
  clientCode: "TEST-002",
  gender: "Male",
  phone: "+91 90000 00002",
  email: "rahul.test@example.com",

  q1: "Doctor said my HbA1c is going the wrong way; I want to fix it before medication increases",
  q2: ["Reduce belly fat", "Gain muscle", "Improve health markers"],
  q3: "Bring HbA1c under 6.5 and lose the belly",
  q4: "I want to lose fat and gain muscle",
  q5: ["Upper abdomen", "Lower abdomen"],
  q6: "Yes", q6a: "78",
  q8: ["Medical recommendation"],
  q9: "8",
  q10: "My father's diabetes complications scared me",

  q11: "92", q12: "175", q13: "41",
  q14: "89", q16: "94",
  q20: "Gradual",
  q21: ["Desk job", "Stress", "Reduced walking"],
  q22: "Increased slightly",
  q25: "No",
  q28: "Not sure",
  q30: "Health markers",

  q31: "No",
  q37: "Higher body fat with low muscle",
  q38: "Yes",
  q39: "No",

  q41: ["Diabetes", "Hypertension", "High cholesterol/triglycerides"],
  q42: "Physician", q43: "Diabetes 2021, BP 2019",
  q44: "Partially controlled", q45: "Yes",
  q46: "No", q47: "No", q48: "No",
  q49: "No", q50: "No", q51: "No", q52: "No", q53: "No", q54: "No", q55: "No",

  q56: "Yes",
  q57: "Metformin 500 mg after breakfast and dinner; Telmisartan 40 mg morning; Rosuvastatin 10 mg night",
  q58: "No", q60: ["None"],

  q61: "No", q67: "No",

  q68: "Within 3 months",
  q69: "Yes", q71: "Yes",
  q72: ["HbA1c", "Cholesterol", "Triglycerides"],
  q72a: "HbA1c 7.8, LDL 148, TG 210 (Jun 2026)",
  q73: "Yes",

  // Diabetes + muscle-gain branches
  d1: "7.8 (Jun 2026)",
  d2: "Fasting 138 last month",
  d3: "Sometimes", d4: "Fasting, a few mornings a month",
  d5: "Rarely", d6: "No", d8: "No", d10: "Occasionally",
  m2: "Yes", m4: "Don't track", m5: "No", m6: "Sometimes", m7: "2", m8: "Yes",

  q74: "07:30", q75: "Tea", q77: "Tea", q78: "Milk tea with sweetener",
  q79: "09:30", q80: "2 slices white bread with butter and 2 boiled eggs",
  q81: "2 slices, 2 eggs",
  q82: ["Boiled"],
  q83: "Family",
  q88: "Tea",
  q89: "14:00", q90: "Office canteen: 3 rotis, chicken curry or dal, rice, salad",
  q91: "3 rotis + 1 katori rice", q92: ["Chicken", "Dal"],
  q93: "Tea with rusk", q94: "Frequently",
  q96: "Samosa or pakora from the canteen twice a week",
  q97: "No",
  q102: "22:00", q103: "2 rotis, sabzi, sometimes chicken",
  q104: "Ice cream on weekends", q105: "00:30", q106: "Mostly normal",

  q108: ["More restaurant food", "More alcohol"],
  q109: "3–5", q110: "2–3 times/week",
  q111: ["North Indian", "Local cuisine"],
  q112: "3",
  q113: "Sometimes", q114: "Weekend dinner out with family, a few drinks",

  q115: "India, Gurgaon",
  q116: "Punjabi",
  q117: ["Roti", "Rice", "Bread"],
  q118: "Easily",
  q119: "Yes",
  q119a: "No non-veg or eggs on Tuesdays and Thursdays",
  q120: "Never",

  q121: "Non-vegetarian",
  q122: "Chicken, eggs, fish, rajma, curd",
  q123: "Lauki, karela, tinda",
  q124: "No",
  q125: ["None"], q126: "",

  q131: "2", q132: "Daily",
  q133: ["Dal", "Curd", "Paneer"],
  q134: "Weekly",
  q135: "Yes",
  q136: "Yes", q137: "2 whole eggs daily",
  q138: ["Chicken", "Fish"], q139: "2–3 times/week",
  q140: "Yes", q141: ["Cost"], q142: "Yes",

  q143: "Starting with LeanR", q145: "0", q146: "30–45 min", q147: "Evening",
  q148: "Less than 3 months", q149: "Complete beginner",
  q150: ["None"],
  q156: "2,000–5,000", q157: "More than 10",

  q158: "No", q162: "No", q163: "Gym", q164: ["Full gym"], q165: "4",

  q166: "Desk job", q167: "Office", q168: "10:00 – 19:30", q169: "Fixed day",
  q171: "Night", q172: "Lunch", q173: "Usually", q174: "Yes",

  q175: "Spouse", q176: "Full kitchen", q177: "Yes", q178: "Maximum 5 minutes", q179: "No",
  q180: "3",

  q181: "Can add a few fitness foods", q182: ["None"],

  q183: ["Late night"], q185: "10–15 minutes", q186: "Comfortably full",
  q187: "Sometimes",

  q189: ["Sweet", "Cold drinks"], q190: "3–4 times/week",
  q191: ["Stress"], q192: ["Order food"],
  q193: "Rarely", q194: "Rarely", q195: "Never", q196: "Rarely",

  q197: ["Acidity"], q198: "Occasionally", q200: "Once/day",
  q201: "Rarely", q202: "Rarely", q203: "No", q204: "No", q205: "No",

  q206: "2–3 L", q207: "Don't exercise", q209: "Never", q210: "No",

  q211: "00:30", q212: "07:30", q213: "6–7 hours", q214: "5",
  q215: "Less than 15 minutes", q217: "Sometimes", q218: "Don't know", q219: "No", q220: "Sometimes",

  q221: "8", q222: "Work", q223: "Moderately", q225: "Less than 30 min",

  q236: "Weekly", q237: "Whisky, 2-3 drinks on weekends", q238: "Fried snacks, peanuts",
  q239: "Never", q240: "3", q241: "3–6 PM",

  q242: "Monthly", q243: "Domestic", q244: ["Hotel", "Restaurant"],
  q245: "2–3 times/month",

  q246: "Yes",
  q247: ["High protein", "Online plan"],
  q248: "A trainer's high-protein plan — lost 4 kg but couldn't keep it up",
  q249: ["Travel", "Could not sustain"],
  q250: "A juice cleanse a colleague suggested",

  q251: ["Need flexibility", "Travel affects adherence"],
  q252: "Flexible exchange system", q253: "Simple visual guide", q254: "Few days/week",
  q255: ["Regular feedback", "Flexible options"],

  q256: ["Work", "Eating out", "Alcohol"],
  q257: "Work", q258: "Eating out", q259: "Alcohol",

  q260: ["Morning tea", "Rice", "Restaurant meal"],
  q260a: "Yes",
  q260b: ["Tuesday", "Thursday"],
  q260c: ["Non-vegetarian food", "Eggs"],
  q260d: "No non-veg or eggs on Tuesdays and Thursdays (religious practice)",
  q261: "Late dinners, canteen choices and weekend drinking",
  q262: "3–4 structured changes",
  q263: "7", q265: "6",
  q266: "Simple options I can actually get in the office",

  s_objective: "Body Recomposition",
  s_gaps: ["Long Meal Gaps", "High Liquid Calories", "Poor Workout Nutrition"],
  s_blocking: "Late dinners, canteen lunches, weekend alcohol and very low activity; diabetes only partially controlled",
  s_restrictions:
    "Diabetic — low-GI, no added sugar. Hypertension — keep sodium moderate. On a statin. Vegetarian meals only on Tuesdays and Thursdays.",
  s_p1: "Dinner by 21:30",
  s_p2: "Low-GI carb swaps at lunch",
  s_p3: "Protein at every meal",
  s_doctor: "Yes",
  pt_goal: "Muscle gain with fat loss",
  pt_coord: ["Muscle gain", "Workout timing", "Post-workout meal"],

  pl_structure: "Flexible Meal Option Plan",
  pl_protein:
    "Eggs at breakfast (except Tue/Thu — use paneer or besan), chicken/fish or dal at lunch and dinner, curd daily",
  pl_carb: "Keep measured rice at lunch, whole grain instead of white bread, low-GI overall",
  pl_fat: "Fried canteen snacks max once a week; 3 tsp oil/day at home",
  pl_meals: "3 meals + snack",
  pl_meals_why: "Long office hours — a structured evening snack prevents the late-night eating",
  pl_priority1: "Dinner by 21:30 → smaller earlier meals with spouse's support → HbA1c recheck in 3 months",
  pl_priority2: "Canteen strategy: roti + chicken/dal + salad, rice only on training days",
  pl_priority3: "8,000 steps plus 3 strength sessions per week",
  pl_notes:
    "TEST CLIENT for end-to-end verification. Diabetes + hypertension: low-GI, moderate sodium. Tuesdays and Thursdays fully vegetarian (no eggs).",
};
