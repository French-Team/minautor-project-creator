/**
 * History Canvas Center — Boutons Undo / Redo
 *
 * Les boutons reflètent `actions.canUndo()` / `canRedo()` à chaque
 * notification. Le clavier (Ctrl+Z / Ctrl+Y) est géré dans
 * `keyboard.js`, ici on ne s'occupe que du DOM.
 */

import { getState, subscribe, actions } from '../../state.js';

let undoBtn = null;
let redoBtn = null;

export function initializeHistoryCanvasCenter() {
  console.log('↶ Initialisation des boutons Undo/Redo...');

  undoBtn = document.getElementById('undo-btn');
  redoBtn = document.getElementById('redo-btn');

  if (!undoBtn || !redoBtn) {
    console.warn('Boutons undo/redo introuvables');
    return;
  }

  undoBtn.addEventListener('click', () => {
    if (actions.undo()) {
      actions.setStatusMessage('Annulé', 'info', 1000);
    }
  });

  redoBtn.addEventListener('click', () => {
    if (actions.redo()) {
      actions.setStatusMessage('Rétabli', 'info', 1000);
    }
  });

  refresh();
  subscribe(refresh);
}

function refresh() {
  const canUndo = actions.canUndo();
  const canRedo = actions.canRedo();
  if (undoBtn) undoBtn.disabled = !canUndo;
  if (redoBtn) redoBtn.disabled = !canRedo;
}
