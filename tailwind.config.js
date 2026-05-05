/** @type {import('tailwindcss').Config} */
export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        display: ["Poppins", "ui-sans-serif", "system-ui"],
        body: ["Noto Sans TC", "ui-sans-serif", "system-ui"]
      },
      boxShadow: {
        card: "0 10px 30px rgba(8, 32, 32, 0.12)"
      }
    }
  },
  plugins: []
};
