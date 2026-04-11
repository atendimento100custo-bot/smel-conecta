/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
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
          900: '#0f1923',
          800: '#162032',
          700: '#1e2d42',
          600: '#253553',
        }
      }
    },
  },
  plugins: [],
}
