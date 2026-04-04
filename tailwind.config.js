/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        base: {
          bg: "#EBEBEB",
        },
        brand: {
          electric: "#FF0028",
          coral: "#FF6B6B",
          plasma: "#8B0000",
          metabolic: "#0D1B3E",
          muted: "#555555",
        },
      },
      fontFamily: {
        display: ["Oswald", "ui-sans-serif", "system-ui", "sans-serif"],
        sans: ["Inter", "ui-sans-serif", "system-ui", "sans-serif"],
      },
      boxShadow: {
        card: "0 2px 12px rgba(13, 27, 62, 0.08)",
        "card-lg": "0 8px 24px rgba(13, 27, 62, 0.1)",
      },
      borderRadius: {
        brand: "8px",
        "brand-lg": "12px",
      },
    },
  },
  plugins: [],
};
