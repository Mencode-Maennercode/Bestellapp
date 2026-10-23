/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        'evm-green': '#009640',
        'evm-yellow': '#FFCC00',
        'evm-dark': '#1a1a1a',
      },
      animation: {
        'pulse-red': 'pulse-red 1s ease-in-out infinite',
        'pulse-orange': 'pulse-orange 1.5s ease-in-out infinite',
        'pulse-green': 'pulse-green 2s ease-in-out infinite',
      },
      keyframes: {
        'pulse-red': {
          '0%, 100%': { backgroundColor: '#dc2626', transform: 'scale(1)' },
          '50%': { backgroundColor: '#ef4444', transform: 'scale(1.05)' },
        },
        'pulse-orange': {
          '0%, 100%': { backgroundColor: '#ea580c', transform: 'scale(1)' },
          '50%': { backgroundColor: '#f97316', transform: 'scale(1.02)' },
        },
        'pulse-green': {
          '0%, 100%': { backgroundColor: '#16a34a', transform: 'scale(1)' },
          '50%': { backgroundColor: '#22c55e', transform: 'scale(1.01)' },
        },
      },
    },
  },
  plugins: [],
}
