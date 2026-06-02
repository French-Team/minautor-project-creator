/**
 * Quartier Bottom — Barre d'état pilotée par le store
 *
 * Plus aucun `document.addEventListener('xxx:created', …)`. Tout passe par
 * `subscribe()` et la vérité vit dans `state`.
 *
 * Affiche :
 *   - element-count : nombre de nœuds
 *   - zoom-status   : pourcentage de zoom
 *   - status-message: message éphémère
 *   - theme-status  : thème actif
 */

import { getState, subscribe } from '../state.js';

let dom = {};

export async function initializeQuartierBottom() {
  console.log('⬇️ Initialisation du quartier Bottom...');

  try {
    dom = {
      elementCount: document.getElementById('element-count'),
      zoomStatus: document.getElementById('zoom-status'),
      statusMessage: document.getElementById('status-message'),
      themeStatus: document.getElementById('theme-status'),
    };

    // Premier rendu (avant que les autres quartiers aient pu muter le state)
    applyState(getState(), { type: 'init' });
    subscribe(applyState);

    // Animation d'apparition
    setTimeout(() => {
      document.querySelector('.quartier-bottom-container')?.classList.add('animate-slide-up');
    }, 300);

    console.log('✅ Quartier Bottom initialisé');
  } catch (error) {
    console.error('❌ Erreur lors de l\'initialisation du quartier Bottom:', error);
    throw error;
  }
}

function applyState(state, meta = {}) {
  if (dom.elementCount) {
    dom.elementCount.textContent = String(state.nodes.length);
  }
  if (dom.zoomStatus) {
    dom.zoomStatus.textContent = `${state.status.zoomPercent}%`;
  }
  if (dom.themeStatus) {
    dom.themeStatus.textContent = state.view.theme === 'dark' ? 'Sombre' : 'Clair';
  }
  if (dom.statusMessage) {
    dom.statusMessage.textContent = state.status.message;
    dom.statusMessage.dataset.type = state.status.messageType;
  }
}
