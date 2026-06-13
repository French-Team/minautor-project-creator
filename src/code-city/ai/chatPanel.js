/**
 * Chat Panel — Panneau latéral de chat avec l'assistant Mina
 *
 * Activé par le bouton "Assistant" du header. Interface de chat complète :
 *   - Messages alternés (user / assistant / system)
 *   - Rendu Markdown simplifié dans les réponses
 *   - Actions rapides (Analyser, Suggérer, Doc, Enrichir)
 *   - Indicateur de frappe "Mina réfléchit…"
 *   - Scroll automatique vers le bas
 *   - Provider non configuré → message d'avertissement
 *
 * Suit le même pattern que exportPanel.js (slide-in depuis la droite).
 *
 * @module chatPanel
 */

import { getState, actions, subscribe } from '../state.js';
import { streamChatCompletion, fetchLocalModels } from './aiClient.js';
import { buildSystemMessages } from './systemPrompt.js';
import { trimHistory } from './chatHistory.js';
import { QUICK_ACTION_CATEGORIES, getActionIcon } from './quickActions.js';
import { toast } from './toast.js';
import { openProviderPanel } from './providerPanel.js';
import { getPreset, getAllPresets } from './providerLoader.js';
import { renderMarkdown, renderStreamingMarkdown } from './markdownRenderer.js';
import { PromptEngine, hashContext, DEFAULT_OPTIMIZATION_THRESHOLD } from './promptEngine.js';
import { estimateTokens } from './chatHistory.js';
import { traceChat } from './traceLogger.js';
import { getChatIcon, getChatIconCheckBold } from '../chatIcons.js';
import { escapeHtml } from '../utils/html.js';

/* ---------- Provider Greek names ---------- */

const PROVIDER_TITLES = {
  openrouter: 'Mina',
  kilo: 'minautor',
  gemini: 'Atlas',
  'opencode-zen': 'Athéna',
  mistral: 'Éole',
  groq: 'Héphaïstos',
  ollama: 'Dédale',
  lmstudio: 'Prométhée',
};

let panelEl = null;
let isOpen = false;
let isThinking = false;
let isOptimizing = false;      // true pendant l'optimisation (après streaming)
let streamAbortController = null; // AbortController pour annuler le streaming en cours
let typewriterTimer = null;     // Timer pour effet typewriter (10ms) — ajout texte brut
let markdownSyncTimer = null;   // Timer pour sync Markdown (500ms) — rendu formaté
let displayedLength = 0;         // Nb de caractères déjà affichés dans la bulle
let scrollThrottleTimer = null;  // Throttle pour scrollToBottom (un seul rAF à la fois)
let streamTokenCount = 0; // Nombre de tokens reçus pendant le streaming
let streamStatsTimer = null; // Timer pour rafraîchir l'indicateur stats
let streamStartTime = 0; // Timestamp de début du streaming (pour affichage temps écoulé)
let progressPct = 0; // Pourcentage actuel de la jauge (0-100)
let progressTimer = null; // Timer pour le pattern de jauge (indépendant du token count)

// PromptEngine
let promptEngine = null;

// Rafraîchissement du cache
let refreshTimer = null;       // setInterval pour refresh périodique
let lastCanvasHash = '';       // Dernier hash du canvas (pour détection de changement)

/* ---------- Initialisation ---------- */

/**
 * Initialise le panneau chat (câble les events, prépare le DOM).
 */
export async function initializeChatPanel() {
  console.log('[Chat] Initialisation du panneau chat…');

  try {
    const root = document.getElementById('app-chat');
    const backdrop = document.getElementById('app-chat-backdrop');
    const closeBtn = document.getElementById('app-chat-close');
    const clearBtn = document.getElementById('app-chat-clear');
    if (!root || !backdrop || !closeBtn) {
      throw new Error('Panneau chat : éléments DOM manquants');
    }

    panelEl = root;

    // Initialiser le PromptEngine
    if (!promptEngine) {
      promptEngine = new PromptEngine();
      const provider = getState().assistant?.provider;
      if (provider?.id) {
        promptEngine.initContextWindow(provider).catch(() => {});
      }
    }

    // Exposer globalement pour les tests E2E (comme window.__state)
    window.__promptEngine = promptEngine;

    // Rendre le contenu initial et mettre à jour le titre
    updateChatTitle();
    renderPanelContent();

    // Câble la fermeture
    closeBtn.addEventListener('click', closeChatPanel);
    backdrop.addEventListener('click', closeChatPanel);
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && isOpen) closeChatPanel();

      // Raccourci / : ouvrir le chat et focus l'input
      // Ne pas intercepter si l'utilisateur tape dans un champ de texte
      if (e.key === '/' && !e.ctrlKey && !e.metaKey && !e.shiftKey) {
        const tag = e.target?.tagName?.toLowerCase();
        const isEditable = tag === 'input' || tag === 'textarea' || e.target?.isContentEditable;
        if (!isEditable) {
          e.preventDefault();
          if (!isOpen) {
            openChatPanel();
          } else {
            panelEl?.querySelector('#chat-input')?.focus();
          }
        }
      }
    });

    // Câble le bouton vider le chat
    if (clearBtn) {
      clearBtn.addEventListener('click', () => {
        const history = getState().assistant?.chatHistory || [];
        if (history.length === 0) return;
        const msg = `Vider l'historique (${history.length} message${history.length > 1 ? 's' : ''}) ?`;
        if (window.confirm(msg)) {
          actions.clearChatHistory();
          renderPanelContent();
        }
      });
    }

  // Câble la délégation de clic sur le body des messages
  // NOTE: handleInputKeydown est attaché directement au textarea dans renderInputArea
  // car #chat-input est dans #chat-input-area (sibling de #app-chat-body), pas enfant.
  const msgBody = panelEl.querySelector('#app-chat-body');
  if (msgBody) {
    // Click handler — les history items sont maintenant dans #app-chat-topbar
  // (et non plus dans #app-chat-body), donc on attache sur panelEl pour
  // capter les clics à la fois du topbar ET du body.
  panelEl.addEventListener('click', handleChatBodyClick);
  }

  // Câble les filtres de l'historique des prompts
  bindPromptHistoryFilters();

    // Câble la barre de providers dans le header
    const providerBar = document.getElementById('app-chat-provider-bar');
    if (providerBar) {
      providerBar.addEventListener('click', handleProviderBarClick);
      // Peupler la barre des providers au démarrage
      populateProviderBar();
    }

    // Écouter les changements de provider pour rafraîchir la barre, le titre et le panneau
    subscribe((_state, meta) => {
      if (meta.type === 'assistant:provider') {
        populateProviderBar();
        updateChatTitle();
        if (isOpen) renderPanelContent();
      }
    });

    // Écouter les changements du canvas pour invalider le cache du prompt
    // Les événements graph:loaded/cleared, node:added/removed/updated changent
    // le contexte du canvas → les prompts en cache ne sont plus valides
    subscribe((_state, meta) => {
      if (!promptEngine) return;
      const canvasEvents = new Set([
        'node:added', 'node:removed', 'node:updated',
        'graph:loaded', 'graph:cleared',
        'edge:added', 'edge:removed', 'edges:bulk-removed',
      ]);
      if (canvasEvents.has(meta.type)) {
        promptEngine.clearCache();
        lastCanvasHash = ''; // Forcer re-hash au prochain refresh
      }
    });

    // État initial : fermé
    applyOpenState(root, false);
    console.log('[Chat] Panneau chat initialisé (fermé)');
  } catch (error) {
    console.error('[Chat] Erreur initialisation panneau chat:', error);
    throw error;
  }
}

/* ---------- API publique ---------- */

/**
 * Ouvre le panneau chat.
 * @param {string} [initialPrompt] — Prompt à envoyer automatiquement
 */
export async function openChatPanel(initialPrompt = '') {
  if (!panelEl) return;
  isOpen = true;
  applyOpenState(panelEl, true);

  // Re-peupler la barre providers, mettre à jour le titre et re-rendre le contenu
  populateProviderBar();
  updateChatTitle();
  renderPanelContent();

  // Démarrer le rafraîchissement périodique du cache (toutes les 30s)
  startRefreshTimer();

  if (initialPrompt) {
    await sendMessage(initialPrompt);
  }
}

/** Ferme le panneau chat. */
export function closeChatPanel() {
  if (!panelEl || !isOpen) return;
  isOpen = false;
  applyOpenState(panelEl, false);

  // Arrêter le rafraîchissement périodique quand le chat est fermé
  stopRefreshTimer();
}

/** Toggle (utilisé par le bouton du top bar). */
export function toggleChatPanel() {
  if (isOpen) closeChatPanel();
  else openChatPanel();
}

/** Renvoie l'état courant. */
export function isChatPanelOpen() {
  return isOpen;
}

/* ---------- DOM helpers ---------- */

function applyOpenState(root, open) {
  root.classList.toggle('is-open', open);
  root.setAttribute('aria-hidden', open ? 'false' : 'true');
  if (open) {
    scrollToBottom();
    const input = panelEl?.querySelector('#chat-input');
    if (input) input.focus();
  }
}

// getActionIcon est maintenant importé de './quickActions.js' (qui le re-exporte
// depuis '../chatIcons.js' — source unique des icônes du chat).

/* ---------- Rendering ---------- */

