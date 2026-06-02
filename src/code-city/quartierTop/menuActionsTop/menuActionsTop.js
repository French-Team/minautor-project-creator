/**
 * Menu Actions Top - Boutons d'action principaux (Effacer, Exporter, Thème)
 *
 * L'onglet Aperçu est désormais dans la sidebar droite (Quartier Right)
 * — pas besoin d'un bouton dédié dans la barre du haut.
 */

import { initializeEffacerAction } from './effacerActionTop.js';
import { initializeExporterAction } from './exporterActionTop.js';
import { initializeThemeClairSombreAction } from './themeClairSombreActionTop.js';

export async function initializeMenuActionsTop() {
    const actionsSection = document.querySelector('.top__actions');
    if (!actionsSection) {
        throw new Error('Section .top__actions non trouvée');
    }

    actionsSection.innerHTML = `
        <button class="btn" id="effacer-btn" title="Effacer le canvas">
            <svg class="btn__icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M19 7l-.867 12.142A2 2 0 0 1 16.138 21H7.862a2 2 0 0 1-1.995-1.858L5 7m5 4v6m4-6v6M1 7h22M9 7V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v3"/>
            </svg>
            <span>Effacer</span>
        </button>

        <button class="btn" id="exporter-btn" title="Exporter le diagramme">
            <svg class="btn__icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                <polyline points="7 10 12 15 17 10"/>
                <line x1="12" y1="15" x2="12" y2="3"/>
            </svg>
            <span>Exporter</span>
        </button>

        <div style="width: 1px; height: 18px; background: var(--border); margin: 0 4px;"></div>

        <button class="btn btn--ghost" id="theme-btn" title="Basculer le thème">
            <svg class="btn__icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="12" cy="12" r="5"/>
                <line x1="12" y1="1" x2="12" y2="3"/>
                <line x1="12" y1="21" x2="12" y2="23"/>
                <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/>
                <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
                <line x1="1" y1="12" x2="3" y2="12"/>
                <line x1="21" y1="12" x2="23" y2="12"/>
                <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/>
                <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
            </svg>
            <span>Thème</span>
        </button>
    `;

    await initializeEffacerAction();
    await initializeExporterAction();
    await initializeThemeClairSombreAction();

    console.log('✅ Menu d\'actions Top initialisé');
}
