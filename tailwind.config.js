/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        sans: ['Outfit', 'sans-serif'],
      },
      colors: {
        primary: {
          50:  '#edfff4',
          100: '#d5ffe8',
          200: '#adffd2',
          300: '#70ffb0',
          400: '#2df986',
          500: '#05e866',
          600: '#00c04e',
          700: '#009640',
          800: '#067535',
          900: '#07602e',
          950: '#023618',
        },
        navy: {
          // Dark mode surface hierarchy — deepest to lightest
          950: '#060A14',   // sidebar / deepest chrome
          900: '#080E1D',   // page background
          850: '#0A1222',   // subtle offset
          800: '#0F1B30',   // card surface
          750: '#111C33',   // card surface alt
          700: '#162240',   // elevated / hover state
          650: '#1A2A4E',   // focused state
          600: '#1E2F52',   // active badge bg
          500: '#253A62',   // inactive
          400: '#4A6090',   // secondary text
          300: '#7A95CC',   // muted text
          200: '#A8BFDD',   // placeholder
          100: '#D0DCEE',   // faint
        }
      }
    },
  },
  plugins: [],
}