function renderPanelContent() {
  if (!panelEl) return;
  const body = panelEl.querySelector('#app-chat-body');
  if (!body) return;

  const provider = getState().assistant?.provider;
  const hasProvider = provider?.id;

  const history = getState().assistant?.chatHistory || [];
  const hasHistory = history.length > 0;

  body.innerHTML = `
    ${!hasProvider ? renderProviderNotice() : ''}
    ${hasHistory ? history.map(renderHistoryMessage).join('') : (!hasProvider ? '' : renderWelcome())}
    <div id="chat-typing" class="chat-typing" style="display:none;">
      <span class="chat-typing__label">Mina réfléchit…</span>
      <span class="chat-typing__dots">
        <span class="chat-typing__dot"></span>
        <span class="chat-typing__dot"></span>
        <span class="chat-typing__dot"></span>
      </span>
    </div>
  `;

  // Remplir la topbar (historique des prompts + stats cumulatives)
  renderChatTopbar();

  // Quick actions
  renderQuickActions();

  // Input area
  renderInputArea();

  // Re-câbler les filtres de l'historique (le DOM est reconstruit)
  bindPromptHistoryFilters();

  // Charger la liste des prompts depuis /api/prompts (asynchrone)
  refreshPromptHistory();

  scrollToBottom();
}

/* ---------- Historique des prompts (data/prompts/) ---------- */

/**
 * Rend la section repliable « Historique des prompts ».
 * La liste est remplie par refreshPromptHistory() après le rendu initial.
 * @returns {string} HTML de la section
 */
function renderPromptHistorySection() {
  return `
    <details class="chat-prompt-history" id="chat-prompt-history">
      <summary class="chat-prompt-history__summary">
        <span class="chat-prompt-history__icon">${getActionIcon('file-text', 12)}</span>
        <span class="chat-prompt-history__title">Historique des prompts</span>
        <span class="chat-prompt-history__count" id="chat-prompt-history__count">…</span>
      </summary>
      <div class="chat-prompt-history__content">
        <div class="chat-prompt-history__filters">
          <input
            type="search"
            class="chat-prompt-history__search"
            id="chat-prompt-history__search"
            placeholder="Rechercher dans l'historique…"
            autocomplete="off"
          />
          <select class="chat-prompt-history__type-filter" id="chat-prompt-history__type-filter">
            <option value="">Tous les types</option>
            <option value="analysis">Analyse</option>
            <option value="suggestion">Suggestion</option>
            <option value="documentation">Documentation</option>
            <option value="enrichment">Enrichissement</option>
            <option value="architecture">Architecture</option>
            <option value="conversation">Conversation</option>
          </select>
        </div>
        <ul class="chat-prompt-history__list" id="chat-prompt-history__list">
          <li class="chat-prompt-history__loading">Chargement…</li>
        </ul>
      </div>
    </details>
  `;
}

/**
 * Charge la liste des prompts depuis /api/prompts et peuple la liste dans le DOM.
 * Filtres supportés : ?q= (recherche) et ?type= (filtre par type).
 * @param {Object} [options]
 * @param {string} [options.searchQuery]
 * @param {string} [options.typeFilter]
 */
/**
 * Rend la topbar sticky du chat panel : contient l'historique des prompts
 * (repliable) + les stats cumulatives d'optimisation + le compteur de streaming
 * (ajouté dynamiquement par startStreamingStats).
 * Reste visible pendant que la conversation scroll.
 *
 * Si un streaming est en cours, on ne touche pas au DOM (sinon on écraserait
 * la barre de stats live). On ne met à jour que les stats cumulatives.
 */
function renderChatTopbar() {
  const topbar = panelEl?.querySelector('#app-chat-topbar');
  if (!topbar) return;
  if (panelEl?.querySelector('#chat-stream-stats')) {
    // Streaming en cours : ne mettre à jour que les stats cumulatives
    const oldCumulative = topbar.querySelector('#chat-cumulative-stats');
    const newCumulative = renderCumulativeStats();
    if (oldCumulative) {
      const tmp = document.createElement('div');
      tmp.innerHTML = newCumulative;
      const newEl = tmp.firstElementChild;
      if (newEl) oldCumulative.replaceWith(newEl);
    } else {
      topbar.insertAdjacentHTML('beforeend', newCumulative);
    }
    return;
  }
  topbar.innerHTML = `
    ${renderPromptHistorySection()}
    ${renderCumulativeStats()}
  `;
}

/**
 * Rend les stats cumulatives d'optimisation (toujours visibles).
 * Affiche : nombre total d'optimisations + tokens économisés + taux de compression moyen.
 */
function renderCumulativeStats() {
  const stats = getState().assistant?.optimizationStats || { totalOptimized: 0, totalTokensSaved: 0, averageCompression: 0 };
  const totalOpt = stats.totalOptimized || 0;
  const saved = stats.totalTokensSaved || 0;
  const ratio = Math.round(stats.averageCompression || 0);
  if (totalOpt === 0) {
    return `
      <div class="chat-cumulative-stats chat-cumulative-stats--empty" id="chat-cumulative-stats">
        <span class="chat-cumulative-stats__icon">${getActionIcon('trending-up', 12)}</span>
        <span class="chat-cumulative-stats__text">Stats d'optimisation : aucune réponse optimisée pour l'instant</span>
      </div>
    `;
  }
  return `
    <div class="chat-cumulative-stats" id="chat-cumulative-stats" title="Statistiques cumulées des optimisations de réponses">
      <span class="chat-cumulative-stats__icon">${getActionIcon('trending-up', 12)}</span>
      <span class="chat-cumulative-stats__text">
        <strong>${totalOpt}</strong> réponse${totalOpt > 1 ? 's' : ''} optimisée${totalOpt > 1 ? 's' : ''} ·
        <strong>${saved.toLocaleString('fr-FR')}</strong> tok économisés ·
        <strong>${ratio}%</strong> de compression
      </span>
    </div>
  `;
}

async function refreshPromptHistory({ searchQuery = '', typeFilter = '' } = {}) {
  const listEl = panelEl?.querySelector('#chat-prompt-history__list');
  const countEl = panelEl?.querySelector('#chat-prompt-history__count');
  if (!listEl) return;

  try {
    const params = new URLSearchParams();
    if (searchQuery) params.set('q', searchQuery);
    if (typeFilter) params.set('type', typeFilter);

    const url = '/api/prompts' + (params.toString() ? '?' + params.toString() : '');
    const resp = await fetch(url);
    if (!resp.ok) {
      listEl.innerHTML = '<li class="chat-prompt-history__error">Erreur de chargement.</li>';
      return;
    }

    const index = await resp.json();
    const prompts = index.prompts || [];

    if (countEl) {
      countEl.textContent = `(${prompts.length})`;
    }

    if (prompts.length === 0) {
      listEl.innerHTML = '<li class="chat-prompt-history__empty">Aucun prompt sauvegardé.</li>';
      return;
    }

    // Trier par timestamp décroissant (plus récent d'abord)
    const sorted = [...prompts].sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));

    listEl.innerHTML = sorted.map(p => renderPromptHistoryItem(p)).join('');
  } catch (err) {
    console.warn('[Chat] Échec chargement historique prompts:', err.message);
    listEl.innerHTML = '<li class="chat-prompt-history__error">Erreur de chargement.</li>';
  }
}

/**
 * Rend un élément de la liste d'historique.
 * @param {Object} p - Entrée index.json : { id, type, timestamp, tokens, category }
 * @returns {string} HTML
 */
function renderPromptHistoryItem(p) {
  const typeLabels = {
    analysis: 'Analyse',
    suggestion: 'Suggestion',
    documentation: 'Documentation',
    enrichment: 'Enrichissement',
    architecture: 'Architecture',
    conversation: 'Conversation',
  };
  const typeLabel = typeLabels[p.type] || p.type || '?';
  const tokens = p.tokens ? `${p.tokens} tok` : '';
  const time = p.timestamp ? formatTime(p.timestamp) : '';
  const date = p.timestamp ? new Date(p.timestamp).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' }) : '';

  return `
    <li class="chat-prompt-history__item" data-prompt-id="${escapeHtml(p.id)}">
      <details class="chat-prompt-history__item-details">
        <summary class="chat-prompt-history__item-summary">
          <span class="chat-prompt-history__item-type chat-prompt-history__item-type--${escapeHtml(p.type || 'unknown')}">${escapeHtml(typeLabel)}</span>
          <span class="chat-prompt-history__item-meta">
            ${date ? `<span class="chat-prompt-history__item-date">${escapeHtml(date)}</span>` : ''}
            ${time ? `<span class="chat-prompt-history__item-time">${escapeHtml(time)}</span>` : ''}
            ${tokens ? `<span class="chat-prompt-history__item-tokens">${escapeHtml(tokens)}</span>` : ''}
          </span>
          <button type="button" class="chat-prompt-history__item-delete" data-action="delete-prompt" data-prompt-id="${escapeHtml(p.id)}" title="Supprimer ce prompt" aria-label="Supprimer ce prompt">${getActionIcon('trash', 12)}</button>
        </summary>
        <div class="chat-prompt-history__item-content" data-prompt-content-id="${escapeHtml(p.id)}">
          <span class="chat-prompt-history__item-loading">Chargement du contenu…</span>
        </div>
      </details>
    </li>
  `;
}

/**
 * Charge le contenu d'un prompt spécifique depuis /api/prompts/{id}.md
 * et l'injecte dans l'élément de liste correspondant.
 * @param {string} id - ID du prompt (timestamp-type)
 */
