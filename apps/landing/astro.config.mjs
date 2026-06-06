// @ts-check
import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import node from '@astrojs/node';
import sitemap from '@astrojs/sitemap';

// https://astro.build/config
export default defineConfig({
  site: process.env.SITE_URL || 'https://museobulawan.com',
  output: 'static',
  adapter: node({
    mode: 'standalone',
  }),
  server: {
    port: process.env.PORT ? parseInt(process.env.PORT) : 4321
  },
  integrations: [
    react(), // Enables React component support
    sitemap(), // Enables sitemap generation
  ],
});