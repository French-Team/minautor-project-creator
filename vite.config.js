import { defineConfig } from 'vite';

// Ports des providers locaux — proxy pour éviter CORS
const LOCAL_PROVIDERS = {
  ollama:   { port: 11434 },
  lmstudio: { port: 1234 },
};

// Providers en ligne qui nécessitent un proxy (pas de CORS côté serveur)
const PROXIED_ONLINE_PROVIDERS = {
  kilo: { target: 'https://api.kilo.ai' },
  'opencode-zen': { target: 'https://opencode.ai/zen/v1' },
};

function buildLocalProxy() {
  const proxy = {};
  for (const [id, { port }] of Object.entries(LOCAL_PROVIDERS)) {
    proxy[`/local-api/${id}`] = {
      target: `http://localhost:${port}`,
      changeOrigin: true,
      rewrite: (path) => path.replace(new RegExp(`^/local-api/${id}`), ''),
    };
  }
  // Providers en ligne avec proxy (CORS)
  for (const [id, { target }] of Object.entries(PROXIED_ONLINE_PROVIDERS)) {
    proxy[`/local-api/${id}`] = {
      target,
      changeOrigin: true,
      rewrite: (path) => path.replace(new RegExp(`^/local-api/${id}`), ''),
    };
  }
  return proxy;
}

export default defineConfig({
  server: {
    port: 8081,
    strictPort: true,
    open: false,
    watch: {
      // Ignorer les fichiers .env pour éviter les hard refresh quand on modifie les clés API
      ignored: ['**/.env', '**/.env.*'],
    },
    proxy: {
      ...buildLocalProxy(),
      // Proxy env server (port 3001 → 8081)
      '/api/env': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
      '/api/state': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
      '/api/providers': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
      '/api/active-provider': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
  preview: {
    port: 8081,
    strictPort: true
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
    target: 'es2020'
  }
});
