/**
 * Quartier Center - Canvas principal + Aperçu Mermaid
 *
 * La zone centre est onglettée :
 *   - Éditeur : toolbar + canvas (drag & drop, nœuds, ports, menus)
 *   - Aperçu  : rendu Mermaid pleine zone (previewPanel.js)
 *
 * L'aperçu se rafraîchit en background pour un switch instantané.
 * Un clic sur un nœud du rendu Mermaid bascule vers l'éditeur,
 * sélectionne le nœud et centre la vue dessus.
 *
 * La structure HTML est définie dans `code-city.js` (source unique de vérité).
 * Ce module se contente d'initialiser les comportements sur les nœuds du DOM existants.
 */

import { initializeStructureCanvasCenter } from './structureCanvasCenter/structureCanvasCenter.js';
import { initializeCenterTabs } from './centerTabs.js';
import { initializePreviewPanel } from './previewPanel.js';
import { initializeCanvasRenderer } from '../render/canvasRenderer.js';

/**
 * Initialise le quartier Center
 */
export async function initializeQuartierCenter() {
    console.log('🎯 Initialisation du quartier Center...');

    try {
        // 1) Onglets Éditeur / Aperçu
        initializeCenterTabs();

        // 2) Structure du canvas + renderer
        await initializeStructureCanvasCenter();
        initializeCanvasRenderer();

        // 3) Aperçu Mermaid (rendu en background, refresh auto)
        await initializePreviewPanel();

        console.log('✅ Quartier Center initialisé avec succès');
    } catch (error) {
        console.error('❌ Erreur lors de l\'initialisation du quartier Center:', error);
        throw error;
    }
}

