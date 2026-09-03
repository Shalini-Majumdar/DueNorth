/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        mint: {
          50: "#f0faf6",
          100: "#d4f0e5",
          200: "#a8e1cb",
          300: "#74CDAC",
          400: "#5cb993",
          500: "#44a57a",
        },
        night: {
          700: "#352f40",
          800: "#292531",
          900: "#1e1b27",
        },
        sage: {
          100: "#e8ede5",
          200: "#d5ddd0",
          300: "#C1CCB7",
          400: "#a8b89c",
        },
        blush: {
          100: "#f5e4e4",
          200: "#E8BFBF",
          300: "#d4a0a0",
          400: "#c08080",
        },
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono", "monospace"],
      },
    },
  },
  plugins: [],
};
