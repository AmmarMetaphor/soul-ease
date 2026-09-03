/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { fileURLToPath, URL } from 'node:url';

/**
 * SOULEASE_SINGLE_FILE=1 produces one JS + one CSS asset with relative paths,
 * which a small post-step can inline into index.html for hosts that serve a
 * single static page (standalone previews). Netlify builds use the default.
 */
const singleFile = process.env.SOULEASE_SINGLE_FILE === '1';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  base: singleFile ? './' : '/',
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  build: {
    sourcemap: false,
    outDir: singleFile ? 'dist-single' : 'dist',
    rollupOptions: {
      output: singleFile
        ? { inlineDynamicImports: true }
        : {
            manualChunks: {
              react: ['react', 'react-dom', 'react-router-dom'],
              supabase: ['@supabase/supabase-js'],
            },
          },
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}', 'server/**/*.test.ts'],
    css: false,
  },
});
