import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, __dirname, '');
  const browserDemo = env.VITE_DATA_MODE === 'browser';
  return {
    // GitHub Pages serves the site from /<repo>/; local builds use /.
    base: env.VITE_BASE ?? '/',
    plugins: [react()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, 'src'),
        // Server modules reused by the in-browser API of the static build.
        '@server': path.resolve(__dirname, '../server/src'),
        ...(browserDemo ? { exceljs: path.resolve(__dirname, '../node_modules/exceljs/dist/exceljs.min.js') } : {}),
      },
    },
    define: browserDemo ? { 'process.env.NODE_ENV': JSON.stringify('production') } : {},
    server: {
      port: 5180,
      strictPort: true,
      // Same-origin proxy: the httpOnly auth cookie works without CORS in development.
      proxy: { '/api': { target: 'http://localhost:4000', changeOrigin: true } },
    },
    build: {
      outDir: 'dist',
      chunkSizeWarningLimit: 2000,
      rollupOptions: {
        output: {
          manualChunks: {
            react: ['react', 'react-dom', 'react-router-dom'],
            mui: ['@mui/material', '@emotion/react', '@emotion/styled'],
            charts: ['recharts'],
            calendar: ['@fullcalendar/core', '@fullcalendar/react', '@fullcalendar/daygrid', '@fullcalendar/timegrid', '@fullcalendar/interaction', '@fullcalendar/list'],
          },
        },
      },
    },
  };
});
