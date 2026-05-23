import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    proxy: {
      // Proxies all /api requests to your Express server
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
      // Proxies /cms-api requests to Payload CMS
      '/cms-api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/cms-api/, '/api'),
      }
    }
  }
});