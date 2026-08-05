// Shared test-client counselling answers for the E2E scripts
// (e2e-test-plan.ts generates PDFs headlessly; seed-ui-test-draft.ts plants
// one of these as a saved draft so the real app UI can be tested).
//
// Both clients answer every mandatory question of the LeanR Premium bank
// (see REQUIRED_IDS in src/lib/counselling/questions.ts) with valid option
// strings, so they pass the generation gate. Rahul additionally avoids
// non-veg and eggs on Tuesdays and Thursdays — exercising the day-of-week
// food rules (q38a–c).

export type Answers = Record<string, string | string[]>;

// ---------------------------------------------------------------------------
// Test client 1 — Priya Test: 32F, vegetarian, PCOS + hypothyroid,
// PEANUT ALLERGY (tests the allergen-must-never-appear enforcement).
// ---------------------------------------------------------------------------
export const PRIYA: Answers = {
  q76_category: "First-timer — never dieted with structure before",
  name: "Priya Test",
  clientCode: "TEST-001",
  gender: "Female",
  phone: "+91 90000 00001",
  email: "priya.test@example.com",

  // 1 — Goal & deeper motivation
  q1: ["Post-pregnancy transformation", "Low energy", "Health report concern"],
  q2: "Fat loss with muscle preservation",
  q3: ["Improve daily energy", "Improve hormonal health", "Improve relationship with food"],
  q4: ["Improve confidence", "Improve health markers", "Family motivation"],
  q5: ["Target weight"],
  q5_weight: "62",
  q6: ["Leaner appearance", "Smaller waist"],
  q8: "8",
  gr_dietitian: "Goal correctly understood",
  gr_client: "Correctly understood",

  // 2 — Body & transformation history
  q9_age: "32", q9_height: "160", q9_weight: "74",
  q9_weight_1y: "70", q9_weight_high: "76", q9_weight_low: "58", q9_weight_comfort: "62",
  q10: ["Gradual weight gain"], q10a: "4", q10b: "6–12 months",
  q11: ["Postpartum period", "Sedentary lifestyle", "Poor sleep"],
  q12: ["Intermittent fasting", "Self-designed diet"],
  q12a: "Lost weight then regained",
  q12b: ["Excessive hunger", "Family food mismatch"],
  q13: "Yes", q13a: "6", q13b: "1–2 months",
  q13c: ["Weight regain", "Strong cravings", "Hair fall"],
  q14: ["Repeated weight regain", "Weight-loss plateau"], q14a: "3–6 months",
  q15: ["Body-fat percentage", "Waist", "BIA or smart scale"],
  q15_bf: "38", q15_waist: "36", q15_src: "Smart scale", q15_assess: "Use for trend only",
  q16: ["Regular meals", "Home-cooked food", "Meal preparation", "Frequent check-ins"],
  q16a: "1) Meal preparation 2) Frequent check-ins 3) Regular meals",

  // 3 — Medical & clinical safety
  q17: ["PCOS or PCOD", "Hypothyroidism", "Vitamin D deficiency"],
  q17a: "Controlled", q17b: "Regular",
  q17c: "Hypothyroid since 2022 — controlled on 50 mcg; PCOS since 2021",
  q18: ["None"],
  q19: "Yes",
  q19a: "Thyronorm 50 mcg — morning, empty stomach, daily",
  q19b: "No",
  q20: ["Thyroid profile", "Vitamin D", "HbA1c"],
  q20a: "One or more abnormal",
  q20b: "Vitamin D 16 ng/mL; HbA1c 5.9; TSH 3.1",
  q21: ["None"],
  q22: ["No instruction"],
  cr1: ["Diet requires clinical modification", "Allergy restriction required"],

  // 4 — Digestion & tolerance
  q23: "Occasionally uncomfortable",
  q24: ["Bloating"], q24a: "1–2 times per week", q24b: ["After lunch"], q24c: "4",
  q25: "Once daily",
  q27: ["Peanut", "Rajma or beans"],
  q27_peanut_type: "Allergy — never serve",
  q27_rajma_or_beans_type: "Intolerance — causes symptoms",
  q27d: "Peanut — throat tightens and hives within minutes",
  q27a: "Severe", q27b: "Yes",
  q26a: ["Bloating", "Gas"], q26d: "1–2 times per week", q26b: "Often",

  // 5 — Actual food day
  q28: ["Breakfast", "Mid-Morning", "Lunch", "Evening", "Dinner"],
  "q112_breakfast_variants":
    "[{\"id\":\"breakfast1\",\"label\":\"Poha\",\"items\":[{\"food\":\"Poha\",\"qty\":\"1 bowl\"}],\"daysPerWeek\":5,\"measured\":{\"calories\":177,\"protein_g\":5,\"carbs_g\":21,\"fat_g\":8}},{\"id\":\"breakfast2\",\"label\":\"Upma\",\"items\":[{\"food\":\"Upma\",\"qty\":\"1 bowl\"}],\"daysPerWeek\":2,\"measured\":{\"calories\":160,\"protein_g\":3,\"carbs_g\":19,\"fat_g\":8}}]",
  "q112_midmorning_variants":
    "[{\"id\":\"midmorning1\",\"label\":\"Fruit\",\"items\":[{\"food\":\"Fruit\",\"qty\":\"1\"}],\"daysPerWeek\":7,\"measured\":{\"calories\":105,\"protein_g\":1,\"carbs_g\":27,\"fat_g\":0}}]",
  "q112_lunch_variants":
    "[{\"id\":\"lunch1\",\"label\":\"Roti, dal and sabzi\",\"items\":[{\"food\":\"Roti\",\"qty\":\"2\"},{\"food\":\"Dal\",\"qty\":\"1 katori\"},{\"food\":\"Sabzi\",\"qty\":\"1 katori\"},{\"food\":\"Salad\",\"qty\":\"1 bowl\"}],\"daysPerWeek\":7,\"measured\":{\"calories\":472,\"protein_g\":17,\"carbs_g\":57,\"fat_g\":19}}]",
  "q112_evening_variants":
    "[{\"id\":\"evening1\",\"label\":\"Tea and biscuits\",\"items\":[{\"food\":\"Biscuits\",\"qty\":\"4\"}],\"daysPerWeek\":7,\"measured\":{\"calories\":215,\"protein_g\":4,\"carbs_g\":41,\"fat_g\":4}}]",
  "q112_dinner_variants":
    "[{\"id\":\"dinner1\",\"label\":\"Roti and paneer sabzi\",\"items\":[{\"food\":\"Roti\",\"qty\":\"2\"},{\"food\":\"Paneer\",\"qty\":\"100 g\"}],\"daysPerWeek\":3,\"measured\":{\"calories\":445,\"protein_g\":22,\"carbs_g\":29,\"fat_g\":26}},{\"id\":\"dinner2\",\"label\":\"Roti, dal and sabzi\",\"items\":[{\"food\":\"Roti\",\"qty\":\"2\"},{\"food\":\"Dal\",\"qty\":\"1 katori\"},{\"food\":\"Sabzi\",\"qty\":\"1 katori\"}],\"daysPerWeek\":4,\"measured\":{\"calories\":455,\"protein_g\":16,\"carbs_g\":54,\"fat_g\":19}}]",
  q28_breakfast_time: "08:30",
  q28_breakfast_food: "Poha 1 plate",
  q28_breakfast_drinks: ["Tea with sugar × 1"],
  q109: "08:30 poha 1 plate or 2 rotis with sabzi, tea with 1 tsp sugar, most mornings. 11:00 a fruit, 4-5 days a week. 13:30 lunch — 2 rotis, dal 1 katori, sabzi, salad, home cooked, daily. 17:30 tea with 4 biscuits, daily. 21:00 dinner — 2 rotis with paneer or a vegetable sabzi, home cooked, daily.",
  q28_breakfast_prep: ["Mixed preparation"],
  q28_breakfast_source: "Home",
  q28_breakfast_extras: ["Oil", "Sugar"],
  q28_midmorning_food: "1 apple",
  q28_lunch_time: "13:30",
  q28_lunch_food: "2 rotis + dal 1 katori + sabzi + salad",
  q28_lunch_source: "Home",
  q28_evening_food: "4 biscuits",
  q28_evening_drinks: ["Tea with sugar × 2"],
  q28_dinner_time: "21:00",
  q28_dinner_food: "2 rotis + paneer sabzi 1 katori",
  q28_dinner_source: "Home",
  q29: "Weekends are different",
  q30: ["Restaurant food", "More sweets", "Delayed meals"],
  q31: "Once weekly", q31a: ["Restaurant", "Delivery"],
  q31b: "Paneer tikka, dal makhani, naan",
  q32: ["Tea", "Biscuits", "Sweets or mithai"],
  q32a: "Tea ×3/day with 1 tsp sugar each; biscuits 4–5 with evening tea",

  // 6 — Preferences & feasibility
  q33: "Vegetarian",
  q34: ["North Indian", "Punjabi"],
  q35: "Rajma chawal, paneer bhurji, dal makhani, curd rice, fruit chaat",
  q36: "Lauki, karela, tinda", q36a: "Will not eat",
  q37: ["Tea", "Roti", "Traditional household food"],
  q38: ["Vegetarian household"],
  q39: ["Self", "Parent or family"], q39a: "Good",
  q40: ["Full kitchen", "Refrigerator", "Microwave"],
  q41: ["Cook daily", "Simple cooking only", "Prepare food in advance"],
  q42: "Moderate household-food budget", q42a: ["No major limitation"],

  // 7 — Training, protein & recovery
  q43: ["Starting with LeanR PT", "Walking"],
  q44a: "3", q44b: "30–45 minutes", q44c: "Morning",
  q44d: "Complete beginner", q44e: "Light", q44f: "Fat loss",
  q45: ["No major problem"],
  q46: ["Recover well"],
  q47: ["Water only"],
  q48: ["Water"],
  q49: ["Small meal"], q49a: "30–60 minutes",
  // Frequencies match the Q28 food day above: dal at lunch daily, paneer sabzi
  // most dinners, milk only in tea (hence half portions), curd rarely.
  q50: ["Milk", "Curd", "Paneer", "Dal"],
  q50p_milk_freq: "Daily", q50p_milk_portion: "Half portion",
  q50p_curd_freq: "1–2 days a week",
  q50p_paneer_freq: "3–4 days a week",
  q50p_dal_freq: "Daily",
  q50a: "2", q50b: ["Vegetarian pattern", "Lack of knowledge"],
  q51: ["Vitamin D"], q51a: "Doctor", q51b: ["None"], q51c: "Vitamin D 60,000 IU weekly",
  q52: ["None"],
  q53: ["No limitation"], q53b: "Not required",

  // 8 — Routine & behaviour
  q54: "Homemaker", q54a: "Not applicable", q54b: "Flexible",
  q54c: "Lightly active", q106: "5,000–8,000", q112: "5000",
  q55: ["Evening", "Social events"], q55a: ["Cravings", "Family routine"],
  q56: "High evening hunger",
  q57: ["Good", "Increased by stress"],
  q58: ["Sweets or mithai", "Fried foods"], q58a: ["Stress", "Boredom"],
  q59: ["Eat more", "Crave specific foods"],
  q60: ["None"],

  // 9 — Lifestyle
  q61: "6–7 hours", q61a: "6", q61b: "Sometimes", q61c: ["Frequent waking"],
  q62: "6", q62a: ["Family", "Health"], q62b: ["Cravings", "Sleep"],
  q63: "1.5–2 litres", q63a: ["None"], q63b: "Never",
  q64: ["Tea"], q64a: "3", q64b: "6–9 PM",
  q65: ["None"],
  q66: ["PCOS", "Irregular Periods"], q66a: "Under medical care",
  q66_cycle: "Irregular", q66_lmp: "2026-07-02",
  q66_symptoms: ["Increased appetite", "Sugar or carb cravings", "Bloating or water weight", "Low mood or irritability"],
  q66_phase: "Week before the period",
  q66_contraception: "None",
  q67: ["Family gatherings", "Religious or community events"],
  q67a: ["Overeat", "Manage reasonably well"],

  // 10 — Success, dropout & coaching
  q68: ["Weekend routine breaks", "Cravings increase", "Motivation reduces"],
  q69: ["Return the next day", "Feel guilty but continue trying"],
  q70: ["Gentle reminders", "Frequent check-ins", "Celebrate small progress"],
  q71: ["Rice causes weight gain", "Avoid food after a specific time"], q71a: "Moderate",
  q72: "Two options per meal", q72a: "Katori, cup or spoon",
  q73: ["Cravings", "Family routine", "Social events"],
  q74: "3 focused changes",
  q75: "7",

  // 11 — Dietitian professional assessment
  ds1: "Homemaker with adequate calories but low, poorly distributed protein and heavy evening hunger — needs protein raised and the evening restructured, not a deficit first.",
  q76: ["Low protein intake", "Excessive evening hunger", "Hidden calorie intake", "Poor sleep"],
  q77: ["Increase protein", "Improve evening snack", "Improve meal regularity"],
  q78: "Tea with breakfast; roti at lunch and dinner; family dinner together",
  q79: ["Client fears rice", "Client fears eating after a specific time"],
  q80: "Fat loss with muscle preservation",
  q81: "Fat-loss phase",
  q82a: "68", q82b: "62", q82c: "Initial target should differ from final target",
  q83: ["Current weight and height context", "Previous comfortable weight", "Sustainability concern"],
  q83a: "Moderate — reassess after 2 weeks",
  q84: "Reduce fat while preserving muscle",
  q84a: "32–34%", q84b: "Preserve", q84c: "Reduce",
  q85: ["Waist", "Overall inches"], q85a: "Waist 36 → 33 in over 12 weeks",
  q86: ["Improve training consistency", "Improve recovery"],
  q87a: "2 weeks", q87b: "2 weeks", q87c: "8–12 weeks", q87d: "6–9 months",
  q87e: "Client timeline appears realistic",
  q88: ["Waist", "Body-fat trend", "Energy", "Diet adherence", "Weight"],
  q89: "Mild energy deficit",
  q90: "Moderate", q90a: "Low",
  q91: ["Protein quantity", "Meal regularity", "Craving management"],
  q92: "Low", q92a: ["Total quantity", "Breakfast"],
  q92b: ["Increase total protein", "Improve breakfast protein"],
  q92c: "Optional convenience",
  q93: ["Improve quality", "Reduce excessive portions"],
  q94: ["Reduce visible oil or ghee"],
  q95: ["Increase vegetables", "Gradual fibre increase"],
  q96: ["Increase total fluids"],
  q97: ["Improve protein intake"],
  q98: ["No coordination required"],
  q99: ["Rice or roti avoidance", "Meal-timing misconception"], q99a: "Address gradually",
  q100: "Two options per meal",
  q101: "8",

  // 12 — Client strategy discussion
};

