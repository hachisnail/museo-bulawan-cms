// @ts-check
import { defineConfig } from 'astro/config';
import node from '@astrojs/node';
import tailwindcss from '@tailwindcss/vite';

// https://astro.build/config
export default defineConfig({
  output: 'server',
  adapter: node({
    mode: 'standalone'
  }),
  server: {
    port: 4321
  },
  vite: {
    server: {
      proxy: {
        '/api': {
          target: 'http://localhost:3000',
          changeOrigin: true,
        }
      }
    },
    plugins: [
      // @ts-expect-error - Bypasses the Rollup/Rolldown type mismatch between root vite and astro's bundled vite
      tailwindcss()
    ],
    ssr: {
      noExternal: ['@tailwindcss/vite']
    }
  }
});