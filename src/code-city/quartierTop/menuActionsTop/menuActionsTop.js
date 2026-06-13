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
import { getChatIcon } from '../../chatIcons.js';

export async function initializeMenuActionsTop() {
    const actionsSection = document.querySelector('.top__actions');
    if (!actionsSection) {
        throw new Error('Section .top__actions non trouvée');
    }

    actionsSection.innerHTML = `
        <button class="btn" id="effacer-btn" title="Effacer le canvas">${getChatIcon('trash', 14, 'btn__icon')}
            <span>Effacer</span>
        </button>

        <button class="btn" id="exporter-btn" title="Exporter le diagramme">${getChatIcon('download', 14, 'btn__icon')}
            <span>Exporter</span>
        </button>

        <div style="width: 1px; height: 18px; background: var(--border); margin: 0 4px;"></div>

        <button class="btn btn--ghost" id="theme-btn" title="Basculer le thème">${getChatIcon('sun', 14, 'btn__icon')}
            <span>Thème</span>
        </button>

        <button class="btn btn--ghost" id="providers-btn" title="Configurer les providers IA">${getChatIcon('code', 14, 'btn__icon')}
            <span>Providers</span>
        </button>

        <div style="width: 1px; height: 18px; background: var(--border); margin: 0 4px;"></div>

        <button class="btn btn--ghost" id="assistant-btn" title="Assistant IA (Ctrl+Shift+A)">${getChatIcon('bot', 14, 'btn__icon')}
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
