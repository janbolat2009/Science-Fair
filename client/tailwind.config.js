/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: {
        display: ['"Space Mono"', 'monospace'],
        body: ['"DM Sans"', 'sans-serif'],
      },
      colors: {
        obsidian: '#0a0a0f',
        void: '#111118',
        surface: '#16161f',
        panel: '#1c1c28',
        border: '#2a2a3d',
        accent: '#6c63ff',
        cyan: '#00d4ff',
        ember: '#ff6b35',
        mint: '#00e5a0',
        muted: '#4a4a6a',
        text: '#e0e0f0',
        subtle: '#8888aa',
      },
      animation: {
        'pulse-slow': 'pulse 3s ease-in-out infinite',
        'glow': 'glow 2s ease-in-out infinite alternate',
      },
      keyframes: {
        glow: {
          '0%': { boxShadow: '0 0 5px rgba(108,99,255,0.3)' },
          '100%': { boxShadow: '0 0 20px rgba(108,99,255,0.7)' },
        }
      }
    },
  },
  plugins: [],
}
