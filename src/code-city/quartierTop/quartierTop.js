/**
 * Quartier Top - Menu principal et actions
 * Gère le logo et les actions principales de l'application
 */

import { initializeLogoTop } from './logoTop/logoTop.js';
import { initializeMenuActionsTop } from './menuActionsTop/menuActionsTop.js';

/**
 * Initialise le quartier Top
 */
export async function initializeQuartierTop() {
    console.log('🟡 Initialisation du quartier Top...');

    try {
        // Initialiser le logo
        await initializeLogoTop();

        // Initialiser les actions du menu
        await initializeMenuActionsTop();

        console.log('✅ Quartier Top initialisé avec succès');
    } catch (error) {
        console.error('❌ Erreur lors de l\'initialisation du quartier Top:', error);
        throw error;
    }
}
