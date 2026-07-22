// ---------------------------------------------------------------------------
// DRAFT — LeanR Premium Client Counselling v3.0, SECTION 1 (Stages 1–12, Q1–Q64).
//
// Not wired into SECTIONS. Section 2 of v3.0 (stages 13–19, A1–A18) is out of
// scope: those are AI/dietitian outputs, not client questions.
//
// The `id` is the storage key — five live clients already have answers filed
// under the current ids, so an id is reused whenever the v3.0 question means the
// same thing, even where the wording and the option list have both moved. `n:`
// carries the v3.0 number the dietitian reads out; the two deliberately diverge.
//
// New ids start at q106 because q1–q105 are taken by the current bank (q65 is
// already alcohol/tobacco, so the obvious next number would have collided).
// Sub-questions of a reused parent keep the parent's number (q10c, q34d, …).
//
// EXCLUDED: the protein section (S6 `protein`: q33, q50, the generated q50p_*
// rows, q50a, q50b) is untouched and already answers v3.0 Q30 (food pattern) and
// Q43 (protein sources), so neither is redrafted here.
//
// ===========================================================================
// ID MAPPING TABLE — every v3.0 Section 1 question
// ===========================================================================
//
// STAGE 1 — INTRODUCTION, RAPPORT & GOAL DISCOVERY
//   Q1  -> q9_age          REUSED  age
//   Q1  -> gender          REUSED  gender (lives in the CLIENT identity section)
//   Q1  -> q1_occupation   NEW     occupation as free text (q54 only held work TYPE)
//   Q1  -> q54             REUSED  work type
//   Q1  -> q1_hours        NEW     working hours
//   Q1  -> q54a            REUSED  shift pattern
//   Q1  -> q34a            REUSED  country
//   Q1  -> q34d            NEW     state (q34c is already staples)
//   Q1  -> q34b            REUSED  city
//   Q1  -> q1_routine      NEW     general daily routine, client's own words
//   Q2  -> q1              REUSED  what motivated you now (max 3) — option list replaced
//   Q3  -> q2              REUSED  main result wanted — option list replaced
//   Q4  -> q6              REUSED  physique goal — multi -> SINGLE, no longer conditional
//   Q5  -> q4              REUSED  why the goal matters (max 3) — option list replaced
//   Q6  -> q7              REUSED  target date / deadline type
//   Q6  -> q7a             REUSED  target date
//   Q6  -> q7b             REUSED  priority Flexible/Important/Fixed (exact match kept)
//
// STAGE 2 — BODY PROFILE & TRANSFORMATION HISTORY
//   Q7  -> q9_height       REUSED  height
//   Q7  -> q9_weight       REUSED  current weight
//   Q7  -> q9_weight_high  REUSED  highest adult weight
//   Q7  -> q9_weight_low   REUSED  lowest adult weight
//   Q7  -> q9_weight_comfort REUSED comfortable/preferred weight
//   Q7  -> q9_weight_1y    REUSED  weight one year ago
//   Q8  -> q10             REUSED  weight/shape change over the last year
//   Q8  -> q10a            REUSED  approximate weight change
//   Q8  -> q10b            REUSED  time period
//   Q8  -> q10c            NEW     major body-shape changes (free text)
//   Q9  -> q11             REUSED  what contributed most (max 5)
//   Q10 -> q12             REUSED  approaches tried before
//   Q10 -> q12c            NEW     per-attempt approach / duration / weight change
//   Q10 -> q12a            REUSED  result of the attempt
//   Q10 -> q12b            REUSED  main reason for stopping (max 3)
//   Q10 -> q13c            REUSED  problems experienced (was the rapid-loss follow-up)
//   Q11 -> q16             REUSED  healthiest / most consistent phase
//   Q11 -> q16a            REUSED  rank top 3 success factors
//
// STAGE 3 — BODY COMPOSITION & OBJECTIVE BASELINE
//   Q12 -> q15             REUSED  which measurements exist — now the METHOD list
//   Q12 -> q15_date        NEW     date of measurement
//   Q12 -> q15_bf / q15_muscle / q15_smm / q15_visceral / q15_waist / q15_hip /
//          q15_chest / q15_arm / q15_thigh   REUSED  the recorded values
//   Q12 -> q15_assess      REUSED  body-composition confidence (tier hierarchy)
//   Q13 -> q15_src         REUSED  body-fat measurement source
//   Q13 -> q13_bf_conf     NEW     body-fat confidence High/Moderate/Low
//   Q13 -> q54d            REUSED  average daily steps (numeric baseline)
//   Q13 -> q13_meal_consistency NEW meal consistency /10
//   Q13 -> q13_protein_adequacy NEW protein adequacy Low/Moderate/Good/Unknown
//   Q13 -> q13_diet_quality NEW    diet quality /10
//   Q13 -> q13_adherence   NEW     self-rated nutrition adherence /10
//   Q13 -> q13_date        NEW     baseline date
//   Q13 -> q13_completeness NEW    baseline completeness
//
// STAGE 4 — MEDICAL, CLINICAL & SAFETY ASSESSMENT
//   Q14 -> q17             REUSED  diagnosed conditions — option list replaced
//   Q14 -> q17d            NEW     when diagnosed
//   Q14 -> q17a            REUSED  current status
//   Q14 -> q17b            REUSED  doctor follow-up
//   Q14 -> q17c            REUSED  per-condition notes
//   Q15 -> q107            NEW     family history
//   Q15 -> q107a           NEW     relationship
//   Q16 -> q18             REUSED  surgery / hospitalisation / injury
//   Q16 -> q18b            NEW     event + date/year
//   Q16 -> q18a            REUSED  current impact
//   Q17 -> q19             REUSED  regular medicines Yes/No
//   Q17 -> q19a            REUSED  medicine name/reason/dose/timing/food
//   Q17 -> q19b            REUSED  recent changes
//   Q18 -> q20             REUSED  blood tests in last 12 months
//   Q18 -> q20b            REUSED  test / date / result values
//   Q18 -> q20a            REUSED  status Normal/Abnormal/Unsure
//   Q18 -> q20c            NEW     report status available / not available
//   Q18 -> q20d            NEW     action: upload / AI extract / dietitian verification
//   Q19 -> q21             REUSED  concerning symptoms — option list replaced
//   Q19 -> q21c            REUSED  dietitian safety decision
//   Q20 -> q22             REUSED  doctor-advised dietary/exercise restrictions
//   Q20 -> q22a            REUSED  instruction details
//   Q21 -> q66             REUSED  hormonal / reproductive factors
//
// STAGE 5 — DIGESTION, ALLERGIES & FOOD TOLERANCE
//   Q22 -> q23             REUSED  overall digestion
//   Q22 -> q24             REUSED  digestive symptoms
//   Q22 -> q24a            REUSED  frequency of the main symptom
//   Q22 -> q24b            REUSED  timing
//   Q22 -> q24c            REUSED  severity 1–10
//   Q22 -> q24d            NEW     food association
//   Q22 -> q25             REUSED  bowel frequency
//   Q22 -> q25a            REUSED  stool consistency — multi -> SINGLE, list replaced
//   Q22 -> q25b            NEW     pain yes/no
//   Q22 -> q25c            NEW     incomplete emptying yes/no
//   Q23 -> q108            NEW     classification of each reaction
//   Q23 -> q27             REUSED  allergens (current list kept — v3.0 gives none)
//   Q23 -> q27a            REUSED  severity incl. previous emergency reaction
//   Q23 -> q27b            REUSED  professionally diagnosed
//   Q23 -> q27c            REUSED  other allergen
//   Q23 -> q26             REUSED  intolerance / digestive-trigger foods
//   Q23 -> q26a            REUSED  reaction / symptoms
//   Q23 -> q26d            NEW     frequency of the reaction
//   Q23 -> q26b            REUSED  reproducibility
//   Q23 -> q26c            REUSED  other trigger foods
//
// STAGE 6 — DETAILED DIETARY INTAKE & HABITUAL FOOD PATTERN
//   Q24 -> q28             REUSED  eating occasions — occasion list replaced
//   Q24 -> q28_<key>_time / _food / _prep / _source / _extras  REUSED per occasion
//   Q24 -> q28_<key>_beverage   NEW  beverage with the occasion
//   Q24 -> q28_<key>_unplanned  NEW  planned vs unplanned eating
//   Q25 -> q109            NEW     typical weekday, meal by meal
//   Q25 -> q109a           NEW     meals usually skipped / delayed / replaced
//   Q26 -> q30             REUSED  what changes on weekends — option list replaced
//   Q26 -> q30a            NEW     weekend difference rating
//   Q26 -> q30b            NEW     potential weekend calorie impact
//   Q27 -> q29             REUSED  week-to-week consistency — option list replaced
//   Q27 -> q29a            NEW     habitual intake confidence
//   Q28 -> q110            NEW     cooking fats & additions used at home
//   Q28 -> q110a           NEW     frequency & approximate quantity
//   Q28 -> q110b           NEW     oil type
//   Q28 -> q110c           NEW     household oil usage
//   Q28 -> q110d           NEW     number of people sharing food
//   Q28 -> q110e           NEW     estimated per-person oil usage
//   Q28 -> q110f           NEW     salt type
//   Q28 -> q110g           NEW     flour types used regularly
//   Q29 -> q31             REUSED  outside-food frequency
//   Q29 -> q31a            REUSED  main sources
//   Q29 -> q31b            REUSED  typical orders
//   Q29 -> q32             REUSED  snacks / beverages / sweets / unplanned eating
//   Q29 -> q32a            REUSED  frequency, quantity, timing, weekday vs weekend
//
// STAGE 7 — FOOD PREFERENCES, CULTURAL HABITS & HOUSEHOLD FEASIBILITY
//   Q30 -> (food pattern)  SKIPPED — already q33 in the untouched protein section
//   Q30 -> q34             REUSED  household cuisine
//   Q30 -> q34c            REUSED  regular staple foods
//   Q30 -> q34f            NEW     frequency of major staples
//   Q30 -> q38             REUSED  cultural / religious food practices
//   Q30 -> q38a/q38b/q38c  REUSED  day-specific rules (feed weeklyDayRulesText)
//   Q31 -> q35             REUSED  foods enjoyed, favourites first
//   Q32 -> q36             REUSED  dislikes / never eat
//   Q32 -> q36a            REUSED  classification of the dislike
//   Q33 -> q37             REUSED  non-negotiables, top 5
//   Q34 -> q39             REUSED  primary meal preparer
//   Q34 -> q39a            REUSED  control over food choices High/Moderate/Low
//   Q34 -> q39b            NEW     ability to request modifications
//   Q34 -> q39c            NEW     household limitations
//   Q35 -> q40             REUSED  facilities available
//   Q35 -> q41             REUSED  realistic meal preparation
//
// STAGE 8 — DAILY ACTIVITY & ENHANCED NEAT ASSESSMENT
//   Q36 -> q54c            REUSED  overall activity outside planned exercise
//   Q36 -> q111            NEW     sitting time
//   Q36 -> q111a           NEW     standing / moving time
//   Q36 -> q111b           NEW     occupational movement
//   Q36 -> q111c           NEW     household movement
//   Q36 -> q111d           NEW     other routine movement
//   Q37 -> q54e            REUSED  commute — duration options replaced by MODE options
//   Q37 -> q54g            NEW     total daily commute
//   Q37 -> q54h            NEW     walking involved in the commute
//   Q38 -> q106            NEW     average daily steps, banded
//   Q38 -> q54f            NEW     step tracking source
//   Q39 -> q112            NEW     weekday steps
//   Q39 -> q112a           NEW     weekend steps
//   Q39 -> q112b           NEW     weekend activity vs weekday
//   Q39 -> q112c           NEW     weekend sitting vs weekday
//   Q39 -> q112d           NEW     NEAT classification
//   Q39 -> q112e           NEW     NEAT confidence
//
// STAGE 9 — EXERCISE, TRAINING, PROTEIN & RECOVERY
//   Q40 -> q43             REUSED  activity / exercise type
//   Q40 -> q44a            REUSED  days per week
//   Q40 -> q44b            REUSED  duration
//   Q40 -> q44c            REUSED  timing
//   Q40 -> q44g            REUSED  location
//   Q40 -> q44d            REUSED  training experience
//   Q40 -> q44e            REUSED  intensity
//   Q41 -> q45             REUSED  how you feel DURING exercise
//   Q41 -> q46             REUSED  how you feel AFTER exercise
//   Q42 -> q47 / q47a      REUSED  pre-training intake and timing
//   Q42 -> q48             REUSED  during training
//   Q42 -> q49 / q49a      REUSED  post-training intake and timing
//   Q43 -> (protein)       SKIPPED — q50 / q50a / q50b in the untouched protein section
//   Q44 -> q51             REUSED  supplements used
//   Q44 -> q51c            REUSED  product / dose / frequency
//   Q44 -> q51a            REUSED  recommended by
//   Q44 -> q51b            REUSED  side effects
//   Q45 -> q53             REUSED  pain / injury location
//   Q45 -> q53c            NEW     severity
//   Q45 -> q53d            NEW     duration
//   Q45 -> q53e            NEW     activities affected
//   Q45 -> q53a            REUSED  professional assessment
//
// STAGE 10 — HUNGER & EATING BEHAVIOUR
//   Q46 -> q56             REUSED  overall hunger pattern
//   Q46 -> q56a            NEW     hungriest time
//   Q46 -> q56b            NEW     low-appetite periods
//   Q46 -> q57             REUSED  appetite variability
//   Q47 -> q55             REUSED  difficult meals / times
//   Q47 -> q55b            NEW     how difficult
//   Q47 -> q55a            REUSED  reason
//   Q48 -> q58             REUSED  cravings
//   Q48 -> q58a            REUSED  triggers
//   Q48 -> q58b            REUSED  timing
//   Q48 -> q58c            NEW     frequency
//   Q49 -> q59             REUSED  stress / emotion response — option list replaced
//   Q50 -> q60             REUSED  concerning eating behaviours (list kept)
//   Q50 -> q60a            REUSED  dietitian assessment — option list replaced
//   Q51 -> q113            NEW     eating speed
//   Q51 -> q113a           NEW     distractions while eating
//   Q51 -> q113b           NEW     why the meal ends
//   Q52 -> q69             REUSED  what happens off-plan — multi -> SINGLE, list replaced
//
// STAGE 11 — SLEEP, STRESS, HYDRATION & LIFESTYLE
//   Q53 -> q61d            NEW     bedtime
//   Q53 -> q61e            NEW     wake time
//   Q53 -> q61             REUSED  average sleep duration
//   Q53 -> q61a            REUSED  sleep quality /10
//   Q53 -> q61c            REUSED  sleep problems (list kept — feeds the apnoea flag)
//   Q53 -> q61f            NEW     night awakenings
//   Q54 -> q62             REUSED  stress 1–10
//   Q54 -> q62a            REUSED  major stress sources
//   Q54 -> q62b            REUSED  impact on eating / sleep / exercise
//   Q55 -> q63             REUSED  daily water intake
//   Q55 -> q63c            NEW     other fluids
//   Q55 -> q63d            NEW     workout hydration
//   Q55 -> q63a            REUSED  factors affecting requirements
//   Q55 -> q63b            REUSED  electrolytes
//   Q56 -> q64             REUSED  caffeinated drinks
//   Q56 -> q64a            REUSED  quantity
//   Q56 -> q64c            REUSED  added sugar
//   Q56 -> q64d            NEW     usual timing
//   Q56 -> q64b            REUSED  last intake of the day
//   Q57 -> q65             REUSED  alcohol / tobacco / nicotine (list kept)
//   Q57 -> q65a            REUSED  frequency
//   Q57 -> q65c            NEW     quantity
//   Q57 -> q65b            REUSED  context
//   Q58 -> q67             REUSED  travel & social situations
//   Q58 -> q67b            REUSED  frequency
//   Q58 -> q67a            REUSED  nutrition impact
//   Q58 -> q67c            NEW     typical challenges
//
// STAGE 12 — ADHERENCE, MINDSET & SUCCESS STRATEGY
//   Q59 -> q73             REUSED  consistency barriers, top 3 — option list replaced
//   Q60 -> q71             REUSED  nutrition beliefs / food rules (list kept)
//   Q60 -> q71b            NEW     source of belief
//   Q60 -> q71a            REUSED  strength of belief
//   Q60 -> q71c            NEW     whether it may affect adherence
//   Q61 -> q72             REUSED  plan type preference — option list replaced
//   Q61 -> q72a            REUSED  preferred measurement method — option list replaced
//   Q62 -> q74             REUSED  realistic change in first two weeks — list replaced
//   Q63 -> q75             REUSED  confidence 1–10
//   Q63 -> q75a            REUSED  what would make the plan easier (shown below 7)
//   Q64 -> q70             REUSED  support & coaching that helps (max 3) — list replaced
// ===========================================================================

