/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Custom dark background colors
        'dark-bg': '#030508',
        'dark-blue': '#0a1628',
        // Glow colors
        'glow-blue': '#4fc3dc',
        'glow-light': '#7ee8fa',
      },
    },
  },
  plugins: [],
}