// ---------------------------------------------------------------------------
// Test client 2 — Rahul Test: 29M, non-vegetarian desk worker who trains in
// the evening, DISLIKES lauki/karela (tests dislike stripping) and avoids
// non-veg + eggs on Tuesdays & Thursdays (tests day-of-week rules q38a–c).
// ---------------------------------------------------------------------------
export const RAHUL: Answers = {
  q76_category: "Re-starter — lost weight before and regained it",
  name: "Rahul Test",
  clientCode: "TEST-002",
  gender: "Male",
  phone: "+91 90000 00002",
  email: "rahul.test@example.com",

  // 1 — Goal & deeper motivation
  q1: ["Recent weight gain", "Poor fitness"],
  q2: "Fat loss",
  q3: ["Improve strength", "Improve stamina"],
  q4: ["Feel physically fitter", "Improve confidence"],
  q5: ["Target weight"],
  q5_weight: "72",
  q6: ["Athletic appearance"],
  q8: "7",
  gr_dietitian: "Goal correctly understood",
  gr_client: "Correctly understood",

  // 2 — Body & transformation history
  q9_age: "29", q9_height: "175", q9_weight: "82", q9_weight_1y: "76",
  q10: ["Gradual weight gain"], q10a: "6", q10b: "1–2 years",
  q11: ["Job change", "Frequent outside food", "Reduced exercise"],
  q12: ["Keto", "Meal skipping"],
  q12a: "Good initial result then plateau",
  q12b: ["Social life affected", "Food became repetitive"],
  q13: "No",
  q14: ["Regain after stopping diet"],
  q15: ["No data"], q15_assess: "Baseline measurement required",
  q16: ["Regular gym routine", "Carried food", "Specific goal or event"],
  q16a: "1) Regular gym routine 2) Carried food 3) Specific goal or event",

  // 3 — Medical & clinical safety
  q17: ["No known condition"],
  q18: ["None"],
  q19: "No",
  q20: ["No recent reports"],
  q21: ["None"],
  q22: ["No instruction"],
  cr1: ["No major clinical limitation identified"],

  // 4 — Digestion & tolerance
  q23: "Mostly comfortable",
  q24: ["Acidity or heartburn"], q24a: "1–2 times per week", q24b: ["After dinner"], q24c: "3",
  q25: "Once daily",
  q27: ["No known allergy or intolerance"],

  // 5 — Actual food day
  q28: ["Breakfast", "Lunch", "Evening", "Post-Workout", "Dinner"],
  "q112_breakfast_variants":
    "[{\"id\":\"breakfast1\",\"label\":\"Aloo paratha and curd\",\"items\":[{\"food\":\"Paratha\",\"qty\":\"2\"},{\"food\":\"Curd\",\"qty\":\"1 katori\"}],\"daysPerWeek\":7,\"measured\":{\"calories\":505,\"protein_g\":16,\"carbs_g\":53,\"fat_g\":25}}]",
  "q112_lunch_variants":
    "[{\"id\":\"lunch1\",\"label\":\"Office thali\",\"items\":[{\"food\":\"Rice\",\"qty\":\"1 katori\"},{\"food\":\"Dal\",\"qty\":\"1 katori\"},{\"food\":\"Sabzi\",\"qty\":\"1 katori\"},{\"food\":\"Roti\",\"qty\":\"2\"}],\"daysPerWeek\":7,\"measured\":{\"calories\":631,\"protein_g\":20,\"carbs_g\":92,\"fat_g\":19}}]",
  "q112_evening_variants":
    "[{\"id\":\"evening1\",\"label\":\"Tea and samosa\",\"items\":[{\"food\":\"Biscuits\",\"qty\":\"2\"}],\"daysPerWeek\":7,\"measured\":{\"calories\":108,\"protein_g\":2,\"carbs_g\":20,\"fat_g\":2}}]",
  "q112_postworkout_variants":
    "[{\"id\":\"postworkout1\",\"label\":\"Banana and shake\",\"items\":[{\"food\":\"Fruit\",\"qty\":\"1\"},{\"food\":\"Protein powder\",\"qty\":\"1 scoop\"}],\"daysPerWeek\":4,\"measured\":{\"calories\":211,\"protein_g\":25,\"carbs_g\":29,\"fat_g\":1}}]",
  "q112_dinner_variants":
    "[{\"id\":\"dinner1\",\"label\":\"Chicken curry and roti\",\"items\":[{\"food\":\"Chicken\",\"qty\":\"1 katori\"},{\"food\":\"Roti\",\"qty\":\"2\"}],\"daysPerWeek\":4,\"measured\":{\"calories\":339,\"protein_g\":22,\"carbs_g\":31,\"fat_g\":14}},{\"id\":\"dinner2\",\"label\":\"Dal and roti\",\"items\":[{\"food\":\"Dal\",\"qty\":\"1 katori\"},{\"food\":\"Roti\",\"qty\":\"2\"}],\"daysPerWeek\":3,\"measured\":{\"calories\":330,\"protein_g\":12,\"carbs_g\":43,\"fat_g\":12}}]",
  q28_breakfast_time: "09:00",
  q28_breakfast_food: "2 aloo parathas + curd 1 katori",
  q109: "09:00 breakfast — 2 aloo parathas with curd, 4-5 days a week, skipped when late. 13:00 office thali — rice, dal, sabzi, 2 rotis, 5 days a week. 17:30 tea with a samosa or fried snack from the office vendor, 3-4 days. 20:00 post-workout banana and a protein shake on the 4 gym days. 21:30 dinner — chicken curry with 2 rotis on 3 nights, dal on the others; eats out or orders in 3 nights a week.",
  q28_breakfast_prep: ["Shallow fried"],
  q28_breakfast_source: "Home",
  q28_breakfast_extras: ["Ghee"],
  q28_lunch_time: "13:00",
  q28_lunch_food: "Office thali — rice, dal, sabzi, 2 rotis",
  q28_lunch_source: "Office or canteen",
  q28_evening_food: "Tea + samosa from office vendor",
  q28_postworkout_food: "1 banana + protein shake",
  q28_dinner_time: "21:30",
  q28_dinner_food: "Chicken curry + 2 rotis (dal on non-gym days)",
  q28_dinner_source: "Home",
  q29: "Weekdays are similar",
  q30: ["Restaurant food", "More alcohol", "Delayed meals"],
  q31: "2–3 times weekly", q31a: ["Delivery", "Restaurant"],
  q31b: "Biryani, butter chicken, momos",
  q32: ["Tea", "Office snacks", "Late-night bites"],
  q32a: "Tea ×2/day; office samosa 2–3×/week; namkeen at midnight while gaming",

  // 6 — Preferences & feasibility
  q33: "Non-vegetarian",
  q34: ["North Indian", "Mixed or international"],
  q35: "Chicken curry, biryani, rajma chawal, paneer tikka, dal makhani",
  q36: "Lauki, karela, bottle gourd, bitter gourd", q36a: "Will not eat",
  q37: ["Tea", "Weekend restaurant meal", "Rice"],
  q38: ["No non-vegetarian food on selected days"],
  q38a: ["Tuesday", "Thursday"],
  q38b: ["Non-vegetarian food", "Eggs"],
  q38c: "Family religious practice — no non-veg or eggs on Tuesdays and Thursdays",
  q39: ["Parent or family", "Office or canteen"], q39a: "Some",
  q40: ["Full kitchen", "Refrigerator", "Microwave"],
  q41: ["Carry meals", "Work microwave available", "Limited additional cooking acceptable"],
  q42: "Flexible", q42a: ["No major limitation"],

  // 7 — Training, protein & recovery
  q43: ["Strength training", "Cardio machines"],
  q44a: "4", q44b: "60–90 minutes", q44c: "Evening",
  q44d: "1–3 years", q44e: "Moderate", q44f: "Fat loss",
  q45: ["Energy drops midway"],
  q46: ["Mild normal soreness", "Excessive hunger"],
  q47: ["Snack", "Caffeine"], q47a: "30–60 minutes before",
  q48: ["Water"],
  q49: ["Protein shake"], q49a: "Less than 30 minutes",
  // Frequencies match the Q28 food day above: curd at breakfast and dal in the
  // office thali daily, chicken on gym nights, a shake after every session.
  q50: ["Chicken", "Eggs", "Dal", "Paneer", "Curd", "Protein powder"],
  q50p_chicken_freq: "3–4 days a week",
  q50p_eggs_freq: "1–2 days a week",
  q50p_dal_freq: "Daily",
  q50p_paneer_freq: "1–2 days a week",
  q50p_curd_freq: "Daily",
  q50p_powder_freq: "Daily",
  q50a: "2", q50b: ["Work schedule", "Carrying food"],
  q51: ["Protein powder", "Creatine"], q51a: "Personal Trainer", q51b: ["None"],
  q51c: "Whey 1 scoop post-workout daily; creatine 5 g daily",
  q52: ["None"],
  q53: ["Knee"], q53a: "Self-observed", q53b: "Required",

  // 8 — Routine & behaviour
  q54: "Desk-based", q54a: "Day", q54b: "Flexible",
  q54c: "Mostly seated", q106: "5,000–8,000", q112: "6000",
  q55: ["Evening", "Late night"], q55a: ["Cravings", "Training timing"],
  q56: "High night hunger",
  q57: ["Very strong", "Increased after training"],
  q58: ["Fried foods", "Fast food", "Late-night food"],
  q58a: ["Habit", "Post-workout", "Boredom"],
  q59: ["Order food more often"],
  q60: ["None"],

  // 9 — Lifestyle
  q61: "5–6 hours", q61a: "5", q61b: "No",
  q61c: ["Difficulty falling asleep", "Late caffeine"],
  q62: "7", q62a: ["Work"], q62b: ["Sleep", "Food intake"],
  q63: "2–3 litres", q63a: ["Long workouts"], q63b: "Sometimes",
  q64: ["Tea", "Coffee", "Pre-workout"], q64a: "4", q64b: "6–9 PM",
  q65: ["Alcohol"], q65a: "Weekly",
  q67: ["Business dinners", "Parties or social events"],
  q67a: ["Overeat", "Drink alcohol", "Eat late"],

  // 10 — Success, dropout & coaching
  q68: ["Work becomes busy", "Restaurant eating increases", "Stop tracking"],
  q69: ["Wait until Monday", "Avoid checking weight"],
  q70: ["Direct accountability", "Clear weekly targets", "Challenge me when I make excuses"],
  q71: ["Skipping meals helps fat loss", "Very high protein is necessary"], q71a: "Mild",
  q72: "Flexible food exchange", q72a: "Hand portions",
  q73: ["Work", "Restaurant food", "Poor sleep"],
  q74: "Moderate routine restructuring",
  q75: "8",

  // 11 — Dietitian professional assessment
  ds1: "Trains hard but eats out most evenings with alcohol — the plan has to make restaurant meals workable rather than ask him to stop eating out.",
  q76: ["Frequent outside food", "Excessive night hunger", "Poor sleep", "Alcohol intake", "Hidden calorie intake"],
  q77: ["Improve dinner", "Create weekend strategy", "Improve meal regularity"],
  q78: "Weekend restaurant meal (guided choices); rice at lunch; tea",
  q79: ["No unnecessary restriction identified"],
  q80: "Fat loss",
  q81: "Fat-loss phase",
  q82a: "76", q82b: "72", q82c: "Client target appears appropriate",
  q83: ["Current weight and height context", "Training demand"],
  q83a: "High — sufficient baseline information",
  q84: "Reduce fat while preserving muscle",
  q84a: "No numerical target", q84b: "Preserve", q84c: "Reduce",
  q85: ["Waist"], q85a: "Waist 38 → 35 in",
  q86: ["Improve strength", "Maintain performance during fat loss"],
  q87a: "2 weeks", q87b: "2 weeks", q87c: "8–12 weeks", q87d: "6–9 months",
  q87e: "Client timeline appears realistic",
  q88: ["Weight", "Waist", "Strength", "Diet adherence"],
  q89: "Controlled energy deficit",
  q90: "High", q90a: "Moderate",
  q91: ["Protein distribution", "Weekend strategy", "Dinner quality"],
  q92: "Moderate but poorly distributed",
  q92a: ["Breakfast", "Lunch"],
  q92b: ["Improve distribution", "Improve breakfast protein"],
  q92c: "Current product appears appropriate",
  q93: ["Improve distribution", "Increase around training"],
  q94: ["Reduce fried food", "Reduce high-fat outside food"],
  q95: ["Increase vegetables"],
  q96: ["Maintain current intake"],
  q97: ["Improve pre-workout nutrition", "Address sleep-related recovery"],
  q98: ["Injury or pain", "Training timing"], q98a: "Routine",
  q99: ["Meal-timing misconception"], q99a: "Clarify immediately",
  q100: "Flexible food exchange",
  q101: "8",

  // 12 — Client strategy discussion
};

