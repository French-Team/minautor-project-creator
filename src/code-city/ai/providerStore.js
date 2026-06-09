/**
 * providerStore.js — Stockage des configurations provider (1 fichier/provider)
 *
 * Interface client pour les endpoints /api/providers/{id} et /api/active-provider
 * Chaque provider a son propre fichier JSON sérialisé sur le serveur dans data/providers/.
 *
 * Règle d'or : Seul le bouton "💾 Enregistrer" écrit sur le disque.
 * Tout le workflow (test clé, sélection modèle, validation) ne vit qu'en mémoire.
 *
 * @module providerStore
 */

/**
 * Charge la config d'un provider depuis son fichier.
 * @param {string} providerId
 * @returns {Promise<Object>} Config ou objet vide si pas de fichier
 */
export async function getProviderConfig(providerId) {
  if (!providerId) return {};
  try {
    const resp = await fetch(`/api/providers/${encodeURIComponent(providerId)}`);
    if (resp.ok) {
      return await resp.json();
    }
  } catch (err) {
    console.warn('[providerStore] getProviderConfig:', err.message);
  }
  return {};
}

/**
 * Sauvegarde la config d'un provider dans son fichier.
 * C'est le SEUL point de persistance des configs provider.
 * @param {string} providerId
 * @param {Object} config - { model, temperature, maxTokens, isConnected, lastTestedAt }
 * @returns {Promise<boolean>}
 */
export async function setProviderConfig(providerId, config) {
  if (!providerId) return false;
  try {
    const resp = await fetch(`/api/providers/${encodeURIComponent(providerId)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(config),
    });
    return resp.ok;
  } catch (err) {
    console.warn('[providerStore] setProviderConfig:', err.message);
    return false;
  }
}

/**
 * Supprime le fichier de config d'un provider.
 * @param {string} providerId
 * @returns {Promise<boolean>}
 */
export async function deleteProviderConfig(providerId) {
  if (!providerId) return false;
  try {
    const resp = await fetch(`/api/providers/${encodeURIComponent(providerId)}`, {
      method: 'DELETE',
    });
    return resp.ok;
  } catch (err) {
    console.warn('[providerStore] deleteProviderConfig:', err.message);
    return false;
  }
}

/**
 * Retourne la liste des IDs de providers qui ont une config sauvegardée.
 * @returns {Promise<string[]>}
 */
export async function listSavedProviders() {
  try {
    const resp = await fetch('/api/providers');
    if (resp.ok) {
      const data = await resp.json();
      return data.providers || [];
    }
  } catch (err) {
    console.warn('[providerStore] listSavedProviders:', err.message);
  }
  return [];
}

/**
 * Charge le provider actif (celui sélectionné au dernier usage).
 * @returns {Promise<string|null>} providerId ou null
 */
export async function getActiveProvider() {
  try {
    const resp = await fetch('/api/active-provider');
    if (resp.ok) {
      const data = await resp.json();
      return data.id || null;
    }
  } catch (err) {
    console.warn('[providerStore] getActiveProvider:', err.message);
  }
  return null;
}

/**
 * Sauvegarde le provider actif (uniquement son ID, pas la config complète).
 * @param {string|null} providerId
 * @returns {Promise<boolean>}
 */
export async function setActiveProvider(providerId) {
  try {
    const resp = await fetch('/api/active-provider', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: providerId }),
    });
    return resp.ok;
  } catch (err) {
    console.warn('[providerStore] setActiveProvider:', err.message);
    return false;
  }
}