async function loadPromptContent(id) {
  const contentEl = panelEl?.querySelector(`[data-prompt-content-id="${CSS.escape(id)}"]`);
  if (!contentEl) return;

  try {
    const resp = await fetch(`/api/prompts/${encodeURIComponent(id)}.md`);
    if (!resp.ok) {
      contentEl.innerHTML = '<span class="chat-prompt-history__item-error">Contenu introuvable.</span>';
      return;
    }
    const text = await resp.text();
    contentEl.innerHTML = `<pre class="chat-prompt-history__item-pre">${escapeHtml(text)}</pre>`;
  } catch (err) {
    contentEl.innerHTML = `<span class="chat-prompt-history__item-error">Erreur : ${escapeHtml(err.message)}</span>`;
  }
}

/**
 * Supprime un prompt via DELETE /api/prompts/{id}.
 * @param {string} id - ID du prompt à supprimer
 */
async function deletePromptFromHistory(id) {
  // Suppression directe sans confirmation JS (UX moderne) + feedback toast

  try {
    const resp = await fetch(`/api/prompts/${encodeURIComponent(id)}`, { method: 'DELETE' });
    if (!resp.ok) {
      console.warn('[Chat] Échec suppression prompt:', resp.status);
      toast.error('Impossible de supprimer le prompt');
      return;
    }
    const searchEl = panelEl?.querySelector('#chat-prompt-history__search');
    const typeEl = panelEl?.querySelector('#chat-prompt-history__type-filter');
    await refreshPromptHistory({
      searchQuery: searchEl?.value || '',
      typeFilter: typeEl?.value || '',
    });
    toast.success('Prompt supprimé');
  } catch (err) {
    console.warn('[Chat] Échec suppression prompt:', err.message);
    toast.error('Erreur réseau lors de la suppression');
  }
}

/**
 * Rend la section repliable du prompt préparé dans le flux de chat.
 * Insérée entre le message utilisateur et la réponse.
 * @param {import('./promptEngine.js').PreparedPrompt} prepared
 * @returns {HTMLElement|null} L'élément DOM créé
 */
function renderPromptSection(prepared) {
  const body = panelEl?.querySelector('#app-chat-body');
  if (!body || !prepared) return null;

  const typeLabel = {
    analysis: 'Analyse',
    suggestion: 'Suggestion',
    documentation: 'Documentation',
    enrichment: 'Enrichissement',
    architecture: 'Architecture',
    conversation: 'Conversation',
  }[prepared.type] || prepared.type;

  const cacheLabel = prepared.cached ? ' · réutilisé [cache]' : ' · préparé';
  const estTokens = Math.ceil(prepared.prompt.length / 4);

  // Nettoyer le prompt : ne garder que les premières lignes pour l'aperçu
  const previewLines = prepared.prompt.split('\n').slice(0, 5).join('\n');
  const hasMore = prepared.prompt.split('\n').length > 5;

  // Utiliser un ID unique basé sur le prepared.id pour éviter les doublons
  const sectionId = `chat-prompt-section-${prepared.id}`;
  const details = document.createElement('details');
  details.className = 'chat-prompt-section';
  details.id = sectionId;
  details.innerHTML = `
    <summary class="chat-prompt-section__summary">
      <span class="chat-prompt-section__title">${getChatIcon('file-text', 12)} Prompt utilisé (${typeLabel}${cacheLabel})</span>
      <span class="chat-prompt-section__meta">
        <span class="chat-prompt-section__tokens">${getActionIcon('bar-chart', 11)} ${estTokens} tok</span>
        ${prepared.cached ? '<span class="chat-prompt-section__badge chat-prompt-section__badge--cached">cache</span>' : ''}
        ${prepared.apiEnhanced ? `<span class="chat-prompt-section__badge chat-prompt-section__badge--enhanced">${getActionIcon('zap', 10)} amélioré</span>` : ''}
        <button type="button" class="chat-prompt-section__reprepare" data-action="re-prepare-prompt" title="Re-préparer le prompt" aria-label="Re-préparer le prompt">${getActionIcon('refresh', 12)}</button>
      </span>
    </summary>
    <div class="chat-prompt-section__content">
      <pre class="chat-prompt-section__pre">${escapeHtml(previewLines)}${hasMore ? '\n...' : ''}</pre>
      <div class="chat-prompt-section__footer">
        <span class="chat-prompt-section__context">
          ${prepared.context.nodeCount} nœuds · ${prepared.context.edgeCount} arêtes
          ${prepared.context.selectedNodes.length > 0 ? `· ${prepared.context.selectedNodes.length} sélectionné(s)` : ''}
        </span>
      </div>
    </div>
  `;

  // Insérer après le dernier message utilisateur
  const userMessages = body.querySelectorAll('.chat-msg--user');
  const lastUser = userMessages[userMessages.length - 1];
  if (lastUser && lastUser.nextSibling) {
    body.insertBefore(details, lastUser.nextSibling);
  } else if (lastUser) {
    body.appendChild(details);
  } else {
    // Fallback : insérer avant le typewriting
    const typingEl = body.querySelector('#chat-typing');
    if (typingEl) body.insertBefore(details, typingEl);
    else body.appendChild(details);
  }

  return details;
}

function renderWelcome() {
  const graph = { nodes: getState().nodes, edges: getState().edges };
  const nodeCount = graph.nodes.filter(n => n.type !== 'hub').length;
  const edgeCount = graph.edges.length;

  // Utiliser le nom grec du provider actif, ou 'Mina' par défaut
  const provider = getState().assistant?.provider;
  const name = (provider?.id && PROVIDER_TITLES[provider.id]) || 'Mina';

  let contextHint = '';
  if (nodeCount > 0) {
    contextHint = `<span class="chat-welcome-context">Je vois ton canvas avec ${nodeCount} nœud${nodeCount > 1 ? 's' : ''} et ${edgeCount} arête${edgeCount > 1 ? 's' : ''}.</span>`;
  }

  return `
    <div class="chat-welcome">
      <strong>Bonjour ! Je suis ${escapeHtml(name)}</strong>, ton assistant de conception.<br>
      Comment puis-je t'aider avec ton diagramme ?
      ${contextHint}
    </div>
  `;
}

function renderProviderNotice() {
  return `
    <div class="chat-notice">
      <span class="chat-notice__icon">${getActionIcon('settings', 16)}</span>
      <span class="chat-notice__text">
        Configure un provider dans le panneau <strong>Providers</strong> pour commencer à discuter avec Mina.
      </span>
      <button type="button" class="chat-notice__link" data-action="open-providers">
        Ouvrir Providers →
      </button>
    </div>
  `;
}

function renderHistoryMessage(msg) {
  if (msg.role === 'user') {
    return `
      <div class="chat-msg chat-msg--user" data-msg-role="user">
        <div class="chat-msg__bubble">${escapeHtml(msg.content)}</div>
        <div class="chat-msg__actions">
          <button type="button" class="chat-msg__edit-btn" data-action="edit-message" title="Modifier ce message" aria-label="Modifier ce message">${getChatIcon('edit', 12)}</button>
          ${msg.timestamp ? `<span class="chat-msg__time">${formatTime(msg.timestamp)}</span>` : ''}
        </div>
      </div>
    `;
  }
  if (msg.role === 'assistant') {
    return `
      <div class="chat-msg chat-msg--assistant">
        <div class="chat-msg__bubble">${renderMarkdown(msg.content)}</div>
        <div class="chat-msg__actions">
          <button type="button" class="chat-regen-btn" data-action="regenerate" title="Régénérer la réponse">${getChatIcon('rotate-ccw', 12)}</button>
          <button type="button" class="chat-copy-btn" data-action="copy" data-text="${escapeHtml(msg.content)}" title="Copier le message">${getChatIcon('copy', 12)}</button>
          ${msg.timestamp ? `<span class="chat-msg__time">${formatTime(msg.timestamp)}</span>` : ''}
        </div>
      </div>
    `;
  }
  return '';
}

function renderQuickActions() {
  const quickBar = panelEl?.querySelector('#chat-quick-actions');
  if (!quickBar) return;

  const provider = getState().assistant?.provider;
  if (!provider?.id) {
    quickBar.innerHTML = '';
    return;
  }

  // Aplatir toutes les actions pour recherche
  const allActions = QUICK_ACTION_CATEGORIES.flatMap(cat => cat.actions);

  quickBar.innerHTML = QUICK_ACTION_CATEGORIES.map(cat => `
    <div class="chat-quick-category">
      <span class="chat-quick-category__label">
        ${getActionIcon(cat.icon)}
        <span>${cat.label}</span>
      </span>
      <select class="chat-quick-select" data-category="${cat.id}" title="${cat.label}">
        <option value="" disabled selected>${cat.label}…</option>
        ${cat.actions.map(a => `<option value="${a.id}" title="${escapeHtml(a.prompt)}">${a.label}</option>`).join('')}
      </select>
    </div>
  `).join('');

  // Câble le changement de sélection pour chaque select
  quickBar.querySelectorAll('.chat-quick-select').forEach(select => {
    select.addEventListener('change', () => {
      const action = allActions.find(a => a.id === select.value);
      if (action) {
        sendMessage(action.prompt);
        select.selectedIndex = 0;
      }
    });
  });
}

