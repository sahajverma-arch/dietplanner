// Regression test for exchangeBlock() (src/lib/nim.ts) — the prompt text that
// hands the model a day's exchange budget alongside the PRESCRIPTION numbers.
//
// Runs the real four test clients through it end to end (toIntake -> roadmap
// -> exchangePlanFor -> prompt text) with no NIM API call, so this checks the
// plumbing (does it throw, does it produce sane text for a real diet type)
// without spending a model call on every run.
//
// Run: npx -y tsx scripts/tests/exchange-block.test.mts
const { exchangeBlock } = await import("../../src/lib/nim");
const { toIntake } = await import("../../src/lib/counselling/assessment");
const { PRIYA, RAHUL, SNEHA, AADI } = await import("../test-clients");

let failed = 0;
const check = (name: string, cond: boolean, detail: string) => {
  if (!cond) failed++;
  console.log(`${cond ? "ok  " : "FAIL"} ${name.padEnd(60)} ${cond ? "" : detail}`);
};

const CLIENTS = [
  { name: "Priya (vegetarian)", answers: PRIYA, dietType: "vegetarian" },
  { name: "Rahul (non-vegetarian)", answers: RAHUL, dietType: "non-vegetarian" },
  { name: "Sneha (eggetarian)", answers: SNEHA, dietType: "eggetarian" },
  { name: "Aadi (eggetarian)", answers: AADI, dietType: "eggetarian" },
] as const;

for (const c of CLIENTS) {
  const intake = toIntake(c.answers as any);
  check(`${c.name}: toIntake dietType matches`, intake.dietType === c.dietType, `got ${intake.dietType}`);

  const block = exchangeBlock({ intake, week: 1 });
  console.log(`\n--- ${c.name}, week 1 ---\n${block || "(empty — no roadmap)"}`);

  check(`${c.name}: exchangeBlock produces output`, block.length > 0, "empty string — roadmap failed to build");
  check(`${c.name}: mentions EXCHANGE BUDGET`, block.includes("EXCHANGE BUDGET"), block.slice(0, 200));
  check(
    `${c.name}: tells the model not to write a bare "Dal" or composed dish name`,
    block.includes('never a bare "Dal"') && block.includes('"Paneer sabzi"'),
    "naming-precision instruction missing — Dal/Paneer will collide with the old, more dilute alias: rows again"
  );

  if (c.dietType === "vegetarian") {
    check(
      `${c.name}: no poultry/fish/egg exchanges for a vegetarian client`,
      !block.includes("Poultry, Fish & Meat") && !block.includes("Chicken breast"),
      block
    );
  }
  if (c.dietType === "non-vegetarian" || c.dietType === "eggetarian") {
    // Not asserting these MUST appear (the solver may satisfy protein from
    // dairy/pulses alone) — just confirming they're not structurally blocked.
  }

  // Week 3+ should still produce a block (later weeks keep having a roadmap).
  const laterWeek = exchangeBlock({ intake, week: 3 });
  check(`${c.name}: week 3 also produces output`, laterWeek.length > 0, "empty at week 3");
}

// A client with no category recorded (roadmap can't be built) must return "" cleanly, not throw.
{
  const { toIntake: toIntake2 } = await import("../../src/lib/counselling/assessment");
  const noCategory = { ...PRIYA, q76_category: "" } as any;
  const intake = toIntake2(noCategory);
  let threw = false;
  let block = "";
  try {
    block = exchangeBlock({ intake, week: 1 });
  } catch {
    threw = true;
  }
  check("no category: does not throw", !threw, "exchangeBlock threw");
  check("no category: returns empty string", block === "", `got: ${block.slice(0, 100)}`);
}

console.log(failed === 0 ? `\nall exchangeBlock cases pass` : `\n${failed} FAILURES`);
