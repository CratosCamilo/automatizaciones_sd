/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './pages/**/*.{js,jsx}',
    './components/**/*.{js,jsx}',
  ],
  theme: {
    extend: {
      colors: {
        'teal-base':     '#003F4F',
        'teal-surface':  '#004D5F',
        'teal-card':     '#006070',
        'teal-hover':    '#007585',
        'cyan-bright':   '#00C4D4',
        'cyan-dim':      '#0097A7',
        'magenta':       '#D81B7C',
        'magenta-dim':   '#AD1457',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
      },
      boxShadow: {
        'card':  '0 4px 20px rgba(0,0,0,0.25)',
        'cyan':  '0 4px 16px rgba(0,196,212,0.35)',
        'up':    '0 8px 24px rgba(0,0,0,0.3)',
      },
    },
  },
  plugins: [],
}
