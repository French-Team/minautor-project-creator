/**
 * Action Providers — Bouton du quartier Top qui ouvre le panneau providers
 *
 * Suit le même pattern que exporterActionTop.js.
 */

import { toggleProviderPanel } from '../../ai/providerPanel.js';

export async function initializeProvidersAction() {
  console.log('🤖 Initialisation de l\'action providers…');

  try {
    const btn = document.getElementById('providers-btn');
    if (!btn) {
      throw new Error('Bouton providers non trouvé');
    }

    btn.setAttribute('aria-haspopup', 'true');
    btn.setAttribute('aria-expanded', 'false');
    btn.setAttribute('aria-controls', 'app-providers');

    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleProviderPanel();
    });

    console.log('✅ Action providers initialisée');
  } catch (error) {
    console.error('❌ Erreur lors de l\'initialisation de l\'action providers:', error);
    throw error;
  }
}