import {
  answered,
  has,
  hasAny,
  hasOther,
  is,
  scaleAtMost,
  val,
  type Answers,
  type Question,
  type Section,
} from "../src/lib/counselling/questions";

const RANK_NOTE = "Click in priority order — first click = rank 1.";

// v3.0 wants the confidence of a body-composition number recorded next to the
// number itself, because the AI rule forbids a low-confidence body-fat value
// from driving calorie targets on its own.
const NO_CONDITION_V3 = "No Medical Condition";

// ---------------------------------------------------------------------------
// STAGE 1 — INTRODUCTION, RAPPORT & GOAL DISCOVERY (Q1–Q6)
// ---------------------------------------------------------------------------

const V3_S1: Section = {
  id: "goal",
  code: "1",
  title: "Introduction, rapport & goal discovery",
  stage: "Goals",
  minutes: "8–10 min",
  intro:
    "Introduce yourself and the purpose first. Q1 is a conversation, not a form — let the client describe their day and fill the fields from what they say.",
  questions: [
    // Q1 is one spoken question that fills ten fields. Age, gender, work type,
    // shift, country and city already have storage keys, so only the four
    // genuinely new fields are added — re-asking under fresh ids would orphan
    // the answers already filed for the live clients.
    { id: "q9_age", n: 1, tag: "core", type: "number", label: "Age (years)", required: true },
    {
      id: "q1_occupation", n: 1, tag: "core", type: "text", label: "Occupation",
      placeholder: "e.g. Software engineer, school teacher, business owner",
    },
    {
      id: "q54", n: 1, tag: "core", type: "single", label: "Work type",
      options: [
        "Desk-based", "Standing", "Physical work", "Field work", "Work from home", "Hybrid",
        "Student", "Homemaker", "Not working", "Other",
      ],
      required: true,
    },
    {
      id: "q1_hours", n: 1, tag: "core", type: "text", label: "Working hours",
      placeholder: "e.g. 9:30 AM to 7 PM, 6 days",
    },
    {
      id: "q54a", n: 1, tag: "core", type: "single", label: "Shift pattern",
      options: ["Day", "Evening", "Night", "Rotational", "Split", "Flexible", "Not applicable"],
    },
    { id: "q34a", n: 1, tag: "core", type: "text", label: "Country", placeholder: "e.g. India" },
    { id: "q34d", n: 1, tag: "core", type: "text", label: "State", placeholder: "e.g. Punjab" },
    { id: "q34b", n: 1, tag: "core", type: "text", label: "City", placeholder: "e.g. Chandigarh" },
    {
      id: "q1_routine", n: 1, tag: "core", type: "textarea", label: "General daily routine",
      placeholder: "Wake, work, meals, travel, training, sleep — in the client's own words.",
      why: "Every later feasibility decision (meal timing, prep, carrying food) is judged against this routine.",
    },
    {
      id: "q1", n: 2, tag: "core", type: "multi", max: 3, required: true,
      label: "What motivated you to begin your health journey with LeanR at this point in your life?",
      options: [
        "Recent weight gain", "Increased body fat", "Clothes fitting tighter", "Poor body shape",
        "Low confidence", "Low energy", "Reduced strength", "Poor stamina",
        "Poor workout performance", "Slow recovery", "Health reports", "Doctor recommendation",
        "Existing medical condition", "Wedding", "Special occasion", "Pregnancy planning",
        "Post-pregnancy transformation", "Sports goal", "Weight regain",
        "Previous failed attempts", "Plateau", "Family motivation", "Better lifestyle",
        "Want professional guidance", "Other",
      ],
      probe: "Why now specifically, and why this month rather than last year?",
    },
    {
      id: "q2", n: 3, tag: "core", type: "single", required: true,
      label: "What would you most like to achieve through LeanR?",
      options: [
        "Fat Loss", "Weight Loss", "Body Recomposition", "Fat Loss With Muscle Preservation",
        "Muscle Gain", "Healthy Weight Gain", "Improved Fitness",
        "Sports/Performance Improvement", "Clinical Nutrition Improvement",
        "Lifestyle Improvement", "Maintenance", "Not Sure – Need Dietitian Guidance",
      ],
      why: "The single primary result — the whole energy and protein strategy hangs off it.",
    },
    {
      // v3.0 asks this of every client, so the old conditional on the goal type
      // is gone and the question is a single select rather than a multi.
      id: "q6", n: 4, tag: "core", type: "single",
      label: "What kind of physical transformation are you hoping to achieve?",
      options: [
        "Lean Physique", "Athletic Physique", "Toned Physique", "Muscular Physique",
        "Better Body Shape", "Smaller Waist", "Better Muscle Definition", "Body Recomposition",
        "Healthy Weight Gain", "No Specific Appearance Goal", "Need Dietitian Guidance",
      ],
    },
    {
      id: "q4", n: 5, tag: "core", type: "multi", max: 3, required: true,
      label: "Why is achieving this goal personally important to you?",
      options: [
        "Better confidence", "Better appearance", "Better health", "Better fitness",
        "Better mobility", "Better quality of life", "Better sports performance",
        "Better energy", "Future disease prevention", "Family responsibility", "Wedding/Event",
        "Pregnancy planning", "Doctor advised", "Better relationship with food",
        "Sustainable lifestyle", "Other",
      ],
      why: "The deeper reason is what coaching messages are written from when motivation drops.",
    },
    {
      id: "q7", n: 6, tag: "core", type: "single",
      label: "Do you have a target date or specific timeline for achieving your goal?",
      options: [
        "No Deadline", "Flexible Goal", "Wedding", "Competition", "Sports Event", "Birthday",
        "Holiday", "Medical Follow-up", "Pregnancy Timeline", "Other",
      ],
    },
    {
      id: "q7a", n: 6, tag: "conditional", type: "date", label: "Target date",
      showIf: (a) => answered(a, "q7") && !is(a, "q7", "No Deadline"),
    },
    {
      id: "q7b", n: 6, tag: "conditional", type: "single", label: "Priority",
      options: ["Flexible", "Important", "Fixed"],
      showIf: (a) => answered(a, "q7") && !is(a, "q7", "No Deadline"),
    },
  ],
};

// ---------------------------------------------------------------------------
// STAGE 2 — BODY PROFILE & TRANSFORMATION HISTORY (Q7–Q11)
// ---------------------------------------------------------------------------

const V3_S2: Section = {
  id: "history",
  code: "2",
  title: "Body profile & transformation history",
  stage: "Goals",
  minutes: "8–10 min",
  questions: [
    { id: "q9_height", n: 7, tag: "core", type: "number", label: "Height (cm)", required: true },
    { id: "q9_weight", n: 7, tag: "core", type: "number", label: "Current weight (kg)", required: true },
    {
      id: "q9_weight_high", n: 7, tag: "core", type: "number", label: "Highest adult weight (kg)",
      note: "Leave blank if unknown.",
    },
    {
      id: "q9_weight_low", n: 7, tag: "core", type: "number", label: "Lowest adult weight (kg)",
      note: "Leave blank if unknown.",
    },
    {
      id: "q9_weight_comfort", n: 7, tag: "core", type: "number",
      label: "Comfortable / preferred weight (kg)",
      note: "Leave blank if the client has never identified one.",
      why: "A weight the client has actually held before is a more defensible target than a round number.",
    },
    {
      id: "q9_weight_1y", n: 7, tag: "core", type: "number", label: "Weight one year ago (kg)",
      note: "Leave blank if unknown.",
    },
    {
      id: "q10", n: 8, tag: "core", type: "multi", required: true,
      label: "How has your weight and body shape changed during the last one year?",
      options: [
        "Gradual Weight Gain", "Rapid Weight Gain", "Gradual Weight Loss", "Rapid Weight Loss",
        "Stable Weight", "Frequent Fluctuations", "Fat Gain", "Muscle Loss",
        "Stable Weight but Body Shape Changed", "Not Sure",
      ],
    },
    {
      id: "q10a", n: 8, tag: "conditional", type: "number", label: "Approximate weight change (kg)",
      showIf: (a) => hasOther(a, "q10", ["Stable Weight", "Not Sure"]),
    },
    {
      id: "q10b", n: 8, tag: "conditional", type: "single", label: "Time period",
      // Kept as bands rather than v3.0's free text: the trajectory arithmetic
      // downstream needs a period it can compare, and a typed phrase is not.
      options: [
        "Less than 1 month", "1–3 months", "3–6 months", "6–12 months", "1–2 years",
        "More than 2 years", "Not sure",
      ],
      showIf: (a) => hasOther(a, "q10", ["Stable Weight", "Not Sure"]),
    },
    {
      id: "q10c", n: 8, tag: "conditional", type: "text", label: "Major body-shape changes",
      placeholder: "e.g. waist up two sizes, arms visibly thinner",
      showIf: (a) => hasOther(a, "q10", ["Not Sure"]),
    },
    {
      id: "q11", n: 9, tag: "core", type: "multi", max: 5,
      label: "What do you feel contributed the most to these changes?",
      options: [
        "Job/Lifestyle Change", "Sedentary Lifestyle", "Exercise Stopped", "Exercise Increased",
        "Injury", "Illness", "Surgery", "Medication", "Pregnancy/Postpartum",
        "Hormonal Changes", "Menopause/Perimenopause", "Stress", "Poor Sleep",
        "Emotional Eating", "Outside Food", "Alcohol", "Travel", "Meal Skipping",
        "Restrictive Dieting", "Low Appetite", "Increased Appetite", "No Clear Reason", "Other",
      ],
    },
    {
      id: "q12", n: 10, tag: "core", type: "multi", required: true,
      label:
        "What weight-loss, weight-gain, fitness or nutrition approaches have you tried previously, and what happened?",
      options: [
        "Calorie Counting", "Dietitian Plan", "Gym", "Personal Trainer", "Intermittent Fasting",
        "Keto", "Low Carb", "Meal Skipping", "Portion Control", "Home Workouts", "Running",
        "Weight-Management Medicines", "Supplements", "Commercial Program", "Self-Planned Diet",
        "Never Tried", "Other",
      ],
    },
    {
      id: "q12c", n: 10, tag: "conditional", type: "textarea",
      label: "For each significant attempt — approach, duration, approximate weight/body change",
      placeholder: "e.g. keto — 3 months, −7 kg; gym + self-planned diet — 6 weeks, no change",
      showIf: (a) => hasOther(a, "q12", ["Never Tried"]),
    },
    {
      id: "q12a", n: 10, tag: "conditional", type: "single", label: "Result",
      options: [
        "Successful and Maintained", "Successful but Regained", "Plateau", "Minimal Result",
        "No Result", "Gained Weight", "Could Not Continue",
      ],
      showIf: (a) => hasOther(a, "q12", ["Never Tried"]),
    },
    {
      id: "q12b", n: 10, tag: "conditional", type: "multi", max: 3,
      label: "Main reason for stopping",
      options: [
        "Hunger", "Cravings", "Restrictive Diet", "Family Food", "Work", "Travel",
        "Poor Results", "Low Motivation", "Cost", "Digestive Problems", "Cooking Difficulty",
        "Other",
      ],
      showIf: (a) => hasOther(a, "q12", ["Never Tried"]),
      why: "The reason it stopped last time is the failure mode this plan has to design around.",
    },
    {
      // Was the rapid-weight-loss follow-up (q13c). Same information, now hung off
      // the previous-attempts question because v3.0 has no separate rapid-loss
      // question — the id is kept so the answers already stored still read.
      id: "q13c", n: 10, tag: "clinical", type: "multi", label: "Problems experienced, if any",
      options: [
        "Hair Fall", "Weakness", "Constipation", "Dizziness", "Menstrual Changes", "Fatigue",
        "Poor Workout Performance", "Weight Regain", "None", "Other",
      ],
      showIf: (a) => hasOther(a, "q12", ["Never Tried"]),
      note: "Hair fall, menstrual changes or repeated weakness after a diet mean the previous deficit was too aggressive — stabilise before running another one.",
    },
    {
      id: "q16", n: 11, tag: "core", type: "multi",
      label:
        "Looking back, when were you healthiest or most consistent, and what helped you succeed?",
      options: [
        "Fixed Work Schedule", "Better Sleep", "Lower Stress", "Home-Cooked Food",
        "Regular Meals", "Family Support", "Workout Partner", "Gym Routine", "Walking",
        "Dietitian Support", "Personal Trainer", "Meal Preparation", "Less Travel",
        "Less Outside Food", "Better Motivation", "Weight Tracking", "Food Tracking",
        "Simpler Routine", "Never Had Such a Phase",
      ],
      why: "The client's own success pattern — rebuilding it is cheaper than inventing a new routine.",
    },
    {
      id: "q16a", n: 11, tag: "planning", type: "text",
      label: "Rank the top 3 success factors (in order)",
      placeholder: "e.g. 1) Meal preparation 2) Gym routine 3) Better sleep",
      note: RANK_NOTE,
      showIf: (a) => hasOther(a, "q16", ["Never Had Such a Phase"]),
    },
  ],
};

// ---------------------------------------------------------------------------
// STAGE 3 — BODY COMPOSITION & OBJECTIVE BASELINE (Q12–Q13)
//
// v3.0's Q13 re-lists weight, waist, hip, body fat, sleep, stress and fluids,
// all of which Q7, Q12, Q53, Q54 and Q55 already capture. Asking them twice
// would mean two storage keys for one fact and a second chance to disagree with
// the first, so the baseline block here only carries the fields nothing else
// owns; the rest is read back from the questions that own them.
// ---------------------------------------------------------------------------

