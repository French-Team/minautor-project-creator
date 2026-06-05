/**
 * Persistence — Sauvegarde et restauration du graphe
 *
 * On ne persiste PAS tout le state : seulement la donnée utile
 * (nodes, edges, view). Au chargement, l'historique repart d'un état
 * unique (le graphe chargé), pas de pile reconstituée.
 *
 * Clé localStorage : `code-city-graph`
 */

import { getState, subscribe, actions } from './state.js';

const STORAGE_KEY = 'code-city-graph';
const SAVE_DEBOUNCE_MS = 400;

let saveTimer = null;
let unsubscribe = null;

export function loadGraphFromStorage() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data || !Array.isArray(data.nodes) || !Array.isArray(data.edges)) return null;
    return data;
  } catch (err) {
    console.warn('⚠️ Lecture localStorage échouée:', err);
    return null;
  }
}

export function clearGraphFromStorage() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (_) {
    /* noop */
  }
}

export function startAutoSave() {
  if (unsubscribe) return; // idempotent
  unsubscribe = subscribe((_state, meta) => {
    // On ne sauve pas à chaque notification : on debounce
    if (meta?.type === 'hover:changed' || meta?.type === 'selection:changed') return;
    scheduleSave();
  });
}

export function stopAutoSave() {
  if (unsubscribe) {
    unsubscribe();
    unsubscribe = null;
  }
  if (saveTimer) {
    clearTimeout(saveTimer);
    saveTimer = null;
  }
}

function scheduleSave() {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(flushSave, SAVE_DEBOUNCE_MS);
}

function flushSave() {
  saveTimer = null;
  const state = getState();
  const data = {
    version: 1,
    savedAt: new Date().toISOString(),
    nodes: state.nodes,
    edges: state.edges,
    view: state.view,
  };
  try {
    const json = JSON.stringify(data);
    checkStorageQuota(json.length);
    localStorage.setItem(STORAGE_KEY, json);
  } catch (err) {
    console.warn('⚠️ Écriture localStorage échouée:', err);
    if (err.name === 'QuotaExceededError' || err.code === 22) {
      actions.setStatusMessage('Espace localStorage insuffisant — données non sauvegardées', 'warning', 5000);
    }
  }
}

/**
 * Vérifie l'espace disponible dans le localStorage.
 * Si > 80% du quota est utilisé, affiche un avertissement.
 */
async function checkStorageQuota(dataSize) {
  try {
    if (!navigator.storage?.estimate) return;
    const { usage, quota } = await navigator.storage.estimate();
    if (!quota) return;
    const usagePercent = ((usage + dataSize) / quota) * 100;
    if (usagePercent > 80) {
      actions.setStatusMessage(
        `localStorage ${Math.round(usagePercent)}% plein — envisagez de purger d'anciens diagrammes`,
        'warning',
        5000,
      );
    }
  } catch (_) {
    // estimate() n'est pas toujours disponible
  }
}

export { flushSave };

/**
 * Charge le graphe depuis le localStorage s'il existe, et dispatche
 * `actions.loadGraph()` ou `actions.setView()` selon ce qui est trouvé.
 * Renvoie `true` si quelque chose a été chargé.
 */
export function restoreFromStorage() {
  const data = loadGraphFromStorage();
  if (!data) return false;

  actions.loadGraph({ nodes: data.nodes, edges: data.edges });
  if (data.view) {
    if (data.view.zoom != null) actions.setZoom(data.view.zoom);
    if (data.view.pan) actions.setPan(data.view.pan);
    if (typeof data.view.gridVisible === 'boolean') actions.setGridVisible(data.view.gridVisible);
  }
  return true;
}
