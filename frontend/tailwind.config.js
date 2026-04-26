/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        // Shelby palette
        slate: {
          bg: "#8ea2bd",  // page backdrop (steel blue)
          dark: "#2a3b52", // card top (dark navy)
          deep: "#1b2838", // stats strip (deepest)
        },
        cream: {
          DEFAULT: "#cabf9e",
          light: "#d8cfb2",
          deep: "#b6a880",
        },
        // kept for CTA pop
        coral: {
          500: "#e85d5d",
          600: "#d94a4a",
        },
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};
