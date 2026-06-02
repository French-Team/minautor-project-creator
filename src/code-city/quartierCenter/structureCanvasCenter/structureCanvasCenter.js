/**
 * Structure Canvas Center - Gestion de la structure du canvas
 */

import { initializeGrilleCanvasCenter } from './grilleCanvasCenter.js';
import { initializeZoomCanvasCenter } from './zoomCanvasCenter.js';


/**
 * Initialise la structure du canvas center
 */
export async function initializeStructureCanvasCenter() {
    console.log('🏗️ Initialisation de la structure du canvas...');

    try {
        // Initialiser la grille
        await initializeGrilleCanvasCenter();

        // Initialiser le zoom
        await initializeZoomCanvasCenter();

        console.log('✅ Structure du canvas initialisée');
    } catch (error) {
        console.error('❌ Erreur lors de l\'initialisation de la structure du canvas:', error);
        throw error;
    }
}
