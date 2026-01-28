import path from 'path';
import fs from 'fs';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

// Tailscale TLS certificate paths
const TLS_CERT_PATH = '/etc/tailscale-certs/vvicier-nextcloud.minmi-gar.ts.net.crt';
const TLS_KEY_PATH = '/etc/tailscale-certs/vvicier-nextcloud.minmi-gar.ts.net.key';

// Check if TLS certs exist
const tlsEnabled = fs.existsSync(TLS_CERT_PATH) && fs.existsSync(TLS_KEY_PATH);

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');
  const apiHost = env.VITE_API_HOST || 'localhost';
  const protocol = tlsEnabled ? 'https' : 'http';
  const wsProtocol = tlsEnabled ? 'wss' : 'ws';
  return {
    server: {
      port: 3000,
      host: '0.0.0.0',
      allowedHosts: ['vvicier-nextcloud.minmi-gar.ts.net'],
      https: tlsEnabled ? {
        key: fs.readFileSync(TLS_KEY_PATH),
        cert: fs.readFileSync(TLS_CERT_PATH),
      } : undefined,
      proxy: {
        '/api': {
          target: `${protocol}://${apiHost}:3001`,
          changeOrigin: true,
          secure: false,
        },
        '/ws': {
          target: `${wsProtocol}://${apiHost}:3001`,
          ws: true,
          secure: false,
        },
      },
    },
    plugins: [react()],
    define: {
      'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY)
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      }
    }
  };
});
