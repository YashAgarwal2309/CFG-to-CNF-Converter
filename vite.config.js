import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Relative base so the production build works from any static host or sub-path.
export default defineConfig({
  base: './',
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './src/test/setup.js',
    css: false,
  },
});