function renderInputArea() {
  const inputArea = panelEl?.querySelector('#chat-input-area');
  if (!inputArea) return;

  const provider = getState().assistant?.provider;
  const disabled = !provider?.id;

  inputArea.innerHTML = `
    <div class="chat-input-wrap">
      <textarea
        class="chat-input"
        id="chat-input"
        placeholder="Que veux-tu faire ?"
        rows="1"
        ${disabled ? 'disabled' : ''}
      ></textarea>
    </div>
    <button type="button" class="chat-send-btn" id="chat-send-btn" ${disabled ? 'disabled' : ''} title="Envoyer (Enter)">${getChatIcon('send', 16)}</button>
    <button type="button" class="chat-stop-btn" id="chat-stop-btn" style="display:none;" title="Arrêter la génération">${getChatIcon('square', 16)}</button>
  `;

  // Auto-resize + Enter key handler sur le textarea
  // (attaché ici car le textarea est recréé à chaque renderInputArea)
  const textarea = inputArea.querySelector('#chat-input');
  if (textarea) {
    textarea.addEventListener('input', () => {
      textarea.style.height = 'auto';
      textarea.style.height = Math.min(textarea.scrollHeight, 120) + 'px';
    });
    textarea.addEventListener('keydown', handleInputKeydown);
  }

  // Send button click
  const sendBtn = inputArea.querySelector('#chat-send-btn');
  if (sendBtn) {
    sendBtn.addEventListener('click', () => {
      const input = panelEl?.querySelector('#chat-input');
      if (input && input.value.trim()) {
        sendMessage(input.value.trim());
      }
    });
  }

  // Stop button click — arrête le streaming en cours
  const stopBtn = inputArea.querySelector('#chat-stop-btn');
  if (stopBtn) {
    stopBtn.addEventListener('click', stopStreaming);
  }
}

/* ---------- Event handlers ---------- */

function handleInputKeydown(e) {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    const input = panelEl?.querySelector('#chat-input');
    if (input && input.value.trim()) {
      sendMessage(input.value.trim());
    }
  }
}

function handleChatBodyClick(e) {
  // Open providers link
  if (e.target.closest('[data-action="open-providers"]')) {
    closeChatPanel();
    openProviderPanel();
    return;
  }

  // Copy button on assistant messages
  const copyBtn = e.target.closest('[data-action="copy"]');
  if (copyBtn) {
    handleCopyMessage(copyBtn);
    return;
  }

  // Regenerate button on assistant messages
  const regenBtn = e.target.closest('[data-action="regenerate"]');
  if (regenBtn) {
    handleRegenerateMessage(regenBtn);
    return;
  }

  // Retry button on error messages
  const retryBtn = e.target.closest('.chat-msg__retry');
  if (retryBtn) {
    const retryText = retryBtn.dataset.retryText;
    if (retryText) sendMessage(retryText);
    return;
  }

  // Re-prepare prompt button
  const reprepareBtn = e.target.closest('[data-action="re-prepare-prompt"]');
  if (reprepareBtn) {
    handleRepreparePrompt();
    return;
  }

  // Edit message button (user message)
  const editBtn = e.target.closest('[data-action="edit-message"]');
  if (editBtn) {
    handleEditMessage(editBtn);
    return;
  }      // Toggle history item (lazy-load content)
      // Note : le click event fire AVANT le toggle natif du <details>.
      // On vérifie donc !historyItemDetails.open (va s'ouvrir) et non
      // historyItemDetails.open (déjà ouvert). Cela déclenche le chargement
      // dès le PREMIER clic, pas le second.
      // On exclut aussi le bouton supprimer pour ne pas court-circuiter
      // le handler deletePromptFromHistory ci-dessous.
      const historyItemDetails = e.target.closest('.chat-prompt-history__item-details');
      if (historyItemDetails && !e.target.closest('[data-action="delete-prompt"]')) {
        const item = historyItemDetails.closest('.chat-prompt-history__item');
        const id = item?.dataset.promptId;
        if (id && !historyItemDetails.open) {
          const contentEl = historyItemDetails.querySelector('[data-prompt-content-id]');
          if (contentEl && contentEl.querySelector('.chat-prompt-history__item-loading')) {
            loadPromptContent(id);
          }
        }
        return;
      }

  // Delete prompt from history
  const deletePromptBtn = e.target.closest('[data-action="delete-prompt"]');
  if (deletePromptBtn) {
    e.preventDefault();
    e.stopPropagation();
    const id = deletePromptBtn.dataset.promptId;
    if (id) deletePromptFromHistory(id);
    return;
  }
}

/**
 * Câble les filtres de l'historique (recherche + type) après renderPanelContent.
 * Appelé depuis initializeChatPanel() + après chaque render.
 */
function bindPromptHistoryFilters() {
  const searchEl = panelEl?.querySelector('#chat-prompt-history__search');
  const typeEl = panelEl?.querySelector('#chat-prompt-history__type-filter');
  if (searchEl && !searchEl.dataset.bound) {
    let searchTimer = null;
    searchEl.addEventListener('input', () => {
      clearTimeout(searchTimer);
      searchTimer = setTimeout(() => {
        refreshPromptHistory({
          searchQuery: searchEl.value,
          typeFilter: typeEl?.value || '',
        });
      }, 200); // Debounce 200ms
    });
    searchEl.dataset.bound = '1';
  }
  if (typeEl && !typeEl.dataset.bound) {
    typeEl.addEventListener('change', () => {
      refreshPromptHistory({
        searchQuery: searchEl?.value || '',
        typeFilter: typeEl.value,
      });
    });
    typeEl.dataset.bound = '1';
  }
}

/* ---------- Send message ---------- */

