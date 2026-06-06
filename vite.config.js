import { defineConfig } from 'vite';

// Ports des providers locaux — proxy pour éviter CORS
const LOCAL_PROVIDERS = {
  ollama:   { port: 11434 },
  lmstudio: { port: 1234 },
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
  return proxy;
}

export default defineConfig({
  server: {
    port: 8081,
    strictPort: true,
    open: false,
    proxy: buildLocalProxy(),
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
