/**
 * envLoader — Charge les clés API depuis /api/env (serveur Node)
 * Les clés viennent du fichier .env à la racine, exposées via env-server.mjs
 * 
 * Support multi-clé avec rotation LRU pour gérer les rate limits (429).
 */

let cachedEnv = null;

// Rotation LRU : Index de la prochaine clé à utiliser
let keyRotationIndex = {};

/**
 * Charge toutes les clés API depuis /api/env
 * @returns {Promise<Record<string, string>>}
 */
export async function loadEnvKeys() {
  if (cachedEnv) return cachedEnv;
  try {
    const resp = await fetch('/api/env');
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const data = await resp.json();
    cachedEnv = data;
    return cachedEnv;
  } catch (err) {
    console.warn('[envLoader] Impossible de charger /api/env:', err.message);
    // Ne pas cacher le résultat vide — permet de réessayer au prochain appel
    return {};
  }
}

/**
 * Retourne TOUTES les clés pour un provider (base + suffixées _1, _2, etc.)
 * @param {string} baseEnvKey - Clé de base (ex: 'OPENROUTER_API_KEY')
 * @returns {Array<{key: string, index: number, value: string}>}
 */
export function getAllKeysForEnvKey(baseEnvKey) {
  if (!cachedEnv || !baseEnvKey) return [];
  
  const keys = [];
  // Clé de base (index 0)
  if (cachedEnv[baseEnvKey]) {
    keys.push({ key: baseEnvKey, index: 0, value: cachedEnv[baseEnvKey] });
  }
  // Clés avec suffixe _1, _2, etc.
  for (let i = 1; i <= 20; i++) {
    const suffixedKey = `${baseEnvKey}_${i}`;
    if (cachedEnv[suffixedKey]) {
      keys.push({ key: suffixedKey, index: i, value: cachedEnv[suffixedKey] });
    }
  }
  return keys;
}

/**
 * Retourne la prochaine clé API pour un provider (rotation LRU)
 * Et incrémente l'index pour la prochaine utilisation.
 * @param {string} baseEnvKey - Clé de base (ex: 'OPENROUTER_API_KEY')
 * @returns {{key: string, value: string}|null}
 */
export function getNextApiKey(baseEnvKey) {
  const keys = getAllKeysForEnvKey(baseEnvKey);
  if (keys.length === 0) return null;
  
  // Initialiser l'index si nécessaire
  // Commencer à index 1 pour éviter de retourner la même clé
  // que la première tentative (qui utilise déjà keys[0])
  if (keyRotationIndex[baseEnvKey] === undefined) {
    keyRotationIndex[baseEnvKey] = 1;
  }
  
  // Récupérer la clé courante et incrémenter
  const currentIndex = keyRotationIndex[baseEnvKey];
  const keyInfo = keys[currentIndex % keys.length];
  
  keyRotationIndex[baseEnvKey] = (currentIndex + 1) % keys.length;
  
  return keyInfo;
}

/**
 * Reset l'index de rotation pour un provider (utile après une erreur non-429)
 * @param {string} baseEnvKey 
 */
export function resetRotationIndex(baseEnvKey) {
  keyRotationIndex[baseEnvKey] = 0;
}

/**
 * Retourne la clé API pour un envKey donné (première clé, pour compatibilité)
 * @param {string|null} envKey - Nom de la variable d'env (ex: 'OPENROUTER_API_KEY')
 * @returns {string}
 */
export function getApiKeyForEnvKey(envKey) {
  if (!envKey || !cachedEnv) return '';
  return cachedEnv[envKey] || '';
}

/**
 * Vérifie si un provider a au moins une clé API configurée
 * @param {object} provider - Provider config (doit avoir .envKey)
 * @returns {boolean}
 */
export function hasApiKey(provider) {
  if (!provider?.envKey) return false;
  const keys = getAllKeysForEnvKey(provider.envKey);
  return keys.length > 0;
}

/**
 * Invalide le cache — pour forcer un rechargement
 */
export function invalidateCache() {
  cachedEnv = null;
  keyRotationIndex = {};
}

/**
 * Retourne le cache des clés API (pour usage interne)
 * @returns {Record<string, string>|null}
 */
export function getCachedEnv() {
  return cachedEnv;
}