async function sendMessage(text, options = {}) {
  const { skipUserMessage = false } = options;

  // [CHAT] Trace ENTRY — début de sendMessage()
  traceChat('sendMessage ENTRY', {
    text: text.slice(0, 80),
    skipUserMessage,
    isThinking,
    isOptimizing,
    hasProvider: !!getState().assistant?.provider?.id,
  });

  if (!text.trim() || isThinking || isOptimizing) {
    traceChat('sendMessage SKIP', {
      reason: !text.trim() ? 'empty' : isThinking ? 'thinking' : 'optimizing',
    });
    return;
  }

  const provider = getState().assistant?.provider;
  if (!provider?.id) {
    addSystemMessage('Configure un provider dans le panneau Providers pour commencer.', 'warning');
    return;
  }

  // Ajouter le message utilisateur dans le DOM et le state (sauf pour régénération)
  if (!skipUserMessage) {
    appendMessageToDOM('user', text);
    actions.pushChatMessage({ role: 'user', content: text, timestamp: Date.now() });
    setInputValue('');

    // [CHAT] Trace user message pushed
    traceChat('user message pushed', { textLen: text.length, timestamp: Date.now() });

    // Préparer le prompt via PromptEngine
    try {
      const graph = { nodes: getState().nodes, edges: getState().edges };
      const prepared = await promptEngine.preparePrompt(text, graph);
      actions.setCurrentPrompt(prepared);

      // [CHAT] Trace promptEngine prepared
      traceChat('promptEngine prepared', {
        preparedId: prepared.id,
        type: prepared.type,
        cached: prepared.cached,
        apiEnhanced: prepared.apiEnhanced,
        tokenCount: estimateTokens(prepared.prompt),
      });

      // Afficher la section prompt dans le DOM
      renderPromptSection(prepared);

      // Rafraîchir l'historique après 500ms (laisse le temps au POST /api/prompts
      // fire-and-forget de compléter l'écriture disque + rotation)
      // Fix: la liste était vide car refreshPromptHistory n'était appelé qu'à
      // l'ouverture du panel, jamais après chaque envoi.
      const refreshHistoryAfter = (delay) => {
        setTimeout(async () => {
          const searchEl = panelEl?.querySelector('#chat-prompt-history__search');
          const typeEl = panelEl?.querySelector('#chat-prompt-history__type-filter');
          const before = panelEl?.querySelector('#chat-prompt-history__count')?.textContent;
          await refreshPromptHistory({
            searchQuery: searchEl?.value || '',
            typeFilter: typeEl?.value || '',
          });
          // Si la liste est toujours vide mais qu'on vient d'envoyer un prompt,
          // réessayer une fois à +800ms (le POST peut être lent en dev)
          const after = panelEl?.querySelector('#chat-prompt-history__count')?.textContent;
          if ((before === '(0)' || before === '…') && after === '(0)') {
            refreshHistoryAfter(800);
          }
        }, delay);
      };
      refreshHistoryAfter(500);
    } catch (err) {
      console.warn('[Chat] Échec préparation prompt:', err.message);
      // Continue sans prompt préparé (fallback SYSTEM_PROMPT)
    }
  }
  scrollToBottom();

  // Indiquer que l'assistant réfléchit
  isThinking = true;
  showThinkingIndicator(true);

  // Créer un AbortController pour pouvoir annuler le streaming
  streamAbortController = new AbortController();

  // Créer la bulle de streaming (mise à jour en temps réel)
  const streamingBubble = createStreamingBubble();
  let streamedContent = '';

  try {
    // Construire les messages avec le contexte du canvas et le prompt préparé
    const graph = { nodes: getState().nodes, edges: getState().edges };
    const currentPrompt = promptEngine?.getCurrentPrompt();
    const customPrompt = currentPrompt?.prompt || null;
    const promptMode = currentPrompt?.type === 'conversation' ? 'enrich' : 'replace';
    const systemMessages = buildSystemMessages(graph, customPrompt, promptMode);
    const history = getState().assistant.chatHistory || [];
    // Note : le message `text` a déjà été push dans `history` (via
    // actions.pushChatMessage) plus haut dans cette fonction, donc
    // `history.map(...)` l'inclut DÉJÀ. Ne PAS le rajouter à la fin
    // dans ce cas, sinon le prompt utilisateur est envoyé en double
    // à LM Studio (bug observé dans les logs serveur).
    //
    // Exception : si `skipUserMessage` est true (régénération / édition
    // puis renvoi), le message N'A PAS été push dans `history` — il faut
    // donc l'ajouter explicitement à la fin de `allMessages`.
    const allMessages = [
      ...systemMessages,
      ...history.map(m => ({ role: m.role, content: m.content })),
      ...(skipUserMessage ? [{ role: 'user', content: text }] : []),
    ];

    // [CHAT] Trace streamChatCompletion CALL
    traceChat('streamChatCompletion CALL', {
      provider: provider.id,
      model: provider.model,
      messagesLen: allMessages.length,
      hasCustomPrompt: !!customPrompt,
    });

    // Appel API en streaming
    await streamChatCompletion(provider, trimHistory(allMessages), {
      onToken(token) {
        streamedContent += token;
        streamTokenCount++;

        // [CHAT] Trace onToken — throttled 1/10 pour éviter de saturer la console
        if (streamTokenCount % 10 === 0) {
          traceChat('onToken', {
            tokenLen: token.length,
            cumLen: streamedContent.length,
            tokenCount: streamTokenCount,
            preview: token.slice(0, 40),
          });
        }

        // Typewriter (10ms) : ajouter les nouveaux caractères en texte échappé
        if (!typewriterTimer) {
          typewriterTimer = setTimeout(() => {
            typewriterTimer = null;
            appendTypewriterText(streamingBubble, streamedContent);
            updateStreamingStats();
            scrollToBottom();
          }, 10);
        }

        // Markdown sync (500ms) : ré-appliquer le rendu formaté complet
        if (!markdownSyncTimer) {
          markdownSyncTimer = setTimeout(() => {
            markdownSyncTimer = null;
            syncMarkdownBubble(streamingBubble, streamedContent);
            updateStreamingStats();
            scrollToBottom();
          }, 500);
        }
      },
      onDone() {
        // Vider les timers de typewriter et markdown sync
        if (typewriterTimer) { clearTimeout(typewriterTimer); typewriterTimer = null; }
        if (markdownSyncTimer) { clearTimeout(markdownSyncTimer); markdownSyncTimer = null; }
        // Finaliser les stats
        stopStreamingStats();
        // Finaliser : retirer le curseur de streaming, sauvegarder dans le state
        finalizeStreamingBubble(streamingBubble, streamedContent);
        actions.pushChatMessage({ role: 'assistant', content: streamedContent, timestamp: Date.now() });
        scrollToBottom();
        // [CHAT] Trace onDone — fin du streaming
        traceChat('onDone', {
          streamedContentLen: streamedContent.length,
          tokenCount: streamTokenCount,
        });
      },
      onError(err) {
        // [CHAT] Trace onError — erreur pendant streaming
        traceChat('onError', {
          errorMsg: err?.message?.slice(0, 200),
          hasPartialContent: streamedContent.length > 0,
        });
        // Si on a déjà du contenu partielle, on le garde
        if (streamedContent) {
          finalizeStreamingBubble(streamingBubble, streamedContent);
          actions.pushChatMessage({ role: 'assistant', content: streamedContent, timestamp: Date.now() });
        } else {
          // Supprimer la bulle vide
          streamingBubble.remove();
          appendMessageToDOM('system', `Erreur : ${err.message}`, 'error');
          addRetryButton(text);
        }
      },
    }, streamAbortController.signal);

    // Post-optimisation après streaming (sauf pour régénération)
    if (!skipUserMessage && streamedContent && !isOptimizing) {
      const tokenCount = estimateTokens(streamedContent);
      const threshold = getState().assistant?.optimizationThreshold || DEFAULT_OPTIMIZATION_THRESHOLD;
      // [CHAT] Trace optimizeLastResponse CALL — toujours émis, willOptimize indique si déclenché
      traceChat('optimizeLastResponse CALL', {
        responseLen: streamedContent.length,
        tokenCount,
        threshold,
        willOptimize: tokenCount > threshold,
      });
      if (tokenCount > threshold) {
        await optimizeLastResponse(streamingBubble, streamedContent);
      }
    }

  } catch (error) {
    // [CHAT] Trace CATCH error — erreur dans sendMessage
    traceChat('CATCH error', {
      errorName: error.name,
      errorMsg: error.message?.slice(0, 200),
      hasPartialContent: streamedContent.length > 0,
    });
    // Annulation volontaire
    if (error.name === 'AbortError') {
      if (streamedContent) {
        finalizeStreamingBubble(streamingBubble, streamedContent);
        actions.pushChatMessage({ role: 'assistant', content: streamedContent, timestamp: Date.now() });
      } else {
        streamingBubble.remove();
      }
    } else {
      // Erreur inattendue
      if (streamedContent) {
        finalizeStreamingBubble(streamingBubble, streamedContent);
        actions.pushChatMessage({ role: 'assistant', content: streamedContent, timestamp: Date.now() });
      } else {
        streamingBubble.remove();
        appendMessageToDOM('system', `Erreur : ${error.message}`, 'error');
        addRetryButton(text);
      }
    }
  } finally {
    isThinking = false;
    streamAbortController = null;
    if (typewriterTimer) { clearTimeout(typewriterTimer); typewriterTimer = null; }
    if (markdownSyncTimer) { clearTimeout(markdownSyncTimer); markdownSyncTimer = null; }
    stopStreamingStats();
    showThinkingIndicator(false);
    showStopButton(false);
    scrollToBottom();
    // [CHAT] Trace FINALLY — fin de sendMessage
    traceChat('FINALLY', {
      streamedContentLen: streamedContent.length,
      isThinking: false,
    });
  }
}

/** Annule le streaming en cours. */
function stopStreaming() {
  if (streamAbortController) {
    streamAbortController.abort();
  }
}

/* ---------- Edit message ---------- */

/**
 * Trouve l'index d'un message user dans l'historique à partir d'un bouton d'édition.
 * On remonte le DOM depuis le bouton jusqu'à `.chat-msg--user` puis on compte
 * les `.chat-msg--user` qui précèdent (incluant celui-ci) pour obtenir l'index.
 * @param {HTMLElement} btn - Le bouton d'édition cliqué
 * @returns {number|null} L'index du message user dans chatHistory, ou null
 */
function findUserMessageIndex(btn) {
  const msgDiv = btn.closest('.chat-msg--user');
  if (!msgDiv) return null;

  const body = panelEl?.querySelector('#app-chat-body');
  if (!body) return null;

  const allUserMsgs = Array.from(body.querySelectorAll('.chat-msg--user'));
  const idxInDom = allUserMsgs.indexOf(msgDiv);
  if (idxInDom === -1) return null;

  // L'historique du state peut contenir des messages assistant et user entrelacés.
  // On parcourt chatHistory en ordre et on compte les 'user' jusqu'à tomber sur
  // celui qui correspond (par contenu + timestamp approximatif).
  const targetText = msgDiv.querySelector('.chat-msg__bubble')?.textContent || '';
  const history = getState().assistant?.chatHistory || [];
  let userCount = 0;
  for (let i = 0; i < history.length; i++) {
    if (history[i].role === 'user') {
      if (userCount === idxInDom && history[i].content === targetText) {
        return i;
      }
      userCount++;
    }
  }
  // Fallback : si on n'a pas trouvé par contenu (caractères échappés), on prend
  // l'index i si userCount correspond
  return null;
}

/**
 * Gère le clic sur le bouton « Modifier » d'un message user.
 * - Refuse si un streaming est en cours (isThinking)
 * - Trouve l'index du message dans l'historique
 * - Supprime tous les messages à partir de cet index (incluant la réponse assistant suivante)
 * - Injecte le texte dans le textarea
 * - Focus le textarea
 * - Re-render le panneau (les messages supprimés disparaissent)
 */
function handleEditMessage(btn) {
  if (isThinking || isOptimizing) {
    if (typeof toast !== 'undefined' && toast?.warning) {
      toast.warning('Une réponse est en cours — attends qu\'elle se termine pour modifier.');
    }
    return;
  }

  const idx = findUserMessageIndex(btn);
  if (idx === null) return;

  const history = getState().assistant?.chatHistory || [];
  const msg = history[idx];
  if (!msg || msg.role !== 'user') return;

  // 1) Truncate l'historique à partir de cet index
  actions.popLastChatMessagesFromIndex(idx);

  // 2) Retirer les bulles du DOM à partir de ce message
  const msgDiv = btn.closest('.chat-msg--user');
  if (msgDiv) {
    // Supprimer ce message et tous les suivants (siblings)
    let next = msgDiv.nextElementSibling;
    msgDiv.remove();
    while (next) {
      const toRemove = next;
      next = next.nextElementSibling;
      toRemove.remove();
    }
  }

  // 3) Injecter le texte dans le textarea
  setInputValue(msg.content);

  // 4) Focus le textarea
  const input = panelEl?.querySelector('#chat-input');
  if (input) {
    input.focus();
    // Placer le curseur à la fin du texte
    const len = input.value.length;
    input.setSelectionRange(len, len);
    // Auto-resize
    input.style.height = 'auto';
    input.style.height = Math.min(input.scrollHeight, 120) + 'px';
  }
}

/**
 * Crée une bulle de message assistant vide avec un indicateur de frappe.
 * La bulle sera mise à jour au fur et à mesure que les tokens arrivent.
 * @returns {HTMLElement} L'élément .chat-msg créé
 */
function createStreamingBubble() {
  const body = panelEl?.querySelector('#app-chat-body');
  if (!body) return null;

  const typingEl = body.querySelector('#chat-typing');
  const msgDiv = document.createElement('div');
  displayedLength = 0;
  msgDiv.className = 'chat-msg chat-msg--assistant chat-msg--streaming';
  msgDiv.innerHTML = `<div class="chat-msg__bubble"><span class="chat-streaming-cursor"></span></div>`;
  // [CHAT] Trace createStreamingBubble — création de la bulle de streaming
  traceChat('createStreamingBubble', {
    className: msgDiv.className,
    hasExistingStreaming: !!body.querySelector('.chat-msg--streaming'),
  });

  if (typingEl) {
    body.insertBefore(msgDiv, typingEl);
  } else {
    body.appendChild(msgDiv);
  }

  // Masquer l'indicateur « Mina réfléchit… » et montrer le bouton stop
  showThinkingIndicator(false);
  showStopButton(true);

  // Lancer le suivi des stats de streaming
  startStreamingStats();

  return msgDiv;
}

