import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'node:path';
export default defineConfig({
    plugins: [react(), tailwindcss()],
    resolve: {
        alias: {
            '@': path.resolve(__dirname, './src'),
        },
    },
    server: {
        port: 5173,
        /** Respaldo si algo usa fetch relativo a /api sin VITE_API_URL (el cliente usa origen absoluto en dev). */
        proxy: {
            '/api': {
                target: process.env.VITE_API_PROXY_TARGET ?? 'http://localhost:8080',
                changeOrigin: true,
                secure: false,
            },
            /** Opcional: el cliente llama a Georef/Nominatim por HTTPS (CORS abierto). Útil si algo usa estas rutas a mano. */
            '/georef-api': {
                target: 'https://apis.datos.gob.ar/georef',
                changeOrigin: true,
                secure: true,
                rewrite: (path) => path.replace(/^\/georef-api/, ''),
            },
            '/nominatim': {
                target: 'https://nominatim.openstreetmap.org',
                changeOrigin: true,
                secure: true,
                rewrite: (path) => path.replace(/^\/nominatim/, ''),
                configure: (proxy) => {
                    proxy.on('proxyReq', (proxyReq) => {
                        proxyReq.setHeader('User-Agent', 'VialtoLogistica/1.0');
                    });
                },
            },
        },
    },
});