const V3_S3: Section = {
  id: "baseline",
  code: "3",
  title: "Body composition & objective baseline",
  stage: "Clinical",
  minutes: "5–6 min",
  intro:
    "Baseline weight, waist, hip, body fat, sleep, stress and fluids come from Q7, Q12 and Stage 11 — they are not re-asked here. Everything future progress is judged against is fixed on this date.",
  questions: [
    {
      id: "q15", n: 12, tag: "fitness", type: "multi",
      label:
        "Do you have recent body-composition measurements, circumference measurements or progress photos?",
      // Ordered highest to lowest confidence on purpose: the list doubles as the
      // v3.0 data-quality hierarchy the dietitian reads off while asking.
      options: [
        "DEXA", "Clinical/Validated BIA", "Professional/Gym BIA", "Consumer Smart Scale",
        "Measuring Tape", "Progress Photos", "Visual Estimate", "None",
      ],
      note: "Tier 1 DEXA · Tier 2 validated clinical BIA · Tier 3 professional BIA · Tier 4 smart scale · Tier 5 circumferences · Tier 6 visual estimate.",
    },
    {
      id: "q15_date", n: 12, tag: "conditional", type: "date", label: "Date of measurement",
      showIf: (a) => hasOther(a, "q15", ["None"]),
    },
    {
      id: "q15_bf", n: 12, tag: "conditional", type: "number", label: "Body fat (%)",
      showIf: (a) => hasOther(a, "q15", ["None"]),
    },
    {
      id: "q15_muscle", n: 12, tag: "conditional", type: "number", label: "Muscle mass (kg)",
      showIf: (a) => hasOther(a, "q15", ["None"]),
    },
    {
      id: "q15_smm", n: 12, tag: "conditional", type: "number", label: "Skeletal muscle (kg)",
      showIf: (a) => hasOther(a, "q15", ["None"]),
    },
    {
      id: "q15_visceral", n: 12, tag: "conditional", type: "number", label: "Visceral fat",
      showIf: (a) => hasOther(a, "q15", ["None"]),
    },
    {
      id: "q15_waist", n: 12, tag: "conditional", type: "number",
      label: "Waist (cm — note the unit if inches)",
      showIf: (a) => hasOther(a, "q15", ["None"]),
    },
    {
      id: "q15_hip", n: 12, tag: "conditional", type: "number", label: "Hip",
      showIf: (a) => hasOther(a, "q15", ["None"]),
    },
    {
      id: "q15_chest", n: 12, tag: "conditional", type: "number", label: "Chest",
      showIf: (a) => hasOther(a, "q15", ["None"]),
    },
    {
      id: "q15_arm", n: 12, tag: "conditional", type: "number", label: "Arms",
      showIf: (a) => hasOther(a, "q15", ["None"]),
    },
    {
      id: "q15_thigh", n: 12, tag: "conditional", type: "number", label: "Thigh",
      showIf: (a) => hasOther(a, "q15", ["None"]),
    },
    {
      id: "q15_assess", n: 12, tag: "planning", type: "single",
      label: "Body-composition confidence",
      options: ["High Confidence", "Moderate Confidence", "Low Confidence", "Insufficient Data"],
      note: "Anything below High is a trend signal, not a number. A low-confidence body-fat or muscle figure must not set calorie targets or drive a clinical decision on its own.",
    },
    {
      id: "q15_src", n: 13, tag: "planning", type: "single", label: "Body-fat measurement source",
      options: [
        "DEXA", "Clinical/Validated BIA", "Professional/Gym BIA", "Consumer Smart Scale",
        "Measuring Tape", "Visual Estimate", "Unknown",
      ],
      showIf: (a) => answered(a, "q15_bf"),
    },
    {
      id: "q13_bf_conf", n: 13, tag: "planning", type: "single", label: "Body-fat confidence",
      options: ["High", "Moderate", "Low"],
      showIf: (a) => answered(a, "q15_bf"),
    },
    {
      id: "q54d", n: 13, tag: "core", type: "number", label: "Average daily steps",
      note: "Tracking source is recorded at Q38. Leave blank if the client has no step data at all.",
    },
    {
      id: "q13_meal_consistency", n: 13, tag: "planning", type: "scale10",
      label: "Current meal consistency (1–10)",
    },
    {
      id: "q13_protein_adequacy", n: 13, tag: "planning", type: "single",
      label: "Current protein adequacy",
      options: ["Low", "Moderate", "Good", "Unknown"],
      note: "A first impression only. The measured intake from the protein section is what the target is built from.",
    },
    { id: "q13_diet_quality", n: 13, tag: "planning", type: "scale10", label: "Current diet quality (1–10)" },
    {
      id: "q13_adherence", n: 13, tag: "planning", type: "scale10",
      label: "Self-rated current nutrition adherence (1–10)",
    },
    {
      id: "q13_date", n: 13, tag: "core", type: "date", label: "Baseline date", required: true,
      why: "Every future review compares against this date, so a plan generated without it has nothing to trend from.",
    },
    {
      id: "q13_completeness", n: 13, tag: "planning", type: "single", label: "Baseline completeness",
      options: ["Complete", "Sufficient", "Partially Complete", "Insufficient"],
    },
  ],
};

// ---------------------------------------------------------------------------
// STAGE 4 — MEDICAL, CLINICAL & SAFETY ASSESSMENT (Q14–Q21)
// ---------------------------------------------------------------------------

const V3_S4: Section = {
  id: "medical",
  code: "4",
  title: "Medical, clinical & safety assessment",
  stage: "Clinical",
  minutes: "10–12 min",
  intro:
    "Blood-report flow: report upload → AI extraction → Dietitian verification. Nothing in this stage is optional for safety, but nothing may be pushed either — record what the client volunteers.",
  questions: [
    {
      id: "q17", n: 14, tag: "clinical", type: "multi", required: true,
      label: "Have you ever been diagnosed with any medical condition?",
      // Grouped in the spec as Metabolic / Thyroid & Hormonal / Heart & Blood
      // Pressure / Liver / Kidney / Digestive / Blood & Nutritional / Bone &
      // Joint / Respiratory / Other; the schema has no group concept, so the
      // spec order is preserved instead and the grouping stays readable.
      options: [
        // Metabolic
        "Diabetes Type 1", "Diabetes Type 2", "Prediabetes", "Insulin Resistance", "Obesity",
        "Metabolic Syndrome",
        // Thyroid & hormonal
        "Hypothyroidism", "Hyperthyroidism", "Hashimoto's Thyroiditis", "Graves' Disease",
        "PCOS/PCOD", "Endometriosis", "Hormonal Imbalance", "Menopause", "Perimenopause",
        // Heart & blood pressure
        "Hypertension", "Low Blood Pressure", "High Cholesterol", "High Triglycerides",
        "Heart Disease", "Heart Failure", "Previous Heart Attack", "Arrhythmia",
        // Liver
        "Fatty Liver Grade I", "Fatty Liver Grade II", "Fatty Liver Grade III", "Hepatitis",
        "Other Liver Disease",
        // Kidney
        "Kidney Stones", "Chronic Kidney Disease", "High Uric Acid", "Gout",
        // Digestive
        "GERD", "Gastritis", "IBS", "IBD", "Crohn's Disease", "Ulcerative Colitis",
        "Celiac Disease", "Gallstones",
        // Blood & nutritional
        "Anaemia", "Iron Deficiency", "Vitamin D Deficiency", "Vitamin B12 Deficiency",
        "Folate Deficiency",
        // Bone & joint
        "Arthritis", "Osteoporosis", "Osteopenia",
        // Respiratory
        "Asthma", "Sleep Apnea",
        // Other
        "Autoimmune Disease", "Previous Cancer", "Current Cancer Treatment", "Other",
        NO_CONDITION_V3,
      ],
    },
    {
      id: "q17d", n: 14, tag: "clinical", type: "single", label: "When diagnosed",
      options: ["<6 months", "6–12 months", "1–3 years", ">3 years"],
      showIf: (a) => hasOther(a, "q17", [NO_CONDITION_V3]),
    },
    {
      id: "q17a", n: 14, tag: "clinical", type: "single", label: "Current status",
      options: ["Controlled", "Improving", "Stable", "Uncontrolled", "Under Investigation"],
      showIf: (a) => hasOther(a, "q17", [NO_CONDITION_V3]),
    },
    {
      id: "q17b", n: 14, tag: "clinical", type: "single", label: "Doctor follow-up",
      options: ["Regular", "Occasionally", "Not Required", "Never"],
      showIf: (a) => hasOther(a, "q17", [NO_CONDITION_V3]),
    },
    {
      id: "q17c", n: 14, tag: "clinical", type: "textarea",
      label: "Per-condition notes (which condition, since when, status, treating doctor)",
      placeholder: "e.g. Hypothyroidism since 2022 — controlled on 50 mcg; PCOS/PCOD — under investigation",
      showIf: (a) => hasOther(a, "q17", [NO_CONDITION_V3]),
      note: "The single status and follow-up answers above cover the client overall; use this when two conditions differ.",
    },
    {
      id: "q107", n: 15, tag: "clinical", type: "multi",
      label: "Is there any relevant family history of medical conditions?",
      options: [
        "Diabetes", "Thyroid Disease", "Obesity", "Hypertension", "High Cholesterol",
        "Heart Disease", "Stroke", "Kidney Disease", "Fatty Liver", "PCOS", "Cancer",
        "Autoimmune Disease", "None", "Don't Know",
      ],
      why: "First-degree family history raises the screening threshold even when the client's own reports are still normal.",
    },
    {
      id: "q107a", n: 15, tag: "conditional", type: "text", label: "Relationship",
      placeholder: "e.g. Father — diabetes; Mother — hypothyroidism",
      showIf: (a) => hasOther(a, "q107", ["None", "Don't Know"]),
    },
    {
      id: "q18", n: 16, tag: "clinical", type: "multi",
      label:
        "Have you undergone any significant surgery, hospitalization, serious injury or major medical event?",
      options: [
        "General Surgery", "Bariatric Surgery", "Orthopaedic Surgery", "Cardiac Surgery",
        "Women's Health Surgery", "Cancer Surgery", "Organ Surgery", "Major Hospitalization",
        "Accident", "Fracture", "Severe Infection", "Other", "None",
      ],
    },
    {
      id: "q18b", n: 16, tag: "conditional", type: "textarea", label: "Event and date/year",
      placeholder: "e.g. Gallbladder removal — 2019; ACL reconstruction — 2023",
      showIf: (a) => hasOther(a, "q18", ["None"]),
    },
    {
      id: "q18a", n: 16, tag: "conditional", type: "multi", label: "Current impact",
      options: [
        "No Impact", "Affects Eating", "Affects Digestion", "Affects Exercise",
        "Affects Mobility", "Chronic Pain", "Requires Medical Monitoring",
      ],
      showIf: (a) => hasOther(a, "q18", ["None"]),
    },
    {
      id: "q19", n: 17, tag: "clinical", type: "single", required: true,
      label: "Are you currently taking any medicines regularly?",
      options: ["Yes", "No"],
    },
    {
      id: "q19a", n: 17, tag: "clinical", type: "textarea", required: true,
      label: "For each medicine — name, reason, dose, timing, before/with/after food",
      placeholder: "e.g. Thyronorm 50 mcg — hypothyroidism, morning, empty stomach; Metformin 500 mg — after dinner",
      showIf: (a) => is(a, "q19", "Yes"),
      note: "Food-medicine timing is a hard constraint on meal timing, not a preference.",
    },
    {
      id: "q19b", n: 17, tag: "clinical", type: "single", label: "Recent changes",
      options: ["No", "Started recently", "Dose increased", "Dose reduced", "Medicine changed", "Not sure"],
      showIf: (a) => is(a, "q19", "Yes"),
      why: "A dose change in the last few weeks can explain weight, appetite or energy movement that would otherwise be blamed on diet.",
    },
    {
      id: "q20", n: 18, tag: "clinical", type: "multi", required: true,
      label: "Have you had relevant blood tests during the last 12 months?",
      options: [
        "CBC", "HbA1c", "Fasting Blood Sugar", "PP Blood Sugar", "Fasting Insulin",
        "Lipid Profile", "Liver Function", "Kidney Function", "Thyroid Profile", "Vitamin D",
        "Vitamin B12", "Iron Profile", "Ferritin", "Uric Acid", "Hormonal Profile", "Other",
      ],
    },
    {
      id: "q20c", n: 18, tag: "clinical", type: "single", label: "Report status",
      options: ["Reports Available", "Reports Not Available"],
      showIf: (a) => answered(a, "q20"),
    },
    {
      id: "q20b", n: 18, tag: "clinical", type: "textarea",
      label: "For relevant tests — test, date, result",
      placeholder: "e.g. HbA1c 6.1 (12 Mar); Vitamin D 14 ng/mL (12 Mar); TSH 8.2 (2 Jan)",
      showIf: (a) => is(a, "q20c", "Reports Available"),
    },
    {
      id: "q20a", n: 18, tag: "clinical", type: "single", label: "Status",
      options: ["Normal", "Abnormal", "Unsure"],
      showIf: (a) => is(a, "q20c", "Reports Available"),
    },
    {
      id: "q20d", n: 18, tag: "clinical", type: "multi", label: "Action",
      options: ["Upload Report", "AI Extract Report", "Dietitian Verification"],
      showIf: (a) => is(a, "q20c", "Reports Available"),
      note: "An AI-extracted value is not verified data until a dietitian has confirmed it.",
    },
    {
      id: "q21", n: 19, tag: "clinical", type: "multi", required: true,
      label: "Are you currently experiencing any symptoms that concern you?",
      options: [
        "Chest Pain", "Breathlessness", "Palpitations", "Severe Fatigue", "Frequent Dizziness",
        "Swelling in Legs", "Black Stool", "Blood in Stool", "Repeated Vomiting",
        "Rapid Unexplained Weight Loss", "Severe Headache During Exercise", "Fainting", "None",
        "Other",
      ],
      note: "Anything other than None is a stop-and-check, not a note for later.",
    },
    {
      id: "q21c", n: 19, tag: "clinical", type: "single", label: "Dietitian safety decision",
      options: [
        "Continue Normally", "Clinical Dietitian Review", "Doctor Clearance Recommended",
        "SOP Escalation Required",
      ],
      showIf: (a) => hasOther(a, "q21", ["None"]),
    },
    {
      id: "q22", n: 20, tag: "clinical", type: "multi", required: true,
      label: "Has any doctor advised specific dietary or exercise restrictions?",
      options: [
        "Low Salt", "Fluid Restriction", "Protein Restriction", "Potassium Restriction",
        "Purine Restriction", "Gluten Free", "Lactose Free", "Low Fat", "Low Sugar",
        "Food-Medicine Timing", "Exercise Restriction", "Avoid Heavy Lifting", "Other",
        "No Restrictions",
      ],
      note: "A doctor's instruction overrides every other planning decision, including the client's own preferences.",
    },
    {
      id: "q22a", n: 20, tag: "clinical", type: "textarea", label: "Instruction details",
      placeholder: "e.g. fluid restricted to 1.5 L/day; protein max 0.8 g/kg per nephrologist; no high-intensity cardio",
      showIf: (a) => hasOther(a, "q22", ["No Restrictions"]),
    },
    {
      // No longer gated on gender: v3.0 puts low testosterone and fertility
      // treatment in the same list, so the question is asked wherever it is
      // clinically relevant rather than only of female clients.
      id: "q66", n: 21, tag: "clinical", type: "multi",
      label:
        "Are there hormonal or reproductive-health factors that may affect your nutrition journey?",
      options: [
        "Regular Cycle", "Irregular Periods", "Missed Periods", "Heavy Bleeding", "Severe Pain",
        "PCOS", "Endometriosis", "Trying to Conceive", "Pregnant", "Breastfeeding", "Postpartum",
        "Perimenopause", "Menopause", "Low Testosterone Diagnosed", "Fertility Treatment",
        "None", "Prefer Not to Answer", "Not Applicable",
      ],
      note: "Never push for an answer here. Pregnancy and breastfeeding stop any deficit-led plan outright.",
    },
  ],
};

