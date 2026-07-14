-- ============================================================================
-- LEANR PREMIUM COUNSELLING — AI independent clinical review
--
-- The counselling form was replaced with the LeanR Premium question bank
-- (Q1–Q105, 12 sections). Counselling answers still live inside
-- clients.intake (jsonb) and form_drafts.data (jsonb), so no structural
-- change is needed there.
--
-- New: before every Week-1 diet, the AI independently reviews the complete
-- client profile against the dietitian's professional hypothesis and selects
-- one decision (Support / Support With Minor Modification / Significantly
-- Modify / AI-Led Alternative / Pause). The decision is stored with the plan.
--
-- Run once in the Supabase SQL Editor, after 0005.
-- ============================================================================

alter table public.diet_plans
  add column if not exists ai_review jsonb;

comment on column public.diet_plans.ai_review is
  'AI independent clinical review of the dietitian hypothesis: '
  '{decision, reasoning, strategy_adjustments[], missing_information[], safety_concerns[]}';