// ---------------------------------------------------------------------------
// Test client 3 — Sneha Test: 35F EGGETARIAN working mother, walks daily but
// does no resistance training. Exercises the counselling protein measurement:
// every Q50 food carries a frequency and portion (q50p_*), so the plan is
// generated against a MEASURED week-1 protein target rather than one the model
// invents. Also covers the Eggetarian food-pattern filter (16 of 20 protein
// foods offered) and a dislike that is not a day-of-week rule.
// ---------------------------------------------------------------------------
export const SNEHA: Answers = {
  q76_category: "Plateaued — dieting now, weight has stopped moving",
  q76_weeks_on_plan: "11",
  q76_weeks_stagnant: "4",
  name: "Sneha Test",
  clientCode: "TEST-003",
  gender: "Female",
  phone: "+91 90000 00003",
  email: "sneha.test@example.com",

  // 1 — Goal & deeper motivation
  q1: ["Low energy", "Recent weight gain"],
  q2: "Fat loss",
  q3: ["Improve daily energy", "Improve hormonal health"],
  q4: ["Improve confidence", "Family motivation"],
  q5: ["Target weight"],
  q5_weight: "60",
  q6: ["Smaller waist"],
  q8: "7",
  gr_dietitian: "Goal correctly understood",
  gr_client: "Correctly understood",

  // 2 — Body & transformation history
  q9_age: "35", q9_height: "158", q9_height_unit: "ft", q9_weight: "68", q9_weight_1y: "64",
  q66_cycle: "Regular (25–35 days)", q66_lmp: "2026-07-14",
  q66_symptoms: ["Sugar or carb cravings", "Bloating or water weight"],
  q66_phase: "Week before the period",
  q66_contraception: "None",
  q10: ["Gradual weight gain"], q10a: "5", q10b: "1–2 years",
  q11: ["Postpartum period", "Sedentary lifestyle", "Poor sleep"],
  q12: ["Self-designed diet"],
  q12a: "Lost weight then regained",
  q12b: ["Family food mismatch", "Excessive hunger"],
  q13: "No",
  q14: ["Repeated weight regain"], q14a: "6–12 months",
  q15: ["No data"], q15_assess: "Baseline measurement required",
  q16: ["Home-cooked food", "Regular meals", "Frequent check-ins"],
  q16a: "1) Home-cooked food 2) Regular meals 3) Frequent check-ins",

  // 3 — Medical & clinical safety
  q17: ["Vitamin B12 deficiency"], q17a: "Controlled", q17b: "Irregular",
  q17c: "B12 deficiency noted on last report; no medication started",
  q18: ["None"],
  q19: "No",
  q20: ["No recent reports"],
  q21: ["None"],
  q22: ["No instruction"],
  cr1: ["No major clinical limitation identified"],

  // 4 — Digestion & tolerance
  q23: "Mostly comfortable",
  q24: ["Bloating"], q24a: "1–2 times per week", q24b: ["After dinner"], q24c: "3",
  q25: "Once daily",
  q27: ["No known allergy or intolerance"],

  // 5 — Actual food day
  q28: ["Breakfast", "Mid-Morning", "Lunch", "Evening", "Dinner"],
  "q112_breakfast_variants":
    "[{\"id\":\"breakfast1\",\"label\":\"Roti and sabzi\",\"items\":[{\"food\":\"Roti\",\"qty\":\"2\"},{\"food\":\"Sabzi\",\"qty\":\"1 katori\"}],\"daysPerWeek\":7,\"measured\":{\"calories\":270,\"protein_g\":8,\"carbs_g\":36,\"fat_g\":10}}]",
  "q112_midmorning_variants":
    "[{\"id\":\"midmorning1\",\"label\":\"Milk\",\"items\":[{\"food\":\"Milk\",\"qty\":\"1 glass\"}],\"daysPerWeek\":7,\"measured\":{\"calories\":149,\"protein_g\":8,\"carbs_g\":12,\"fat_g\":8}}]",
  "q112_lunch_variants":
    "[{\"id\":\"lunch1\",\"label\":\"Rice, dal, sabzi and curd\",\"items\":[{\"food\":\"Rice\",\"qty\":\"1 katori\"},{\"food\":\"Dal\",\"qty\":\"1 katori\"},{\"food\":\"Sabzi\",\"qty\":\"1 katori\"},{\"food\":\"Curd\",\"qty\":\"1 katori\"}],\"daysPerWeek\":7,\"measured\":{\"calories\":576,\"protein_g\":21,\"carbs_g\":74,\"fat_g\":21}}]",
  "q112_evening_variants":
    "[{\"id\":\"evening1\",\"label\":\"Tea and biscuits\",\"items\":[{\"food\":\"Biscuits\",\"qty\":\"2\"}],\"daysPerWeek\":7,\"measured\":{\"calories\":108,\"protein_g\":2,\"carbs_g\":20,\"fat_g\":2}}]",
  "q112_dinner_variants":
    "[{\"id\":\"dinner1\",\"label\":\"Roti and sabzi\",\"items\":[{\"food\":\"Roti\",\"qty\":\"2\"},{\"food\":\"Sabzi\",\"qty\":\"1 katori\"}],\"daysPerWeek\":5,\"measured\":{\"calories\":270,\"protein_g\":8,\"carbs_g\":36,\"fat_g\":10}},{\"id\":\"dinner2\",\"label\":\"Roti and paneer\",\"items\":[{\"food\":\"Roti\",\"qty\":\"2\"},{\"food\":\"Paneer\",\"qty\":\"100 g\"}],\"daysPerWeek\":2,\"measured\":{\"calories\":445,\"protein_g\":22,\"carbs_g\":29,\"fat_g\":26}}]",
  q28_breakfast_time: "08:00",
  q28_breakfast_food: "2 rotis + sabzi + tea with 1 tsp sugar",
  q109: "08:00 breakfast — 2 rotis with sabzi and tea with 1 tsp sugar, daily. 11:00 a glass of milk, daily. 13:30 lunch — rice 1 cup, dal 1 katori, sabzi, curd 1 katori, carried from home, daily. 17:00 tea with 2 biscuits, daily. 21:00 dinner — 2 rotis with sabzi, paneer twice a week, cooked at home with the family.",
  q28_breakfast_prep: ["Dry preparation"],
  q28_breakfast_source: "Home",
  q28_midmorning_food: "1 glass milk",
  q28_lunch_time: "13:30",
  q28_lunch_food: "Rice 1 cup + dal 1 katori + sabzi + curd 1 katori",
  q28_lunch_source: "Home",
  q28_evening_food: "Tea + 2 biscuits",
  q28_dinner_time: "21:00",
  q28_dinner_food: "2 rotis + sabzi (paneer twice a week)",
  q28_dinner_source: "Home",
  q29: "Weekdays are similar",
  q30: ["Family meals", "Delayed meals"],
  q31: "Once weekly", q31a: ["Restaurant"],
  q31b: "Chole bhature, dosa",
  q32: ["Tea", "Children's leftovers"],
  q32a: "Tea ×3/day with sugar; finishes children's leftover food most days",

  // 6 — Preferences & feasibility
  q33: "Eggetarian",
  q34: ["North Indian"],
  q35: "Paneer, dal, curd, seasonal fruit, eggs",
  q36: "Brinjal, mushroom", q36a: "Will not eat",
  q37: ["Tea", "Rice", "Family dinner"],
  q38: ["No restriction"],
  q39: ["Self"], q39a: "Full",
  q40: ["Full kitchen", "Refrigerator", "Microwave"],
  q41: ["Cook once for the family", "Limited additional cooking acceptable"],
  q42: "Moderate", q42a: ["Time"],

  // 7 — Training, protein & recovery
  q43: ["Walking", "Yoga"],
  q44a: "5", q44b: "30–45 minutes", q44c: "Morning",
  q44d: "Complete beginner", q44e: "Light", q44f: "Fat loss",
  q45: ["Good energy"],
  q46: ["Mild normal soreness"],
  q47: ["Nothing"], q47a: "30–60 minutes before",
  q48: ["Water"],
  q49: ["Nothing for several hours"],

  // Q50 — protein foods, each measured for frequency and portion. This is what
  // makes the week-1 protein target a measurement rather than a guess.
  q50: ["Milk", "Curd", "Paneer", "Dal", "Eggs", "Sprouts", "Nuts or seeds"],
  q50p_milk_freq: "Daily",
  q50p_curd_freq: "Daily",
  q50p_paneer_freq: "1–2 days a week",
  q50p_dal_freq: "Daily",
  q50p_eggs_freq: "3–4 days a week",
  q50p_sprouts_freq: "1–2 days a week",
  q50p_nuts_freq: "Daily",
  q50a: "2", q50b: ["Family food pattern", "Cooking"],
  q51: ["None"],
  q52: ["None"],
  q53: ["None"],

  // 8 — Routine & behaviour
  q54: "Desk-based", q54a: "Day", q54b: "Fixed",
  q54c: "Mostly seated", q106: "5,000–8,000", q112: "5000",
  q55: ["Evening"], q55a: ["Cravings"],
  q56: "Moderate night hunger",
  q57: ["Moderate"],
  q58: ["Sweets", "Tea with sugar"],
  q58a: ["Habit", "Stress"],
  q59: ["Eat more sweets"],
  q60: ["None"],

  // 9 — Lifestyle
  q61: "6–7 hours", q61a: "6", q61b: "No",
  q61c: ["Children waking at night"],
  q62: "6", q62a: ["Family responsibilities"], q62b: ["Sleep", "Food intake"],
  q63: "1–2 litres", q63a: ["Forgets"], q63b: "Sometimes",
  q64: ["Tea"], q64a: "3", q64b: "6–9 PM",
  q65: ["None"],
  q67: ["Family functions"],
  q67a: ["Overeat", "Eat late"],

  // 10 — Success, dropout & coaching
  q68: ["Family responsibilities increase", "Stop tracking"],
  q69: ["Wait until Monday"],
  q70: ["Frequent check-ins", "Clear weekly targets"],
  q71: ["Skipping meals helps fat loss"], q71a: "Mild",
  q72: "Fixed structured plan", q72a: "Household measures",
  q73: ["Family responsibilities", "Poor sleep"],
  q74: "Minor routine adjustment",
  q75: "7",

  // 11 — Dietitian professional assessment
  ds1: "Desk-based, fixed routine, protein low and clustered at dinner — spread protein across the day and protect the family dinner.",
  q76: ["Low protein intake", "Poor protein distribution", "Hidden calorie intake", "Poor sleep"],
  q77: ["Increase protein", "Improve protein distribution", "Improve breakfast"],
  q78: "Tea; rice at lunch; family dinner",
  q79: ["No unnecessary restriction identified"],
  q80: "Fat loss",
  q81: "Fat-loss phase",
  q82a: "64", q82b: "60", q82c: "Client target appears appropriate",
  q83: ["Current weight and height context"],
  q83a: "High — sufficient baseline information",
  q84: "Reduce fat while preserving muscle",
  q84a: "No numerical target", q84b: "Preserve", q84c: "Reduce",
  q85: ["Waist"], q85a: "Waist 36 → 33 in",
  q86: ["Improve stamina"],
  q87a: "2 weeks", q87b: "3 weeks", q87c: "8–12 weeks", q87d: "6–9 months",
  q87e: "Client timeline appears realistic",
  q88: ["Weight", "Waist", "Diet adherence"],
  q89: "Controlled energy deficit",
  q90: "Moderate", q90a: "Moderate",
  q91: ["Protein distribution", "Breakfast quality"],
  q92: "Very low",
  q92a: ["Total quantity", "Breakfast"],
  q92b: ["Increase total protein", "Improve breakfast protein"],
  q92c: "Not required",
  q93: ["Increase total protein", "Improve distribution"],
  q94: ["Reduce sweets"],
  q95: ["Increase vegetables"],
  q96: ["Maintain current intake"],
  q97: ["Address sleep-related recovery"],
  q98: ["Time"], q98a: "Routine",
  q99: ["Meal-timing misconception"], q99a: "Clarify gradually",
  q100: "Fixed structured plan",
  q101: "7",

  // 12 — Client strategy discussion
};

