// @ts-check
import { defineConfig } from 'astro/config';

// https://astro.build/config
export default defineConfig({
  // Enable server-side rendering so new articles are fetched on every request
  // instead of being pre-built at build time (which caused 404 on new articles).
  output: 'server',
});
