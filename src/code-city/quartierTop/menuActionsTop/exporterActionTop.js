/**
 * Action Exporter — Bouton du quartier Top qui ouvre le panneau d'export
 *
 * Le panneau lui-même (slide-in, contenu, fermeture) vit dans
 * `quartierRight/exportPanel.js`. Ce module ne fait que câbler le
 * bouton `#exporter-btn` pour toggler ce panneau.
 */

import { toggleExportPanel } from '../../quartierRight/exportPanel.js';

export async function initializeExporterAction() {
  console.log('📤 Initialisation de l\'action exporter…');

  try {
    const btn = document.getElementById('exporter-btn');
    if (!btn) {
      throw new Error('Bouton exporter non trouvé');
    }

    btn.setAttribute('aria-haspopup', 'true');
    btn.setAttribute('aria-expanded', 'false');
    btn.setAttribute('aria-controls', 'app-export');

    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleExportPanel();
    });

    console.log('✅ Action exporter initialisée');
  } catch (error) {
    console.error('❌ Erreur lors de l\'initialisation de l\'action exporter:', error);
    throw error;
  }
}
