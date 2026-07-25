import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// Если приложение будет лежать не в корне домена (например, на GitHub Pages
// по адресу user.github.io/cashback/), запусти сборку так:
//   VITE_BASE=/cashback/ npm run build
const base = process.env.VITE_BASE ?? '/';

// Один и тот же порт для разработки и для preview — это важно:
// localStorage привязан к адресу вместе с портом, и на разных портах
// браузер считает приложение разными сайтами, то есть данные «пропадают».
const PORT = 4173;

export default defineConfig({
  base,
  server: { port: PORT, strictPort: true },
  preview: { port: PORT, strictPort: true },
  plugins: [
    react(),
    VitePWA({
      // Новая версия приложения подхватывается сама, без ручной перезагрузки.
      registerType: 'autoUpdate',
      workbox: {
        // Кладём в офлайн-кеш всё, включая 196 логотипов банков,
        // чтобы приложение полностью работало без интернета.
        globPatterns: ['**/*.{js,css,html,png,svg,woff2}'],
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
      },
      manifest: {
        name: 'Кешбэк — мои банки',
        short_name: 'Кешбэк',
        description: 'Быстро смотреть, в каком банке какой кешбэк за категорию',
        lang: 'ru',
        start_url: base,
        scope: base,
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#0f1115',
        theme_color: '#4f46e5',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          {
            src: 'icons/icon-maskable-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
    }),
  ],
});