// ---------------------------------------------------------------------------
// STAGE 5 — DIGESTION, ALLERGIES & FOOD TOLERANCE (Q22–Q23)
//
// v3.0's Q23 is one question covering allergy, intolerance and digestive
// trigger. It stays split across q27 (allergen — never appears in any meal) and
// q26 (trigger food — reduced or timed differently), because the plan treats the
// two completely differently and a single merged list would flatten that.
// ---------------------------------------------------------------------------

const V3_S5: Section = {
  id: "digestion",
  code: "5",
  title: "Digestion, allergies & food tolerance",
  stage: "Clinical",
  minutes: "5–6 min",
  questions: [
    {
      id: "q23", n: 22, tag: "core", type: "single", required: true,
      label: "How would you describe your digestion overall?",
      options: [
        "Excellent", "Mostly Comfortable", "Occasionally Uncomfortable",
        "Frequently Uncomfortable", "Daily Digestive Problems", "Severe Digestive Issues",
        "Not Sure",
      ],
    },
    {
      id: "q24", n: 22, tag: "clinical", type: "multi", label: "Digestive symptoms",
      options: [
        "Bloating", "Gas", "Acidity", "Heartburn", "Acid Reflux", "Constipation",
        "Loose Motions", "Alternating Bowel Pattern", "Stomach Pain", "Cramps", "Nausea",
        "Vomiting", "Early Fullness", "Excessive Burping", "None", "Other",
      ],
    },
    {
      id: "q24a", n: 22, tag: "conditional", type: "single", label: "Frequency of the main symptom",
      options: ["Rare", "1–2 times per week", "3–5 times per week", "Daily", "Multiple times daily"],
      showIf: (a) => hasOther(a, "q24", ["None"]),
    },
    {
      id: "q24b", n: 22, tag: "conditional", type: "multi", label: "Timing",
      options: [
        "Morning", "After breakfast", "After lunch", "Evening", "After dinner", "Night",
        "After specific foods", "During stress", "Around training", "Random",
      ],
      showIf: (a) => hasOther(a, "q24", ["None"]),
    },
    {
      id: "q24c", n: 22, tag: "conditional", type: "scale10", label: "Severity (1–10)",
      showIf: (a) => hasOther(a, "q24", ["None"]),
    },
    {
      id: "q24d", n: 22, tag: "conditional", type: "text", label: "Food association",
      placeholder: "e.g. worse after dal and rajma; fine on plain khichdi days",
      showIf: (a) => hasOther(a, "q24", ["None"]),
      why: "A symptom tied to a food is a plan constraint; a symptom tied to nothing is a monitoring item.",
    },
    {
      id: "q25", n: 22, tag: "core", type: "single", required: true, label: "Bowel frequency",
      options: [
        "More than 3 times daily", "2–3 times daily", "Once daily", "Once every 2 days",
        "Less than 3 times weekly", "Highly irregular", "Prefer not to answer",
      ],
    },
    {
      // Was a multi-select of stool experience. v3.0 asks for one consistency, so
      // pain and incomplete emptying become their own yes/no fields rather than
      // options buried in a list.
      id: "q25a", n: 22, tag: "clinical", type: "single", label: "Consistency",
      options: ["Normal", "Hard", "Loose", "Mixed"],
    },
    {
      id: "q25b", n: 22, tag: "clinical", type: "single", label: "Pain",
      options: ["Yes", "No"],
    },
    {
      id: "q25c", n: 22, tag: "clinical", type: "single", label: "Incomplete emptying",
      options: ["Yes", "No"],
    },
    {
      id: "q108", n: 23, tag: "clinical", type: "multi",
      label: "How would you classify each food that you cannot eat or that causes symptoms?",
      options: [
        "Medically Diagnosed Allergy", "Suspected Allergy", "Food Intolerance",
        "Digestive Trigger", "Other Reaction",
      ],
      why: "A diagnosed allergy is a zero-tolerance exclusion; an intolerance is a dose and timing decision. Recording which is which stops the plan over-restricting.",
    },
    {
      id: "q27", n: 23, tag: "clinical", type: "multi", required: true,
      label: "Do you have any known food allergy?",
      // v3.0 leaves the allergen list free text. The named major allergens are
      // kept because an allergen typed as free text is one spelling away from
      // not matching anything the plan checks against.
      options: [
        "No known allergy", "Milk", "Egg", "Peanut", "Tree nuts", "Wheat", "Soy", "Fish",
        "Shellfish", "Sesame", "Other",
      ],
      note: "An allergen must never appear in any meal, in any form or preparation.",
    },
    {
      id: "q27a", n: 23, tag: "clinical", type: "single", label: "Reaction severity",
      options: ["Mild", "Moderate", "Severe", "Previous emergency reaction", "Unknown"],
      showIf: (a) => hasOther(a, "q27", ["No known allergy"]),
    },
    {
      id: "q27b", n: 23, tag: "clinical", type: "single", label: "Professionally diagnosed?",
      options: ["Yes", "No", "Not sure"],
      showIf: (a) => hasOther(a, "q27", ["No known allergy"]),
    },
    {
      id: "q27c", n: 23, tag: "conditional", type: "text", label: "Other allergen",
      showIf: (a) => has(a, "q27", "Other"),
    },
    {
      id: "q26", n: 23, tag: "clinical", type: "multi",
      label: "Are there other foods that repeatedly cause symptoms?",
      options: [
        "Milk", "Curd", "Paneer", "Wheat or gluten foods", "Fried food", "High-fat food",
        "Spicy food", "Onion", "Garlic", "Dal", "Chickpeas", "Rajma or beans", "Soy", "Eggs",
        "Seafood", "Nuts", "Artificial sweeteners", "Protein powder",
        "No repeated discomfort", "Other",
      ],
      note: "Allergies belong in the previous question — this is intolerance and digestive-trigger territory.",
    },
    {
      id: "q26a", n: 23, tag: "conditional", type: "multi", label: "Reaction / symptoms",
      options: [
        "Bloating", "Gas", "Acidity", "Reflux", "Pain", "Nausea", "Loose stools",
        "Constipation", "Skin reaction", "Other",
      ],
      showIf: (a) => hasOther(a, "q26", ["No repeated discomfort"]),
    },
    {
      id: "q26d", n: 23, tag: "conditional", type: "single", label: "Frequency of the reaction",
      options: ["Rare", "1–2 times per week", "3–5 times per week", "Daily", "Multiple times daily"],
      showIf: (a) => hasOther(a, "q26", ["No repeated discomfort"]),
    },
    {
      id: "q26b", n: 23, tag: "conditional", type: "single", label: "Reproducibility",
      options: ["Almost every time", "Often", "Sometimes", "Client is unsure"],
      showIf: (a) => hasOther(a, "q26", ["No repeated discomfort"]),
      why: "A food that reacts almost every time is excluded; one that reacts sometimes is retested with a smaller portion.",
    },
    {
      id: "q26c", n: 23, tag: "conditional", type: "text", label: "Other trigger foods",
      showIf: (a) => has(a, "q26", "Other"),
    },
  ],
};

// ---------------------------------------------------------------------------
// STAGE 6 — DETAILED DIETARY INTAKE & HABITUAL FOOD PATTERN (Q24–Q29)
//
// Occasion keys are kept from the current bank wherever the occasion survived,
// so the per-occasion answer keys (q28_lunch_food and friends) keep pointing at
// the same meal. Only the display labels follow v3.0.
// ---------------------------------------------------------------------------

export const V3_MEAL_OCCASIONS: { key: string; label: string }[] = [
  { key: "wake", label: "Wake-up Drinks" },
  { key: "breakfast", label: "Breakfast" },
  { key: "midmorning", label: "Mid-Morning" },
  { key: "lunch", label: "Lunch" },
  { key: "afternoon", label: "Afternoon" },
  { key: "evening", label: "Evening" },
  { key: "preworkout", label: "Pre-Workout" },
  { key: "duringworkout", label: "During Workout" },
  { key: "postworkout", label: "Post-Workout" },
  { key: "dinner", label: "Dinner" },
  { key: "afterdinner", label: "After Dinner" },
  // Keeps the `beforesleep` key so the bedtime projection still resolves.
  { key: "beforesleep", label: "Late-Night Food" },
  { key: "beverages", label: "Beverages" },
  { key: "snacks", label: "Snacks" },
  { key: "tasting", label: "Tasting While Cooking" },
  { key: "smallbites", label: "Small Bites" },
  { key: "alcohol", label: "Alcohol" },
];

const PREPARATION = [
  "Raw", "Boiled", "Steamed", "Grilled", "Roasted", "Air fried", "Shallow fried",
  "Deep fried", "Curry", "Dry preparation", "Baked", "Mixed preparation", "Unknown",
];
const FOOD_SOURCE = [
  "Home", "Office or canteen", "Restaurant", "Delivery", "Tiffin", "Hostel or PG",
  "Packaged", "Other",
];
const EXTRA_COMPONENTS = [
  "Oil", "Ghee", "Butter", "Sugar", "Milk", "Sauce", "Dressing", "Chutney", "Pickle", "None",
];

function v3MealTimelineQuestions(): Question[] {
  const out: Question[] = [];
  for (const { key, label } of V3_MEAL_OCCASIONS) {
    const show = (a: Answers) => has(a, "q28", label);
    out.push(
      {
        id: `q28_${key}_time`, n: 24, tag: "conditional", type: "time",
        label: `${label} — exact or approximate time`, showIf: show,
      },
      {
        id: `q28_${key}_food`, n: 24, tag: "conditional", type: "textarea", required: true,
        label: `${label} — food/drink with quantity`,
        placeholder: "e.g. 2 rotis + dal 1 katori + salad · tea with 1 tsp sugar",
        probe: "Hunger before the meal, if useful.",
        showIf: show,
      },
      {
        id: `q28_${key}_prep`, n: 24, tag: "conditional", type: "multi",
        label: `${label} — cooking method`, options: PREPARATION, showIf: show,
      },
      {
        // Doubles as v3.0's "Location" — where the food came from and where it
        // was eaten are the same answer for almost every occasion.
        id: `q28_${key}_source`, n: 24, tag: "conditional", type: "single",
        label: `${label} — food source`, options: FOOD_SOURCE, showIf: show,
      },
      {
        id: `q28_${key}_extras`, n: 24, tag: "conditional", type: "multi",
        label: `${label} — added oil/ghee, sugar, sauces & condiments`,
        options: EXTRA_COMPONENTS, showIf: show,
      },
      {
        id: `q28_${key}_beverage`, n: 24, tag: "conditional", type: "text",
        label: `${label} — beverage`,
        placeholder: "e.g. tea with 1 tsp sugar; buttermilk; water only",
        showIf: show,
      },
      {
        id: `q28_${key}_unplanned`, n: 24, tag: "conditional", type: "single",
        label: `${label} — planned or unplanned?`,
        options: ["Planned", "Unplanned", "Partly unplanned"],
        showIf: show,
      }
    );
  }
  return out;
}

const V3_S6: Section = {
  id: "foodday",
  code: "6",
  title: "Detailed dietary intake & habitual food pattern",
  stage: "Diet",
  minutes: "14–16 min",
  intro:
    "Q24 is yesterday, occasion by occasion, waking to sleeping. Q25 is what a normal week looks like. Both are needed — one recalled day is not habitual intake and must not be treated as the client's usual calories.",
  questions: [
    {
      id: "q28", n: 24, tag: "core", type: "multi", required: true,
      label: "Eating occasions during the previous complete day",
      options: V3_MEAL_OCCASIONS.map((o) => o.label),
      note: "Include tasting while cooking, small bites and anything drunk — these are the occasions clients leave out unless asked by name.",
    },
    ...v3MealTimelineQuestions(),
    {
      id: "q109", n: 25, tag: "core", type: "textarea", required: true,
      label: "Now describe what you normally eat on a typical weekday, meal by meal",
      placeholder:
        "Per usual meal: time · food · typical quantity · preparation · source · how many days a week.",
      why: "The recall says what happened yesterday; this says what happens most days, and the calorie estimate is built from this one.",
    },
    {
      id: "q109a", n: 25, tag: "core", type: "multi",
      label: "Which meals are usually skipped, delayed or replaced?",
      options: [
        "Breakfast usually skipped", "Breakfast usually delayed", "Breakfast usually replaced",
        "Mid-morning usually skipped", "Lunch usually skipped", "Lunch usually delayed",
        "Lunch usually replaced", "Evening snack usually skipped", "Dinner usually skipped",
        "Dinner usually delayed", "Dinner usually replaced", "No meal is regularly missed",
      ],
    },
    {
      id: "q30", n: 26, tag: "core", type: "multi",
      label: "How does your eating and activity usually change on weekends or holidays?",
      options: [
        "Wake-up Time", "Breakfast", "Meal Timing", "Portion Sizes", "Number of Meals",
        "Outside Food", "Restaurant/Delivery", "Snacks", "Sweets", "Alcohol",
        "Late-Night Eating", "Protein Intake", "Total Activity",
      ],
      note: "Select what differs from a weekday, then describe the direction of each change while asking.",
    },
    {
      id: "q30a", n: 26, tag: "planning", type: "single", label: "Weekend difference",
      options: ["No Meaningful Difference", "Mild Difference", "Moderate Difference", "Major Difference"],
    },
    {
      id: "q30b", n: 26, tag: "planning", type: "single", label: "Potential weekend calorie impact",
      options: ["Lower", "Similar", "Moderately Higher", "Significantly Higher", "Unable to Estimate"],
      why: "Two heavy weekend days can erase a whole week's deficit — the weekend has to be planned, not ignored.",
    },
    {
      id: "q29", n: 27, tag: "core", type: "single", required: true,
      label: "How consistent is this eating pattern from week to week?",
      options: [
        "Very Consistent", "Weekdays Are Usually Consistent", "Weekends Are Significantly Different",
        "Intake Changes Every Day", "Work Schedule Changes My Food",
        "Travel Frequently Changes My Food", "I Eat Differently When Stressed",
        "I Eat Differently Around Workouts", "No Consistent Pattern",
      ],
    },
    {
      id: "q29a", n: 27, tag: "planning", type: "single", label: "Habitual intake confidence",
      options: ["High", "Moderate", "Low", "Additional Dietary Recall Required"],
      note: "Estimate calories from the habitual pattern and several data points. One reported day on its own does not support a calorie target.",
    },
    {
      id: "q110", n: 28, tag: "core", type: "multi",
      label: "What cooking fats and additions are commonly used in your household?",
      options: [
        "Ghee", "Butter", "Oil", "Cheese", "Mayonnaise", "Sauces", "Chutney", "Pickle", "Sugar",
        "Honey", "Jaggery", "Cream", "None",
      ],
      why: "Household cooking fat is the single biggest hidden calorie source in an Indian kitchen and never appears in a food recall.",
    },
    {
      id: "q110a", n: 28, tag: "conditional", type: "textarea",
      label: "Frequency and approximate quantity of the selected items",
      placeholder: "e.g. ghee 1 tsp per roti, daily; pickle most lunches; cream in weekend gravies",
      showIf: (a) => hasOther(a, "q110", ["None"]),
    },
    { id: "q110b", n: 28, tag: "core", type: "text", label: "Cooking oil type", placeholder: "e.g. mustard, refined sunflower, ghee" },
    {
      id: "q110c", n: 28, tag: "core", type: "text", label: "Approximate household oil usage",
      placeholder: "e.g. 5 litre tin per month",
    },
    { id: "q110d", n: 28, tag: "core", type: "number", label: "Number of people sharing food" },
    {
      id: "q110e", n: 28, tag: "planning", type: "text", label: "Estimated per-person oil usage",
      placeholder: "e.g. ~28 ml/day",
      note: "Household tin ÷ people ÷ days. Rough, but far closer than asking the client how much oil they eat.",
    },
    {
      id: "q110f", n: 28, tag: "core", type: "single", label: "Salt type",
      options: ["Iodized", "Himalayan Pink", "Rock", "Black", "Low Sodium", "Mixed", "Other"],
    },
    {
      id: "q110g", n: 28, tag: "core", type: "multi", label: "Flour types used regularly",
      options: [
        "Wheat", "Multigrain", "Ragi", "Bajra", "Jowar", "Maize", "Oats", "Mixed Millet",
        "Gluten-Free", "Other",
      ],
    },
    {
      id: "q31", n: 29, tag: "core", type: "single", required: true,
      label: "How often do you eat food prepared outside your home?",
      options: [
        "More than once daily", "Daily", "4–6 times weekly", "2–3 times weekly", "Once weekly",
        "1–3 times monthly", "Rarely",
      ],
    },
    {
      id: "q31a", n: 29, tag: "conditional", type: "multi", label: "Main sources",
      options: [
        "Restaurant", "Delivery", "Office or canteen", "College", "Hotel",
        "Business or client meals", "Family meals", "Street food", "Travel food",
      ],
      showIf: (a) => answered(a, "q31") && !is(a, "q31", "Rarely"),
    },
    {
      id: "q31b", n: 29, tag: "conditional", type: "textarea", label: "Typical orders and portions",
      placeholder: "e.g. butter chicken + 2 naan; masala dosa; chicken biryani full plate",
      showIf: (a) => answered(a, "q31") && !is(a, "q31", "Rarely"),
    },
    {
      id: "q32", n: 29, tag: "core", type: "multi", required: true,
      label: "Which snacks, beverages, sweets or unplanned eating are part of your routine?",
      options: [
        "Tea", "Coffee", "Added sugar", "Milk beverages", "Juice", "Soft drinks",
        "Diet soft drinks", "Energy drinks", "Biscuits", "Namkeen", "Chips", "Nuts or seeds",
        "Sweets or mithai", "Chocolate", "Desserts", "Sauces", "Dressings", "Pickle", "Chutney",
        "Office snacks", "Food from colleagues or friends", "Tasting while cooking",
        "Children's leftovers", "Late-night bites", "Nothing significant", "Other",
      ],
      why: "Hidden intake — usually where the unexplained calorie gap actually is.",
    },
    {
      id: "q32a", n: 29, tag: "conditional", type: "textarea",
      label: "For each item — frequency, quantity, timing, main source, weekday vs weekend",
      placeholder: "e.g. tea x3/day with 1 tsp sugar; biscuits 4–5 with evening tea; sweets only on weekends",
      showIf: (a) => hasOther(a, "q32", ["Nothing significant"]),
    },
  ],
};

