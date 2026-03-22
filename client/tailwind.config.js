/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      fontFamily: {
        display: ["Playfair Display", "serif"],
        body: ["Source Sans 3", "sans-serif"]
      },
      colors: {
        sand: {
          50: "#f9f5ef",
          100: "#f1e8d8",
          200: "#e4d4ba",
          300: "#d6be99",
          400: "#c7a879",
          500: "#b9925c",
          600: "#9e7a48",
          700: "#7c5f38",
          800: "#5a4529",
          900: "#3f301d"
        },
        oasis: {
          50: "#f1faf7",
          100: "#d7f0e8",
          200: "#b0dfd2",
          300: "#86ceb9",
          400: "#5dbb9f",
          500: "#3ea784",
          600: "#2c896a",
          700: "#216a52",
          800: "#174c3b",
          900: "#0f3428"
        },
        ink: "#1f2328"
      },
      boxShadow: {
        soft: "0 10px 30px rgba(27, 39, 51, 0.08)",
        lift: "0 12px 40px rgba(17, 24, 39, 0.18)"
      }
    }
  },
  plugins: []
};
