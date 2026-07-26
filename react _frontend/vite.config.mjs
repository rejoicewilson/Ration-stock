import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    host: true,
    open: true,
    proxy: {
      '/count': 'http://127.0.0.1:8000',
      '/fps-stock': 'http://127.0.0.1:8000',
      '/transactions': 'http://127.0.0.1:8000',
      '/stock-register': 'http://127.0.0.1:8000',
      '/ro-details': 'http://127.0.0.1:8000',
      '/ro-quantity-details': 'http://127.0.0.1:8000',
      '/ration-card-details': 'http://127.0.0.1:8000',
    },
  },
});
