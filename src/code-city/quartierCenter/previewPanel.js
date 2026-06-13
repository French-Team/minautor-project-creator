/**
 * Preview Panel — Rendu Mermaid dans l'onglet "Aperçu" du centre
 *
 * Rôle :
 *   - Afficher le rendu live du diagramme dans le panel de l'onglet Aperçu
 *     (zone large, pas la sidebar)
 *   - Rendre en arrière-plan même quand l'onglet Éditeur est actif, pour
 *     que le switch vers Aperçu soit instantané
 *   - Permettre de cliquer sur un nœud du rendu SVG pour basculer vers
 *     l'onglet Éditeur, sélectionner le nœud et centrer la vue dessus
 */

import { getState, subscribe, actions } from '../state.js';
import { buildMermaidCode, renderMermaidToSvg } from '../mermaid/build.js';
import { activateEditorTab, centerOnNode } from './centerTabs.js';

import { getChatIcon } from "../chatIcons.js";
import { escapeHtml } from '../utils/html.js';

let renderToken = 0;

export async function initializePreviewPanel() {
  console.log('🖼️ Initialisation du preview panel…');

  try {
    // Premier rendu (en background)
    renderPreview();

    // Souscription : on re-rend à chaque changement d'état
    subscribe(handleStateChange);
    console.log('✅ Preview panel initialisé');
  } catch (error) {
    console.error('❌ Erreur initialisation preview panel:', error);
    throw error;
  }
}

function handleStateChange(state, meta = {}) {
  if (!shouldRefreshPreview(meta)) return;
  renderPreview();
}

function shouldRefreshPreview(meta) {
  return [
    'node:added', 'node:updated', 'node:removed',
    'edge:added', 'edge:removed',
    'graph:cleared', 'graph:loaded',
    'history:undo', 'history:redo', 'view:theme',
    'init',
  ].includes(meta.type);
}

async function renderPreview() {
  const container = document.getElementById('preview-container');
  if (!container) return;

  const { nodes, edges } = getState();
  if (nodes.length === 0) {
    container.className = 'preview-frame';
    container.innerHTML = '<span>Le diagramme apparaîtra ici dès qu\'il y aura des éléments.</span>';
    return;
  }

  const myToken = ++renderToken;
  const code = buildMermaidCode({ nodes, edges });
  container.className = 'preview-frame is-loading';
  container.innerHTML = '';

  const { svg, error } = await renderMermaidToSvg(code);
  if (myToken !== renderToken) return; // un autre rendu a pris le dessus

  if (error) {
    container.className = 'preview-frame';
    container.innerHTML = `
      <div class="preview-error">
        <strong>Erreur Mermaid</strong>
        <pre>${escapeHtml(error)}</pre>
      </div>
    `;
    return;
  }

  container.className = 'preview-frame';
  container.innerHTML = `<div class="preview-svg">${svg}</div>`;

  // Bouton "Analyser avec Mina" sous le diagramme
  const analyseBtn = document.createElement('button');
  analyseBtn.type = 'button';
  analyseBtn.className = 'preview-analyse-btn';
  analyseBtn.innerHTML = `${getChatIcon('zap', 14)} Analyser avec Mina`;
  analyseBtn.addEventListener('click', () => {
    const { nodes, edges } = getState();
    const graph = { nodes, edges };
    const prompt = `Analyse ce diagramme :\n\n${buildMermaidCode(graph)}\n\nDonne-moi un résumé des éléments, leurs relations, et suggère des améliorations.`;
    openChatPanel(prompt);
  });
  container.appendChild(analyseBtn);

  // Branche le click sur les nœuds du SVG rendu → switch + sélection + centrage
  attachNodeClickHandlers(container);
}

/** Délègue un click sur n'importe quel nœud du SVG Mermaid vers le store.
 *  Mermaid expose l'identifiant du nœud via l'attribut data-id sur le <g>. */
function attachNodeClickHandlers(container) {
  const svg = container.querySelector('svg');
  if (!svg) return;

  // Pointer-events : on ne veut attraper que les clics sur les nœuds,
  // pas tout l'arrière-plan (pour permettre un futur pan/zoom).
  svg.addEventListener('click', (e) => {
    const nodeGroup = e.target.closest('[data-id]');
    if (!nodeGroup) return;
    const mermaidId = nodeGroup.getAttribute('data-id');
    if (!mermaidId) return;

    // Le data-id de Mermaid correspond exactement à notre ID interne
    // (on génère les IDs en `n1`, `n2`, etc., Mermaid les utilise tels quels
    // pour les nodes non quotés). On retire les guillemets si Mermaid a
    // quoté l'ID.
    const cleanId = mermaidId.replace(/^"|"$/g, '');

    // Sélectionne le nœud
    const state = getState();
    const node = state.nodes.find((n) => n.id === cleanId);
    if (!node) return;
    actions.selectNode(node.id);

    // Bascule vers l'onglet Éditeur et centre la vue sur le nœud
    activateEditorTab();
    // Petit délai pour laisser le canvas reprendre le focus / la bonne
    // taille (le panel Aperçu vient d'être masqué)
    requestAnimationFrame(() => {
      centerOnNode(node.id);
    });
  });
}

