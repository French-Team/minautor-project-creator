/**
 * Keyboard — Raccourcis clavier globaux
 *
 * Ne s'active pas quand le focus est dans un input/textarea/contentEditable.
 *
 *   Ctrl/Cmd + Z         → undo
 *   Ctrl/Cmd + Y         → redo
 *   Ctrl/Cmd + Shift + Z → redo (variante)
 *   Ctrl/Cmd + S         → force-save + toast
 *   Ctrl/Cmd + A         → tout sélectionner
 *   Ctrl/Cmd + D         → dupliquer la sélection
 *   Ctrl/Cmd + C         → copier la sélection
 *   Ctrl/Cmd + V         → coller (à la position du pan courant)
 *   Ctrl/Cmd + +         → zoom avant
 *   Ctrl/Cmd + -         → zoom arrière
 *   Ctrl/Cmd + 0         → zoom reset 100%
 *   Flèches              → décaler la sélection d'un pas de grille
 *   Shift + Flèches      → décaler d'un pas plus large (×5)
 *   F2                   → ouvrir le panneau Propriétés pour le nœud sélectionné
 *   Enter                → ouvrir le panneau Propriétés (variante)
 *
 *   Ctrl+Shift+A         → ouvrir le panneau chat (Assistant Mina)
 *   Ctrl+Shift+C         → complétion FIM inline (quand focus dans #code-preview)
 */

import { getState, actions } from './state.js';
import { flushSave } from './persistence.js';
import { openPropertiesAndFocusLabel } from './quartierCenter/centerTabs.js';
import { openChatPanel } from './ai/chatPanel.js';
import { triggerFimCompletion, insertFimCompletion } from './ai/fimHandler.js';

let isInstalled = false;

// Clipboard interne pour le copier/coller (nodes + edges)
let clipboard = { nodes: [], edges: [] };

export function installKeyboardShortcuts() {
  if (isInstalled) return;
  isInstalled = true;

  document.addEventListener('keydown', (e) => {
    const key = e.key;

    // --- Ctrl+Shift+C → complétion FIM inline (doit fonctionner DANS les textareas) ---
    if (e.ctrlKey && e.shiftKey && key.toLowerCase() === 'c') {
      const codeArea = document.getElementById('code-preview');
      if (document.activeElement === codeArea && codeArea.selectionStart !== codeArea.selectionEnd) {
        e.preventDefault();
        triggerFimCompletion(codeArea, (type, msg) => {
          actions.setStatusMessage(msg, type === 'error' ? 'error' : 'info', type === 'done' ? 2000 : 0);
        }).then((completion) => {
          if (completion) insertFimCompletion(codeArea, completion);
        });
      }
      return;
    }

    // --- Ctrl+Shift+A → ouvrir panneau chat ---
    if (e.ctrlKey && e.shiftKey && key.toLowerCase() === 'a') {
      e.preventDefault();
      openChatPanel();
      return;
    }

    if (shouldIgnoreEvent(e)) return;

    const meta = e.ctrlKey || e.metaKey;

    // --- Undo / Redo ---
    if (meta && key.toLowerCase() === 'z' && !e.shiftKey) {
      e.preventDefault();
      if (actions.undo()) {
        actions.setStatusMessage('Annulé', 'info', 1000);
      }
      return;
    }
    if (meta && (key.toLowerCase() === 'y' || (key.toLowerCase() === 'z' && e.shiftKey))) {
      e.preventDefault();
      if (actions.redo()) {
        actions.setStatusMessage('Rétabli', 'info', 1000);
      }
      return;
    }

    // --- Save ---
    if (meta && key.toLowerCase() === 's') {
      e.preventDefault();
      flushSave();
      actions.setStatusMessage('Sauvegardé localement', 'success', 1500);
      return;
    }

    // --- Select all ---
    if (meta && key.toLowerCase() === 'a') {
      e.preventDefault();
      const ids = new Set(getState().nodes.map((n) => n.id));
      actions.setSelection(ids, new Set());
      actions.setStatusMessage(`${ids.size} nœud${ids.size > 1 ? 's' : ''} sélectionné${ids.size > 1 ? 's' : ''}`, 'info', 1200);
      return;
    }

    // --- Duplicate (Ctrl+D) ---
    if (meta && key.toLowerCase() === 'd') {
      e.preventDefault();
      duplicateSelection();
      return;
    }

    // --- Copy (Ctrl+C) ---
    if (meta && key.toLowerCase() === 'c') {
      e.preventDefault();
      copySelection();
      return;
    }

    // --- Paste (Ctrl+V) ---
    if (meta && key.toLowerCase() === 'v') {
      e.preventDefault();
      pasteClipboard();
      return;
    }

    // --- Zoom (Ctrl++ / Ctrl+- / Ctrl+0) ---
    if (meta && (key === '=' || key === '+' || key === '°')) {
      e.preventDefault();
      dispatchZoom('in');
      return;
    }
    if (meta && key === '-') {
      e.preventDefault();
      dispatchZoom('out');
      return;
    }
    if (meta && key === '0') {
      e.preventDefault();
      dispatchZoom('reset');
      return;
    }

    // --- Arrow keys → nudge ---
    if (!meta && ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(key)) {
      const { selection, nodes } = getState();
      if (selection.nodes.size === 0) return;
      e.preventDefault();
      const shift = e.shiftKey;
      const step = shift ? 100 : 20;
      const dx = key === 'ArrowRight' ? step : key === 'ArrowLeft' ? -step : 0;
      const dy = key === 'ArrowDown' ? step : key === 'ArrowUp' ? -step : 0;
      for (const id of selection.nodes) {
        const node = nodes.find((n) => n.id === id);
        if (node) {
          actions.updateNode(id, { x: node.x + dx, y: node.y + dy });
        }
      }
      return;
    }

    // --- F2 / Enter → open properties ---
    if (key === 'F2' || (key === 'Enter' && !meta)) {
      const { selection } = getState();
      if (selection.nodes.size === 1) {
        e.preventDefault();
        const nodeId = [...selection.nodes][0];
        actions.selectNode(nodeId);
        openPropertiesAndFocusLabel();
      }
      return;
    }
  });
}

