import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        ink: "#0b1f44",
        line: "#d8e2f0",
        bull: "#16803c",
        bear: "#d64032",
        judge: "#1d5fd1",
      },
    },
  },
  plugins: [],
};

export default config;

