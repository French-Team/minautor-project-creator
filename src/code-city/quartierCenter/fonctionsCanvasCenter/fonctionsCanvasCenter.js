/**
 * Fonctions Canvas Center - Gestion des fonctions du canvas
 *
 * Le drag & drop, la sélection, les connexions et le rendu des nœuds
 * sont désormais gérés par le canvasRenderer (../render/canvasRenderer.js).
 * Ce module ne garde que l'orchestration du panneau d'actions (edit, delete).
 */

import { initializeMenuActionsCenter } from './menuActionsCenter/menuActionsCenter.js';


/**
 * Initialise les fonctions du canvas center
 */
export async function initializeFonctionsCanvasCenter() {
    console.log('⚙️ Initialisation des fonctions du canvas...');

    try {
        // Le drag & drop et la sélection sont branchés sur le state via
        // canvasRenderer (appelé depuis quartierCenter.js).
        await initializeMenuActionsCenter();

        console.log('✅ Fonctions du canvas initialisées');
    } catch (error) {
        console.error('❌ Erreur lors de l\'initialisation des fonctions du canvas:', error);
        throw error;
    }
}