/* -------------------------------------------------------------------------- */
/*  Actions de raccourcis                                                     */
/* -------------------------------------------------------------------------- */

function duplicateSelection() {
  const { selection, nodes, edges } = getState();
  if (selection.nodes.size === 0) {
    actions.setStatusMessage('Rien à dupliquer', 'info', 1200);
    return;
  }
  const GRID = 40;
  const offset = GRID * 2;
  const idMap = new Map(); // ancien → nouveau

  for (const id of selection.nodes) {
    const node = nodes.find((n) => n.id === id);
    if (!node) continue;
    actions.addNode({
      type: node.type,
      label: node.label ? `${node.label} (copie)` : node.label,
      x: node.x + offset,
      y: node.y + offset,
      priority: node.priority,
      description: node.description || '',
      properties: node.properties ? { ...node.properties } : {},
      variant: node.variant,
      icon: node.icon,
      color: node.color,
      background: node.background,
    });
    // addNode ne retourne rien : lire le dernier noeud depuis le state
    const added = getState().nodes[getState().nodes.length - 1];
    if (added) idMap.set(id, added.id);
  }

  // Dupliquer les arêtes internes à la sélection
  for (const e of edges) {
    if (idMap.has(e.from) && idMap.has(e.to)) {
      actions.addEdge({
        from: idMap.get(e.from),
        to: idMap.get(e.to),
        fromPort: e.fromPort,
        toPort: e.toPort,
        label: e.label,
        type: e.type,
      });
    }
  }

  // Sélectionner les copies
  const newIds = new Set(idMap.values());
  actions.setSelection(newIds, new Set());
  actions.setStatusMessage(`${newIds.size} nœud${newIds.size > 1 ? 's' : ''} dupliqué${newIds.size > 1 ? 's' : ''}`, 'success', 1200);
}

function copySelection() {
  const { selection, nodes, edges } = getState();
  if (selection.nodes.size === 0) return;

  const selectedIds = selection.nodes;
  clipboard.nodes = nodes.filter((n) => selectedIds.has(n.id)).map((n) => ({
    type: n.type,
    label: n.label,
    x: n.x,
    y: n.y,
    priority: n.priority,
    description: n.description || '',
    properties: n.properties ? { ...n.properties } : {},
    variant: n.variant,
    icon: n.icon,
    color: n.color,
    background: n.background,
  }));
  // Arêtes internes à la sélection
  clipboard.edges = edges.filter((e) => selectedIds.has(e.from) && selectedIds.has(e.to)).map((e) => ({
    fromIndex: [...selectedIds].indexOf(e.from),
    toIndex: [...selectedIds].indexOf(e.to),
    fromPort: e.fromPort,
    toPort: e.toPort,
    label: e.label,
    type: e.type,
  }));

  actions.setStatusMessage(
    `${clipboard.nodes.length} nœud${clipboard.nodes.length > 1 ? 's' : ''} copié${clipboard.nodes.length > 1 ? 's' : ''}`,
    'info', 1200,
  );
}

function pasteClipboard() {
  if (clipboard.nodes.length === 0) return;
  const GRID = 40;
  const offset = GRID * 2;

  const newIds = [];
  const indexMap = new Map(); // ancien index → nouveau id

  for (const n of clipboard.nodes) {
    actions.addNode({
      type: n.type,
      label: n.label,
      x: n.x + offset,
      y: n.y + offset,
      priority: n.priority,
      description: n.description,
      properties: n.properties ? { ...n.properties } : {},
      variant: n.variant,
      icon: n.icon,
      color: n.color,
      background: n.background,
    });
    // addNode ne retourne rien : lire le dernier noeud depuis le state
    const added = getState().nodes[getState().nodes.length - 1];
    if (added) {
      indexMap.set(newIds.length, added.id);
      newIds.push(added.id);
    }
  }

  // Restaurer les arêtes
  for (const e of clipboard.edges) {
    const from = indexMap.get(e.fromIndex);
    const to = indexMap.get(e.toIndex);
    if (from && to) {
      actions.addEdge({
        from, to,
        fromPort: e.fromPort,
        toPort: e.toPort,
        label: e.label,
        type: e.type,
      });
    }
  }

  // Décaler le clipboard pour le prochain collage (écraser le décalage initial)
  for (const n of clipboard.nodes) {
    n.x += offset;
    n.y += offset;
  }

  const pasteIds = new Set(newIds);
  actions.setSelection(pasteIds, new Set());
  actions.setStatusMessage(
    `${pasteIds.size} nœud${pasteIds.size > 1 ? 's' : ''} collé${pasteIds.size > 1 ? 's' : ''}`,
    'success', 1200,
  );
}

function dispatchZoom(direction) {
  const event = new CustomEvent('canvas:zoom', { detail: { direction } });
  document.dispatchEvent(event);
  if (direction === 'reset') {
    actions.setStatusMessage('Zoom réinitialisé', 'info', 1000);
  }
}

function shouldIgnoreEvent(e) {
  const tag = (e.target?.tagName || '').toLowerCase();
  if (tag === 'input' || tag === 'textarea' || e.target?.isContentEditable) return true;
  return false;
}