// ---------------------------------------------------------------------------
// STAGE 7 — FOOD PREFERENCES, CULTURAL HABITS & HOUSEHOLD FEASIBILITY (Q30–Q35)
//
// v3.0's Q30 also asks the food pattern (vegetarian / eggetarian / …). That is
// q33 in the protein section, which stays untouched — the protein food list is
// built from it, so it is asked there and not repeated here.
// ---------------------------------------------------------------------------

const V3_S7: Section = {
  id: "preferences",
  code: "7",
  title: "Food preferences, cultural habits & household feasibility",
  stage: "Diet",
  minutes: "8–10 min",
  intro:
    "Household food first: the plan improves what is already cooked at home rather than introducing a second kitchen. Food pattern is recorded with the protein questions.",
  questions: [
    {
      id: "q34", n: 30, tag: "core", type: "multi", max: 3, required: true,
      label: "What cuisine does your household normally follow?",
      options: [
        "North Indian", "Punjabi", "Gujarati", "Rajasthani", "Maharashtrian", "Bengali",
        "Bihari or Jharkhand", "South Indian", "Kerala-style", "Tamil", "Telugu", "Karnataka",
        "North-East Indian", "Kashmiri", "Indian mixed", "Middle Eastern", "Mediterranean",
        "East Asian", "South-East Asian", "European or Western", "African", "Latin American",
        "Mixed or international", "Other",
      ],
    },
    {
      id: "q34c", n: 30, tag: "planning", type: "multi", label: "Regular staple foods",
      options: [
        "Roti", "Rice", "Paratha", "Bread", "Oats", "Poha", "Upma", "Idli", "Dosa", "Millet",
        "Pasta", "Noodles", "Potato", "Other",
      ],
      why: "Staples anchor the plan — they are portioned and improved, not replaced.",
    },
    {
      id: "q34f", n: 30, tag: "planning", type: "textarea", label: "Frequency of major staples",
      placeholder: "e.g. roti twice daily (3–4 each time); rice at lunch only; poha 2 mornings a week",
    },
    {
      id: "q38", n: 30, tag: "clinical", type: "multi", required: true,
      label: "Cultural or religious food practices",
      options: [
        "No restriction", "Vegetarian household", "Vegan preference", "Jain restrictions",
        "Halal", "Kosher", "No beef", "No pork", "No egg",
        "No non-vegetarian food on selected days", "Fasting practice",
        "Separate cooking not allowed", "Ethical or environmental restriction",
        "Prefer not to answer", "Other",
      ],
    },
    {
      id: "q38a", n: 30, tag: "conditional", type: "multi", label: "On which days?",
      options: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"],
      showIf: (a) =>
        has(a, "q38", "No non-vegetarian food on selected days") || has(a, "q38", "Fasting practice"),
    },
    {
      id: "q38b", n: 30, tag: "conditional", type: "multi", label: "What is avoided on those days?",
      options: [
        "Non-vegetarian food", "Eggs", "Onion & garlic", "All animal products",
        "Specific grains (fasting)", "Other",
      ],
      showIf: (a) =>
        has(a, "q38", "No non-vegetarian food on selected days") || has(a, "q38", "Fasting practice"),
    },
    {
      id: "q38c", n: 30, tag: "conditional", type: "text", label: "Day-rule details",
      placeholder: "e.g. Tuesdays & Thursdays — no non-veg or eggs; Navratri fasts",
      showIf: (a) =>
        has(a, "q38", "No non-vegetarian food on selected days") || has(a, "q38", "Fasting practice"),
      note: "These day rules are enforced per weekday in the generated plan, so vague answers produce wrong days.",
    },
    {
      id: "q35", n: 31, tag: "planning", type: "textarea", required: true,
      label: "Which foods do you genuinely enjoy and want to keep? (up to 15, top 5 first)",
      placeholder: "e.g. rajma chawal, paneer bhurji, masala dosa, filter coffee, fruit chaat …",
      why: "Favourite foods are retained wherever clinically possible — a plan that deletes all of them is abandoned in week two.",
      note: RANK_NOTE,
    },
    {
      id: "q36", n: 32, tag: "planning", type: "textarea",
      label: "Which foods do you dislike, avoid or never want included?",
      placeholder: "e.g. lauki, karela, tinda",
      note: "Allergies and intolerances belong in Stage 5 — do not repeat them here.",
    },
    {
      id: "q36a", n: 32, tag: "conditional", type: "single", label: "Classify",
      options: [
        "Mild Dislike", "Strong Dislike", "Never Eat", "Religious Restriction",
        "Ethical Restriction",
      ],
      showIf: (a) => answered(a, "q36"),
    },
    {
      id: "q37", n: 33, tag: "planning", type: "multi", max: 5, required: true,
      label: "Which foods or eating habits are non-negotiable for you? (rank top 5)",
      options: [
        "Tea", "Coffee", "Rice", "Roti", "Bread", "Milk", "Sweets or dessert", "Chocolate",
        "Weekend restaurant meal", "Social meal", "Traditional household food",
        "Current breakfast", "Evening snack", "Late dinner due to routine",
        "No strong non-negotiable", "Other",
      ],
      note: RANK_NOTE,
      why: "Non-negotiables stay in the plan. The meal around them is improved; they are not deleted.",
    },
    {
      id: "q39", n: 34, tag: "core", type: "multi", required: true,
      label: "Who is the primary meal preparer in your household?",
      options: [
        "Self", "Spouse or partner", "Parent or family", "Cook or helper", "PG or hostel kitchen",
        "Office or canteen", "Tiffin service", "Restaurant or delivery", "Varies",
      ],
    },
    {
      id: "q39a", n: 34, tag: "planning", type: "single", label: "Control over food choices",
      options: ["High", "Moderate", "Low"],
    },
    {
      id: "q39b", n: 34, tag: "planning", type: "single", label: "Ability to request modifications",
      options: ["Yes", "Sometimes", "No"],
      why: "Low control plus no ability to request changes means the plan must work with the food already being cooked.",
    },
    {
      id: "q39c", n: 34, tag: "planning", type: "text", label: "Relevant household limitations",
      placeholder: "e.g. one common gravy for six people; cook leaves by 8 AM",
    },
    {
      id: "q40", n: 35, tag: "core", type: "multi", label: "Facilities available",
      options: [
        "Full Kitchen", "Basic Kitchen", "Refrigerator", "Freezer", "Microwave",
        "Office Refrigerator", "Office Microwave", "Meal Carrying Capability", "Other",
      ],
    },
    {
      id: "q41", n: 35, tag: "planning", type: "multi", required: true,
      label: "Realistic meal preparation",
      options: [
        "Daily Cooking", "Simple Cooking", "Batch Cooking", "Weekly Prep", "Family Help",
        "Very Limited", "No Extra Cooking", "Max 5 Minutes", "Max 10–15 Minutes",
        "Max 30 Minutes",
      ],
      why: "Everything the plan asks the client to cook has to fit inside this answer, or it will not be cooked.",
    },
  ],
};

// ---------------------------------------------------------------------------
// STAGE 8 — DAILY ACTIVITY & ENHANCED NEAT ASSESSMENT (Q36–Q39)
//
// Almost all new. The current bank had one activity dropdown and a step count;
// v3.0 wants sitting, standing, occupation, commute, household movement and the
// weekday/weekend split, because two clients with the same step count can differ
// by several hundred calories a day on everything else.
// ---------------------------------------------------------------------------

const V3_S8: Section = {
  id: "neat",
  code: "8",
  title: "Daily activity & NEAT",
  stage: "Lifestyle",
  minutes: "5–6 min",
  questions: [
    {
      id: "q54c", n: 36, tag: "core", type: "single", required: true,
      label: "Outside planned exercise, how active are you during a normal day?",
      options: ["Mostly seated", "Lightly active", "Moderately active", "Active", "Highly physical"],
    },
    {
      id: "q111", n: 36, tag: "core", type: "single", label: "Sitting time",
      options: ["<4 Hours", "4–6 Hours", "6–8 Hours", "8–10 Hours", ">10 Hours", "Variable", "Don't Know"],
    },
    {
      id: "q111a", n: 36, tag: "core", type: "single", label: "Standing or moving time",
      options: ["<1 Hour", "1–2 Hours", "2–4 Hours", "4–6 Hours", ">6 Hours", "Variable"],
    },
    {
      id: "q111b", n: 36, tag: "core", type: "text", label: "Occupational movement",
      placeholder: "e.g. shop floor rounds twice a day; site visits 3 days a week",
    },
    {
      id: "q111c", n: 36, tag: "core", type: "text", label: "Household movement",
      placeholder: "e.g. cooking and cleaning for five, school runs on foot",
    },
    {
      id: "q111d", n: 36, tag: "core", type: "text", label: "Other routine movement",
      placeholder: "e.g. evening walk with the dog, stairs to a 4th-floor flat",
    },
    {
      id: "q54e", n: 37, tag: "core", type: "single", label: "Usual commute pattern",
      options: ["Work From Home", "Walking", "Cycling", "Public Transport", "Car", "Two-Wheeler", "Mixed"],
    },
    {
      id: "q54g", n: 37, tag: "core", type: "text", label: "Total daily commute",
      placeholder: "e.g. 80 minutes each way",
    },
    {
      id: "q54h", n: 37, tag: "core", type: "single", label: "Walking involved",
      options: ["Minimal", "<15 Minutes", "15–30 Minutes", "30–60 Minutes", ">60 Minutes"],
      why: "Commute walking is often the only movement a desk-based client has, and it disappears the moment they switch to working from home.",
    },
    {
      id: "q106", n: 38, tag: "core", type: "single", required: true,
      label: "Average daily step count",
      options: [
        "<3,000", "3,000–5,000", "5,000–8,000", "8,000–10,000", "10,000–12,000", ">12,000",
        "Don't Know",
      ],
    },
    {
      id: "q54f", n: 38, tag: "core", type: "single", label: "Tracking source",
      options: ["Phone", "Smartwatch", "Fitness Tracker", "Estimate"],
      note: "A phone in a pocket undercounts and an estimate is a guess — neither should be treated as measured data.",
      showIf: (a) => answered(a, "q106") && !is(a, "q106", "Don't Know"),
    },
    { id: "q112", n: 39, tag: "core", type: "number", label: "Weekday steps" },
    { id: "q112a", n: 39, tag: "core", type: "number", label: "Weekend steps" },
    {
      id: "q112b", n: 39, tag: "core", type: "single", label: "Weekend activity compared with weekday",
      options: ["Much Lower", "Slightly Lower", "Similar", "Slightly Higher", "Much Higher", "Variable"],
    },
    {
      id: "q112c", n: 39, tag: "core", type: "single", label: "Weekend sitting time compared with weekday",
      options: ["Much Higher", "Slightly Higher", "Similar", "Lower", "Variable"],
    },
    {
      id: "q112d", n: 39, tag: "planning", type: "single", label: "NEAT classification",
      options: ["Very Low NEAT", "Low NEAT", "Moderate NEAT", "High NEAT", "Very High NEAT"],
      note: "Judge on steps plus sitting, standing, occupation, commute, household movement and the weekday/weekend difference — not steps alone.",
    },
    {
      id: "q112e", n: 39, tag: "planning", type: "single", label: "NEAT confidence",
      options: ["High", "Moderate", "Low"],
    },
  ],
};

// ---------------------------------------------------------------------------
// STAGE 9 — EXERCISE, TRAINING & RECOVERY (Q40–Q42, Q44–Q45)
//
// v3.0's Q43 (protein sources, meals per day, distribution, barriers) is already
// the protein section — q50, q50a and q50b — and is not redrafted here. The
// untouched protein section belongs immediately after this stage.
// ---------------------------------------------------------------------------

