import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

const PORT = process.env.ENV_SERVER_PORT || 3001;
const ENV_PATH = path.resolve(process.cwd(), '.env');
const STATE_PATH = path.resolve(process.cwd(), 'minautor-state.json');
const PROVIDERS_DIR = path.resolve(process.cwd(), 'data/providers');
const ACTIVE_PROVIDER_PATH = path.resolve(process.cwd(), 'data/active-provider.json');

// Ensure providers directory exists
if (!fs.existsSync(PROVIDERS_DIR)) {
  fs.mkdirSync(PROVIDERS_DIR, { recursive: true });
}

function loadEnv() {
  if (!fs.existsSync(ENV_PATH)) {
    console.warn('⚠️  Fichier .env introuvable — aucune clé API disponible');
    return {};
  }
  const content = fs.readFileSync(ENV_PATH, 'utf-8');
  const env = {};
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    // Gérer les lignes avec = dans la valeur (pas de trim quotes ici)
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx === -1) continue;
    let key = trimmed.slice(0, eqIdx).trim();
    let value = trimmed.slice(eqIdx + 1);
    // Enlever les quotes autour de la valeur si présent
    if ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    env[key] = value;
  }
  return env;
}

function saveEnv(env) {
  const lines = Object.entries(env)
    .filter(([k, v]) => v !== undefined && v !== null)
    .map(([k, v]) => {
      // Échapper les valeurs contenant des # ou des newlines
      let escaped = String(v);
      if (escaped.includes('#') || escaped.includes('\n')) {
        escaped = `"${escaped.replace(/"/g, '\\"')}"`;
      }
      return `${k}=${escaped}`;
    });
  fs.writeFileSync(ENV_PATH, lines.join('\n') + '\n', 'utf-8');
}

function updateEnvKey(key, value) {
  const env = loadEnv();
  if (value === null || value === undefined) {
    delete env[key];
  } else {
    env[key] = value;
  }
  saveEnv(env);
}

// Retourne toutes les clés pour un provider (ex: OPENROUTER_API_KEY, OPENROUTER_API_KEY_1, OPENROUTER_API_KEY_2)
function getKeysForProvider(baseEnvKey) {
  const env = loadEnv();
  const keys = [];
  // Clé de base (sans suffixe)
  if (env[baseEnvKey]) {
    keys.push({ key: baseEnvKey, index: 0, value: env[baseEnvKey] });
  }
  // Clés avec suffixe _1, _2, etc.
  for (let i = 1; i <= 20; i++) {
    const suffixedKey = `${baseEnvKey}_${i}`;
    if (env[suffixedKey]) {
      keys.push({ key: suffixedKey, index: i, value: env[suffixedKey] });
    }
  }
  return keys;
}

// Ajoute une nouvelle clé pour un provider (trouve le prochain index libre)
function addKeyForProvider(baseEnvKey, value) {
  const env = loadEnv();
  
  // Vérifier si cette valeur existe déjà (éviter les doublons)
  for (const [k, v] of Object.entries(env)) {
    if (k.startsWith(baseEnvKey) && v === value) {
      return k; // Retourner la clé existante au lieu de créer un doublon
    }
  }
  
  // Si la clé de base n'existe pas, l'utiliser comme _0
  if (!env[baseEnvKey]) {
    env[baseEnvKey] = value;
    saveEnv(env);
    return baseEnvKey;
  }
  // Sinon trouver le prochain index libre
  for (let i = 1; i <= 20; i++) {
    const suffixedKey = `${baseEnvKey}_${i}`;
    if (!env[suffixedKey]) {
      env[suffixedKey] = value;
      saveEnv(env);
      return suffixedKey;
    }
  }
  throw new Error('Trop de clés pour ce provider (max 20)');
}

// State file helpers
function loadState() {
  try {
    if (fs.existsSync(STATE_PATH)) {
      const content = fs.readFileSync(STATE_PATH, 'utf-8');
      return JSON.parse(content);
    }
  } catch (_) {}
  return null;
}

function saveState(state) {
  try {
    fs.writeFileSync(STATE_PATH, JSON.stringify(state, null, 2), 'utf-8');
    return true;
  } catch (e) {
    console.error('[env-server] Failed to save state:', e.message);
    return false;
  }
}

// ── Provider file helpers ────────────────────────────────────────────────

function loadProviderConfig(providerId) {
  const filePath = path.join(PROVIDERS_DIR, `${providerId}.json`);
  try {
    if (fs.existsSync(filePath)) {
      return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    }
  } catch (_) {}
  return null;
}

function saveProviderConfig(providerId, config) {
  const filePath = path.join(PROVIDERS_DIR, `${providerId}.json`);
  try {
    fs.writeFileSync(filePath, JSON.stringify(config, null, 2), 'utf-8');
    return true;
  } catch (e) {
    console.error(`[env-server] Failed to save provider ${providerId}:`, e.message);
    return false;
  }
}

function deleteProviderConfig(providerId) {
  const filePath = path.join(PROVIDERS_DIR, `${providerId}.json`);
  try {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
    return true;
  } catch (e) {
    console.error(`[env-server] Failed to delete provider ${providerId}:`, e.message);
    return false;
  }
}

