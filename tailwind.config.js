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
          // ── Primary accent ──────────────────────────
          red:           '#6D001A',   // Burgundy
          'red-dark':    '#550015',   // Deep burgundy
          'red-light':   '#8B0021',   // Mid burgundy
          // ── Dark surfaces ───────────────────────────
          black:         '#000000',   // Pure black
          brown:         '#111111',   // Dark surface
          'brown-light': '#222222',   // Slightly lighter dark surface
          // ── Light surfaces ──────────────────────────
          cream:         '#F8F8F8',   // Near-white background
          beige:         '#C0C0C0',   // Light borders / muted text
          'beige-light': '#E0E0E0',   // Lighter border
          // ── Semantic aliases ────────────────────────
          terracotta:    '#6D001A',   // = burgundy
          ochre:         '#E0E0E0',   // Light gray (text on dark bg)
          gold:          '#FFFFFF',   // White (star/badge highlights)
          blue:          '#6D001A',   // = burgundy (verified badge)
          'blue-dark':   '#550015',
          'blue-light':  '#8B0021',
        },
      },
      fontFamily: {
        sans:    ['Plus Jakarta Sans', 'system-ui', 'sans-serif'],
        display: ['Cormorant Garamond', 'Georgia', 'serif'],
      },
      backgroundImage: {
        'shuka-pattern':   "repeating-conic-gradient(#6D001A 0% 25%, #000000 0% 50%) 0 0 / 20px 20px",
        'maasai-gradient': 'linear-gradient(135deg, #000000 0%, #111111 50%, #6D001A 100%)',
        'hero-gradient':   'linear-gradient(180deg, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.4) 60%, rgba(109,0,26,0.3) 100%)',
      },
      animation: {
        'bead-pulse': 'bead-pulse 1.5s ease-in-out infinite',
        'fade-in':    'fadeIn 0.5s ease-in-out',
        'slide-up':   'slideUp 0.4s ease-out',
        'shimmer':    'shimmer 2s linear infinite',
      },
      keyframes: {
        'bead-pulse': {
          '0%, 100%': { transform: 'scale(1)', opacity: '1' },
          '50%':       { transform: 'scale(1.2)', opacity: '0.8' },
        },
        'fadeIn': {
          '0%':   { opacity: '0' },
          '100%': { opacity: '1' },
        },
        'slideUp': {
          '0%':   { transform: 'translateY(20px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        'shimmer': {
          '0%':   { backgroundPosition: '-1000px 0' },
          '100%': { backgroundPosition: '1000px 0' },
        },
      },
      boxShadow: {
        'maasai':     '0 4px 20px rgba(109, 0, 26, 0.25)',
        'card':       '0 2px 15px rgba(0, 0, 0, 0.10)',
        'card-hover': '0 8px 30px rgba(0, 0, 0, 0.20)',
      },
    },
  },
  plugins: [],
};
