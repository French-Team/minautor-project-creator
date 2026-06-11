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
import { QUICK_ACTION_CATEGORIES, ACTION_ICONS } from './quickActions.js';
import { openProviderPanel } from './providerPanel.js';
import { getPreset, getAllPresets } from './providerLoader.js';
import { renderMarkdown, renderStreamingMarkdown } from './markdownRenderer.js';
import { PromptEngine, hashContext, DEFAULT_OPTIMIZATION_THRESHOLD } from './promptEngine.js';
import { estimateTokens } from './chatHistory.js';
import { traceChat } from './traceLogger.js';

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
let streamStartTime = null; // Timestamp de début du streaming
let streamTokenCount = 0; // Nombre de tokens reçus pendant le streaming
let streamStatsTimer = null; // Timer pour rafraîchir l'indicateur stats

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
  console.log('💬 Initialisation du panneau chat…');

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
      msgBody.addEventListener('click', handleChatBodyClick);
    }

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
    console.log('✅ Panneau chat initialisé (fermé)');
  } catch (error) {
    console.error('❌ Erreur initialisation panneau chat:', error);
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

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Retourne le HTML SVG pour une icône d'action.
 * @param {string} key - Clé dans ACTION_ICONS
 * @param {number} [size=14] - Taille du SVG
 * @returns {string}
 */
function getActionIcon(key, size = 14) {
  const svg = ACTION_ICONS[key];
  if (!svg) return '';
  // Ajuster la taille si nécessaire
  if (size !== 14) {
    return svg.replace(/width="14"/, `width="${size}"`).replace(/height="14"/, `height="${size}"`);
  }
  return svg;
}

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

  // Quick actions
  renderQuickActions();

  // Input area
  renderInputArea();

  scrollToBottom();
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
      <span class="chat-prompt-section__title">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
          <polyline points="14 2 14 8 20 8"/>
          <line x1="16" y1="13" x2="8" y2="13"/>
          <line x1="16" y1="17" x2="8" y2="17"/>
          <polyline points="10 9 9 9 8 9"/>
        </svg>
        Prompt utilisé (${typeLabel}${cacheLabel})
      </span>
      <span class="chat-prompt-section__meta">
        <span class="chat-prompt-section__tokens">📏 ${estTokens} tok</span>
        ${prepared.cached ? '<span class="chat-prompt-section__badge chat-prompt-section__badge--cached">cache</span>' : ''}
        ${prepared.apiEnhanced ? '<span class="chat-prompt-section__badge chat-prompt-section__badge--enhanced">✨ amélioré</span>' : ''}
        <button type="button" class="chat-prompt-section__reprepare" data-action="re-prepare-prompt" title="Re-préparer le prompt">↻</button>
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
          <button type="button" class="chat-msg__edit-btn" data-action="edit-message" title="Modifier ce message" aria-label="Modifier ce message">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
            </svg>
          </button>
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
          <button type="button" class="chat-regen-btn" data-action="regenerate" title="Régénérer la réponse">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M21 2v6h-6"/>
              <path d="M3 12a9 9 0 0 1 15-6.7L21 8"/>
              <path d="M3 22v-6h6"/>
              <path d="M21 12a9 9 0 0 1-15 6.7L3 16"/>
            </svg>
          </button>
          <button type="button" class="chat-copy-btn" data-action="copy" data-text="${escapeHtml(msg.content)}" title="Copier le message">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <rect x="9" y="9" width="13" height="13" rx="2"/>
              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
            </svg>
          </button>
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
    <button type="button" class="chat-send-btn" id="chat-send-btn" ${disabled ? 'disabled' : ''} title="Envoyer (Enter)">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <line x1="22" y1="2" x2="11" y2="13"></line>
        <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
      </svg>
    </button>
    <button type="button" class="chat-stop-btn" id="chat-stop-btn" style="display:none;" title="Arrêter la génération">
      <svg viewBox="0 0 24 24" fill="currentColor">
        <rect x="6" y="6" width="12" height="12" rx="2"/>
      </svg>
    </button>
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
    const allMessages = [
      ...systemMessages,
      ...history.map(m => ({ role: m.role, content: m.content })),
      { role: 'user', content: text },
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
    <button type="button" class="chat-regen-btn" data-action="regenerate" title="Régénérer la réponse">
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M21 2v6h-6"/>
        <path d="M3 12a9 9 0 0 1 15-6.7L21 8"/>
        <path d="M3 22v-6h6"/>
        <path d="M21 12a9 9 0 0 1-15 6.7L3 16"/>
      </svg>
    </button>
    <button type="button" class="chat-copy-btn" data-action="copy" data-text="${escapeHtml(rawContent)}" title="Copier le message">
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <rect x="9" y="9" width="13" height="13" rx="2"/>
        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
      </svg>
    </button>
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
    btn.innerHTML = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"/></svg>';
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
    optimizing: '⚡ Optimisation en cours...',
    done: '⚡ Optimisé',
    'no-change': '✓ Déjà concis',
    failed: '⚠️ Optimisation non disponible',
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
  streamStartTime = Date.now();
  streamTokenCount = 0;

  // Supprimer un ancien stats bar s'il existe
  const old = panelEl?.querySelector('.chat-stream-stats');
  if (old) old.remove();

  // Créer l'élément stats dans le header (entre le centre et les boutons)
  const header = panelEl?.querySelector('.app__chat-header');
  if (!header) return;

  const statsBar = document.createElement('div');
  statsBar.className = 'chat-stream-stats';
  statsBar.id = 'chat-stream-stats';
  statsBar.innerHTML = `
    <span class="chat-stream-stats__icon">${getActionIcon('zap', 11)}</span>
    <span class="chat-stream-stats__text">0 tok · 0.0s</span>
    <span class="chat-stream-stats__bar"><span class="chat-stream-stats__bar-fill"></span></span>
  `;

  // Insérer dans le header-center (en bas de la colonne, pleine largeur)
  const center = header.querySelector('.app__chat-header-center');
  if (center) {
    center.appendChild(statsBar);
  } else {
    header.appendChild(statsBar);
  }

  // Timer pour rafraîchir l'affichage
  streamStatsTimer = setInterval(() => {
    updateStreamingStats();
  }, 200);
}

/**
 * Met à jour l'affichage des stats de streaming (texte + barre).
 */
function updateStreamingStats() {
  const statsEl = panelEl?.querySelector('#chat-stream-stats');
  if (!statsEl || !streamStartTime) return;

  const elapsed = ((Date.now() - streamStartTime) / 1000).toFixed(1);
  const textEl = statsEl.querySelector('.chat-stream-stats__text');
  const barFill = statsEl.querySelector('.chat-stream-stats__bar-fill');

  if (textEl) textEl.textContent = `${streamTokenCount} tok · ${elapsed}s`;

  // Barre de progression : augmente avec le temps (max 30s = 100%)
  if (barFill) {
    const pct = Math.min((elapsed / 30) * 100, 100);
    barFill.style.width = `${pct}%`;
  }
}

/**
 * Arrête le suivi des stats : affiche le résultat final, puis
 * disparaît après 2s (fade out).
 */
function stopStreamingStats() {
  if (!streamStatsTimer && !streamStartTime) return; // Déjà arrêté
  if (streamStatsTimer) {
    clearInterval(streamStatsTimer);
    streamStatsTimer = null;
  }

  // Mettre à jour une dernière fois avec le résultat final
  const statsEl = panelEl?.querySelector('#chat-stream-stats');
  if (statsEl && streamStartTime) {
    const elapsed = ((Date.now() - streamStartTime) / 1000).toFixed(1);
    const textEl = statsEl.querySelector('.chat-stream-stats__text');
    const barFill = statsEl.querySelector('.chat-stream-stats__bar-fill');
    if (textEl) textEl.textContent = `${streamTokenCount} tok · ${elapsed}s`;
    if (barFill) barFill.style.width = '100%';

    // Classe finale → déclenche le fade out
    statsEl.classList.add('chat-stream-stats--done');

    // Supprimer l'élément du DOM après 2s
    setTimeout(() => {
      if (statsEl.parentNode) statsEl.remove();
    }, 2000);
  }

  streamStartTime = null;
  streamTokenCount = 0;
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
 */
function getProviderIcon(iconType) {
  const icons = {
    cloud: `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z"/></svg>`,
    sparkles: `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/></svg>`,
    code: `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>`,
    server: `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="2" width="20" height="8" rx="2" ry="2"/><rect x="2" y="14" width="20" height="8" rx="2" ry="2"/><line x1="6" y1="6" x2="6.01" y2="6"/><line x1="6" y1="18" x2="6.01" y2="18"/></svg>`,
  };
  return icons[iconType] || icons.cloud;
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