// ---------------------------------------------------------------------------
// Test client 4 — Anna Test: 30M South Indian VEGETARIAN, rice-and-sambar
// daily pattern typical of a Tamil household. Exercises the cuisine-aware
// food matching (q34 = South Indian/Tamil): raising his low, rice-heavy
// protein intake should pull in South Indian-appropriate sources (extra
// dal/sambar, curd, sprouts, moong dal chilla) rather than defaulting to the
// North Indian roti-paneer pattern the other fixtures produce.
// ---------------------------------------------------------------------------
export const ANNA: Answers = {
  q76_category: "First-timer — never dieted with structure before",
  name: "Anna Test",
  clientCode: "TEST-005",
  gender: "Male",
  phone: "+91 90000 00005",
  email: "anna.test@example.com",

  // 1 — Goal & deeper motivation
  q1: ["Recent weight gain", "Low energy"],
  q2: "Fat loss with muscle preservation",
  q3: ["Improve daily energy", "Improve fitness"],
  q4: ["Feel physically fitter", "Improve confidence"],
  q5: ["Target weight"],
  q5_weight: "72",
  q6: ["Leaner appearance"],
  q8: "7",
  gr_dietitian: "Goal correctly understood",
  gr_client: "Correctly understood",

  // 2 — Body & transformation history
  q9_age: "30", q9_height: "170", q9_weight: "80",
  q9_weight_1y: "75", q9_weight_high: "82", q9_weight_low: "68", q9_weight_comfort: "72",
  q10: ["Gradual weight gain"], q10a: "5", q10b: "1–2 years",
  q11: ["Desk job", "Sedentary lifestyle", "Frequent outside food"],
  q12: ["Self-designed diet"],
  q12a: "No clear result",
  q12b: ["Food became repetitive", "Family food mismatch"],
  q13: "No",
  q14: ["Weight-loss plateau"], q14a: "3–6 months",
  q15: ["No data"], q15_assess: "Baseline measurement required",
  q16: ["Regular meals", "Home-cooked food", "Frequent check-ins"],
  q16a: "1) Regular meals 2) Home-cooked food 3) Frequent check-ins",

  // 3 — Medical & clinical safety
  q17: ["No known condition"],
  q18: ["None"],
  q19: "No",
  q20: ["No recent reports"],
  q21: ["None"],
  q22: ["No instruction"],
  cr1: ["No major clinical limitation identified"],

  // 4 — Digestion & tolerance
  q23: "Mostly comfortable",
  q24: ["Bloating"], q24a: "1–2 times per week", q24b: ["After lunch"], q24c: "3",
  q25: "Once daily",
  q27: ["No known allergy or intolerance"],

  // 5 — Actual food day
  q28: ["Breakfast", "Mid-Morning", "Lunch", "Evening", "Dinner"],
  "q112_breakfast_variants":
    "[{\"id\":\"breakfast1\",\"label\":\"Idli, sambar and chutney\",\"items\":[{\"food\":\"Idli\",\"qty\":\"3\"},{\"food\":\"Sambar\",\"qty\":\"1 katori\"},{\"food\":\"Coconut chutney\",\"qty\":\"2 tbsp\"}],\"daysPerWeek\":5,\"measured\":{\"calories\":300,\"protein_g\":8,\"carbs_g\":55,\"fat_g\":6}},{\"id\":\"breakfast2\",\"label\":\"Dosa and chutney\",\"items\":[{\"food\":\"Dosa\",\"qty\":\"2\"},{\"food\":\"Coconut chutney\",\"qty\":\"2 tbsp\"}],\"daysPerWeek\":2,\"measured\":{\"calories\":280,\"protein_g\":6,\"carbs_g\":45,\"fat_g\":8}}]",
  "q112_midmorning_variants":
    "[{\"id\":\"midmorning1\",\"label\":\"Filter coffee and banana\",\"items\":[{\"food\":\"Filter coffee\",\"qty\":\"1 cup\"},{\"food\":\"Banana\",\"qty\":\"1\"}],\"daysPerWeek\":7,\"measured\":{\"calories\":150,\"protein_g\":3,\"carbs_g\":30,\"fat_g\":2}}]",
  "q112_lunch_variants":
    "[{\"id\":\"lunch1\",\"label\":\"Rice, sambar, poriyal and curd\",\"items\":[{\"food\":\"Rice\",\"qty\":\"1.5 cups\"},{\"food\":\"Sambar\",\"qty\":\"1 katori\"},{\"food\":\"Poriyal\",\"qty\":\"1 katori\"},{\"food\":\"Curd\",\"qty\":\"1 katori\"},{\"food\":\"Rasam\",\"qty\":\"1 cup\"}],\"daysPerWeek\":7,\"measured\":{\"calories\":650,\"protein_g\":18,\"carbs_g\":100,\"fat_g\":12}}]",
  "q112_evening_variants":
    "[{\"id\":\"evening1\",\"label\":\"Filter coffee and banana chips\",\"items\":[{\"food\":\"Filter coffee\",\"qty\":\"1 cup\"},{\"food\":\"Banana chips\",\"qty\":\"1 handful\"}],\"daysPerWeek\":7,\"measured\":{\"calories\":180,\"protein_g\":2,\"carbs_g\":20,\"fat_g\":10}}]",
  "q112_dinner_variants":
    "[{\"id\":\"dinner1\",\"label\":\"Dosa and sambar\",\"items\":[{\"food\":\"Dosa\",\"qty\":\"2\"},{\"food\":\"Sambar\",\"qty\":\"1 katori\"}],\"daysPerWeek\":4,\"measured\":{\"calories\":350,\"protein_g\":9,\"carbs_g\":55,\"fat_g\":10}},{\"id\":\"dinner2\",\"label\":\"Idli and sambar\",\"items\":[{\"food\":\"Idli\",\"qty\":\"3\"},{\"food\":\"Sambar\",\"qty\":\"1 katori\"}],\"daysPerWeek\":3,\"measured\":{\"calories\":320,\"protein_g\":9,\"carbs_g\":58,\"fat_g\":5}}]",
  q28_breakfast_time: "08:00",
  q28_breakfast_food: "3 idlis with sambar and chutney, most mornings",
  q28_breakfast_drinks: ["Filter coffee × 1"],
  q109: "08:00 idli (3) with sambar and chutney, 5 mornings a week, dosa the other 2. 10:30 filter coffee and a banana. 13:00 lunch — rice, sambar, a poriyal, curd and rasam, home cooked, daily. 17:30 filter coffee with banana chips. 20:30 dinner — dosa or idli with sambar, home cooked, daily.",
  q28_breakfast_prep: ["Steamed"],
  q28_breakfast_source: "Home",
  q28_breakfast_extras: ["Oil"],
  q28_midmorning_food: "Filter coffee + 1 banana",
  q28_lunch_time: "13:00",
  q28_lunch_food: "Rice + sambar + poriyal + curd + rasam",
  q28_lunch_source: "Home",
  q28_evening_food: "Filter coffee + banana chips",
  q28_evening_drinks: ["Filter coffee × 1"],
  q28_dinner_time: "20:30",
  q28_dinner_food: "Dosa or idli with sambar",
  q28_dinner_source: "Home",
  q29: "Weekdays are similar",
  q30: ["Restaurant food", "More sweets"],
  q31: "Once weekly", q31a: ["Restaurant"],
  q31b: "Masala dosa, filter coffee, payasam",
  q32: ["Filter coffee", "Banana chips", "Sweets or mithai"],
  q32a: "Filter coffee ×2/day; banana chips most evenings",

  // 6 — Preferences & feasibility
  q33: "Vegetarian",
  q34: ["South Indian", "Tamil"],
  q35: "Masala dosa, filter coffee, curd rice, sambar, rasam, payasam",
  q36: "Bitter gourd", q36a: "Will not eat",
  q37: ["Filter coffee", "Rice", "Traditional household food"],
  q38: ["Vegetarian household"],
  q39: ["Self", "Parent or family"], q39a: "Good",
  q40: ["Full kitchen", "Refrigerator", "Microwave"],
  q41: ["Cook daily", "Simple cooking only"],
  q42: "Moderate household-food budget", q42a: ["No major limitation"],

  // 7 — Training, protein & recovery
  q43: ["Walking"],
  q44a: "3", q44b: "30–45 minutes", q44c: "Morning",
  q44d: "Complete beginner", q44e: "Light", q44f: "Fat loss",
  q45: ["No major problem"],
  q46: ["Recover well"],
  q47: ["Water only"],
  q48: ["Water"],
  q49: ["Small meal"], q49a: "30–60 minutes",
  // Frequencies match the Q28 food day above: sambar/rasam (dal) at every
  // main meal, curd at lunch daily, coffee-milk twice, sprouts occasional.
  q50: ["Dal", "Curd", "Milk", "Sprouts", "Nuts or seeds"],
  q50p_dal_freq: "Daily",
  q50p_curd_freq: "Daily",
  q50p_milk_freq: "Daily", q50p_milk_portion: "Half portion",
  q50p_sprouts_freq: "1–2 days a week",
  q50p_nuts_freq: "1–2 days a week",
  q50a: "2", q50b: ["Vegetarian pattern", "Lack of knowledge"],
  q51: ["None"],
  q52: ["None"],
  q53: ["No limitation"], q53b: "Not required",

  // 8 — Routine & behaviour
  q54: "Desk-based", q54a: "Day", q54b: "Fixed",
  q54c: "Mostly seated", q106: "3,000–5,000", q112: "4000",
  q55: ["Evening"], q55a: ["Cravings", "Habit"],
  q56: "Moderate evening hunger",
  q57: ["Good"],
  q58: ["Sweets or mithai", "Fried foods"], q58a: ["Habit", "Boredom"],
  q59: ["Eat more"],
  q60: ["None"],

  // 9 — Lifestyle
  q61: "6–7 hours", q61a: "6", q61b: "Sometimes", q61c: ["Late screen time"],
  q62: "5", q62a: ["Work"], q62b: ["Food intake"],
  q63: "1.5–2 litres", q63a: ["None"], q63b: "Never",
  q64: ["Filter coffee"], q64a: "2", q64b: "6–9 PM",
  q65: ["None"],
  q67: ["Family gatherings", "Religious or community events"],
  q67a: ["Overeat", "Manage reasonably well"],

  // 10 — Success, dropout & coaching
  q68: ["Weekend routine breaks", "Motivation reduces"],
  q69: ["Return the next day", "Feel guilty but continue trying"],
  q70: ["Gentle reminders", "Frequent check-ins"],
  q71: ["Rice causes weight gain"], q71a: "Moderate",
  q72: "Two options per meal", q72a: "Katori, cup or spoon",
  q73: ["Cravings", "Family routine"],
  q74: "3 focused changes",
  q75: "7",

  // 11 — Dietitian professional assessment
  ds1: "Desk-based, rice-and-sambar pattern typical of a South Indian household — protein is low and carb-heavy (idli/dosa/rice at every meal). Raise protein within the same cuisine rather than switching him to roti and paneer.",
  q76: ["Low protein intake", "Hidden calorie intake", "Sedentary lifestyle"],
  q77: ["Increase protein", "Improve meal regularity"],
  q78: "Filter coffee; rice at lunch and dinner; South Indian home food",
  q79: ["Client fears rice"],
  q80: "Fat loss with muscle preservation",
  q81: "Fat-loss phase",
  q82a: "76", q82b: "72", q82c: "Initial target should differ from final target",
  q83: ["Current weight and height context", "Sustainability concern"],
  q83a: "Moderate — reassess after 2 weeks",
  q84: "Reduce fat while preserving muscle",
  q84a: "No numerical target", q84b: "Preserve", q84c: "Reduce",
  q85: ["Waist"], q85a: "Waist 38 → 35 in over 12 weeks",
  q86: ["Improve training consistency"],
  q87a: "2 weeks", q87b: "2 weeks", q87c: "8–12 weeks", q87d: "6–9 months",
  q87e: "Client timeline appears realistic",
  q88: ["Waist", "Energy", "Diet adherence", "Weight"],
  q89: "Mild energy deficit",
  q90: "Moderate", q90a: "Low",
  q91: ["Protein quantity", "Meal regularity"],
  q92: "Low", q92a: ["Total quantity", "Breakfast"],
  q92b: ["Increase total protein", "Improve breakfast protein"],
  q92c: "Optional convenience",
  q93: ["Improve quality", "Reduce excessive portions"],
  q94: ["Reduce visible oil in cooking"],
  q95: ["Increase vegetables", "Gradual fibre increase"],
  q96: ["Increase total fluids"],
  q97: ["Improve protein intake"],
  q98: ["No coordination required"],
  q99: ["Rice or roti avoidance"], q99a: "Address gradually",
  q100: "Two options per meal",
  q101: "7",

  // 12 — Client strategy discussion
};

