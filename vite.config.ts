import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// base: './' — собранная версия работает из любой папки, а не только из корня сайта.
export default defineConfig({
  base: './',
  plugins: [react()],
});
