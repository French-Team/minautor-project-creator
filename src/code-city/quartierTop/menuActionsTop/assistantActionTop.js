/**
 * Assistant Action Top — Bouton "Assistant" dans la barre du haut
 *
 * Câble le bouton #assistant-btn pour ouvrir/fermer le panneau chat.
 *
 * @module assistantActionTop
 */

import { toggleChatPanel } from '../../ai/chatPanel.js';

export async function initializeAssistantAction() {
    const btn = document.getElementById('assistant-btn');
    if (!btn) {
        console.warn('Bouton #assistant-btn non trouvé');
        return;
    }

    btn.addEventListener('click', () => {
        toggleChatPanel();
    });

    console.log('✅ Bouton Assistant câblé');
}
