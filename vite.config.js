import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  // Optimize for Three.js and WebGL
  optimizeDeps: {
    include: ['three', 'gsap', '@react-three/fiber', '@react-three/drei', '@react-three/postprocessing'],
  },
  // Build optimizations
  build: {
    target: 'esnext',
    minify: 'esbuild',
  },
  // Development server settings
  server: {
    port: 3000,
    open: true,
  },
});
