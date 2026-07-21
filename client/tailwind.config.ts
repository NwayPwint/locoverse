import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        background: '#F7F8FA',
        surface: {
          DEFAULT: '#FFFFFF',
          hover: '#F0F2F4',
        },
        'text-primary': '#1A1D23',
        'text-secondary': '#6B7280',
        'accent-creative': '#3D4A5C',
        'accent-action': '#529692',
        'accent-warm': '#3A7A75',
        'accent-success': '#4A8F8A',
        border: '#E5E7EB',
      },
      fontFamily: {
        body: ['var(--font-inter)', 'Inter', 'sans-serif'],
        heading: ['var(--font-jakarta)', 'Plus Jakarta Sans', 'sans-serif'],
        mono: ['var(--font-mono)', 'JetBrains Mono', 'monospace'],
      },
      borderRadius: {
        lg: '8px',
      },
      animation: {
        'fade-in': 'fadeIn 0.3s ease-in-out',
        'marquee': 'marquee 20s linear infinite',
        'wave': 'wave 1.2s ease-in-out infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        marquee: {
          '0%': { transform: 'translateX(0%)' },
          '100%': { transform: 'translateX(-50%)' },
        },
        wave: {
          '0%, 100%': { transform: 'scaleY(0.3)' },
          '50%': { transform: 'scaleY(1)' },
        },
      },
    },
  },
  plugins: [],
};

export default config;
