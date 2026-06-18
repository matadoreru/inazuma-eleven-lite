/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        gold: {
          300: '#fde68a',
          400: '#fbbf24',
          500: '#f59e0b',
          600: '#d97706',
        },
        dark: {
          900: '#0a0a0f',
          800: '#12121a',
          700: '#1a1a26',
          600: '#22223a',
          500: '#2d2d4a',
        },
      },
      fontFamily: {
        game: ['"Exo 2"', 'sans-serif'],
        pixel: ['"Press Start 2P"', 'monospace'],
      },
      backgroundImage: {
        'bg-menu': "url('/backgrounds/bg_menu.png')",
        'bg-career': "url('/backgrounds/bg_career.png')",
      },
    },
  },
  plugins: [],
}
