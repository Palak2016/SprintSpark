/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        forest: {
          50: '#f0f6f4',
          100: '#dde9df', // muted sage
          200: '#bcd3c2',
          300: '#91b69d',
          400: '#649576',
          500: '#437856',
          600: '#315f43',
          700: '#1F4A40', // primary deep forest green
          800: '#1b3d35',
          900: '#17332c',
          950: '#0b1d19',
        },
        charcoal: {
          50: '#f6f7f7',
          100: '#e3e6e4',
          200: '#c5cbc7',
          300: '#9ea8a2',
          400: '#75827b',
          500: '#5c6861',
          600: '#48534d',
          700: '#3a433e',
          800: '#202824', // deep charcoal
          900: '#1c221f',
          950: '#0d100f',
        },
        sage: {
          50: '#f7faf7',
          100: '#DDE9DF',
          200: '#c4d7c7',
          300: '#a3c0a8',
          400: '#7fa386',
          500: '#628769',
        },
        offwhite: '#F8FAF7',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
      boxShadow: {
        'subtle': '0 1px 2px 0 rgba(0, 0, 0, 0.04), 0 1px 3px 0 rgba(0, 0, 0, 0.02)',
        'card': '0 1px 3px 0 rgba(0, 0, 0, 0.05), 0 1px 2px -1px rgba(0, 0, 0, 0.05)',
        'popover': '0 10px 25px -5px rgba(0, 0, 0, 0.08), 0 8px 10px -6px rgba(0, 0, 0, 0.05)',
      }
    },
  },
  plugins: [],
}