// ---------------------------------------------------------------------------
// Test client 5 — Aadi Test: 27M EGGETARIAN who does not eat eggs on Tuesdays
// and Saturdays. Exercises the day-of-week rules (q38a–c) on an EGG-only
// restriction — Rahul's case removes non-veg and eggs together, so an
// egg-only rule on an eggetarian (whose entire non-plant protein IS eggs) is
// the harder test: those two days must find protein elsewhere.
// ---------------------------------------------------------------------------
export const AADI: Answers = {
  q76_category: "Maintenance — at or near goal, holding it",
  name: "Aadi Test",
  clientCode: "TEST-004",
  gender: "Male",
  phone: "+91 90000 00004",
  email: "aadi.test@example.com",

  // 1 — Goal & deeper motivation
  q1: ["Poor fitness", "Low energy"],
  q2: "Muscle gain with fat control",
  q3: ["Improve strength", "Improve daily energy"],
  q4: ["Feel physically fitter", "Improve confidence"],
  q5: ["Target weight"],
  q5_weight: "72",
  q6: ["Athletic appearance"],
  q8: "8",
  gr_dietitian: "Goal correctly understood",
  gr_client: "Correctly understood",

  // 2 — Body & transformation history
  q9_age: "27", q9_height: "172", q9_weight: "66", q9_weight_1y: "64",
  q10: ["Gradual weight gain"], q10a: "2", q10b: "1–2 years",
  q11: ["Sedentary lifestyle", "Irregular meals"],
  q12: ["Self-designed diet"],
  q12a: "No clear result",
  q12b: ["Food became repetitive"],
  q13: "No",
  q14: ["Weight-loss plateau"], q14a: "3–6 months",
  q15: ["No data"], q15_assess: "Baseline measurement required",
  q16: ["Regular gym routine", "Regular meals"],
  q16a: "1) Regular gym routine 2) Regular meals",

  // 3 — Medical & clinical safety
  q17: ["No known condition"],
  q18: ["None"],
  q19: "No",
  q20: ["No recent reports"],
  q21: ["None"],
  q22: ["No instruction"],
  cr1: ["No major clinical limitation identified"],

  // 4 — Digestion & tolerance
  q23: "Mostly comfortable",
  q24: ["No frequent symptom"],
  q25: "Once daily",
  q27: ["No known allergy or intolerance"],

  // 5 — Actual food day
  q28: ["Breakfast", "Lunch", "Evening", "Post-Workout", "Dinner"],
  "q112_breakfast_variants":
    "[{\"id\":\"breakfast1\",\"label\":\"Egg omelette and bread\",\"items\":[{\"food\":\"Eggs\",\"qty\":\"3\"},{\"food\":\"Bread\",\"qty\":\"2\"}],\"daysPerWeek\":7,\"measured\":{\"calories\":394,\"protein_g\":27,\"carbs_g\":29,\"fat_g\":18}}]",
  "q112_lunch_variants":
    "[{\"id\":\"lunch1\",\"label\":\"Rice, dal, sabzi and curd\",\"items\":[{\"food\":\"Rice\",\"qty\":\"1 katori\"},{\"food\":\"Dal\",\"qty\":\"1 katori\"},{\"food\":\"Sabzi\",\"qty\":\"1 katori\"},{\"food\":\"Curd\",\"qty\":\"1 katori\"}],\"daysPerWeek\":7,\"measured\":{\"calories\":576,\"protein_g\":21,\"carbs_g\":74,\"fat_g\":21}}]",
  "q112_evening_variants":
    "[{\"id\":\"evening1\",\"label\":\"Tea and biscuits\",\"items\":[{\"food\":\"Biscuits\",\"qty\":\"2\"}],\"daysPerWeek\":7,\"measured\":{\"calories\":108,\"protein_g\":2,\"carbs_g\":20,\"fat_g\":2}}]",
  "q112_postworkout_variants":
    "[{\"id\":\"postworkout1\",\"label\":\"Banana and boiled eggs\",\"items\":[{\"food\":\"Fruit\",\"qty\":\"1\"},{\"food\":\"Eggs\",\"qty\":\"2\"}],\"daysPerWeek\":4,\"measured\":{\"calories\":260,\"protein_g\":14,\"carbs_g\":28,\"fat_g\":11}}]",
  "q112_dinner_variants":
    "[{\"id\":\"dinner1\",\"label\":\"Roti and paneer sabzi\",\"items\":[{\"food\":\"Roti\",\"qty\":\"3\"},{\"food\":\"Paneer\",\"qty\":\"100 g\"}],\"daysPerWeek\":3,\"measured\":{\"calories\":517,\"protein_g\":24,\"carbs_g\":41,\"fat_g\":28}},{\"id\":\"dinner2\",\"label\":\"Roti and dal\",\"items\":[{\"food\":\"Roti\",\"qty\":\"3\"},{\"food\":\"Dal\",\"qty\":\"1 katori\"}],\"daysPerWeek\":4,\"measured\":{\"calories\":403,\"protein_g\":14,\"carbs_g\":56,\"fat_g\":13}}]",
  q28_breakfast_time: "08:30",
  q28_breakfast_food: "3 egg omelette + 2 bread slices + tea",
  q109: "08:30 breakfast — 3 egg omelette with 2 bread slices and tea, most days. 13:30 lunch — rice 1 cup, dal 1 katori, sabzi, curd 1 katori, daily. 17:30 tea with biscuits, daily. 19:30 post-workout banana and 2 boiled eggs on the 5 training days. 21:00 dinner — 3 rotis with paneer sabzi or dal, home cooked, daily.",
  q28_breakfast_prep: ["Shallow fried"],
  q28_breakfast_source: "Home",
  q28_lunch_time: "13:30",
  q28_lunch_food: "Rice 1 cup + dal 1 katori + sabzi + curd 1 katori",
  q28_lunch_source: "Home",
  q28_evening_food: "Tea + biscuits",
  q28_postworkout_food: "1 banana + 2 boiled eggs",
  q28_dinner_time: "21:00",
  q28_dinner_food: "3 rotis + paneer sabzi or dal",
  q28_dinner_source: "Home",
  q29: "Weekdays are similar",
  q30: ["Family meals", "Delayed meals"],
  q31: "Once weekly", q31a: ["Restaurant"],
  q31b: "Chole bhature, pav bhaji",
  q32: ["Tea", "Office snacks"],
  q32a: "Tea ×2/day with sugar; biscuits most evenings",

  // 6 — Preferences & feasibility
  q33: "Eggetarian",
  q34: ["North Indian"],
  q35: "Eggs, paneer, dal, rajma, curd",
  q36: "Karela, tinda", q36a: "Will not eat",
  q37: ["Tea", "Rice", "Eggs"],

  // The rule under test: eggs are avoided on Tuesdays and Saturdays.
  q38: ["No non-vegetarian food on selected days"],
  q38a: ["Tuesday", "Saturday"],
  q38b: ["Eggs"],
  q38c: "Family religious practice — no eggs on Tuesdays and Saturdays",

  q39: ["Parent or family"], q39a: "Some",
  q40: ["Full kitchen", "Refrigerator"],
  q41: ["Carry meals", "Limited additional cooking acceptable"],
  q42: "Flexible", q42a: ["No major limitation"],

  // 7 — Training, protein & recovery
  q43: ["Strength training"],
  q44a: "4", q44b: "45–60 minutes", q44c: "Evening",
  q44d: "Less than 6 months", q44e: "Moderate", q44f: "Muscle gain",
  q45: ["Good energy"],
  q46: ["Mild normal soreness"],
  q47: ["Snack"], q47a: "30–60 minutes before",
  q48: ["Water"],
  q49: ["Whole food meal"], q49a: "Less than 30 minutes",

  // Frequencies match the Q28 food day: eggs most days (but not Tue/Sat),
  // dal and curd daily, paneer at dinner a few nights a week.
  q50: ["Eggs", "Dal", "Curd", "Paneer", "Milk", "Rajma or beans"],
  q50p_eggs_freq: "5–6 days a week", q50p_eggs_portion: "1½ portions",
  q50p_dal_freq: "Daily",
  q50p_curd_freq: "Daily",
  q50p_paneer_freq: "3–4 days a week",
  q50p_milk_freq: "Daily",
  q50p_rajma_freq: "1–2 days a week",
  q50a: "3", q50b: ["Cooking", "Family food pattern"],
  q51: ["None"],
  q52: ["None"],
  q53: ["None"],

  // 8 — Routine & behaviour
  q54: "Desk-based", q54a: "Day", q54b: "Fixed",
  q54c: "Mostly seated", q106: "5,000–8,000", q112: "7000",
  q55: ["Evening"], q55a: ["Training timing"],
  q56: "Moderate night hunger",
  q57: ["Moderate"],
  q58: ["Sweets", "Fried foods"],
  q58a: ["Habit"],
  q59: ["Order food more often"],
  q60: ["None"],

  // 9 — Lifestyle
  q61: "6–7 hours", q61a: "6", q61b: "No",
  q61c: ["Late screen time"],
  q62: "5", q62a: ["Work"], q62b: ["Sleep"],
  q63: "2–3 litres", q63a: ["Long workouts"], q63b: "Sometimes",
  q64: ["Tea"], q64a: "2", q64b: "Before 3 PM",
  q65: ["None"],
  q67: ["Family functions"],
  q67a: ["Overeat"],

  // 10 — Success, dropout & coaching
  q68: ["Work becomes busy", "Stop tracking"],
  q69: ["Wait until Monday"],
  q70: ["Clear weekly targets", "Frequent check-ins"],
  q71: ["Very high protein is necessary"], q71a: "Mild",
  q72: "Flexible food exchange", q72a: "Household measures",
  q73: ["Work", "Poor sleep"],
  q74: "Minor routine adjustment",
  q75: "8",

  // 11 — Dietitian professional assessment
  ds1: "Young, trains regularly, protein below what his training needs — raise protein and fix meal regularity before touching calories.",
  q76: ["Low protein intake", "Poor protein distribution", "Irregular meals"],
  q77: ["Increase protein", "Improve protein distribution"],
  q78: "Tea; rice at lunch; eggs at breakfast",
  q79: ["No unnecessary restriction identified"],
  q80: "Muscle gain",
  q81: "Muscle-gain phase",
  q82a: "69", q82b: "72", q82c: "Client target appears appropriate",
  q83: ["Current weight and height context", "Training demand"],
  q83a: "High — sufficient baseline information",
  q84: "Increase lean mass",
  q84a: "No numerical target", q84b: "Increase", q84c: "Maintain",
  q85: ["No specific target"],
  q86: ["Improve strength"],
  q87a: "3 weeks", q87b: "3 weeks", q87c: "8–12 weeks", q87d: "6–9 months",
  q87e: "Client timeline appears realistic",
  q88: ["Weight", "Strength", "Diet adherence"],
  q89: "Controlled energy surplus",
  q90: "High", q90a: "Moderate",
  q91: ["Protein distribution", "Meal regularity"],
  q92: "Moderate but poorly distributed",
  q92a: ["Total quantity", "Lunch"],
  q92b: ["Increase total protein", "Improve distribution"],
  q92c: "Not required",
  q93: ["Increase total protein", "Improve distribution"],
  q94: ["Reduce fried food"],
  q95: ["Increase vegetables"],
  q96: ["Maintain current intake"],
  q97: ["Improve pre-workout nutrition"],
  q98: ["Time"], q98a: "Routine",
  q99: ["Protein misconception"], q99a: "Clarify gradually",
  q100: "Flexible food exchange",
  q101: "8",

  // 12 — Client strategy discussion
};