const isTraining = (a: Answers) => hasOther(a, "q43", ["Currently not exercising"]);

const V3_S9: Section = {
  id: "training",
  code: "9",
  title: "Exercise, training & recovery",
  stage: "Fitness",
  minutes: "8–10 min",
  questions: [
    {
      id: "q43", n: 40, tag: "fitness", type: "multi", required: true,
      label: "Tell me about your current exercise or training routine.",
      options: [
        "Starting with LeanR PT", "Strength training", "Cardio machines", "Running", "Walking",
        "Yoga", "Pilates", "Swimming", "Cycling", "Sports", "Home workout", "HIIT",
        "Group classes", "Rehabilitation exercise", "Currently not exercising", "Other",
      ],
    },
    {
      id: "q44a", n: 40, tag: "fitness", type: "single", label: "Days per week",
      options: ["0", "1", "2", "3", "4", "5", "6", "7", "Variable"],
      showIf: isTraining,
    },
    {
      id: "q44b", n: 40, tag: "fitness", type: "single", label: "Duration",
      options: [
        "Less than 30 minutes", "30–45 minutes", "45–60 minutes", "60–90 minutes",
        "More than 90 minutes", "Variable",
      ],
      showIf: isTraining,
    },
    {
      id: "q44c", n: 40, tag: "fitness", type: "single", label: "Timing",
      options: ["Early morning", "Morning", "Afternoon", "Evening", "Night", "Variable"],
      showIf: isTraining,
      why: "Training time decides where the carbohydrate and protein go, not just how much.",
    },
    {
      id: "q44g", n: 40, tag: "fitness", type: "single", label: "Location",
      options: ["Gym", "Home", "Outdoor", "Mixed"],
      showIf: isTraining,
    },
    {
      id: "q44d", n: 40, tag: "fitness", type: "single", required: true, label: "Training experience",
      options: [
        "Complete beginner", "Less than 6 months", "6–12 months", "1–3 years",
        "More than 3 years", "Returning after a break",
      ],
    },
    {
      id: "q44e", n: 40, tag: "fitness", type: "single", label: "Intensity",
      options: ["Very light", "Light", "Moderate", "Hard", "Very hard", "Variable", "Not sure"],
      showIf: isTraining,
    },
    {
      id: "q45", n: 41, tag: "fitness", type: "multi",
      label: "How do you feel during exercise?",
      options: [
        "Good energy", "Low energy before starting", "Energy drops early", "Energy drops midway",
        "Excessive hunger", "Weakness", "Dizziness", "Nausea", "Cramps",
        "Unusual breathlessness", "Headache", "Shakiness", "Too full or heavy",
        "No major problem", "Other",
      ],
      showIf: isTraining,
      note: "Dizziness, unusual breathlessness or shakiness during training is a clinical signal, not a fuelling detail.",
    },
    {
      id: "q46", n: 41, tag: "fitness", type: "multi",
      label: "How do you feel after exercise and between sessions?",
      options: [
        "Recover well", "Mild normal soreness", "Excessive soreness", "Soreness for several days",
        "Persistent fatigue", "Strength declining", "Performance declining", "Poor sleep",
        "Excessive hunger", "Low appetite", "Frequent cramps", "Feel dehydrated", "Other",
      ],
      showIf: isTraining,
    },
    {
      id: "q47", n: 42, tag: "fitness", type: "multi", label: "Before training",
      options: [
        "Full meal", "Small meal", "Snack", "Fruit or carbohydrate source", "Protein food",
        "Protein shake", "Pre-workout supplement", "Caffeine", "Water only", "Train fasted",
        "Variable",
      ],
      showIf: isTraining,
    },
    {
      id: "q47a", n: 42, tag: "fitness", type: "single", label: "How long before training?",
      options: [
        "Less than 30 minutes before", "30–60 minutes before", "1–2 hours before",
        "2–3 hours before", "More than 3 hours before",
      ],
      showIf: (a) => isTraining(a) && hasOther(a, "q47", ["Train fasted", "Water only"]),
    },
    {
      id: "q48", n: 42, tag: "fitness", type: "multi", label: "During training",
      options: [
        "Nothing", "Water", "Electrolytes", "Sports drink", "Carbohydrate drink or gel",
        "BCAA or EAA", "Other supplement", "Food",
      ],
      showIf: isTraining,
    },
    {
      id: "q49", n: 42, tag: "fitness", type: "multi", label: "After training",
      options: [
        "Full meal", "Small meal", "Protein-rich food", "Protein shake",
        "Fruit or carbohydrate source", "Milk or dairy beverage", "Water only",
        "Nothing for several hours", "Variable",
      ],
      showIf: isTraining,
    },
    {
      id: "q49a", n: 42, tag: "fitness", type: "single", label: "How soon after training?",
      options: ["Less than 30 minutes", "30–60 minutes", "1–2 hours", "2–3 hours", "More than 3 hours"],
      showIf: (a) => isTraining(a) && hasOther(a, "q49", ["Nothing for several hours"]),
    },
    {
      id: "q51", n: 44, tag: "clinical", type: "multi", required: true,
      label: "Do you currently use any supplements?",
      options: [
        "Protein powder", "Creatine", "Pre-workout", "BCAA or EAA", "Electrolytes",
        "Mass gainer", "Fat burner", "Multivitamin", "Vitamin D", "Vitamin B12", "Iron",
        "Calcium", "Omega-3", "Magnesium", "Herbal or Ayurvedic product", "None", "Other",
      ],
    },
    {
      id: "q51c", n: 44, tag: "conditional", type: "textarea",
      label: "For each — product, dose, frequency, purpose",
      placeholder: "e.g. whey 1 scoop post-workout daily; Vitamin D 60k IU weekly for deficiency",
      showIf: (a) => hasOther(a, "q51", ["None"]),
    },
    {
      id: "q51a", n: 44, tag: "conditional", type: "single", label: "Recommended by",
      options: ["Doctor", "Dietitian", "Personal Trainer", "Friend or family", "Social media", "Self", "Other"],
      showIf: (a) => hasOther(a, "q51", ["None"]),
    },
    {
      id: "q51b", n: 44, tag: "conditional", type: "multi", label: "Side effects",
      options: ["None", "Digestive issue", "Headache", "Sleep issue", "Palpitations", "Skin issue", "Other"],
      showIf: (a) => hasOther(a, "q51", ["None"]),
    },
    {
      id: "q53", n: 45, tag: "fitness", type: "multi", required: true,
      label: "Do you have any pain, injury or movement limitations affecting exercise?",
      options: [
        "Knee", "Lower back", "Upper back", "Neck", "Shoulder", "Elbow or wrist", "Hip",
        "Ankle or foot", "Previous fracture", "Post-surgery limitation",
        "Medically restricted movement", "No limitation", "Other",
      ],
    },
    {
      id: "q53c", n: 45, tag: "conditional", type: "single", label: "Severity",
      options: ["Mild", "Moderate", "Severe", "Variable"],
      showIf: (a) => hasOther(a, "q53", ["No limitation"]),
    },
    {
      id: "q53d", n: 45, tag: "conditional", type: "single", label: "Duration",
      options: ["Less than 1 month", "1–3 months", "3–6 months", "6–12 months", "More than 1 year"],
      showIf: (a) => hasOther(a, "q53", ["No limitation"]),
    },
    {
      id: "q53e", n: 45, tag: "conditional", type: "text", label: "Activities affected",
      placeholder: "e.g. cannot squat below parallel; stairs painful after 10 minutes",
      showIf: (a) => hasOther(a, "q53", ["No limitation"]),
    },
    {
      id: "q53a", n: 45, tag: "conditional", type: "single", label: "Professional assessment",
      options: ["Doctor", "Physiotherapist", "Personal Trainer", "Self-observed", "Not assessed"],
      showIf: (a) => hasOther(a, "q53", ["No limitation"]),
    },
  ],
};

// ---------------------------------------------------------------------------
// STAGE 10 — HUNGER & EATING BEHAVIOUR (Q46–Q52)
// ---------------------------------------------------------------------------

const V3_S10: Section = {
  id: "routine",
  code: "10",
  title: "Hunger & eating behaviour",
  stage: "Behaviour",
  minutes: "6–8 min",
  questions: [
    {
      id: "q56", n: 46, tag: "core", type: "single", required: true,
      label: "How would you describe your hunger and appetite throughout the day?",
      options: [
        "Stable", "Low hunger most of the day", "High morning hunger", "High lunch hunger",
        "High evening hunger", "High night hunger", "Extreme post-workout hunger",
        "Unpredictable", "Often eat without physical hunger", "Not sure",
      ],
      why: "The appetite phenotype decides where the calories are placed — an evening-hunger client fails a big-breakfast plan.",
    },
    {
      id: "q56a", n: 46, tag: "core", type: "single", label: "Hungriest time",
      options: [
        "Early morning", "Mid-morning", "Lunch", "Afternoon", "Evening", "Night", "Post-workout",
        "Variable",
      ],
    },
    {
      id: "q56b", n: 46, tag: "core", type: "multi", label: "Low-appetite periods",
      options: [
        "Early morning", "Mid-morning", "Lunch", "Afternoon", "Evening", "Night",
        "Immediately after training", "During stress", "No low-appetite period",
      ],
    },
    {
      id: "q57", n: 46, tag: "core", type: "multi", label: "Appetite variability",
      options: [
        "Good", "Very strong", "Low", "Variable", "Become full quickly",
        "Struggle to finish meals", "Forget to eat", "Delay eating despite hunger",
        "Hungry but not interested in food", "Reduced after training", "Increased after training",
        "Reduced by stress", "Increased by stress", "No concern",
      ],
    },
    {
      id: "q55", n: 47, tag: "core", type: "multi", max: 3, required: true,
      label: "Are there particular meals or times of day that are difficult to manage?",
      options: [
        "Early morning", "Breakfast", "Mid-morning", "Lunch", "Afternoon", "Evening",
        "Pre-workout", "Post-workout", "Dinner", "Late night", "Weekend", "Travel",
        "Social events", "No specific time",
      ],
    },
    {
      id: "q55b", n: 47, tag: "conditional", type: "single", label: "How difficult",
      options: ["Slightly difficult", "Moderately difficult", "Very difficult", "Usually goes wrong"],
      showIf: (a) => hasOther(a, "q55", ["No specific time"]),
    },
    {
      id: "q55a", n: 47, tag: "conditional", type: "multi", label: "Reason",
      options: [
        "No time", "No appetite", "Excessive hunger", "Meetings", "No meal break",
        "Food unavailable", "Cannot carry food", "Family routine", "Cravings", "Stress",
        "Commute", "Training timing", "Tiredness", "Cooking difficulty", "Other",
      ],
      showIf: (a) => hasOther(a, "q55", ["No specific time"]),
    },
    {
      id: "q58", n: 48, tag: "core", type: "multi", required: true,
      label: "What food cravings do you experience?",
      options: [
        "Sweets or mithai", "Chocolate", "Bakery foods", "Fried foods", "Salty snacks",
        "Chips or namkeen", "Fast food", "Carbohydrate-rich foods", "Sugary drinks",
        "Tea or coffee", "Late-night food", "No strong cravings", "Other",
      ],
    },
    {
      id: "q58a", n: 48, tag: "conditional", type: "multi", max: 3, label: "Trigger",
      options: [
        "Hunger", "Stress", "Boredom", "Poor sleep", "Menstrual cycle", "Previous restriction",
        "Social situation", "Food cues", "Work pressure", "Habit", "Post-workout", "Other",
      ],
      showIf: (a) => hasOther(a, "q58", ["No strong cravings"]),
      why: "A craving driven by previous restriction is fixed by feeding more, not by more willpower.",
    },
    {
      id: "q58b", n: 48, tag: "conditional", type: "single", label: "Timing",
      options: ["Morning", "Afternoon", "Evening", "Late night", "Post-workout", "Variable"],
      showIf: (a) => hasOther(a, "q58", ["No strong cravings"]),
    },
    {
      id: "q58c", n: 48, tag: "conditional", type: "single", label: "Frequency",
      options: ["Rarely", "1–2 times per week", "3–5 times per week", "Daily", "Multiple times daily"],
      showIf: (a) => hasOther(a, "q58", ["No strong cravings"]),
    },
    {
      id: "q59", n: 49, tag: "core", type: "multi",
      label: "How do stress and emotions affect your eating?",
      options: [
        "Eat More", "Eat Less", "Crave Specific Foods", "Snack More", "Skip Meals",
        "Order Outside Food", "No Significant Effect", "Variable", "Other",
      ],
    },
    {
      id: "q60", n: 50, tag: "clinical", type: "multi", required: true,
      label: "Have you experienced any concerning eating behaviours?",
      // v3.0 leaves this open text. The named patterns are kept because the
      // disordered-eating stop is triggered from them, and an open box gives the
      // safety check nothing to read.
      options: [
        "Feeling unable to control eating", "Eating an unusually large amount with distress",
        "Severe or prolonged food restriction", "Skipping meals to compensate",
        "Significant guilt after eating", "Anxiety after eating", "Strong fear of specific foods",
        "Self-induced vomiting", "Other compensatory behaviour",
        "Professionally diagnosed eating disorder", "Currently receiving professional support",
        "None", "Prefer not to answer",
      ],
      note: "Ask sensitively, record only what is offered, and never intensify restriction where any of this is present.",
    },
    {
      id: "q60a", n: 50, tag: "clinical", type: "single", label: "Dietitian assessment",
      options: [
        "No Concern", "Explore Further", "Senior Clinical Review",
        "Mental Health Professional Referral", "Avoid Aggressive Restriction",
      ],
      showIf: (a) => hasOther(a, "q60", ["None"]),
    },
    {
      id: "q113", n: 51, tag: "core", type: "single", label: "Eating speed",
      options: ["Very Fast", "Fast", "Moderate", "Slow"],
      why: "Fast, distracted eating means fullness signals arrive after the plate is empty — a portion problem no calorie target fixes on its own.",
    },
    {
      id: "q113a", n: 51, tag: "core", type: "multi", label: "Common distractions",
      options: ["Phone", "TV", "Work", "Driving", "Conversation", "None", "Other"],
    },
    {
      id: "q113b", n: 51, tag: "core", type: "single", label: "Why do you usually finish a meal?",
      options: [
        "Comfortable Fullness", "Plate Is Empty", "Still Hungry", "Habit", "Food Is Available",
        "Don't Want to Waste Food", "Emotional Satisfaction", "Not Sure", "Other",
      ],
    },
    {
      // Was a multi-select of off-plan behaviours; v3.0 asks for the single
      // closest pattern, which is what the all-or-nothing phenotype is read from.
      id: "q69", n: 52, tag: "core", type: "single", required: true,
      label: "When following a nutrition plan, what usually happens when things do not go as planned?",
      options: [
        "I Adjust and Continue Normally", "I Return to the Plan at the Next Meal",
        "I Usually Give Up for the Rest of the Day", "I May Go Off-Plan for Several Days",
        "I Feel Guilty and Restrict Later", "I Compensate With Extra Exercise",
        "I Tend to Follow an All-or-Nothing Pattern", "It Depends on the Situation", "Not Sure",
      ],
    },
  ],
};

