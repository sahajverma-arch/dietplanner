export type DietType = "vegetarian" | "non-vegetarian" | "vegan" | "eggetarian";

export interface IntakeForm {
  // Section 1 — Basics
  fullName: string;
  age: string;
  gender: string;
  heightCm: string;
  weightKg: string;
  targetWeightKg: string;
  phone: string;
  email: string;
  occupation: string;
  goal: string;

  // Section 2 — Food preferences
  dietType: DietType;
  cuisines: string;
  mealsPerDay: string;
  likes: string;
  dislikes: string;
  allergies: string;
  intolerances: string;
  cookingTime: string;

  // Section 3 — Lifestyle
  activityLevel: string;
  exercise: string;
  sleepHours: string;
  wakeTime: string;
  bedTime: string;
  waterIntakeLitres: string;
  smoking: string;
  alcohol: string;
  eatingOutPerWeek: string;
  workSchedule: string;

  // Section 4 — Medical
  conditions: string[];
  medications: string;
  supplements: string;
  digestion: string;
  labNotes: string;

  // Section 5 — Notes
  notes: string;
}

export const emptyIntake: IntakeForm = {
  fullName: "",
  age: "",
  gender: "",
  heightCm: "",
  weightKg: "",
  targetWeightKg: "",
  phone: "",
  email: "",
  occupation: "",
  goal: "",
  dietType: "vegetarian",
  cuisines: "",
  mealsPerDay: "3",
  likes: "",
  dislikes: "",
  allergies: "",
  intolerances: "",
  cookingTime: "",
  activityLevel: "",
  exercise: "",
  sleepHours: "",
  wakeTime: "",
  bedTime: "",
  waterIntakeLitres: "",
  smoking: "",
  alcohol: "",
  eatingOutPerWeek: "",
  workSchedule: "",
  conditions: [],
  medications: "",
  supplements: "",
  digestion: "",
  labNotes: "",
  notes: "",
};

export interface FollowUpInput {
  weightKg: string;
  adherence: string;
  energyLevel: string;
  hunger: string;
  complaints: string;
  notes: string;
}

export const emptyFollowUp: FollowUpInput = {
  weightKg: "",
  adherence: "",
  energyLevel: "",
  hunger: "",
  complaints: "",
  notes: "",
};

export interface ClientRow {
  id: string;
  dietitian_id: string;
  full_name: string;
  age: number | null;
  gender: string | null;
  height_cm: number | null;
  weight_kg: number | null;
  goal: string | null;
  diet_type: string | null;
  phone: string | null;
  email: string | null;
  intake: IntakeForm;
  created_at: string;
  updated_at: string;
}

export interface DietPlanRow {
  id: string;
  client_id: string;
  dietitian_id: string;
  week_number: number;
  source: "first_counselling" | "follow_up";
  plan: unknown;
  /** AI independent clinical review of the dietitian hypothesis (week 1). */
  ai_review: unknown | null;
  pdf_path: string | null;
  created_at: string;
}

export interface FollowupRow {
  id: string;
  client_id: string;
  dietitian_id: string;
  week_number: number;
  weight_kg: number | null;
  adherence: string | null;
  complaints: string | null;
  notes: string | null;
  data: FollowUpInput;
  created_at: string;
}
