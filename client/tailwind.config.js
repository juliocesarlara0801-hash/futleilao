/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        gold: {
          DEFAULT: '#FFD700',
          dim: '#C9A600',
        },
        pitch: {
          DEFAULT: '#1B5E20',
          dark: '#0F3D12',
          darker: '#0B0F0C',
        },
      },
      fontFamily: {
        sans: ['Poppins', 'Inter', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        gold: '0 0 20px rgba(255, 215, 0, 0.35)',
      },
      keyframes: {
        flipIn: {
          '0%': { transform: 'rotateY(90deg)', opacity: '0' },
          '100%': { transform: 'rotateY(0deg)', opacity: '1' },
        },
        pulseGold: {
          '0%, 100%': { boxShadow: '0 0 0px rgba(255,215,0,0.4)' },
          '50%': { boxShadow: '0 0 24px rgba(255,215,0,0.8)' },
        },
      },
      animation: {
        flipIn: 'flipIn 0.5s ease-out',
        pulseGold: 'pulseGold 1.5s ease-in-out infinite',
      },
    },
  },
  plugins: [],
};
