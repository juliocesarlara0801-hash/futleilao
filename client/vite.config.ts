import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg'],
      manifest: {
        name: 'FutLeilão',
        short_name: 'FutLeilão',
        description: 'Leilão de craques com os amigos, em tempo real.',
        theme_color: '#1B5E20',
        background_color: '#0B0F0C',
        display: 'standalone',
        start_url: '/',
        icons: [{ src: 'favicon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any maskable' }],
      },
    }),
  ],
  server: {
    port: 5173,
    proxy: {
      '/socket.io': {
        target: process.env.VITE_SERVER_URL ?? 'http://localhost:3001',
        ws: true,
      },
      '/api': {
        target: process.env.VITE_SERVER_URL ?? 'http://localhost:3001',
      },
    },
  },
});