function listProviderConfigs() {
  try {
    if (!fs.existsSync(PROVIDERS_DIR)) return [];
    return fs.readdirSync(PROVIDERS_DIR)
      .filter(f => f.endsWith('.json'))
      .map(f => f.replace(/\.json$/, ''));
  } catch (_) {
    return [];
  }
}

function loadActiveProvider() {
  try {
    if (fs.existsSync(ACTIVE_PROVIDER_PATH)) {
      return JSON.parse(fs.readFileSync(ACTIVE_PROVIDER_PATH, 'utf-8'));
    }
  } catch (_) {}
  return { id: null };
}

function saveActiveProvider(data) {
  try {
    fs.writeFileSync(ACTIVE_PROVIDER_PATH, JSON.stringify(data, null, 2), 'utf-8');
    return true;
  } catch (e) {
    console.error('[env-server] Failed to save active provider:', e.message);
    return false;
  }
}

const server = http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  // API State (assistant config - provider, chatHistory, etc.)
  if (req.url === '/api/state') {
    if (req.method === 'GET') {
      const state = loadState();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(state || {}));
      return;
    }

    if (req.method === 'POST') {
      let body = '';
      req.on('data', chunk => { body += chunk; });
      req.on('end', () => {
        try {
          const data = JSON.parse(body);
          const ok = saveState(data);
          res.writeHead(ok ? 200 : 500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ ok }));
        } catch (e) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: e.message }));
        }
      });
      return;
    }
  }

  if (req.url === '/api/env') {
    if (req.method === 'GET') {
      const env = loadEnv();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(env));
      return;
    }

    if (req.method === 'POST') {
      let body = '';
      req.on('data', chunk => { body += chunk; });
      req.on('end', () => {
        try {
          const data = JSON.parse(body);
          if (data.action === 'setKey') {
            const { key, value } = data;
            if (!key) {
              res.writeHead(400, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ error: 'key is required' }));
              return;
            }
            updateEnvKey(key, value || '');
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ ok: true, key }));
          } else if (data.action === 'addKey') {
            // Ajoute une nouvelle clé pour un provider (multi-clé)
            const { baseEnvKey, value } = data;
            if (!baseEnvKey) {
              res.writeHead(400, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ error: 'baseEnvKey is required' }));
              return;
            }
            if (!value) {
              res.writeHead(400, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ error: 'value is required' }));
              return;
            }
            const newKey = addKeyForProvider(baseEnvKey, value);
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ ok: true, key: newKey }));
          } else if (data.action === 'getKeys') {
            // Retourne toutes les clés pour un provider
            const { baseEnvKey } = data;
            if (!baseEnvKey) {
              res.writeHead(400, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ error: 'baseEnvKey is required' }));
              return;
            }
            const keys = getKeysForProvider(baseEnvKey);
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ keys }));
          } else if (data.action === 'deleteKey') {
            const { key } = data;
            if (!key) {
              res.writeHead(400, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ error: 'key is required' }));
              return;
            }
            updateEnvKey(key, null);
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ ok: true, deleted: key }));
          } else if (data.action === 'clear') {
            saveEnv({});
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ ok: true }));
          } else {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'unknown action' }));
          }
        } catch (e) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: e.message }));
        }
      });
      return;
    }
  }

  // ── API Active Provider ─────────────────────────────────────────────
  if (req.url === '/api/active-provider') {
    if (req.method === 'GET') {
      const active = loadActiveProvider();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(active));
      return;
    }
    if (req.method === 'POST') {
      let body = '';
      req.on('data', chunk => { body += chunk; });
      req.on('end', () => {
        try {
          const data = JSON.parse(body);
          const ok = saveActiveProvider(data);
          res.writeHead(ok ? 200 : 500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ ok }));
        } catch (e) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: e.message }));
        }
      });
      return;
    }
  }

  // ── API Provider list ────────────────────────────────────────────
  if (req.url === '/api/providers' && req.method === 'GET') {
    const ids = listProviderConfigs();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ providers: ids }));
    return;
  }

  // ── API Provider config (/api/providers/{id}) ────────────────────
  const providersMatch = req.url.match(/^\/api\/providers\/([a-zA-Z0-9_-]+)$/);
  if (providersMatch) {
    const providerId = providersMatch[1];

    if (req.method === 'GET') {
      const config = loadProviderConfig(providerId);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(config || {}));
      return;
    }

    if (req.method === 'POST') {
      let body = '';
      req.on('data', chunk => { body += chunk; });
      req.on('end', () => {
        try {
          const config = JSON.parse(body);
          const ok = saveProviderConfig(providerId, config);
          res.writeHead(ok ? 200 : 500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ ok }));
        } catch (e) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: e.message }));
        }
      });
      return;
    }

    if (req.method === 'DELETE') {
      const ok = deleteProviderConfig(providerId);
      res.writeHead(ok ? 200 : 500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok }));
      return;
    }
  }

  res.writeHead(404);
  res.end('Not found');
});

server.listen(PORT, () => {
  console.log(`🔑 Env server running on http://localhost:${PORT}/api/env`);
});