// ---------------------------------------------------------------------------
// STAGE 11 — SLEEP, STRESS, HYDRATION & LIFESTYLE (Q53–Q58)
// ---------------------------------------------------------------------------

const V3_S11: Section = {
  id: "lifestyle",
  code: "11",
  title: "Sleep, stress, hydration & lifestyle",
  stage: "Lifestyle",
  minutes: "6–7 min",
  questions: [
    { id: "q61d", n: 53, tag: "core", type: "time", label: "Bedtime" },
    { id: "q61e", n: 53, tag: "core", type: "time", label: "Wake time" },
    {
      id: "q61", n: 53, tag: "core", type: "single", required: true, label: "Average sleep duration",
      options: [
        "Less than 5 hours", "5–6 hours", "6–7 hours", "7–8 hours", "8–9 hours",
        "More than 9 hours", "Variable",
      ],
    },
    { id: "q61a", n: 53, tag: "core", type: "scale10", required: true, label: "Sleep quality (1–10)" },
    {
      id: "q61c", n: 53, tag: "clinical", type: "multi", label: "Sleep problems",
      options: [
        "Difficulty falling asleep", "Frequent waking", "Wake too early", "Heavy snoring",
        "Observed breathing pauses", "Daytime sleepiness", "Shift-related sleep issue",
        "Late caffeine", "Training affects sleep", "No major concern", "Other",
      ],
      note: "Snoring plus observed breathing pauses plus daytime sleepiness is a sleep-apnoea picture worth naming to the client.",
    },
    {
      id: "q61f", n: 53, tag: "conditional", type: "single", label: "Night awakenings",
      options: ["None", "Once", "Twice", "Three or more", "Variable"],
      showIf: (a) => hasOther(a, "q61c", ["No major concern"]),
    },
    { id: "q62", n: 54, tag: "core", type: "scale10", required: true, label: "Current stress level (1–10)" },
    {
      id: "q62a", n: 54, tag: "conditional", type: "multi", max: 3, label: "Major stress sources",
      options: [
        "Work", "Business", "Studies", "Financial", "Family", "Relationship", "Health",
        "Body or weight", "Caregiving", "Travel", "Poor sleep", "Other",
      ],
      showIf: (a) => answered(a, "q62"),
    },
    {
      id: "q62b", n: 54, tag: "conditional", type: "multi", label: "Impact on eating, sleep and exercise",
      options: [
        "Food intake", "Cravings", "Meal timing", "Sleep", "Training consistency",
        "Performance", "Digestion", "No noticeable effect",
      ],
      showIf: (a) => answered(a, "q62"),
    },
    {
      id: "q63", n: 55, tag: "core", type: "single", required: true,
      label: "Approximate daily water intake",
      options: [
        "Less than 1 litre", "1–1.5 litres", "1.5–2 litres", "2–3 litres", "More than 3 litres",
        "Not sure",
      ],
      note: "If a fluid restriction was recorded at Q20, that ceiling wins over any hydration target.",
    },
    {
      id: "q63c", n: 55, tag: "core", type: "text", label: "Other fluids",
      placeholder: "e.g. 3 teas, 1 buttermilk, occasional juice",
    },
    {
      id: "q63d", n: 55, tag: "fitness", type: "text", label: "Workout hydration",
      placeholder: "e.g. 500 ml during a 60-minute session",
    },
    {
      id: "q63a", n: 55, tag: "conditional", type: "multi", label: "Factors affecting requirements",
      options: [
        "Hot climate", "Heavy sweating", "Long workouts", "Outdoor training",
        "Endurance exercise", "Physical job", "Frequent travel", "None",
      ],
    },
    {
      id: "q63b", n: 55, tag: "conditional", type: "single", label: "Electrolytes",
      options: ["Regularly", "Sometimes", "Only during long or hard exercise", "Never", "Unsure when required"],
    },
    {
      id: "q64", n: 56, tag: "core", type: "multi", required: true,
      label: "Which caffeinated drinks do you regularly consume?",
      options: ["Tea", "Coffee", "Energy drink", "Pre-workout", "Caffeine tablet", "None"],
    },
    {
      id: "q64a", n: 56, tag: "conditional", type: "number", label: "Quantity (servings per day)",
      showIf: (a) => hasOther(a, "q64", ["None"]),
    },
    {
      id: "q64c", n: 56, tag: "conditional", type: "single", label: "Added sugar",
      options: ["No", "Yes", "Sometimes"],
      showIf: (a) => hasOther(a, "q64", ["None"]),
      why: "Four sugared teas a day is a meal's worth of calories that never appears in a food recall.",
    },
    {
      id: "q64d", n: 56, tag: "conditional", type: "multi", label: "Timing",
      options: ["On waking", "With breakfast", "Mid-morning", "After lunch", "Evening", "Pre-workout", "Night"],
      showIf: (a) => hasOther(a, "q64", ["None"]),
    },
    {
      id: "q64b", n: 56, tag: "conditional", type: "single", label: "Last intake timing",
      options: ["Before 12 PM", "12–3 PM", "3–6 PM", "6–9 PM", "After 9 PM", "Variable"],
      showIf: (a) => hasOther(a, "q64", ["None"]),
    },
    {
      id: "q65", n: 57, tag: "core", type: "multi", required: true,
      label: "Do you consume alcohol, tobacco or nicotine?",
      options: [
        "Alcohol", "Cigarette", "Vaping", "Chewing tobacco", "Other nicotine or tobacco",
        "None", "Prefer not to answer",
      ],
      note: "Record sensitively and without comment — a judged answer here is an inaccurate answer.",
    },
    {
      id: "q65a", n: 57, tag: "conditional", type: "single", label: "Frequency",
      options: ["Daily", "4–6 times weekly", "2–3 times weekly", "Weekly", "Monthly", "Occasionally"],
      showIf: (a) => hasOther(a, "q65", ["None", "Prefer not to answer"]),
    },
    {
      id: "q65c", n: 57, tag: "conditional", type: "text", label: "Quantity",
      placeholder: "e.g. 3–4 pegs of whisky per sitting; 5 cigarettes a day",
      showIf: (a) => hasOther(a, "q65", ["None", "Prefer not to answer"]),
    },
    {
      id: "q65b", n: 57, tag: "conditional", type: "multi", label: "Context",
      options: ["Routine use", "Social", "Weekend", "Stress-related", "Travel", "Other"],
      showIf: (a) => hasOther(a, "q65", ["None", "Prefer not to answer"]),
    },
    {
      id: "q67", n: 58, tag: "core", type: "multi", required: true,
      label: "How often do travel and social situations affect your eating routine?",
      options: [
        "Work travel", "Personal travel", "Flights or airports", "Hotel stays",
        "Business dinners", "Restaurants", "Family gatherings", "Parties or social events",
        "International travel", "Religious or community events", "Rarely affected", "Other",
      ],
    },
    {
      id: "q67b", n: 58, tag: "conditional", type: "single", label: "Frequency",
      options: ["Rarely", "1–2 times per month", "Weekly", "Multiple times per week", "Frequent traveller"],
      showIf: (a) => hasOther(a, "q67", ["Rarely affected"]),
    },
    {
      id: "q67a", n: 58, tag: "conditional", type: "multi", label: "Nutrition impact",
      options: [
        "Skip meals", "Eat very little beforehand", "Overeat", "Drink alcohol",
        "Eat whatever is available", "Struggle with protein", "Eat late",
        "Order familiar foods", "Carry snacks", "Manage reasonably well",
      ],
      showIf: (a) => hasOther(a, "q67", ["Rarely affected"]),
    },
    {
      id: "q67c", n: 58, tag: "conditional", type: "text", label: "Typical challenges",
      placeholder: "e.g. airport food after 10 PM; client dinners three nights a week",
      showIf: (a) => hasOther(a, "q67", ["Rarely affected"]),
    },
  ],
};

// ---------------------------------------------------------------------------
// STAGE 12 — ADHERENCE, MINDSET & SUCCESS STRATEGY (Q59–Q64)
// ---------------------------------------------------------------------------

const V3_S12: Section = {
  id: "coaching",
  code: "12",
  title: "Adherence, mindset & success strategy",
  stage: "Behaviour",
  minutes: "5–6 min",
  intro:
    "This stage decides how the plan is written, not what is in it: structure, portion language, how much change lands in week one and what support the client gets.",
  questions: [
    {
      id: "q73", n: 59, tag: "planning", type: "multi", max: 3, required: true,
      label:
        "Based on your past experience, what could make it difficult to stay consistent with your LeanR plan?",
      options: [
        "Busy Work Schedule", "Travel", "Stress", "Poor Sleep", "Family Responsibilities",
        "Hunger", "Cravings", "Cooking", "Budget", "Food Availability", "Social Events",
        "Low Motivation", "Poor Results", "Digestive Problems", "Other",
      ],
      note: RANK_NOTE,
    },
    {
      id: "q71", n: 60, tag: "core", type: "multi", required: true,
      label: "Are there any nutrition beliefs or food rules that strongly influence how you eat?",
      options: [
        "Carbohydrates cause weight gain", "Rice causes weight gain", "Roti causes weight gain",
        "Avoid food after a specific time", "Skipping meals helps fat loss",
        "Fasting is necessary", "Fruit has too much sugar", "Dietary fat should be avoided",
        "Very high protein is necessary", "Protein damages kidneys or liver",
        "Protein powder is unsafe", "Supplements are necessary", "Detox or cleanse is required",
        "More sweating means more fat loss", "Fasted workout significantly increases fat loss",
        "Social-media nutrition influences choices", "No strong belief affecting choices", "Other",
      ],
      why: "A plan that silently contradicts a strongly held rule gets quietly edited by the client instead of followed.",
    },
    {
      id: "q71b", n: 60, tag: "conditional", type: "multi", label: "Source of belief",
      options: [
        "Social media", "Friends or family", "Previous dietitian", "Personal Trainer", "Doctor",
        "Own experience", "Article or book", "Not sure",
      ],
      showIf: (a) => hasOther(a, "q71", ["No strong belief affecting choices"]),
    },
    {
      id: "q71a", n: 60, tag: "conditional", type: "single", label: "Strength of belief",
      options: ["None", "Mild", "Moderate", "Significant"],
      showIf: (a) => hasOther(a, "q71", ["No strong belief affecting choices"]),
    },
    {
      id: "q71c", n: 60, tag: "conditional", type: "single",
      label: "May it affect adherence or nutrition quality?",
      options: ["No", "Possibly", "Yes — restricts food choices", "Yes — drives under-eating"],
      showIf: (a) => hasOther(a, "q71", ["No strong belief affecting choices"]),
    },
    {
      id: "q72", n: 61, tag: "planning", type: "single", required: true,
      label: "What type of nutrition plan would be easiest for you to follow consistently?",
      options: ["Exact Meal Plan", "Meal Options", "Flexible Exchange", "Portion Guidance", "Combination"],
    },
    {
      id: "q72a", n: 61, tag: "planning", type: "single", label: "Preferred measurement method",
      options: ["Grams", "Household Measures", "Hand Portions", "Visual Portions", "Combination"],
      why: "The plan is written in the client's own measuring language — grams to someone who cooks in katoris is a plan they cannot follow.",
    },
    {
      id: "q74", n: 62, tag: "planning", type: "single", required: true,
      label: "How much change feels realistic for you during the first two weeks?",
      options: [
        "Very Small Changes", "A Few Priority Changes", "Moderate Structured Changes",
        "Comfortable With Significant Changes", "Not Sure – Need Dietitian Guidance",
      ],
    },
    {
      id: "q75", n: 63, tag: "core", type: "scale10", required: true,
      label: "How confident are you that you can follow the agreed nutrition and lifestyle plan? (1–10)",
    },
    {
      id: "q75a", n: 63, tag: "conditional", type: "multi",
      label: "What would make the plan easier to follow?",
      options: [
        "Simpler Meals", "More Food Options", "Less Cooking", "Family-Friendly Meals",
        "Travel Options", "More Accountability", "More Frequent Follow-ups", "Flexible Portions",
        "Better Craving Management", "Other",
      ],
      showIf: (a) => scaleAtMost(a, "q75", 6),
      note: "Below 7 the plan is changed now, not reviewed later — confidence at counselling predicts week-3 dropout.",
    },
    {
      id: "q70", n: 64, tag: "core", type: "multi", max: 3, required: true,
      label: "What type of support and coaching helps you stay most consistent?",
      options: [
        "Clear Step-by-Step Instructions", "Regular Accountability", "Frequent Check-ins",
        "Flexible Guidance", "Strict Structure", "Encouragement and Motivation",
        "Progress Data and Feedback", "Education and Explanation", "Problem-Solving Support",
        "Simple Targets", "Other",
      ],
    },
  ],
};

// ---------------------------------------------------------------------------
// v3.0 SECTION 1, in spec order. The untouched protein section (S6 `protein`)
// belongs between Stage 9 and Stage 10 — it answers v3.0 Q30's food pattern and
// the whole of Q43.
// ---------------------------------------------------------------------------

export const V3_SECTIONS: Section[] = [
  V3_S1, V3_S2, V3_S3, V3_S4, V3_S5, V3_S6, V3_S7, V3_S8, V3_S9, V3_S10, V3_S11, V3_S12,
];

// Referenced so the draft type-checks standalone with `noUnusedLocals`.
export const V3_HELPERS_IN_USE = { hasAny, val };

