/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        background: '#09090b',
        primary: '#FFD580',
        secondary: '#D97500', 
      }
    },
  },
  plugins: [],
}
