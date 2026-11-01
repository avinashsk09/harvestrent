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
          DEFAULT: '#0F3D26',
          dark: '#0A291A',
          light: '#1B5B3A',
        },
        agri: {
          DEFAULT: '#2E7D4F',
          hover: '#24653F',
          light: '#E8F3EC',
          border: '#C3DECD',
        },
        cream: {
          DEFAULT: '#F5F0E1',
          light: '#FAF7EE',
          dark: '#E8E1CE',
          border: '#DED7C4',
        },
        amberGold: {
          DEFAULT: '#C98B2B',
          light: '#FBF3E6',
          border: '#ECD8B5',
        },
        brickRed: {
          DEFAULT: '#A63D2F',
          light: '#FAECEB',
          border: '#E8BBB7',
        },
        neutralText: {
          primary: '#1A211D',
          secondary: '#535E57',
          muted: '#76827A',
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
      boxShadow: {
        'soft': '0 1px 3px 0 rgba(15, 61, 38, 0.05), 0 1px 2px -1px rgba(15, 61, 38, 0.05)',
        'card': '0 2px 6px -1px rgba(15, 61, 38, 0.06), 0 1px 4px -2px rgba(15, 61, 38, 0.04)',
      }
    },
  },
  plugins: [],
};
