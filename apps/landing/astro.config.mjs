// @ts-check
import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';
import react from '@astrojs/react';

// https://astro.build/config
export default defineConfig({
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