/** @type {import('tailwindcss').Config} */
const token = (name) => `rgb(var(--${name}) / <alpha-value>)`;

export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        canvas: token('bg'),
        surface: token('surface'),
        'surface-2': token('surface-2'),
        elevated: token('elevated'),
        line: token('border'),
        fg: token('fg'),
        muted: token('muted'),
        subtle: token('subtle'),
        accent: token('accent'),
        'accent-strong': token('accent-strong'),
        cyan: token('cyan'),
        violet: token('violet'),
        success: token('success'),
        danger: token('danger'),
        warn: token('warn'),
      },
      fontFamily: {
        sans: ['"Inter Variable"', 'Inter', 'system-ui', '-apple-system', 'Segoe UI', 'sans-serif'],
        mono: ['"JetBrains Mono Variable"', '"JetBrains Mono"', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
      boxShadow: {
        glow: '0 0 0 1px rgb(var(--accent) / 0.25), 0 8px 32px -8px rgb(var(--accent) / 0.35)',
        card: '0 1px 0 0 rgb(255 255 255 / 0.03) inset, 0 12px 32px -16px rgb(0 0 0 / 0.45)',
      },
      keyframes: {
        shimmer: { '0%': { backgroundPosition: '200% 0' }, '100%': { backgroundPosition: '-200% 0' } },
      },
      animation: { shimmer: 'shimmer 8s linear infinite' },
    },
  },
  plugins: [],
};
