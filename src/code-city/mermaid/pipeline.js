/**
 * Mermaid Pipeline — Synchronisation state ↔ code Mermaid
 *
 * - À chaque mutation du graphe, regénère le code et l'écrit dans le
 *   textarea `#code-preview`.
 * - Quand l'utilisateur modifie le textarea à la main, on parse son code
 *   et on met à jour l'état (sans toucher aux positions).
 * - Boucle infinie évitée par un drapeau `isApplyingFromState`.
 */

import { getState, subscribe, actions } from '../state.js';
import { buildMermaidCode, parseMermaidCode } from './build.js';

let textarea = null;
let isApplyingFromState = false;
let lastGenerated = '';

export function initializeMermaidPipeline() {
  textarea = document.getElementById('code-preview');
  if (!textarea) {
    console.warn('⚠️ Textarea #code-preview introuvable, pipeline inactif.');
    return;
  }

  // Rendre éditable (le code HTML initial le déclare readonly)
  textarea.removeAttribute('readonly');

  // 1) State -> textarea
  subscribe((_state, meta) => {
    if (meta?.type === 'status:message' || meta?.type === 'hover:changed') return;
    refreshFromState();
  });

  // 2) Textarea -> state
  let debounceId = null;
  textarea.addEventListener('input', () => {
    if (isApplyingFromState) return;
    clearTimeout(debounceId);
    debounceId = setTimeout(() => {
      applyUserEdit(textarea.value);
    }, 350);
  });

  // Premier rendu
  refreshFromState();
  console.log('🔗 Pipeline Mermaid initialisé');
}

/* --------------------------------------------------------------------------
 * State -> textarea
 * -------------------------------------------------------------------------- */

function refreshFromState() {
  if (!textarea) return;
  const code = buildMermaidCode(getState());
  if (code === lastGenerated && textarea.value === code) return;
  lastGenerated = code;
  isApplyingFromState = true;
  textarea.value = code;
  isApplyingFromState = false;
}

/* --------------------------------------------------------------------------
 * Textarea -> state
 * -------------------------------------------------------------------------- */

function applyUserEdit(code) {
  const parsed = parseMermaidCode(code);
  if (parsed.error) {
    actions.setStatusMessage(`Mermaid: ${parsed.error}`, 'warning');
    return;
  }

  const state = getState();
  // Réconciliation par ID : on garde la position/type/priority des nœuds
  // existants si l'ID est inchangé. Les nouveaux nœuds sont ajoutés avec
  // des positions par défaut (grille). Les nœuds absents du code sont
  // supprimés.
  const oldById = new Map(state.nodes.map((n) => [n.id, n]));

  // Calcul d'une grille de placement pour les nouveaux nœuds
  const GRID = 40;
  const COLS = 6;
  let nextSlot = 0;
  const usedPositions = new Set(
    state.nodes.map((n) => `${Math.round(n.x / GRID)},${Math.round(n.y / GRID)}`),
  );

  const newNodes = parsed.nodes.map((n) => {
    const existing = oldById.get(n.id);
    if (existing) {
      return { ...existing, label: n.label };
    }
    // Trouve un slot libre
    let x = 0;
    let y = 0;
    while (usedPositions.has(`${Math.round(x / GRID)},${Math.round(y / GRID)}`)) {
      nextSlot += 1;
      x = (nextSlot % COLS) * GRID;
      y = Math.floor(nextSlot / COLS) * GRID;
    }
    usedPositions.add(`${Math.round(x / GRID)},${Math.round(y / GRID)}`);
    return {
      id: n.id,
      type: n.type || 'process',
      label: n.label,
      x,
      y,
      priority: 'medium',
      icon: '📌',
    };
  });

  // Réconciliation des arêtes (par triplet from/to/label)
  const oldEdges = new Map(
    state.edges.map((e) => [`${e.from}::${e.to}::${e.label || ''}`, e]),
  );
  const newEdges = parsed.edges.map((e) => {
    const key = `${e.from}::${e.to}::${e.label || ''}`;
    const existing = oldEdges.get(key);
    if (existing) return existing;
    return { from: e.from, to: e.to, label: e.label || '' };
  });

  const newGraph = { nodes: newNodes, edges: newEdges };

  // Détection de changement réel pour éviter une boucle d'historique
  if (graphsEqual(state, newGraph)) return;

  actions.loadGraph(newGraph);
  actions.setStatusMessage('Code Mermaid synchronisé', 'success', 1500);
}

function graphsEqual(a, b) {
  if (a.nodes.length !== b.nodes.length || a.edges.length !== b.edges.length) return false;
  for (let i = 0; i < a.nodes.length; i++) {
    const x = a.nodes[i];
    const y = b.nodes.find((n) => n.id === x.id);
    if (!y) return false;
    if (x.label !== y.label || x.type !== y.type || x.x !== y.x || x.y !== y.y) return false;
  }
  for (let i = 0; i < a.edges.length; i++) {
    const x = a.edges[i];
    const y = b.edges.find(
      (e) => e.from === x.from && e.to === x.to && (e.label || '') === (x.label || ''),
    );
    if (!y) return false;
  }
  return true;
}