// ---------------------------------------------------------------------------
// Test client 6 — Sakshi Test: 27F non-vegetarian, 62 kg / 157.5 cm (5'2"),
// measured protein intake ~24-25 g/day (0.4 g/kg) — a severe-deficit case.
// Non-veg in preference but eats meat only 2 days/week, so the gap is not a
// dietary restriction to design around, just very little protein on the
// plate at any meal. Exercises the week-1 walk-up from a much lower floor
// than the other fixtures (Priya starts at ~43 g, Sakshi at ~25 g).
// ---------------------------------------------------------------------------
export const SAKSHI: Answers = {
  q76_category: "First-timer — never dieted with structure before",
  name: "Sakshi Test",
  clientCode: "TEST-006",
  gender: "Female",
  phone: "+91 90000 00006",
  email: "sakshi.test@example.com",

  // 1 — Goal & deeper motivation
  q1: ["Low energy", "Recent weight gain"],
  q2: "Fat loss",
  q3: ["Improve daily energy", "Improve relationship with food"],
  q4: ["Improve confidence", "Improve health markers"],
  q5: ["Target weight"],
  q5_weight: "56",
  q6: ["Leaner appearance"],
  q8: "7",
  gr_dietitian: "Goal correctly understood",
  gr_client: "Correctly understood",

  // 2 — Body & transformation history
  q9_age: "27", q9_height: "157.5", q9_height_unit: "ft", q9_weight: "62",
  q9_weight_1y: "58", q9_weight_high: "63", q9_weight_low: "52", q9_weight_comfort: "56",
  q10: ["Gradual weight gain"], q10a: "4", q10b: "6–12 months",
  q11: ["Sedentary lifestyle", "Irregular meals", "Poor sleep"],
  q12: ["Meal skipping"],
  q12a: "No clear result",
  q12b: ["Excessive hunger", "Food became repetitive"],
  q13: "No",
  q14: ["Weight-loss plateau"], q14a: "3–6 months",
  q15: ["No data"], q15_assess: "Baseline measurement required",
  q16: ["Regular meals", "Home-cooked food", "Frequent check-ins"],
  q16a: "1) Regular meals 2) Home-cooked food 3) Frequent check-ins",

  // 3 — Medical & clinical safety
  q17: ["No known condition"],
  q18: ["None"],
  q19: "No",
  q20: ["No recent reports"],
  q21: ["None"],
  q22: ["No instruction"],
  cr1: ["No major clinical limitation identified"],

  // 4 — Digestion & tolerance
  q23: "Mostly comfortable",
  q24: ["No frequent symptom"],
  q25: "Once daily",
  q27: ["No known allergy or intolerance"],

  // 5 — Actual food day (measured: this is what pins the ~24 g/day baseline)
  q28: ["Breakfast", "Mid-Morning", "Lunch", "Evening", "Dinner"],
  "q112_breakfast_variants":
    "[{\"id\":\"breakfast1\",\"label\":\"Poha\",\"items\":[{\"food\":\"Poha\",\"qty\":\"1 plate\"}],\"daysPerWeek\":5,\"measured\":{\"calories\":250,\"protein_g\":4,\"carbs_g\":55,\"fat_g\":7}},{\"id\":\"breakfast2\",\"label\":\"Bread and jam\",\"items\":[{\"food\":\"Bread\",\"qty\":\"2 slices\"},{\"food\":\"Jam\",\"qty\":\"1 tbsp\"}],\"daysPerWeek\":2,\"measured\":{\"calories\":220,\"protein_g\":3,\"carbs_g\":40,\"fat_g\":5}}]",
  "q112_midmorning_variants":
    "[{\"id\":\"midmorning1\",\"label\":\"Nothing / tea only\",\"items\":[],\"daysPerWeek\":7,\"measured\":{\"calories\":40,\"protein_g\":1,\"carbs_g\":5,\"fat_g\":1}}]",
  "q112_lunch_variants":
    "[{\"id\":\"lunch1\",\"label\":\"Rice and sabzi\",\"items\":[{\"food\":\"Rice\",\"qty\":\"1 cup\"},{\"food\":\"Sabzi\",\"qty\":\"1 katori\"}],\"daysPerWeek\":5,\"measured\":{\"calories\":350,\"protein_g\":5,\"carbs_g\":70,\"fat_g\":8}},{\"id\":\"lunch2\",\"label\":\"Rice, sabzi and egg curry\",\"items\":[{\"food\":\"Rice\",\"qty\":\"1 cup\"},{\"food\":\"Sabzi\",\"qty\":\"1 katori\"},{\"food\":\"Egg curry\",\"qty\":\"1 egg\"}],\"daysPerWeek\":2,\"measured\":{\"calories\":390,\"protein_g\":10,\"carbs_g\":65,\"fat_g\":12}}]",
  "q112_evening_variants":
    "[{\"id\":\"evening1\",\"label\":\"Tea and biscuits\",\"items\":[{\"food\":\"Biscuits\",\"qty\":\"2\"}],\"daysPerWeek\":7,\"measured\":{\"calories\":120,\"protein_g\":2,\"carbs_g\":20,\"fat_g\":3}}]",
  "q112_dinner_variants":
    "[{\"id\":\"dinner1\",\"label\":\"Roti and sabzi\",\"items\":[{\"food\":\"Roti\",\"qty\":\"2\"},{\"food\":\"Sabzi\",\"qty\":\"1 katori\"}],\"daysPerWeek\":5,\"measured\":{\"calories\":280,\"protein_g\":5,\"carbs_g\":45,\"fat_g\":8}},{\"id\":\"dinner2\",\"label\":\"Chicken curry and roti\",\"items\":[{\"food\":\"Chicken curry\",\"qty\":\"1 katori\"},{\"food\":\"Roti\",\"qty\":\"2\"}],\"daysPerWeek\":2,\"measured\":{\"calories\":310,\"protein_g\":14,\"carbs_g\":30,\"fat_g\":15}}]",
  q28_breakfast_time: "08:30",
  q28_breakfast_food: "Poha 1 plate, most mornings",
  q28_breakfast_drinks: ["Tea with sugar × 1"],
  q109: "08:30 poha or bread with jam, most mornings. 11:00 nothing, just tea. 13:30 lunch — rice and a vegetable sabzi, home cooked, most days; egg curry twice a week. 17:30 tea with 2 biscuits, daily. 20:30 dinner — roti and sabzi, chicken curry twice a week, home cooked.",
  q28_breakfast_prep: ["Mixed preparation"],
  q28_breakfast_source: "Home",
  q28_breakfast_extras: ["Oil"],
  q28_midmorning_food: "Nothing",
  q28_lunch_time: "13:30",
  q28_lunch_food: "Rice + sabzi (egg curry twice a week)",
  q28_lunch_source: "Home",
  q28_evening_food: "Tea + 2 biscuits",
  q28_evening_drinks: ["Tea with sugar × 1"],
  q28_dinner_time: "20:30",
  q28_dinner_food: "Roti + sabzi (chicken curry twice a week)",
  q28_dinner_source: "Home",
  q29: "Weekdays are similar",
  q30: ["Skipped meals", "More sweets"],
  q31: "Once weekly", q31a: ["Delivery"],
  q31b: "Biryani, momos",
  q32: ["Tea", "Biscuits"],
  q32a: "Tea ×2/day with sugar; biscuits with evening tea",

  // 6 — Preferences & feasibility
  q33: "Non-vegetarian",
  q34: ["North Indian", "Mixed or international"],
  q35: "Egg curry, chicken curry, rice, biryani",
  q36: "Karela", q36a: "Will not eat",
  q37: ["Tea", "Rice"],
  q38: ["No restriction"],
  q39: ["Self"], q39a: "Some",
  q40: ["Full kitchen", "Refrigerator"],
  q41: ["Cook daily", "Simple cooking only"],
  q42: "Flexible", q42a: ["No major limitation"],

  // 7 — Training, protein & recovery
  q43: ["No current training", "Walking"],
  q44a: "2", q44b: "20–30 minutes", q44c: "Evening",
  q44d: "Complete beginner", q44e: "Light", q44f: "Fat loss",
  q45: ["No major problem"],
  q46: ["Recover well"],
  q47: ["Nothing"],
  q48: ["Water"],
  q49: ["Nothing for several hours"],
  // Frequencies match the Q28 food day above: egg curry and chicken curry
  // only twice a week each — this is what makes 24-25 g/day a measurement,
  // not a guess.
  q50: ["Eggs", "Chicken"],
  q50p_eggs_freq: "1–2 days a week",
  q50p_chicken_freq: "1–2 days a week",
  q50a: "1", q50b: ["Lack of knowledge", "Cooking"],
  q51: ["None"],
  q52: ["None"],
  q53: ["No limitation"], q53b: "Not required",

  // 8 — Routine & behaviour
  q54: "Homemaker", q54a: "Not applicable", q54b: "Flexible",
  q54c: "Mostly seated", q106: "2,000–3,000", q112: "2500",
  q55: ["Evening"], q55a: ["Habit", "Boredom"],
  q56: "Low protein, low energy pattern",
  q57: ["Low"],
  q58: ["Sweets or mithai", "Skipped meals leading to overeating"], q58a: ["Habit", "Lack of knowledge"],
  q59: ["Eat more"],
  q60: ["None"],

  // 9 — Lifestyle
  q61: "6–7 hours", q61a: "6", q61b: "Sometimes", q61c: ["Frequent waking"],
  q62: "5", q62a: ["Family"], q62b: ["Food intake"],
  q63: "1–2 litres", q63a: ["Forgets"], q63b: "Sometimes",
  q64: ["Tea"], q64a: "2", q64b: "6–9 PM",
  q65: ["None"],
  q67: ["Family gatherings"],
  q67a: ["Overeat", "Manage reasonably well"],

  // 10 — Success, dropout & coaching
  q68: ["Motivation reduces", "Skips meals when busy"],
  q69: ["Feel guilty but continue trying"],
  q70: ["Gentle reminders", "Frequent check-ins"],
  q71: ["Skipping meals helps fat loss"], q71a: "Moderate",
  q72: "Two options per meal", q72a: "Katori, cup or spoon",
  q73: ["Habit", "Lack of knowledge"],
  q74: "3 focused changes",
  q75: "6",

  // 11 — Dietitian professional assessment
  ds1: "Homemaker eating almost no protein at any meal — measured intake is ~24-25 g/day (0.4 g/kg), well below even a sedentary floor. Non-veg by preference but meat appears only twice a week, so this is a plate-composition gap, not a restriction to negotiate around. Protein is the single priority before anything else.",
  q76: ["Low protein intake", "Skipped meals", "Hidden calorie intake", "Poor sleep"],
  q77: ["Increase protein", "Improve meal regularity"],
  q78: "Tea; rice at lunch; home-cooked food",
  q79: ["No unnecessary restriction identified"],
  q80: "Fat loss",
  q81: "Fat-loss phase",
  q82a: "62", q82b: "58", q82c: "Initial target should differ from final target",
  q83: ["Current weight and height context", "Sustainability concern"],
  q83a: "Moderate — reassess after 2 weeks",
  q84: "Reduce fat while preserving muscle",
  q84a: "No numerical target", q84b: "Increase", q84c: "Reduce",
  q85: ["Waist"], q85a: "Waist reduction over 12 weeks",
  q86: ["Improve training consistency"],
  q87a: "2 weeks", q87b: "2 weeks", q87c: "8–12 weeks", q87d: "6–9 months",
  q87e: "Client timeline appears realistic",
  q88: ["Energy", "Diet adherence", "Weight"],
  q89: "Mild energy deficit",
  q90: "Low", q90a: "Low",
  q91: ["Protein quantity", "Meal regularity"],
  q92: "Very low",
  q92a: ["Total quantity", "Breakfast", "Lunch"],
  q92b: ["Increase total protein", "Improve breakfast protein"],
  q92c: "Optional convenience",
  q93: ["Increase total protein", "Improve distribution"],
  q94: ["Reduce sweets"],
  q95: ["Increase vegetables"],
  q96: ["Increase total fluids"],
  q97: ["Improve protein intake"],
  q98: ["No coordination required"],
  q99: ["Meal-timing misconception"], q99a: "Address gradually",
  q100: "Two options per meal",
  q101: "6",

  // 12 — Client strategy discussion
};