/**
 * Ajoute les nouveaux caractères (delta) en texte échappé dans la bulle.
 * Couche « rapide » du typewriter : les caractères arrivent en temps réel
 * sans attendre le rendu Markdown.
 * @param {HTMLElement} bubble - Élément .chat-msg--streaming
 * @param {string} fullContent - Contenu complet accumulé depuis le début
 */
function appendTypewriterText(bubble, fullContent) {
  if (!bubble) return;
  const bbl = bubble.querySelector('.chat-msg__bubble');
  if (!bbl) return;

  const delta = fullContent.slice(displayedLength);
  if (!delta) return;

  // Ajouter les nouveaux caractères en texte brut (effet machine à écrire)
  bbl.appendChild(document.createTextNode(delta));
  displayedLength = fullContent.length;
}

/**
 * Remplace tout le contenu de la bulle par le rendu Markdown formaté.
 * Couche « lente » du typewriter : applique la mise en forme toutes les 500ms.
 * @param {HTMLElement} bubble - Élément .chat-msg--streaming
 * @param {string} fullContent - Contenu complet accumulé depuis le début
 */
function syncMarkdownBubble(bubble, fullContent) {
  if (!bubble) return;
  const bbl = bubble.querySelector('.chat-msg__bubble');
  if (!bbl) return;

  // Remplacer tout le contenu par le rendu Markdown + curseur
  bbl.innerHTML = renderStreamingMarkdown(fullContent) + '<span class="chat-streaming-cursor"></span>';
  // Tout le contenu est maintenant dans le HTML rendu
  displayedLength = fullContent.length;
}

/**
 * Finalise la bulle de streaming : retire le curseur, rend le markdown final.
 * @param {HTMLElement} bubble
 * @param {string} content - Contenu final complet
 */
function finalizeStreamingBubble(bubble, content) {
  if (!bubble) return;
  bubble.classList.remove('chat-msg--streaming');
  const bbl = bubble.querySelector('.chat-msg__bubble');
  if (!bbl) return;
  bbl.innerHTML = renderMarkdown(content);
  // Ajouter le bouton copier
  addCopyButtonToBubble(bubble, content);
}

/**
 * Ajoute un bouton « Réessayer » sous un message d'erreur.
 */
function addRetryButton(text) {
  const retryEl = panelEl?.querySelector('.chat-msg--error:last-child .chat-msg__bubble');
  if (retryEl) {
    const retryBtn = document.createElement('button');
    retryBtn.className = 'chat-msg__retry';
    retryBtn.innerHTML = `${getActionIcon('refresh')} Réessayer`;
    retryBtn.dataset.retryText = text;
    retryEl.appendChild(retryBtn);
  }
}

/** Affiche ou masque le bouton stop streaming. */
function showStopButton(show) {
  const stopBtn = panelEl?.querySelector('#chat-stop-btn');
  const sendBtn = panelEl?.querySelector('#chat-send-btn');
  if (stopBtn) stopBtn.style.display = show ? 'flex' : 'none';
  if (sendBtn) sendBtn.style.display = show ? 'none' : 'flex';
}

/* ---------- DOM manipulation helpers ---------- */

function appendMessageToDOM(role, content, type = '') {
  const body = panelEl?.querySelector('#app-chat-body');
  if (!body) return;

  const typingEl = body.querySelector('#chat-typing');
  const msgDiv = document.createElement('div');

  if (role === 'user') {
    msgDiv.className = 'chat-msg chat-msg--user';
    msgDiv.innerHTML = `<div class="chat-msg__bubble">${escapeHtml(content)}</div>`;
  } else if (role === 'assistant') {
    msgDiv.className = 'chat-msg chat-msg--assistant';
    msgDiv.innerHTML = `<div class="chat-msg__bubble">${renderMarkdown(content)}</div>`;
    addCopyButtonToBubble(msgDiv, content);
  } else {
    msgDiv.className = `chat-msg chat-msg--system${type ? ' chat-msg--' + type : ''}`;
    const bbl = document.createElement('div');
    bbl.className = 'chat-msg__bubble';
    // Ajouter icône inline selon le type
    if (type === 'warning') {
      const iconSpan = document.createElement('span');
      iconSpan.className = 'chat-msg__inline-icon';
      iconSpan.innerHTML = getActionIcon('alert-triangle');
      bbl.appendChild(iconSpan);
    } else if (type === 'error') {
      const iconSpan = document.createElement('span');
      iconSpan.className = 'chat-msg__inline-icon';
      iconSpan.innerHTML = getActionIcon('x-circle');
      bbl.appendChild(iconSpan);
    }
    bbl.appendChild(document.createTextNode(content));
    msgDiv.appendChild(bbl);
  }

  // Insérer avant l'indicateur de frappe
  if (typingEl) {
    body.insertBefore(msgDiv, typingEl);
  } else {
    body.appendChild(msgDiv);
  }
}

function addSystemMessage(text, type = '') {
  appendMessageToDOM('system', text, type);
  scrollToBottom();
}

function showThinkingIndicator(show) {
  const typingEl = panelEl?.querySelector('#chat-typing');
  if (typingEl) {
    typingEl.style.display = show ? 'flex' : 'none';
  }
}

function setInputValue(value) {
  const input = panelEl?.querySelector('#chat-input');
  if (input) {
    input.value = value;
    input.style.height = 'auto';
  }
}

function scrollToBottom() {
  if (scrollThrottleTimer) return;
  const body = panelEl?.querySelector('#app-chat-body');
  if (!body) return;
  scrollThrottleTimer = requestAnimationFrame(() => {
    scrollThrottleTimer = null;
    body.scrollTop = body.scrollHeight;
  });
}

function formatTime(timestamp) {
  const d = new Date(timestamp);
  return d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
}

/* ---------- Copy button ---------- */

/**
 * Ajoute un bouton copier à une bulle de message assistant.
 * @param {HTMLElement} msgDiv - L'élément .chat-msg
 * @param {string} rawContent - Le markdown brut du message
 */
function addCopyButtonToBubble(msgDiv, rawContent) {
  if (!msgDiv) return;
  const actionsDiv = document.createElement('div');
  actionsDiv.className = 'chat-msg__actions';
  actionsDiv.innerHTML = `
    <button type="button" class="chat-regen-btn" data-action="regenerate" title="Régénérer la réponse">${getChatIcon('rotate-ccw', 12)}</button>
    <button type="button" class="chat-copy-btn" data-action="copy" data-text="${escapeHtml(rawContent)}" title="Copier le message">${getChatIcon('copy', 12)}</button>
  `;
  msgDiv.appendChild(actionsDiv);
}

/**
 * Copie le texte brut d'un message assistant dans le presse-papier.
 * Affiche une vérification visuelle (icône ✓) pendant 1.5s.
 */
async function handleCopyMessage(btn) {
  const text = btn.dataset.text;
  if (!text) return;

  try {
    await navigator.clipboard.writeText(text);
    // Feedback visuel : remplacer l'icône par ✓ temporairement
    btn.classList.add('chat-copy-btn--copied');
    const originalHTML = btn.innerHTML;
    btn.innerHTML = getChatIconCheckBold(12);
    setTimeout(() => {
      btn.classList.remove('chat-copy-btn--copied');
      btn.innerHTML = originalHTML;
    }, 1500);
  } catch {
    // Fallback : sélectionner le texte
    console.warn('Clipboard API non disponible');
  }
}

/* ---------- Regenerate button ---------- */

/**
 * Trouve le message user précédent dans le DOM par rapport à un bouton regenerate.
 * @param {HTMLElement} btn - Le bouton regenerate cliqué
 * @returns {string|null} Le texte du message user précédent ou null
 */
function findPreviousUserMessage(btn) {
  const msgDiv = btn.closest('.chat-msg');
  if (!msgDiv) return null;

  // Remonter dans le DOM jusqu'au message user précédent
  let el = msgDiv.previousElementSibling;
  while (el) {
    if (el.classList.contains('chat-msg--user')) {
      const bubble = el.querySelector('.chat-msg__bubble');
      return bubble ? bubble.textContent.trim() : null;
    }
    el = el.previousElementSibling;
  }
  return null;
}

/**
 * Régénère la réponse assistant en réenvoyant le même prompt user.
 * Supprime seulement le dernier message assistant du DOM et du state,
 * puis relance la génération sans dupliquer le message utilisateur.
 *
 * Correction (B2) : utilise popLastChatMessage au lieu de clearChatHistory
 * + re-add, pour éviter de persister un historique vide en cas d'échec.
 */
async function handleRegenerateMessage(btn) {
  if (isThinking) return;

  const userText = findPreviousUserMessage(btn);
  if (!userText) return;

  // Supprimer le message assistant courant du DOM
  const msgDiv = btn.closest('.chat-msg');
  if (msgDiv) msgDiv.remove();

  // Pop le dernier message assistant du state + persist (une seule opération)
  actions.popLastChatMessage('assistant');

  // Relancer la génération sans ajouter de nouveau message user
  await sendMessage(userText, { skipUserMessage: true });
}

/* ---------- Refresh timer (canvas cache) ---------- */

