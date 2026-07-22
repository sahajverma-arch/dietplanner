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
  q7: "No deadline",
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
  q25: "Once daily", q25a: ["Comfortable and formed"],
  q26: ["No repeated discomfort"],
  q27: ["Peanut"], q27a: "Severe", q27b: "Yes",

  // 5 — Actual food day
  q28: ["Breakfast", "Mid-morning", "Lunch", "Evening snack", "Dinner"],
  q28_breakfast_time: "08:30",
  q28_breakfast_food: "Poha 1 plate + tea with 1 tsp sugar",
  q28_breakfast_prep: ["Mixed preparation"],
  q28_breakfast_source: "Home",
  q28_breakfast_extras: ["Oil", "Sugar"],
  q28_midmorning_food: "1 apple",
  q28_lunch_time: "13:30",
  q28_lunch_food: "2 rotis + dal 1 katori + sabzi + salad",
  q28_lunch_source: "Home",
  q28_evening_food: "Tea + 4 biscuits",
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
  q54c: "Lightly active", q54d: "5000",
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
  q66: ["PCOS or PCOD", "Regular cycle"], q66a: "Under medical care",
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
  q102: "Yes",
  q103: "Yes",
  q104: ["No"],
  q105: "8",
};

// ---------------------------------------------------------------------------
// Test client 2 — Rahul Test: 29M, non-vegetarian desk worker who trains in
// the evening, DISLIKES lauki/karela (tests dislike stripping) and avoids
// non-veg + eggs on Tuesdays & Thursdays (tests day-of-week rules q38a–c).
// ---------------------------------------------------------------------------
export const RAHUL: Answers = {
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
  q7: "Flexible personal target", q7a: "2026-10-01", q7b: "Flexible",
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
  q25: "Once daily", q25a: ["Comfortable and formed"],
  q26: ["No repeated discomfort"],
  q27: ["No known allergy"],

  // 5 — Actual food day
  q28: ["Breakfast", "Lunch", "Evening snack", "Post-workout", "Dinner"],
  q28_breakfast_time: "09:00",
  q28_breakfast_food: "2 aloo parathas + curd 1 katori",
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
  q54c: "Mostly seated", q54d: "6000",
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
  q102: "Yes",
  q103: "Mostly", q103a: "Work schedule",
  q104: ["Added flexibility", "Added restaurant consideration"],
  q105: "8",
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
  q7: "No deadline",
  q8: "7",
  gr_dietitian: "Goal correctly understood",
  gr_client: "Correctly understood",

  // 2 — Body & transformation history
  q9_age: "35", q9_height: "158", q9_weight: "68", q9_weight_1y: "64",
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
  q25: "Once daily", q25a: ["Comfortable and formed"],
  q26: ["No repeated discomfort"],
  q27: ["No known allergy"],

  // 5 — Actual food day
  q28: ["Breakfast", "Mid-morning", "Lunch", "Evening snack", "Dinner"],
  q28_breakfast_time: "08:00",
  q28_breakfast_food: "2 rotis + sabzi + tea with 1 tsp sugar",
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
  q54c: "Mostly seated", q54d: "5000",
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
  q102: "Yes",
  q103: "Mostly", q103a: "Family schedule",
  q104: ["Added flexibility"],
  q105: "8",
};

// ---------------------------------------------------------------------------
// Test client 4 — Aadi Test: 27M EGGETARIAN who does not eat eggs on Tuesdays
// and Saturdays. Exercises the day-of-week rules (q38a–c) on an EGG-only
// restriction — Rahul's case removes non-veg and eggs together, so an
// egg-only rule on an eggetarian (whose entire non-plant protein IS eggs) is
// the harder test: those two days must find protein elsewhere.
// ---------------------------------------------------------------------------
export const AADI: Answers = {
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
  q7: "Flexible personal target", q7a: "2026-12-01", q7b: "Flexible",
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
  q25: "Once daily", q25a: ["Comfortable and formed"],
  q26: ["No repeated discomfort"],
  q27: ["No known allergy"],

  // 5 — Actual food day
  q28: ["Breakfast", "Lunch", "Evening snack", "Post-workout", "Dinner"],
  q28_breakfast_time: "08:30",
  q28_breakfast_food: "3 egg omelette + 2 bread slices + tea",
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
  q54c: "Mostly seated", q54d: "7000",
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
  q102: "Yes",
  q103: "Mostly", q103a: "Work schedule",
  q104: ["Added flexibility"],
  q105: "8",
};
