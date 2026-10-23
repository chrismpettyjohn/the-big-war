import { defineConfig } from 'vite';
import solid from 'vite-plugin-solid';

export default defineConfig({
  plugins: [solid()],
  css: {
    transformer: 'lightningcss',
  },
  server: { port: 5173, host: true },
  build: {
    target: 'es2022',
    cssMinify: 'lightningcss',
  },
});
