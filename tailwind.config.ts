import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: "#FFED00", // LEANR yellow (sampled from logo)
          dim: "#E0D000",
        },
      },
    },
  },
  plugins: [],
};

export default config;