/* ===========================================================================
 * DROPPED — current ids that appear nowhere in this draft
 * ===========================================================================
 *
 * SECTION 1 (goal)
 *   q3         "What other results are important to you?" — v3.0 keeps one primary
 *              result (Q3) and one reason set (Q5); the secondary-results list is gone.
 *   q5         "Which specific targets do you currently have in mind?" + every
 *              follow-up: q5_weight, q5_bodyfat, q5_waist, q5_inches, q5_size,
 *              q5_other. v3.0 has no numeric client target anywhere in Section 1;
 *              targets are set by the dietitian in Section 2 (A2/A12).
 *              NOTE: toIntake() line 447 reads `val(a,"q5_weight") || val(a,"q82a")`
 *              for targetWeightKg — both sources are now gone from Section 1.
 *   q8, q8a    Readiness 1–10 and its barrier list. v3.0 asks confidence at Q63
 *              instead, and barriers at Q59.
 *   gr_dietitian, gr_client   Goal-reflection confirmation pair. v3.0 folds the
 *              reflection into the conversation and does not record it.
 *
 * SECTION 2 (history)
 *   q13, q13a, q13b   Rapid-loss / highly-restrictive-diet screen and its detail.
 *              v3.0 covers the same ground inside Q10 (result + reason + problems).
 *              q13c survives, re-parented to Q10.
 *   q14, q14a  Repeated regain / plateau and its duration — folded into Q8
 *              ("Frequent Fluctuations") and Q10 ("Successful but Regained", "Plateau").
 *
 * SECTION 3 (medical)
 *   q21a, q21b Symptom frequency and "has a doctor assessed this?". v3.0 Q19 goes
 *              straight from the symptom list to the safety decision.
 *   cr1        Clinical reflection multi-select — this is v3.0 Section 2 (A1,
 *              clinical safety gate), which is out of scope for Section 1.
 *
 * SECTION 4 (digestion)
 *   nothing dropped.
 *
 * SECTION 5 (foodday)
 *   q28_other_*   The "Other" meal occasion and its five generated fields.
 *              v3.0's occasion list has no Other.
 *
 * SECTION 7 (preferences)
 *   q42, q42a  Food budget and limited-access list. v3.0 keeps budget only as a
 *              consistency barrier (Q59 "Budget").
 *
 * SECTION 8 (training)
 *   q44f       Primary training goal — not asked in v3.0 Q40.
 *   q52, q52a  Under-fuelling / RED-S screen and its coinciding factors. v3.0
 *              Section 1 has no equivalent question. This is the highest-value
 *              drop in the whole rewrite: see BROKEN OPTION MATCHES #24.
 *   q53b       PT handover — LeanR ops field, not in v3.0.
 *
 * SECTION 9 (routine)
 *   q54b       Meal breaks (Fixed / Flexible / Short only / …). v3.0 covers meal
 *              difficulty at Q47 but never asks about work breaks directly.
 *
 * SECTION 10 (lifestyle)
 *   q61b       "Wake refreshed?" — v3.0 Q53 asks quality and night awakenings only.
 *   q66a       "Medical care for this" hormonal follow-up — v3.0 Q21 stops at the
 *              factor list.
 *
 * SECTION 11 (coaching)
 *   q68        Dropout first-signs list. v3.0 asks the barriers (Q59) and the
 *              off-plan pattern (Q52) but not the leading indicator.
 *   q74a       "Anything important we have not discussed?" free-text catch-all.
 *
 * SECTIONS 12 & 13 (assessment, discussion) — ENTIRELY OUT OF SCOPE, not deleted:
 *   ds1–ds4, q76, q77, q78, q79, q80, q81, q82a, q82b, q82c, q83, q83a, q84,
 *   q84a, q84b, q84c, q85, q85a, q86, q87a, q87b, q87c, q87d, q87e, q88, q89,
 *   q90, q90a, q91, q92, q92a, q92b, q92c, q93, q94, q95, q96, q97, q98, q98a,
 *   q99, q99a, q100, q101, q101a, q102, q103, q103a, q104, q105
 *   These are v3.0 Section 2 (Stages 13–19, A1–A18) — dietitian/AI strategy
 *   fields, which this draft was told to ignore. They are listed here only so the
 *   count reconciles: they are NOT dropped by v3.0, they moved to Section 2.
 *
 * PROTEIN SECTION — untouched and intentionally absent from this draft:
 *   q33, q50, q50p_* (generated frequency/portion rows), q50a, q50b.
 *
 * ===========================================================================
 * BROKEN OPTION MATCHES — assessment.ts compares against an exact option string
 * that this draft's option list no longer contains.
 * Format: [assessment.ts line] id — expected string → closest v3.0 option.
 * ===========================================================================
 *
 * --- RED FLAGS (RULES, lines 65–209) — these are clinical stops, so every one
 * --- of these silently stops firing. This is the dangerous half of the list.
 *
 *  1. [L67 via L38]  q21 — "Chest pain or pressure"        → "Chest Pain"
 *  2. [L67 via L40]  q21 — "Severe breathlessness"         → "Breathlessness"
 *  3. [L67 via L41]  q21 — "Breathlessness during light activity"
 *                                                          → "Breathlessness" (the
 *                     light-activity distinction no longer exists at all)
 *  4. [L67 via L42]  q21 — "Irregular or very rapid heartbeat sensation"
 *                                                          → "Palpitations"
 *  5. [L67 via L43]  q21 — "Repeated vomiting"             → "Repeated Vomiting" (case)
 *  6. [L67 via L44]  q21 — "Blood in stool"                → "Blood in Stool" (case)
 *  7. [L67 via L45]  q21 — "Black or tarry stool"          → "Black Stool"
 *  8. [L67 via L46]  q21 — "Unexplained rapid weight loss" → "Rapid Unexplained Weight Loss"
 *      (only URGENT_SYMPTOMS entry that still matches: [L39] "Fainting".)
 *      Also note v3.0 adds four symptoms the urgent list has never seen:
 *      "Severe Fatigue", "Frequent Dizziness", "Swelling in Legs",
 *      "Severe Headache During Exercise" — the last two are arguably urgent.
 *
 *  9. [L75]   q21c — "Urgent SOP escalation"               → "SOP Escalation Required"
 * 10. [L79]   q25a — "Blood"                               → NO EQUIVALENT. q25a is now
 *                     stool consistency (Normal/Hard/Loose/Mixed). Blood in stool
 *                     only exists at q21 "Blood in Stool".
 * 11. [L79]   q25a — "Black or tarry"                      → NO EQUIVALENT; closest is
 *                     q21 "Black Stool".
 * 12. [L111]  q60a — "Senior clinical review required"     → "Senior Clinical Review"
 * 13. [L112]  q60a — "Professional referral should be considered"
 *                                                          → "Mental Health Professional Referral"
 * 14. [L132]  q17  — "Kidney condition"                    → "Chronic Kidney Disease"
 *                     (v3.0 also splits out "Kidney Stones", "High Uric Acid", "Gout";
 *                     the no-generic-high-protein rule should key on CKD only.)
 * 15. [L140]  q17  — "Liver condition"                     → "Other Liver Disease"
 *                     (plus "Fatty Liver Grade I/II/III", "Hepatitis")
 * 16. [L144]  q17  — "Professionally diagnosed eating disorder"
 *                                                          → NO EQUIVALENT in v3.0 Q14.
 *                     Nearest surviving signal is q60 "Professionally diagnosed
 *                     eating disorder", which a different rule (L101) already reads.
 * 17. [L152]  q18  — "Bariatric surgery"                   → "Bariatric Surgery" (case)
 * 18. [L160]  q22  — hasOther(["No instruction"])          → "No Restrictions"
 *                     Effect: the doctor-instruction flag fires for EVERY client who
 *                     selects "No Restrictions", because that string is no longer
 *                     recognised as the none-option. Worse than not firing.
 * 19. [L168 via L50] q52 — "Stress fracture or bone injury"       → id q52 DROPPED
 * 20. [L168 via L52] q52 — "Menstrual cycle irregular or stopped" → id q52 DROPPED
 * 21. [L168 via L53] q52 — "Training while eating very little"    → id q52 DROPPED
 * 22. [L168 via L54] q52 — "Fear of increasing food despite high training"
 *                                                                 → id q52 DROPPED
 *                     (#19–22: the whole RED-S / under-fuelling stop dies with q52.
 *                     Nearest partial cover: q46 "Persistent fatigue" /
 *                     "Strength declining", q66 "Missed Periods".)
 * 23. [L176]  q13  — "Yes"                                 → id q13 DROPPED. The
 *                     rapid-loss / restriction-history flag never fires again.
 *                     Nearest cover: q12a "Successful but Regained" + q13c
 *                     "Hair Fall"/"Menstrual Changes".
 * 24. [L201]  cr1  — "Doctor clearance should be considered"  → id cr1 DROPPED
 * 25. [L202]  cr1  — "Senior Dietitian review required"       → id cr1 DROPPED
 *                     (#24–25: cr1 moves to v3.0 Section 2 / A1. Nearest Section-1
 *                     cover: q21c "Doctor Clearance Recommended" /
 *                     "Clinical Dietitian Review".)
 * 26. [L418]  q66  — "PCOS or PCOD"                        → "PCOS"
 *                     Effect: PCOS stops being copied into the conditions list.
 *
 * --- STILL MATCHING (verified, listed so the audit is complete):
 *     [L39] q21 "Fainting" · [L83/L92/L411] q27 "No known allergy" ·
 *     [L93] q27a "Severe" and "Previous emergency reaction" ·
 *     [L101 via L57–62] all five q60 ED_RISK strings ·
 *     [L120/L420] q66 "Pregnant" · [L128/L421] q66 "Breastfeeding" ·
 *     [L184] q17a "Uncontrolled" · [L192] q61c "Observed breathing pauses" ·
 *     [L261/L616] q19 "Yes"/"No" · [L470] q65 "None" · [L471] q65 "Alcohol".
 *
 * --- SAME BUG CLASS, `!==` / joinList drop-lists rather than is/has helpers.
 * --- These silently leak a "none" option into the AI profile or the plan.
 *
 * 27. [L417 + L610] q17  — "No known condition"       → "No Medical Condition"
 *                     Effect: "No Medical Condition" is sent to the AI as a condition.
 * 28. [L593]  q15  — "No data"                        → "None"
 * 29. [L615]  q18a — "No current impact"              → "No Impact"
 * 30. [L618]  q20  — "No recent reports"              → NO EQUIVALENT. v3.0's test
 *                     list has no none-option; report availability moved to the new
 *                     q20c ("Reports Not Available").
 * 31. [L625]  q22  — "No instruction"                 → "No Restrictions"
 * 32. [L637]  q25a — "Comfortable and formed"         → "Normal"
 * 33. [L674]  q30  — "No major change"                → NO EQUIVALENT. v3.0's Q26 is a
 *                     list of dimensions that change, with the magnitude in the new
 *                     q30a ("No Meaningful Difference").
 * 34. [L749]  q59  — "No major effect"                → "No Significant Effect"
 * 35. [L772–774] q66 — "Nothing relevant"             → "None"
 * 36. [L772–774] q66 — "Not applicable"               → "Not Applicable" (case)
 * 37. [L772–774] q66 — "Prefer not to answer"         → "Prefer Not to Answer" (case)
 * 38. [L789]  q73  — "No major barrier"               → NO EQUIVALENT; v3.0's Q59 list
 *                     has no none-option.
 * 39. [L591]  q14  — "No"                             → id q14 DROPPED
 * 40. [L668]  q42a — "No major limitation"            → id q42a DROPPED
 * 41. [L731/L732] q52/q52a — "None"                   → id q52 DROPPED
 *
 * --- TYPE CHANGES (not string mismatches, but the reader breaks the same way):
 *     q6  multi → single: [L561] `physique_result: list(a,"q6")` returns [] for a
 *         string answer. Must become val().
 *     q25a multi → single: [L79] has() and [L637] list().filter() both need val().
 *     q69 multi → single: [L783] `after_off_plan: list(a,"q69")` must become val().
 *
 * --- MEAL_OCCASIONS (imported constant, so the CODE tracks automatically at
 *     [L233] and [L526]; it is STORED ANSWERS that stop matching):
 *     "Wake-up intake"→"Wake-up Drinks" · "Mid-morning"→"Mid-Morning" ·
 *     "Evening snack"→"Evening" · "Pre-workout"→"Pre-Workout" ·
 *     "During workout"→"During Workout" · "Post-workout"→"Post-Workout" ·
 *     "After dinner"→"After Dinner" · "Before sleep"→"Late-Night Food" ·
 *     "Other" removed. Breakfast/Lunch/Afternoon/Dinner unchanged.
 *     The occasion KEYS are deliberately preserved, so [L467] q28_wake_time,
 *     q28_breakfast_time and [L468] q28_beforesleep_time all still resolve.
 *
 * ===========================================================================
 * NEW CONTENT — v3.0 questions with no current equivalent
 * ===========================================================================
 *
 * STAGE 1
 *   q1_occupation, q1_hours, q1_routine, q34d (state)
 *     The current bank recorded work TYPE but never the job, the hours or the
 *     shape of the day — the three things every feasibility judgement rests on.
 *
 * STAGE 2
 *   q10c   Major body-shape changes independent of the number on the scale.
 *   q12c   Per-attempt log (approach, duration, result) rather than one summary.
 *
 * STAGE 3 — the measurement-confidence tiers, entirely new
 *   q15 is re-cut as a METHOD list ordered by confidence (DEXA → visual estimate),
 *   and the confidence itself becomes recorded data:
 *   q15_assess (High/Moderate/Low/Insufficient Data), q13_bf_conf, q15_date.
 *   Rationale the current bank had nowhere to put: a low-confidence body-fat
 *   number must not set a calorie target, only a trend.
 *   Plus the baseline block: q13_meal_consistency, q13_protein_adequacy,
 *   q13_diet_quality, q13_adherence, q13_date, q13_completeness.
 *   q13_date matters most — without a baseline date nothing downstream can trend.
 *
 * STAGE 4
 *   q107, q107a   Family history + relationship. Nothing in the current bank
 *                 asks it at all, despite it changing the screening threshold.
 *   q17d          When the condition was diagnosed.
 *   q18b          Event and year for the surgery/hospitalisation.
 *   q20c, q20d    Report availability, and the upload → AI-extract → dietitian-
 *                 verify action, which the current bank only described in prose.
 *
 * STAGE 5
 *   q108          Allergy vs suspected allergy vs intolerance vs digestive
 *                 trigger — the classification that decides zero-tolerance
 *                 exclusion versus a portion change.
 *   q24d          Food association for a digestive symptom.
 *   q25b, q25c    Pain and incomplete emptying as their own answers.
 *   q26d          Frequency of the intolerance reaction.
 *
 * STAGE 6
 *   q109, q109a   Habitual weekday intake as a separate question from the 24-hour
 *                 recall, plus which meals are usually skipped/delayed/replaced.
 *                 v3.0's core rule — one recalled day is not habitual intake —
 *                 had no question to stand on before this.
 *   q29a          Habitual-intake confidence.
 *   q30a, q30b    Weekend difference and its calorie impact.
 *   q110–q110g    The household kitchen audit: cooking fats and additions, oil
 *                 type, household tin usage, people sharing food, per-person oil,
 *                 salt type, flour types. The largest genuinely new dataset in the
 *                 rewrite and the usual home of the missing calories.
 *   q34f          Frequency of major staples.
 *   Per-occasion: q28_<key>_beverage, q28_<key>_unplanned.
 *
 * STAGE 7
 *   q39b, q39c    Ability to request modifications, and household limitations.
 *
 * STAGE 8 — the NEAT questions, almost all new
 *   q111 (sitting time), q111a (standing/moving), q111b (occupational movement),
 *   q111c (household movement), q111d (other routine movement),
 *   q54g (total daily commute), q54h (walking in the commute),
 *   q106 (banded step count), q54f (tracking source),
 *   q112/q112a (weekday vs weekend steps), q112b (weekend activity),
 *   q112c (weekend sitting), q112d (NEAT classification), q112e (NEAT confidence).
 *   The current bank had one dropdown (q54c) and one number (q54d) for all of it.
 *
 * STAGE 9
 *   q53c, q53d, q53e   Injury severity, duration and activities affected.
 *
 * STAGE 10
 *   q56a, q56b    Hungriest time and low-appetite periods.
 *   q55b          How difficult the difficult meal actually is.
 *   q58c          Craving frequency.
 *   q113, q113a, q113b   Eating speed, distractions, and why the meal ends —
 *                 the satiety/mindful-eating block. "Plate Is Empty" and "Don't
 *                 Want to Waste Food" are portion problems no calorie target fixes.
 *
 * STAGE 11
 *   q61d, q61e, q61f   Bedtime, wake time and night awakenings as recorded fields
 *                 rather than inferred from the meal timeline.
 *   q63c, q63d    Other fluids and workout hydration.
 *   q64d          Caffeine timing across the day.
 *   q65c          Alcohol/tobacco quantity.
 *   q67c          Typical travel and social challenges.
 *
 * STAGE 12
 *   q71b, q71c    Where the food belief came from, and whether it threatens
 *                 adherence or nutrition quality.
 * ======================================================================== */
