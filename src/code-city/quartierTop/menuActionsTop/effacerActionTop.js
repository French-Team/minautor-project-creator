/**
 * Action Effacer - Gestion de l'effacement du canvas
 *
 * Déclenche actions.clear() qui notifie le store d'état.
 * Le canvasRenderer se met à jour automatiquement.
 */

import { getState, actions } from '../../state.js';

export async function initializeEffacerAction() {
    console.log('🗑️ Initialisation de l\'action effacer...');

    try {
        const effacerBtn = document.getElementById('effacer-btn');
        if (!effacerBtn) {
            throw new Error('Bouton effacer non trouvé');
        }

        effacerBtn.addEventListener('click', () => {
            const { nodes, edges } = getState();
            const total = nodes.length + edges.length;
            if (total === 0) {
                actions.setStatusMessage('Canvas déjà vide', 'info');
                return;
            }
            if (!confirm(`Effacer les ${total} élément${total > 1 ? 's' : ''} du canvas ?`)) return;
            showConfirmationAnimation(effacerBtn);
            actions.clear();
            actions.setStatusMessage(`Canvas effacé (${total} élément${total > 1 ? 's' : ''})`, 'info');
            console.log('✅ Canvas effacé');
        });

        console.log('✅ Action effacer initialisée');
    } catch (error) {
        console.error('❌ Erreur lors de l\'initialisation de l\'action effacer:', error);
        throw error;
    }
}

function showConfirmationAnimation(button) {
    const originalText = button.innerHTML;
    let dotCount = 0;
    button.classList.add('animate-pulse-warning');
    const animateDots = () => {
        dotCount = (dotCount + 1) % 4;
        const dots = '.'.repeat(dotCount);
        button.innerHTML = button.innerHTML.replace(/\.*$/, dots);
    };
    const dotsInterval = setInterval(animateDots, 200);
    setTimeout(() => {
        clearInterval(dotsInterval);
        button.innerHTML = originalText;
        button.classList.remove('animate-pulse-warning');
    }, 1500);
}