// ---------------------------------------------------------------------------
// Test client 7 — Kavya Test: 29F, Kerala-style South Indian NON-VEGETARIAN —
// fish, prawn and egg at nearly every meal (meen curry, prawn curry, egg
// roast/curry, puttu, appam), rice-heavy plate. Exercises cuisine-aware
// NON-VEG South Indian food matching: raising her protein should pull
// Kerala-style fish/prawn/egg dishes rather than defaulting to the North
// Indian chicken-tikka/paneer pattern the other non-veg fixtures (Rahul,
// Sakshi) produce. Anna covers South Indian VEGETARIAN; this is its non-veg
// counterpart.
// ---------------------------------------------------------------------------
export const KAVYA: Answers = {
  q76_category: "First-timer — never dieted with structure before",
  name: "Kavya Test",
  clientCode: "TEST-007",
  gender: "Female",
  phone: "+91 90000 00007",
  email: "kavya.test@example.com",

  // 1 — Goal & deeper motivation
  q1: ["Recent weight gain", "Low energy"],
  q2: "Fat loss with muscle preservation",
  q3: ["Improve daily energy", "Improve fitness"],
  q4: ["Feel physically fitter", "Improve confidence"],
  q5: ["Target weight"],
  q5_weight: "60",
  q6: ["Leaner appearance"],
  q8: "7",
  gr_dietitian: "Goal correctly understood",
  gr_client: "Correctly understood",

  // 2 — Body & transformation history
  q9_age: "29", q9_height: "160", q9_weight: "68",
  q9_weight_1y: "63", q9_weight_high: "70", q9_weight_low: "55", q9_weight_comfort: "60",
  q10: ["Gradual weight gain"], q10a: "5", q10b: "1–2 years",
  q11: ["Desk job", "Sedentary lifestyle", "Frequent outside food"],
  q12: ["Self-designed diet"],
  q12a: "No clear result",
  q12b: ["Food became repetitive", "Family food mismatch"],
  q13: "No",
  q14: ["Weight-loss plateau"], q14a: "3–6 months",
  q15: ["No data"], q15_assess: "Baseline measurement required",
  q16: ["Regular meals", "Home-cooked food", "Frequent check-ins"],
  q16a: "1) Regular meals 2) Home-cooked food 3) Frequent check-ins",

  // 3 — Medical & clinical safety
  q17: ["No known condition"],
  q18: ["None"],
  q19: "No",
  q20: ["No recent reports"],
  q21: ["None"],
  q22: ["No instruction"],
  cr1: ["No major clinical limitation identified"],

  // 4 — Digestion & tolerance
  q23: "Mostly comfortable",
  q24: ["Bloating"], q24a: "1–2 times per week", q24b: ["After lunch"], q24c: "3",
  q25: "Once daily",
  q27: ["No known allergy or intolerance"],

  // 5 — Actual food day
  q28: ["Breakfast", "Mid-Morning", "Lunch", "Evening", "Dinner"],
  "q112_breakfast_variants":
    "[{\"id\":\"breakfast1\",\"label\":\"Puttu and egg curry\",\"items\":[{\"food\":\"Puttu\",\"qty\":\"1 plate\"},{\"food\":\"Egg curry\",\"qty\":\"1 egg\"}],\"daysPerWeek\":5,\"measured\":{\"calories\":320,\"protein_g\":10,\"carbs_g\":45,\"fat_g\":10}},{\"id\":\"breakfast2\",\"label\":\"Appam and egg roast\",\"items\":[{\"food\":\"Appam\",\"qty\":\"2\"},{\"food\":\"Egg roast\",\"qty\":\"1 egg\"}],\"daysPerWeek\":2,\"measured\":{\"calories\":300,\"protein_g\":9,\"carbs_g\":40,\"fat_g\":11}}]",
  "q112_midmorning_variants":
    "[{\"id\":\"midmorning1\",\"label\":\"Filter coffee and banana\",\"items\":[{\"food\":\"Filter coffee\",\"qty\":\"1 cup\"},{\"food\":\"Banana\",\"qty\":\"1\"}],\"daysPerWeek\":7,\"measured\":{\"calories\":150,\"protein_g\":3,\"carbs_g\":30,\"fat_g\":2}}]",
  "q112_lunch_variants":
    "[{\"id\":\"lunch1\",\"label\":\"Rice, fish curry and avial\",\"items\":[{\"food\":\"Rice\",\"qty\":\"1.5 cups\"},{\"food\":\"Fish curry\",\"qty\":\"1 katori\"},{\"food\":\"Avial\",\"qty\":\"1 katori\"},{\"food\":\"Rasam\",\"qty\":\"1 cup\"}],\"daysPerWeek\":5,\"measured\":{\"calories\":620,\"protein_g\":22,\"carbs_g\":85,\"fat_g\":18}},{\"id\":\"lunch2\",\"label\":\"Rice, egg curry and sambar\",\"items\":[{\"food\":\"Rice\",\"qty\":\"1.5 cups\"},{\"food\":\"Egg curry\",\"qty\":\"1 egg\"},{\"food\":\"Sambar\",\"qty\":\"1 katori\"}],\"daysPerWeek\":2,\"measured\":{\"calories\":560,\"protein_g\":15,\"carbs_g\":90,\"fat_g\":12}}]",
  "q112_evening_variants":
    "[{\"id\":\"evening1\",\"label\":\"Filter coffee and banana chips\",\"items\":[{\"food\":\"Filter coffee\",\"qty\":\"1 cup\"},{\"food\":\"Banana chips\",\"qty\":\"1 handful\"}],\"daysPerWeek\":7,\"measured\":{\"calories\":180,\"protein_g\":2,\"carbs_g\":20,\"fat_g\":10}}]",
  "q112_dinner_variants":
    "[{\"id\":\"dinner1\",\"label\":\"Appam and prawn curry\",\"items\":[{\"food\":\"Appam\",\"qty\":\"2\"},{\"food\":\"Prawn curry\",\"qty\":\"1 katori\"}],\"daysPerWeek\":3,\"measured\":{\"calories\":420,\"protein_g\":18,\"carbs_g\":50,\"fat_g\":14}},{\"id\":\"dinner2\",\"label\":\"Chapati and fish curry\",\"items\":[{\"food\":\"Chapati\",\"qty\":\"2\"},{\"food\":\"Fish curry\",\"qty\":\"1 katori\"}],\"daysPerWeek\":4,\"measured\":{\"calories\":400,\"protein_g\":19,\"carbs_g\":42,\"fat_g\":15}}]",
  q28_breakfast_time: "08:00",
  q28_breakfast_food: "Puttu with egg curry, most mornings",
  q28_breakfast_drinks: ["Filter coffee × 1"],
  q109: "08:00 puttu with egg curry, 5 mornings a week, appam with egg roast the other 2. 10:30 filter coffee and a banana. 13:00 lunch — rice with fish curry and avial most days, egg curry and sambar twice a week, home cooked, daily. 17:30 filter coffee with banana chips. 20:00 dinner — appam with prawn curry three nights, chapati with fish curry the rest, home cooked.",
  q28_breakfast_prep: ["Steamed"],
  q28_breakfast_source: "Home",
  q28_breakfast_extras: ["Coconut oil"],
  q28_midmorning_food: "Filter coffee + 1 banana",
  q28_lunch_time: "13:00",
  q28_lunch_food: "Rice + fish curry + avial (egg curry + sambar twice a week)",
  q28_lunch_source: "Home",
  q28_evening_food: "Filter coffee + banana chips",
  q28_evening_drinks: ["Filter coffee × 1"],
  q28_dinner_time: "20:00",
  q28_dinner_food: "Appam + prawn curry (chapati + fish curry on other nights)",
  q28_dinner_source: "Home",
  q29: "Weekdays are similar",
  q30: ["Restaurant food", "More sweets"],
  q31: "Once weekly", q31a: ["Restaurant"],
  q31b: "Kerala parotta, chicken fry, fish moilee",
  q32: ["Filter coffee", "Banana chips", "Sweets or mithai"],
  q32a: "Filter coffee ×2/day; banana chips most evenings",

  // 6 — Preferences & feasibility
  q33: "Non-vegetarian",
  q34: ["South Indian", "Kerala-style"],
  q35: "Fish curry, prawn curry, appam, puttu, egg roast, Kerala parotta",
  q36: "Raw mango", q36a: "Will not eat",
  q37: ["Filter coffee", "Rice", "Fish curry"],
  q38: ["No restriction"],
  q39: ["Self", "Parent or family"], q39a: "Good",
  q40: ["Full kitchen", "Refrigerator", "Microwave"],
  q41: ["Cook daily", "Simple cooking only"],
  q42: "Moderate household-food budget", q42a: ["No major limitation"],

  // 7 — Training, protein & recovery
  q43: ["Walking"],
  q44a: "3", q44b: "30–45 minutes", q44c: "Morning",
  q44d: "Complete beginner", q44e: "Light", q44f: "Fat loss",
  q45: ["No major problem"],
  q46: ["Recover well"],
  q47: ["Water only"],
  q48: ["Water"],
  q49: ["Small meal"], q49a: "30–60 minutes",
  // Frequencies match the Q28 food day above: fish curry at lunch most days,
  // egg curry/roast at breakfast, prawn curry at dinner, dal/sambar occasional.
  q50: ["Fish", "Eggs", "Seafood", "Dal", "Curd"],
  q50p_fish_freq: "5–6 days a week",
  q50p_eggs_freq: "3–4 days a week",
  q50p_seafood_freq: "1–2 days a week",
  q50p_dal_freq: "1–2 days a week",
  q50p_curd_freq: "1–2 days a week",
  q50a: "2", q50b: ["Cost", "Availability"],
  q51: ["None"],
  q52: ["None"],
  q53: ["No limitation"], q53b: "Not required",

  // 8 — Routine & behaviour
  q54: "Desk-based", q54a: "Day", q54b: "Fixed",
  q54c: "Mostly seated", q106: "3,000–5,000", q112: "4000",
  q55: ["Evening"], q55a: ["Cravings", "Habit"],
  q56: "Moderate evening hunger",
  q57: ["Good"],
  q58: ["Fried foods", "Sweets or mithai"], q58a: ["Habit", "Boredom"],
  q59: ["Eat more"],
  q60: ["None"],

  // 9 — Lifestyle
  q61: "6–7 hours", q61a: "6", q61b: "Sometimes", q61c: ["Late screen time"],
  q62: "5", q62a: ["Work"], q62b: ["Food intake"],
  q63: "1.5–2 litres", q63a: ["None"], q63b: "Never",
  q64: ["Filter coffee"], q64a: "2", q64b: "6–9 PM",
  q65: ["None"],
  q67: ["Family gatherings", "Religious or community events"],
  q67a: ["Overeat", "Manage reasonably well"],

  // 10 — Success, dropout & coaching
  q68: ["Weekend routine breaks", "Motivation reduces"],
  q69: ["Return the next day", "Feel guilty but continue trying"],
  q70: ["Gentle reminders", "Frequent check-ins"],
  q71: ["Rice causes weight gain"], q71a: "Moderate",
  q72: "Two options per meal", q72a: "Katori, cup or spoon",
  q73: ["Cravings", "Family routine"],
  q74: "3 focused changes",
  q75: "7",

  // 11 — Dietitian professional assessment
  ds1: "Desk-based, Kerala-style non-vegetarian pattern — fish and egg at nearly every meal, rice-heavy plate. Protein is present but carb-heavy (puttu/appam/rice at every meal). Raise protein within the same cuisine — more fish, egg and prawn — rather than switching her to roti and paneer.",
  q76: ["Low protein intake", "Hidden calorie intake", "Sedentary lifestyle"],
  q77: ["Increase protein", "Improve meal regularity"],
  q78: "Filter coffee; rice at lunch and dinner; Kerala-style home food",
  q79: ["Client fears rice"],
  q80: "Fat loss with muscle preservation",
  q81: "Fat-loss phase",
  q82a: "68", q82b: "62", q82c: "Initial target should differ from final target",
  q83: ["Current weight and height context", "Sustainability concern"],
  q83a: "Moderate — reassess after 2 weeks",
  q84: "Reduce fat while preserving muscle",
  q84a: "No numerical target", q84b: "Preserve", q84c: "Reduce",
  q85: ["Waist"], q85a: "Waist reduction over 12 weeks",
  q86: ["Improve training consistency"],
  q87a: "2 weeks", q87b: "2 weeks", q87c: "8–12 weeks", q87d: "6–9 months",
  q87e: "Client timeline appears realistic",
  q88: ["Waist", "Energy", "Diet adherence", "Weight"],
  q89: "Mild energy deficit",
  q90: "Moderate", q90a: "Low",
  q91: ["Protein quantity", "Meal regularity"],
  q92: "Moderate", q92a: ["Total quantity", "Breakfast"],
  q92b: ["Increase total protein", "Improve breakfast protein"],
  q92c: "Optional convenience",
  q93: ["Improve quality", "Reduce excessive portions"],
  q94: ["Reduce coconut oil in cooking"],
  q95: ["Increase vegetables", "Gradual fibre increase"],
  q96: ["Increase total fluids"],
  q97: ["Improve protein intake"],
  q98: ["No coordination required"],
  q99: ["Rice or roti avoidance"], q99a: "Address gradually",
  q100: "Two options per meal",
  q101: "7",

  // 12 — Client strategy discussion
};
