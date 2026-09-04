/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        // ── Surfaces: deep navy-slate ramp (blue, never black) ────────────
        canvas: "#111C2A", // page background
        surface: {
          DEFAULT: "#16222F",
          base: "#16222F", // section background
          raised: "#1A2837", // panels, cards
          overlay: "#213141", // inputs, hovered rows, popovers
          line: "#2C3F53", // hairline borders
          edge: "#3B5268", // stronger dividers
          mute: "#4E6981", // disabled icon
        },
        // ── Text: warm off-white → cool slate ────────────────────────────
        ink: {
          DEFAULT: "#E9EFF5",
          primary: "#E9EFF5",
          secondary: "#B4C2D0",
          muted: "#8A9AAA",
          faint: "#6B7C8C",
        },
        // ── Emerald / jade: primary action + positive + recovered ────────
        jade: {
          100: "#C8F5E2",
          200: "#93EAC6",
          300: "#5FDCA9",
          400: "#34D399",
          500: "#17B27C",
          600: "#0E8C61",
          900: "#08281E",
        },
        // ── Steel blue: secondary informational ──────────────────────────
        steel: {
          200: "#B7D2E8",
          300: "#87B4DA",
          400: "#5B97C9",
          500: "#3B78AB",
          900: "#0C2233",
        },
        // ── Amber: attention / warning ───────────────────────────────────
        amber: {
          200: "#F8DFA6",
          300: "#F3C86B",
          400: "#E6AC3C",
          500: "#C48D22",
          900: "#2E2109",
        },
        // ── Coral: risk / danger (restrained warm red) ───────────────────
        coral: {
          200: "#F8C3BB",
          300: "#F0968A",
          400: "#E2705F",
          500: "#C4523F",
          900: "#31140F",
        },
      },
      fontFamily: {
        sans: ["Geist Variable", "Inter", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono", "ui-monospace", "monospace"],
      },
      fontSize: {
        "2xs": ["0.6875rem", { lineHeight: "1rem", letterSpacing: "0.04em" }],
        // Named financial sizes — never use arbitrary text-[…] for these:
        // Tailwind can't disambiguate `text-[clamp(...)]` from a colour and
        // silently drops the tone class alongside it.
        display: ["clamp(2.25rem, 4vw, 3.25rem)", { lineHeight: "0.95", letterSpacing: "-0.03em" }],
        hero: ["2rem", { lineHeight: "1", letterSpacing: "-0.02em" }],
      },
      borderRadius: {
        sm: "4px",
        DEFAULT: "6px",
        md: "6px",
        lg: "8px",
        xl: "10px",
        "2xl": "14px",
      },
      boxShadow: {
        panel: "0 1px 0 0 rgba(255,255,255,0.02) inset, 0 1px 2px rgba(0,0,0,0.4)",
        lift: "0 10px 30px -12px rgba(0,0,0,0.7)",
        drawer: "-24px 0 60px -20px rgba(0,0,0,0.75)",
      },
      keyframes: {
        "row-flash": {
          "0%": { backgroundColor: "rgba(52,211,153,0.14)" },
          "100%": { backgroundColor: "transparent" },
        },
        "rail-pulse": {
          "0%,100%": { opacity: "0.55" },
          "50%": { opacity: "1" },
        },
      },
      animation: {
        "row-flash": "row-flash 1.6s ease-out",
        "rail-pulse": "rail-pulse 2.4s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};
