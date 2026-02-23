/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        maasai: {
          red: '#B22222',
          'red-dark': '#8B1515',
          'red-light': '#D44545',
          black: '#1A0F00',
          blue: '#3A5FCD',
          'blue-dark': '#2A4FAD',
          'blue-light': '#5A7FED',
          terracotta: '#C1440E',
          ochre: '#E07A5F',
          beige: '#D2B48C',
          'beige-light': '#EDD9B8',
          brown: '#2F1F0F',
          'brown-light': '#4A3020',
          cream: '#FDF6E3',
          gold: '#D4A017',
        },
      },
      fontFamily: {
        sans: ['Poppins', 'system-ui', 'sans-serif'],
        display: ['Playfair Display', 'Georgia', 'serif'],
      },
      backgroundImage: {
        'shuka-pattern': "repeating-conic-gradient(#B22222 0% 25%, #1A0F00 0% 50%) 0 0 / 20px 20px",
        'maasai-gradient': 'linear-gradient(135deg, #1A0F00 0%, #2F1F0F 50%, #C1440E 100%)',
        'hero-gradient': 'linear-gradient(180deg, rgba(26,15,0,0.85) 0%, rgba(26,15,0,0.4) 60%, rgba(193,68,14,0.3) 100%)',
      },
      animation: {
        'bead-pulse': 'bead-pulse 1.5s ease-in-out infinite',
        'fade-in': 'fadeIn 0.5s ease-in-out',
        'slide-up': 'slideUp 0.4s ease-out',
        'shimmer': 'shimmer 2s linear infinite',
      },
      keyframes: {
        'bead-pulse': {
          '0%, 100%': { transform: 'scale(1)', opacity: '1' },
          '50%': { transform: 'scale(1.2)', opacity: '0.8' },
        },
        'fadeIn': {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        'slideUp': {
          '0%': { transform: 'translateY(20px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        'shimmer': {
          '0%': { backgroundPosition: '-1000px 0' },
          '100%': { backgroundPosition: '1000px 0' },
        },
      },
      boxShadow: {
        'maasai': '0 4px 20px rgba(178, 34, 34, 0.25)',
        'card': '0 2px 15px rgba(26, 15, 0, 0.12)',
        'card-hover': '0 8px 30px rgba(26, 15, 0, 0.2)',
      },
    },
  },
  plugins: [],
};
