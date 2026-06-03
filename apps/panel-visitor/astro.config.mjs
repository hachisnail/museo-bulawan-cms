// @ts-check
import { defineConfig } from 'astro/config';
import node from '@astrojs/node';
import tailwindcss from '@tailwindcss/vite';

// https://astro.build/config
export default defineConfig({
  output: 'server',
  adapter: node({
    mode: 'standalone',
  }),
  server: {
    port: process.env.PORT ? parseInt(process.env.PORT) : 4322
  },
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