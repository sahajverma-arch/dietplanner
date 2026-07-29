import type { Config } from "tailwindcss";
import colors from "tailwindcss/colors";

/**
 * Colours resolve through CSS variables so the whole app can switch theme
 * without any component knowing about it.
 *
 * The app was written dark-first: high zinc steps are surfaces (bg-zinc-900 is
 * a card), low-to-mid steps are text (text-zinc-400 is muted body copy). That
 * convention held consistently enough to invert — in light mode the same tokens
 * are re-pointed, so a "surface" step becomes near-white and a "text" step
 * becomes near-black. The 380-odd hardcoded utilities keep working untouched,
 * and a new component written in the existing idiom is themed for free.
 *
 * Steps not listed keep their Tailwind defaults, so nothing silently vanishes
 * if a component reaches for one that was never themed.
 */
const themed = (ramp: string, steps: number[]) =>
  Object.fromEntries(steps.map((s) => [s, `rgb(var(--${ramp}-${s}) / <alpha-value>)`]));

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // LEANR yellow stays yellow in both themes — it is the brand, and on
        // white it does the same job it does on black: a filled chip or button
        // with black text on it. Only `text-brand` is re-pointed for light mode
        // (see globals.css), because yellow type on white cannot be read.
        brand: {
          DEFAULT: "#FFED00", // sampled from the logo
          dim: "#E0D000",
        },
        zinc: {
          ...colors.zinc,
          ...themed("z", [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950]),
        },
        sky: { ...colors.sky, ...themed("sky", [400, 500]) },
        amber: { ...colors.amber, ...themed("amber", [300, 400, 500]) },
        red: { ...colors.red, ...themed("red", [300, 400, 500]) },
        emerald: { ...colors.emerald, ...themed("emerald", [400, 500]) },
      },
    },
  },
  plugins: [],
};

export default config;