/**
 * Démarre le rafraîchissement périodique du cache du prompt.
 * Toutes les 30s, compare le hash actuel du canvas avec le dernier connu.
 * Si différent → vide le cache (le prochain message aura un prompt frais).
 */
function startRefreshTimer() {
  stopRefreshTimer(); // Éviter les timers en double

  // Enregistrer le hash initial
  const graph = { nodes: getState().nodes, edges: getState().edges };
  lastCanvasHash = hashContext(graph.nodes, graph.edges);

  refreshTimer = setInterval(() => {
    if (!promptEngine || !isOpen) return;

    const current = { nodes: getState().nodes, edges: getState().edges };
    const currentHash = hashContext(current.nodes, current.edges);

    if (currentHash !== lastCanvasHash) {
      lastCanvasHash = currentHash;
      promptEngine.clearCache();
    }
  }, 30000); // 30 secondes
}

/**
 * Arrête le rafraîchissement périodique.
 */
function stopRefreshTimer() {
  if (refreshTimer) {
    clearInterval(refreshTimer);
    refreshTimer = null;
  }
}

/* ---------- Re-prepare prompt ---------- */

/**
 * Re-prépare le prompt actuel en ignorant le cache,
 * puis met à jour la section dans le DOM.
 */
async function handleRepreparePrompt() {
  if (isThinking || !promptEngine) return;

  // Trouver le dernier message utilisateur
  const body = panelEl?.querySelector('#app-chat-body');
  const userMessages = body?.querySelectorAll('.chat-msg--user');
  const lastUser = userMessages?.[userMessages.length - 1];
  if (!lastUser) return;

  const bubble = lastUser.querySelector('.chat-msg__bubble');
  const userText = bubble?.textContent?.trim();
  if (!userText) return;

  try {
    const graph = { nodes: getState().nodes, edges: getState().edges };
    const prepared = await promptEngine.preparePrompt(userText, graph, { forceRefresh: true });
    actions.setCurrentPrompt(prepared);

    // Remplacer la section prompt de ce message (la dernière)
    const oldSection = body?.querySelector('.chat-prompt-section:last-of-type');
    if (oldSection) oldSection.remove();

    renderPromptSection(prepared);
  } catch (err) {
    console.warn('[Chat] Échec re-préparation prompt:', err.message);
  }
}

/* ---------- Post-optimisation ---------- */

/**
 * Post-optimisation de la réponse après streaming.
 * Appelle le modèle pour condenser la réponse si elle dépasse le seuil.
 * @param {HTMLElement} bubble - Bulle de message assistant
 * @param {string} originalContent - Contenu original de la réponse
 */
async function optimizeLastResponse(bubble, originalContent) {
  const threshold = getState().assistant?.optimizationThreshold || DEFAULT_OPTIMIZATION_THRESHOLD;
  const tokenCount = estimateTokens(originalContent);
  // [CHAT] Trace optimizeLastResponse CALL — entrée post-optimisation
  traceChat('optimizeLastResponse CALL', {
    responseLen: originalContent.length,
    tokenCount,
    threshold,
    willOptimize: tokenCount > threshold,
  });
  if (!bubble || !originalContent || isOptimizing) {
    traceChat('optimizeLastResponse SKIP', {
      reason: !bubble ? 'no-bubble' : !originalContent ? 'empty' : 'already-optimizing',
    });
    return;
  }

  isOptimizing = true;
  // [CHAT] Trace isOptimizing LOCK — début optimisation
  traceChat('isOptimizing LOCK', { reason: 'start', isOptimizing: true });
  const provider = getState().assistant?.provider;
  const preparedPrompt = promptEngine?.getCurrentPrompt();

  if (!provider?.id || !preparedPrompt) {
    traceChat('optimizeLastResponse SKIP', { reason: 'no-prompt' });
    isOptimizing = false;
    return;
  }

  // Afficher le badge d'optimisation en cours
  showOptimizationBadge(bubble, 'optimizing');

  try {
    const optimized = await promptEngine.optimizeResponse(originalContent, preparedPrompt, provider);

    if (optimized && optimized.trim() && optimized !== originalContent.trim()) {
      // Remplacer le contenu de la bulle par la version optimisée
      const bbl = bubble.querySelector('.chat-msg__bubble');
      if (bbl) {
        bbl.innerHTML = renderMarkdown(optimized);
      }

      // Mettre à jour le dernier message dans l'historique
      actions.popLastChatMessage('assistant');
      actions.pushChatMessage({ role: 'assistant', content: optimized, timestamp: Date.now() });

      // Badge succès
      const originalTokens = estimateTokens(originalContent);
      const optimizedTokens = estimateTokens(optimized);
      const compressionRatio = Math.round((1 - optimized.length / originalContent.length) * 100);
      // [CHAT] Trace optimizeLastResponse BADGE done — optimisation réussie
      traceChat('optimizeLastResponse BADGE done', {
        originalTokens,
        optimizedTokens,
        compressionRatio,
      });
      showOptimizationBadge(bubble, 'done');

      // Mettre à jour les stats d'optimisation cumulées
      const tokensSaved = Math.max(0, originalTokens - optimizedTokens);
      if (tokensSaved > 0) {
        actions.updateOptimizationStats(tokensSaved, originalTokens);
      }
      // Rafraîchir l'affichage des stats cumulatives dans la topbar
      const cumulativeEl = panelEl?.querySelector('#chat-cumulative-stats');
      if (cumulativeEl) {
        const newHtml = renderCumulativeStats();
        const tmp = document.createElement('div');
        tmp.innerHTML = newHtml;
        const newEl = tmp.firstElementChild;
        if (newEl) cumulativeEl.replaceWith(newEl);
      }
    } else {
      // [CHAT] Trace optimizeLastResponse BADGE no-change — optimisation sans changement
      traceChat('optimizeLastResponse BADGE no-change', {
        originalTokens: tokenCount,
        optimizedTokens: estimateTokens(optimized || ''),
      });
      // Optimisation sans changement — badge discret
      showOptimizationBadge(bubble, 'no-change');
    }
  } catch (err) {
    console.warn('[Chat] Échec optimisation:', err.message);
    // [CHAT] Trace optimizeLastResponse BADGE failed — échec optimisation
    traceChat('optimizeLastResponse BADGE failed', { errorMsg: err.message?.slice(0, 200) });
    showOptimizationBadge(bubble, 'failed');
  } finally {
    isOptimizing = false;
    // [CHAT] Trace isOptimizing LOCK — fin optimisation
    traceChat('isOptimizing LOCK', { reason: 'end', isOptimizing: false });
  }
}

/**
 * Affiche ou met à jour le badge d'optimisation dans une bulle.
 * @param {HTMLElement} bubble - Élément .chat-msg
 * @param {'optimizing'|'done'|'no-change'|'failed'} state
 */
function showOptimizationBadge(bubble, state) {
  if (!bubble) return;

  // Supprimer un badge existant
  const old = bubble.querySelector('.chat-opt-badge');
  if (old) old.remove();

  const labels = {
    optimizing: 'Optimisation en cours...',
    done: 'Optimisé',
    'no-change': 'Déjà concis',
    failed: 'Optimisation non disponible',
  };

  const label = labels[state] || '';
  if (!label) return;

  const badge = document.createElement('span');
  badge.className = `chat-opt-badge chat-opt-badge--${state}`;
  badge.textContent = label;

  if (state === 'optimizing') {
    // Insérer le badge dans la bulle (pendant l'optimisation, la bulle contient
    // le contenu original — on ajoute le badge en dessous)
    const bbl = bubble.querySelector('.chat-msg__bubble');
    if (bbl) {
      bbl.appendChild(document.createElement('br'));
      bbl.appendChild(badge);
    }
  } else {
    // Après optimisation : ajouter le badge dans le conteneur d'actions
    const actionsDiv = bubble.querySelector('.chat-msg__actions');
    if (actionsDiv) {
      actionsDiv.prepend(badge);
    } else {
      // Fallback : ajouter après la bulle
      bubble.appendChild(badge);
    }
  }
}

/* ---------- Streaming stats ---------- */

/**
 * Lance le suivi des stats de streaming (tokens + temps écoulé).
 * Crée un élément DOM dans le header du chat (à côté du titre)
 * avec une barre de progression. Met à jour toutes les 200ms.
 */
function startStreamingStats() {
  streamTokenCount = 0;
  streamStartTime = Date.now();
  progressPct = 0;

  // Supprimer un ancien stats bar s'il existe
  const old = panelEl?.querySelector('.chat-stream-stats');
  if (old) old.remove();

  // Créer l'élément stats dans la topbar (à côté de l'historique des prompts)
  // pour qu'il reste visible quand la conversation grandit.
  const topbar = panelEl?.querySelector('#app-chat-topbar');
  if (!topbar) return;

  const statsBar = document.createElement('div');
  statsBar.className = 'chat-stream-stats';
  statsBar.id = 'chat-stream-stats';
  statsBar.innerHTML = `
    <span class="chat-stream-stats__pulse" aria-hidden="true"></span>
    <span class="chat-stream-stats__icon">${getActionIcon('zap', 12)}</span>
    <span class="chat-stream-stats__metrics" aria-live="polite" aria-atomic="true"><span class="chat-stream-stats__text"><strong class="chat-stream-stats__count">0</strong> <span class="chat-stream-stats__unit">tok</span></span><span class="chat-stream-stats__time-sep" aria-hidden="true">·</span><span class="chat-stream-stats__time">0.0s</span></span>
    <span class="chat-stream-stats__bar"><span class="chat-stream-stats__bar-fill"></span></span>
  `;

  // Insérer dans la topbar (avant les stats cumulatives si présentes)
  const cumulative = topbar.querySelector('.chat-cumulative-stats');
  if (cumulative) {
    topbar.insertBefore(statsBar, cumulative);
  } else {
    topbar.appendChild(statsBar);
  }

  // Timer pour rafraîchir l'affichage (compteur de tokens uniquement)
  // 500ms suffit : l'œil humain ne distingue pas 200ms vs 500ms pour un compteur.
  streamStatsTimer = setInterval(() => {
    updateStreamingStats();
  }, 500);

  // Timer pour le calcul de progression basé sur le temps écoulé — indépendant
  // du token count. Met à jour la jauge toutes les 800ms via une courbe lisse.
  progressTimer = setInterval(() => {
    updateProgressByTime();
  }, 800);

  // Calcule immédiatement la position initiale (0% au frame 0, sans attendre
  // le premier tick du timer) pour que la jauge affiche une valeur dès l'instant 0.
  updateProgressByTime();
}

