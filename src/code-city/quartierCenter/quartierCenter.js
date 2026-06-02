/**
 * Quartier Center - Canvas principal
 * Gère le canvas central pour l'édition visuelle des diagrammes
 *
 * La structure HTML est définie dans `code-city.js` (source unique de vérité).
 * Ce module se contente d'initialiser les comportements sur les nœuds du DOM existants.
 */

import { initializeStructureCanvasCenter } from './structureCanvasCenter/structureCanvasCenter.js';
import { initializeFonctionsCanvasCenter } from './fonctionsCanvasCenter/fonctionsCanvasCenter.js';
import { initializeCanvasRenderer } from '../render/canvasRenderer.js';

/**
 * Initialise le quartier Center
 */
export async function initializeQuartierCenter() {
    console.log('🎯 Initialisation du quartier Center...');

    try {
        // Le renderer canvas doit être initialisé APRÈS la structure
        // (grille, zoom) pour pouvoir s'y brancher.
        await initializeStructureCanvasCenter();
        await initializeFonctionsCanvasCenter();
        initializeCanvasRenderer();

        console.log('✅ Quartier Center initialisé avec succès');
    } catch (error) {
        console.error('❌ Erreur lors de l\'initialisation du quartier Center:', error);
        throw error;
    }
}

