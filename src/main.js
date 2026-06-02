/**
 * Code City - Entry point
 * Point d'entrée principal de l'application, initialisé par Vite.
 */

import mermaid from 'mermaid';

import { initializeApp } from './code-city/code-city.js';
import { log } from './code-city/utils.js';

mermaid.initialize({
  startOnLoad: false,
  theme: 'default',
  securityLevel: 'loose',
  flowchart: { useMaxWidth: false, htmlLabels: true }
});

window.mermaid = mermaid;

function bootstrap() {
  log('Démarrage du module principal', 'info');
  initializeApp().catch((error) => {
    console.error("Échec de l'initialisation de l'application", error);
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', bootstrap);
} else {
  bootstrap();
}
