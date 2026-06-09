/**
 * Action Thème Clair/Sombre
 *
 * Le thème vit dans `state.view.theme`. Cette action :
 *   1. dispatche `actions.toggleTheme()` quand on clique
 *   2. écoute le store pour propager au DOM (classes body), à mermaid
 *      (re-init pour le rendu) et au localStorage (persistance)
 *   3. met à jour l'icône du bouton selon le thème courant
 */

import { getState, subscribe, actions } from '../../state.js';
import mermaid from 'mermaid';

let themeBtn = null;
let mediaQueryListener = null;

export async function initializeThemeClairSombreAction() {
  console.log('🌙 Initialisation de l\'action thème...');

  try {
    themeBtn = document.getElementById('theme-btn');
    if (!themeBtn) {
      throw new Error('Bouton thème non trouvé');
    }

    // Premier rendu (au cas où un autre module a déjà muté le state)
    applyTheme(getState().view.theme);

    // Click handler
    themeBtn.addEventListener('click', () => {
      actions.toggleTheme();
    });

    // Souscription au store
    subscribe((state, meta) => {
      if (meta?.type === 'view:theme' || meta?.type === 'init') {
        applyTheme(state.view.theme);
      }
    });

    // Préférence système (seulement si l'utilisateur n'a pas choisi)
    if (window.matchMedia) {
      mediaQueryListener = (e) => {
        if (!localStorage.getItem('code-city-theme')) {
          actions.setTheme(e.matches ? 'dark' : 'light');
        }
      };
      window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', mediaQueryListener);
    }

    console.log('✅ Action thème initialisée');
  } catch (error) {
    console.error('❌ Erreur lors de l\'initialisation de l\'action thème:', error);
    throw error;
  }
}

/**
 * Initialise le thème au démarrage de l'application (appelé depuis main.js).
 * Synchronise le state, le DOM, mermaid et localStorage.
 */
export function initializeTheme() {
  const theme = getState().view.theme;
  applyTheme(theme);
}

function applyTheme(theme) {
  const app = document.querySelector('.app');

  if (theme === 'dark') {
    app?.classList.remove('theme-light');
    app?.classList.add('theme-dark');
    document.body.classList.remove('theme-light');
    document.body.classList.add('theme-dark');
  } else {
    app?.classList.remove('theme-dark');
    app?.classList.add('theme-light');
    document.body.classList.remove('theme-dark');
    document.body.classList.add('theme-light');
  }

  document.body.classList.add('theme-transition');

  // Mermaid doit être re-initialisé pour prendre le nouveau thème en compte
  try {
    mermaid.initialize({
      startOnLoad: false,
      theme: theme === 'dark' ? 'dark' : 'default',
      securityLevel: 'loose',
      flowchart: { useMaxWidth: false, htmlLabels: true },
    });
  } catch (err) {
    console.warn('mermaid.initialize a échoué:', err);
  }

  // Persistance
  try {
    localStorage.setItem('code-city-theme', theme);
  } catch (_) {
    /* localStorage peut être désactivé */
  }

  // Icône du bouton
  if (themeBtn) updateThemeIcon(themeBtn, theme);
}

function updateThemeIcon(button, theme) {
  const svg = button.querySelector('svg');
  if (!svg) return;

  if (theme === 'dark') {
    svg.innerHTML = '<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>';
    button.title = 'Passer en mode clair';
  } else {
    svg.innerHTML = `
      <circle cx="12" cy="12" r="5"/>
      <line x1="12" y1="1" x2="12" y2="3"/>
      <line x1="12" y1="21" x2="12" y2="23"/>
      <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/>
      <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
      <line x1="1" y1="12" x2="3" y2="12"/>
      <line x1="21" y1="12" x2="23" y2="12"/>
      <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/>
      <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
    `;
    button.title = 'Passer en mode sombre';
  }
}
