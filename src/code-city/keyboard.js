/**
 * Keyboard — Raccourcis clavier globaux
 *
 * Ne s'active pas quand le focus est dans un input/textarea/contentEditable.
 *
 *   Ctrl/Cmd + Z       → undo
 *   Ctrl/Cmd + Y       → redo
 *   Ctrl/Cmd + Shift + Z → redo (variante)
 *   Ctrl/Cmd + S       → force-save + toast
 *   Ctrl/Cmd + A       → tout sélectionner
 */

import { getState, actions } from './state.js';
import { flushSave } from './persistence.js';

let isInstalled = false;

export function installKeyboardShortcuts() {
  if (isInstalled) return;
  isInstalled = true;

  document.addEventListener('keydown', (e) => {
    if (shouldIgnoreEvent(e)) return;

    const meta = e.ctrlKey || e.metaKey;
    const key = e.key.toLowerCase();

    if (meta && key === 'z' && !e.shiftKey) {
      e.preventDefault();
      if (actions.undo()) {
        actions.setStatusMessage('Annulé', 'info', 1000);
      }
      return;
    }
    if (meta && (key === 'y' || (key === 'z' && e.shiftKey))) {
      e.preventDefault();
      if (actions.redo()) {
        actions.setStatusMessage('Rétabli', 'info', 1000);
      }
      return;
    }
    if (meta && key === 's') {
      e.preventDefault();
      flushSave();
      actions.setStatusMessage('Sauvegardé localement', 'success', 1500);
      return;
    }
    if (meta && key === 'a') {
      e.preventDefault();
      const ids = new Set(getState().nodes.map((n) => n.id));
      actions.setSelection(ids, new Set());
      actions.setStatusMessage(`${ids.size} nœud${ids.size > 1 ? 's' : ''} sélectionné${ids.size > 1 ? 's' : ''}`, 'info', 1200);
      return;
    }
  });
}

function shouldIgnoreEvent(e) {
  const tag = (e.target?.tagName || '').toLowerCase();
  if (tag === 'input' || tag === 'textarea' || e.target?.isContentEditable) return true;
  return false;
}
