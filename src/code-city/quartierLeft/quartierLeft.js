/**
 * Quartier Left — Palette d'éléments draggables
 *
 * La structure HTML (les conteneurs #categorie-1/2/3) est définie dans
 * `code-city.js` (source unique de vérité). Ce module se contente de
 * peupler ces conteneurs et de brancher le drag&drop.
 */

import { initializeMenuMermaidActionsLeft } from './fonctionsMermaidLeft/menuMermaidActionsLeft/menuMermaidActionsLeft.js';
import { initializeMermaidPipeline } from '../mermaid/pipeline.js';

export async function initializeQuartierLeft() {
    console.log('⬅️ Initialisation du quartier Left...');
    try {
        await initializeMenuMermaidActionsLeft();
        // Branche la synchro state ↔ code (utilisée par l'onglet Code)
        initializeMermaidPipeline();
        console.log('✅ Quartier Left initialisé');
    } catch (error) {
        console.error('❌ Erreur lors de l\'initialisation du quartier Left:', error);
        throw error;
    }
}
