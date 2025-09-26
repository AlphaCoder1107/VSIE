/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx}',
    './components/**/*.{js,ts,jsx,tsx}',
    './src/**/*.{js,ts,jsx,tsx}'
  ],
  theme: {
    extend: {
      container: {
        center: true,
        padding: {
          DEFAULT: '1.5rem',
          md: '3rem'
        }
      },
      screens: {
        'xs': '480px'
      },
      colors: {
        'vsie-900': '#0b1220',
        'vsie-800': '#0f1724',
        'vsie-muted': '#98a0b3',
        'vsie-accent': '#6c5cff',
        'vsie-accent-2': '#7b61ff'
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui']
      }
    }
  },
  plugins: [require('@tailwindcss/typography')]
}