/**
 * Calcule le pourcentage de progression de la jauge en fonction du temps écoulé.
 * Utilise une courbe exponentielle lissée : 0% → 90% en ~60 secondes.
 *   - Rapide au début (le modèle "démarre")
 *   - Ralentit progressivement (le modèle "réfléchit")
 *   - Asymptote à 90% (ne touche jamais 100% avant la fin réelle)
 *
 * Au-delà de 60 secondes, oscille entre 85% et 90% pour signaler "presque fini"
 * sans jamais prétendre que c'est terminé. La jauge saute à 100% (vert plein)
 * uniquement quand stopStreamingStats() est appelé, c-à-d quand le modèle a
 * réellement fini de streamer.
 *
 * Valeurs de référence (formule : pct = 90 * (1 - exp(-elapsed / 20))):
 *   t=1s  → 4%
 *   t=5s  → 22%
 *   t=10s → 39%
 *   t=20s → 59%
 *   t=30s → 70%
 *   t=60s → 83%
 *   t→∞  → 90%
 */
function updateProgressByTime() {
  if (streamStartTime === 0) return;
  const elapsed = (Date.now() - streamStartTime) / 1000;

  // Phase 1 : montée exponentielle (0 → 90%)
  let pct = 90 * (1 - Math.exp(-elapsed / 20));

  // Phase 2 : oscillation 85/90% après 60s (respiration "presque fini")
  if (elapsed > 60) {
    // Cycle de 2.4s : 1.2s à 85%, 1.2s à 90%
    const cycle = (elapsed % 2.4) / 2.4;
    pct = cycle < 0.5 ? 85 : 90;
  }

  progressPct = Math.round(pct);
  updateProgressBar(progressPct);
}

/**
 * Met à jour la jauge : largeur + couleur qui évolue selon le pourcentage.
 * @param {number} pct - Pourcentage (0-100)
 */
function updateProgressBar(pct) {
  const statsEl = panelEl?.querySelector('#chat-stream-stats');
  if (!statsEl) return;
  const barFill = statsEl.querySelector('.chat-stream-stats__bar-fill');
  if (!barFill) return;
  barFill.style.width = `${pct}%`;
  // Couleur évolue : bleu (froid) → vert (progression) → ambre (chauffage) → rouge (presque fini)
  // Utilise les tokens CSS du design system pour rester cohérent avec le dark mode
  let bg;
  if (pct < 30) {
    bg = 'linear-gradient(90deg, var(--info, #2563eb), #3b82f6)'; // bleu
  } else if (pct < 50) {
    bg = 'linear-gradient(90deg, var(--success, #15a35a), #34d399)'; // vert
  } else if (pct < 70) {
    bg = 'linear-gradient(90deg, var(--warning, #d97706), #fbbf24)'; // ambre
  } else {
    bg = 'linear-gradient(90deg, var(--danger, #dc2626), #f87171)'; // rouge
  }
  barFill.style.background = bg;
}

/**
 * Met à jour l'affichage des stats de streaming (texte + barre).
 */
function updateStreamingStats() {
  const statsEl = panelEl?.querySelector('#chat-stream-stats');
  if (!statsEl) return;

  // Mettre à jour le compteur de tokens (la jauge est gérée
  // par applyProgressStep() avec son propre timer pour le pattern +30%/-10%)
  const countEl = statsEl.querySelector('.chat-stream-stats__count');
  if (countEl) countEl.textContent = streamTokenCount;

  // Mettre à jour le temps écoulé depuis streamStartTime
  const timeEl = statsEl.querySelector('.chat-stream-stats__time');
  if (timeEl && streamStartTime > 0) {
    const elapsedSec = (Date.now() - streamStartTime) / 1000;
    timeEl.textContent = `${elapsedSec.toFixed(1)}s`;
  }
}

/**
 * Arrête le suivi des stats : affiche le résultat final, puis
 * disparaît après 2s (fade out).
 */
function stopStreamingStats() {
  if (!streamStatsTimer && !progressTimer) return; // Déjà arrêté
  if (streamStatsTimer) {
    clearInterval(streamStatsTimer);
    streamStatsTimer = null;
  }
  if (progressTimer) {
    clearInterval(progressTimer);
    progressTimer = null;
  }

  // Final : jauge à 100% avec couleur "succès" (vert plein)
  const statsEl = panelEl?.querySelector('#chat-stream-stats');
  if (statsEl) {
    // Mettre à jour le compteur de tokens et le temps final via la fonction partagée
    updateStreamingStats();
    // Set direct à 100% (pas besoin d'appeler updateProgressBar qui serait écrasé)
    const barFill = statsEl.querySelector('.chat-stream-stats__bar-fill');
    if (barFill) {
      barFill.style.width = '100%';
      barFill.style.background = 'linear-gradient(90deg, #15a35a, #34d399)';
    }

    // Classe finale → déclenche le fade out
    statsEl.classList.add('chat-stream-stats--done');

    // Supprimer l'élément du DOM après 2s
    setTimeout(() => {
      if (statsEl.parentNode) statsEl.remove();
    }, 2000);
  }

  streamTokenCount = 0;
  streamStartTime = 0;
  progressPct = 0;
}

/* ---------- Chat title (Greek names) ---------- */

/**
 * Met à jour le titre du chat selon le provider sélectionné.
 * Utilise les noms grecs de PROVIDER_TITLES, ou 'Mina' par défaut si aucun provider actif.
 */
function updateChatTitle() {
  const titleEl = document.getElementById('app-chat-title');
  if (!titleEl) return;

  const provider = getState().assistant?.provider;
  const providerId = provider?.id;

  if (providerId && PROVIDER_TITLES[providerId]) {
    titleEl.textContent = PROVIDER_TITLES[providerId];
  } else {
    titleEl.textContent = 'Mina';
  }

  // Déclencher l'animation de fondu : retirer puis ré-ajouter la classe
  titleEl.classList.remove('chat-title--fade');
  // Forcer un reflow pour que l'animation redémarre
  void titleEl.offsetWidth;
  titleEl.classList.add('chat-title--fade');
}

/* ---------- Provider bar (header) ---------- */

/**
 * Retourne l'icône SVG pour un provider selon son icon type.
 * Utilise le helper getChatIcon() qui pointe vers lucide-static.
 */
function getProviderIcon(iconType) {
  return getChatIcon(iconType, 12) || getChatIcon('cloud', 12);
}

/**
 * Peuple la barre de providers dans le header du chat.
 * Affiche les boutons des providers disponibles (depuis provider-configs.json).
 */
function populateProviderBar() {
  const bar = document.getElementById('app-chat-provider-bar');
  if (!bar) return;

  const allProviders = getAllPresets();
  const currentProvider = getState().assistant?.provider;
  const configs = getState().assistant?.providerConfigs || {};

  bar.innerHTML = allProviders.map(p => {
    const isActive = currentProvider?.id === p.id;
    const isConfigured = isActive
      ? currentProvider?.isConnected
      : !!(configs[p.id]?.isConnected);
    return `
      <button
        type="button"
        class="app__chat-provider-btn ${isActive ? 'is-active' : ''} ${!isConfigured ? 'is-unconfigured' : ''}"
        data-provider-id="${escapeHtml(p.id)}"
        title="${escapeHtml(p.name)}${!isConfigured ? ' — non configuré' : ''}"
      >
        <span class="app__chat-provider-btn__icon">${getProviderIcon(p.icon)}</span>
        <span class="app__chat-provider-btn__label">${escapeHtml(p.name)}</span>
      </button>
    `;
  }).join('');
}

/**
 * Gère le clic sur un bouton provider de la barre.
 * - Si le provider cliqué est déjà actif → juste fermer le panneau chat
 * - Si le provider n'est pas configuré → ouvrir le panneau Providers pour le configurer
 * - Si le provider est configuré mais pas actif → ouvrir le panneau Providers (étape modèle)
 */
function handleProviderBarClick(e) {
  const btn = e.target.closest('.app__chat-provider-btn');
  if (!btn) return;

  const providerId = btn.dataset.providerId;
  if (!providerId) return;

  const currentProvider = getState().assistant?.provider;
  const configs = getState().assistant?.providerConfigs || {};
  const isConfigured = currentProvider?.id === providerId
    ? currentProvider?.isConnected
    : !!(configs[providerId]?.isConnected);

  // Si le provider cliqué est déjà actif, juste fermer le chat
  if (currentProvider?.id === providerId) {
    closeChatPanel();
    return;
  }

  // Provider non configuré → rediriger vers le panneau Providers
  if (!isConfigured) {
    closeChatPanel();
    openProviderPanel();
    return;
  }

  // Provider configuré → sélection directe
  actions.setProvider(providerId);
}


