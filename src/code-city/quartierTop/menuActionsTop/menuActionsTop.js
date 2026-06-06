/**
 * Menu Actions Top - Boutons d'action principaux (Effacer, Exporter, Thème)
 *
 * L'onglet Aperçu est désormais dans la sidebar droite (Quartier Right)
 * — pas besoin d'un bouton dédié dans la barre du haut.
 */

import { initializeEffacerAction } from './effacerActionTop.js';
import { initializeExporterAction } from './exporterActionTop.js';
import { initializeThemeClairSombreAction } from './themeClairSombreActionTop.js';
import { initializeProvidersAction } from './providersActionTop.js';
import { initializeAssistantAction } from './assistantActionTop.js';

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

        <button class="btn btn--ghost" id="providers-btn" title="Configurer les providers IA">
            <svg class="btn__icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M17.25 6.75 22.5 12l-5.25 5.25m-10.5 0L1.5 12l5.25-5.25m7.5-3-4.5 16.5"/>
            </svg>
            <span>Providers</span>
        </button>

        <div style="width: 1px; height: 18px; background: var(--border); margin: 0 4px;"></div>

        <button class="btn btn--ghost" id="assistant-btn" title="Assistant IA (Ctrl+Shift+A)">
            <svg class="btn__icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M12 2a4 4 0 0 0-4 4v2H6a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V10a2 2 0 0 0-2-2h-2V6a4 4 0 0 0-4-4z"/>
                <circle cx="12" cy="15" r="2"/>
            </svg>
            <span>Assistant</span>
        </button>
    `;

    await initializeEffacerAction();
    await initializeExporterAction();
    await initializeThemeClairSombreAction();
    await initializeProvidersAction();
    await initializeAssistantAction();

    console.log('✅ Menu d\'actions Top initialisé');
}
