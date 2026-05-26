// @ts-check
import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';
import react from '@astrojs/react';
import node from '@astrojs/node';

// https://astro.build/config
export default defineConfig({
  output: 'server',
  adapter: node({
    mode: 'standalone',
  }),
  integrations: [
    react(), // Enables React component support
  ],
  vite: {
    plugins: [
      // @ts-expect-error - Bypasses the Rollup/Rolldown type mismatch in Vite
      tailwindcss(),
    ],
    // This stops Vite from choking on Astro's internal 'astro:' modules
    ssr: {
      noExternal: ['@tailwindcss/vite'],
    }
  },
});