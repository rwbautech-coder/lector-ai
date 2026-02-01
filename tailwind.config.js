/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        primary: '#6366f1',
        secondary: '#4f46e5',
        surface: {
          light: '#ffffff',
          dark: '#1e293b'
        },
        background: {
          light: '#f8fafc',
          dark: '#0f172a'
        },
        text: {
           light: '#0f172a',
           dark: '#f1f5f9'
        }
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      }
    },
  },
  plugins: [],
}