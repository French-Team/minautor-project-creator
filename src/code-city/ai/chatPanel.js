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
import { QUICK_ACTIONS } from './quickActions.js';
import { openProviderPanel } from './providerPanel.js';
import { PROVIDER_PRESETS } from './providerPresets.js';

let panelEl = null;
let isOpen = false;
let isThinking = false;
let streamAbortController = null; // AbortController pour annuler le streaming en cours
let streamRenderTimer = null; // Timer pour throttle le rendu markdown pendant le streaming
let streamStartTime = null; // Timestamp de début du streaming
let streamTokenCount = 0; // Nombre de tokens reçus pendant le streaming
let streamStatsTimer = null; // Timer pour rafraîchir l'indicateur stats

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

    // Rendre le contenu initial
    renderPanelContent();

    // Câble la fermeture
    closeBtn.addEventListener('click', closeChatPanel);
    backdrop.addEventListener('click', closeChatPanel);
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && isOpen) closeChatPanel();
    });

    // Câble le bouton vider le chat
    if (clearBtn) {
      clearBtn.addEventListener('click', () => {
        actions.clearChatHistory();
        renderPanelContent();
      });
    }

    // Câble l'envoi de message (input)
    const inputArea = panelEl.querySelector('#app-chat-body');
    if (inputArea) {
      inputArea.addEventListener('keydown', handleInputKeydown);
      inputArea.addEventListener('click', handleChatBodyClick);
    }

    // Câble le sélecteur de modèle dans le header
    const modelSelect = document.getElementById('app-chat-model-select');
    if (modelSelect) {
      modelSelect.addEventListener('change', handleModelSelectChange);
      // Peupler la liste des modèles au démarrage
      populateModelSelector();
    }

    // Écouter les changements de provider pour rafraîchir le sélecteur et le panneau
    subscribe((_state, meta) => {
      if (meta.type === 'assistant:provider') {
        populateModelSelector();
        if (isOpen) renderPanelContent();
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

  // Re-peupler le sélecteur de modèle à chaque ouverture
  populateModelSelector();

  if (initialPrompt) {
    await sendMessage(initialPrompt);
  }
}

/** Ferme le panneau chat. */
export function closeChatPanel() {
  if (!panelEl || !isOpen) return;
  isOpen = false;
  applyOpenState(panelEl, false);
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

function renderWelcome() {
  const graph = { nodes: getState().nodes, edges: getState().edges };
  const nodeCount = graph.nodes.filter(n => n.type !== 'hub').length;
  const edgeCount = graph.edges.length;

  let contextHint = '';
  if (nodeCount > 0) {
    contextHint = `<span class="chat-welcome-context">Je vois ton canvas avec ${nodeCount} nœud${nodeCount > 1 ? 's' : ''} et ${edgeCount} arête${edgeCount > 1 ? 's' : ''}.</span>`;
  }

  return `
    <div class="chat-welcome">
      <strong>Bonjour ! Je suis Mina</strong>, ton assistant de conception.<br>
      Comment puis-je t'aider avec ton diagramme ?
      ${contextHint}
    </div>
  `;
}

function renderProviderNotice() {
  return `
    <div class="chat-notice">
      <span class="chat-notice__icon">⚙️</span>
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
      <div class="chat-msg chat-msg--user">
        <div class="chat-msg__bubble">${escapeHtml(msg.content)}</div>
        ${msg.timestamp ? `<span class="chat-msg__time">${formatTime(msg.timestamp)}</span>` : ''}
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

  quickBar.innerHTML = `
    <select class="chat-quick-select" id="chat-quick-select" title="Actions rapides">
      <option value="" disabled selected>⚡ Actions rapides…</option>
      ${QUICK_ACTIONS.map(a => `<option value="${a.id}" title="${escapeHtml(a.prompt)}">${a.label}</option>`).join('')}
    </select>
  `;

  // Câble le changement de sélection
  const select = quickBar.querySelector('#chat-quick-select');
  if (select) {
    select.addEventListener('change', () => {
      const action = QUICK_ACTIONS.find(a => a.id === select.value);
      if (action) {
        sendMessage(action.prompt);
        select.selectedIndex = 0;
      }
    });
  }
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
        placeholder=""
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

  // Auto-resize textarea
  const textarea = inputArea.querySelector('#chat-input');
  if (textarea) {
    textarea.addEventListener('input', () => {
      textarea.style.height = 'auto';
      textarea.style.height = Math.min(textarea.scrollHeight, 120) + 'px';
    });
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
}

/* ---------- Send message ---------- */

async function sendMessage(text) {
  if (!text.trim() || isThinking) return;

  const provider = getState().assistant?.provider;
  if (!provider?.id) {
    addSystemMessage('⚠️ Configure un provider dans le panneau Providers pour commencer.', 'warning');
    return;
  }

  // Ajouter le message utilisateur dans le DOM et le state
  appendMessageToDOM('user', text);
  actions.pushChatMessage({ role: 'user', content: text, timestamp: Date.now() });
  setInputValue('');
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
    // Construire les messages avec le contexte du canvas
    const graph = { nodes: getState().nodes, edges: getState().edges };
    const systemMessages = buildSystemMessages(graph);
    const history = getState().assistant.chatHistory || [];
    const allMessages = [
      ...systemMessages,
      ...history.map(m => ({ role: m.role, content: m.content })),
      { role: 'user', content: text },
    ];

    // Appel API en streaming
    await streamChatCompletion(provider, trimHistory(allMessages), {
      onToken(token) {
        streamedContent += token;
        streamTokenCount++;
        // Throttle le rendu markdown : max 1 re-render toutes les 40ms
        if (!streamRenderTimer) {
          streamRenderTimer = setTimeout(() => {
            streamRenderTimer = null;
            updateStreamingBubble(streamingBubble, streamedContent);
            updateStreamingStats();
            scrollToBottom();
          }, 40);
        }
      },
      onDone() {
        // Vider le timer de throttle restant
        if (streamRenderTimer) { clearTimeout(streamRenderTimer); streamRenderTimer = null; }
        // Finaliser les stats
        stopStreamingStats();
        // Finaliser : retirer le curseur de streaming, sauvegarder dans le state
        finalizeStreamingBubble(streamingBubble, streamedContent);
        actions.pushChatMessage({ role: 'assistant', content: streamedContent, timestamp: Date.now() });
        scrollToBottom();
      },
      onError(err) {
        // Si on a déjà du contenu partielle, on le garde
        if (streamedContent) {
          finalizeStreamingBubble(streamingBubble, streamedContent);
          actions.pushChatMessage({ role: 'assistant', content: streamedContent, timestamp: Date.now() });
        } else {
          // Supprimer la bulle vide
          streamingBubble.remove();
          const errorMsg = `❌ Erreur : ${err.message}`;
          appendMessageToDOM('system', errorMsg, 'error');
          addRetryButton(text);
        }
      },
    }, streamAbortController.signal);

  } catch (error) {
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
        appendMessageToDOM('system', `❌ Erreur : ${error.message}`, 'error');
        addRetryButton(text);
      }
    }
  } finally {
    isThinking = false;
    streamAbortController = null;
    if (streamRenderTimer) { clearTimeout(streamRenderTimer); streamRenderTimer = null; }
    stopStreamingStats();
    showThinkingIndicator(false);
    showStopButton(false);
    scrollToBottom();
  }
}

/** Annule le streaming en cours. */
function stopStreaming() {
  if (streamAbortController) {
    streamAbortController.abort();
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
  msgDiv.className = 'chat-msg chat-msg--assistant chat-msg--streaming';
  msgDiv.innerHTML = `<div class="chat-msg__bubble"><span class="chat-streaming-cursor"></span></div>`;

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
 * Met à jour le contenu de la bulle de streaming avec le markdown rendu.
 * @param {HTMLElement} bubble - Éléments .chat-msg--streaming
 * @param {string} content - Contenu accumulé depuis le début du streaming
 */
function updateStreamingBubble(bubble, content) {
  if (!bubble) return;
  const bbl = bubble.querySelector('.chat-msg__bubble');
  if (!bbl) return;
  bbl.innerHTML = renderMarkdown(content) + '<span class="chat-streaming-cursor"></span>';
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
    retryBtn.textContent = '🔄 Réessayer';
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
    msgDiv.innerHTML = `<div class="chat-msg__bubble">${escapeHtml(content)}</div>`;
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
  const body = panelEl?.querySelector('#app-chat-body');
  if (body) {
    requestAnimationFrame(() => {
      body.scrollTop = body.scrollHeight;
    });
  }
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
 * Supprime le message assistant courant puis relance la génération.
 */
async function handleRegenerateMessage(btn) {
  if (isThinking) return;

  const userText = findPreviousUserMessage(btn);
  if (!userText) return;

  // Supprimer le message assistant courant du DOM et du state
  const msgDiv = btn.closest('.chat-msg');
  if (msgDiv) {
    msgDiv.remove();
    // Copier l'historique AVANT de le vider (clearChatHistory vide le tableau)
    const historyCopy = [...getState().assistant.chatHistory];
    // Retirer le dernier message assistant
    if (historyCopy.length > 0 && historyCopy[historyCopy.length - 1].role === 'assistant') {
      historyCopy.pop();
    }
    actions.clearChatHistory();
    historyCopy.forEach(m => actions.pushChatMessage(m));
  }

  // Relancer la génération
  await sendMessage(userText);
}

/* ---------- Streaming stats ---------- */

/**
 * Lance le suivi des stats de streaming (tokens + temps écoulé).
 * Crée un élément DOM dans la zone d'input et met à jour toutes les 200ms.
 */
function startStreamingStats() {
  streamStartTime = Date.now();
  streamTokenCount = 0;

  // Créer l'élément stats dans la zone d'input
  const inputArea = panelEl?.querySelector('#chat-input-area');
  if (!inputArea) return;

  // Supprimer un ancien stats bar s'il existe
  const old = inputArea.querySelector('.chat-stream-stats');
  if (old) old.remove();

  const statsBar = document.createElement('div');
  statsBar.className = 'chat-stream-stats';
  statsBar.id = 'chat-stream-stats';
  statsBar.innerHTML = '<span class="chat-stream-stats__text">0 tokens · 0.0s</span>';
  inputArea.prepend(statsBar);

  // Timer pour rafraîchir l'affichage
  streamStatsTimer = setInterval(() => {
    updateStreamingStats();
  }, 200);
}

/**
 * Met à jour l'affichage des stats de streaming.
 */
function updateStreamingStats() {
  const statsEl = panelEl?.querySelector('#chat-stream-stats .chat-stream-stats__text');
  if (!statsEl || !streamStartTime) return;

  const elapsed = ((Date.now() - streamStartTime) / 1000).toFixed(1);
  statsEl.textContent = `${streamTokenCount} token${streamTokenCount > 1 ? 's' : ''} · ${elapsed}s`;
}

/**
 * Arrête le suivi des stats et affiche le résultat final.
 */
function stopStreamingStats() {
  if (!streamStatsTimer && !streamStartTime) return; // Déjà arrêté
  if (streamStatsTimer) {
    clearInterval(streamStatsTimer);
    streamStatsTimer = null;
  }

  // Mettre à jour une dernière fois avec le résultat final
  const statsEl = panelEl?.querySelector('#chat-stream-stats .chat-stream-stats__text');
  if (statsEl && streamStartTime) {
    const elapsed = ((Date.now() - streamStartTime) / 1000).toFixed(1);
    statsEl.textContent = `${streamTokenCount} token${streamTokenCount > 1 ? 's' : ''} · ${elapsed}s`;
    // Ajouter la classe finale (couleur différente)
    const bar = statsEl.closest('.chat-stream-stats');
    if (bar) bar.classList.add('chat-stream-stats--done');
  }

  streamStartTime = null;
  streamTokenCount = 0;
}

/* ---------- Model selector (header) ---------- */

/**
 * Peuple le sélecteur de modèle dans le header du chat.
 * Charge les modèles du preset courant + les modèles locaux dynamiques.
 */
async function populateModelSelector() {
  const select = document.getElementById('app-chat-model-select');
  if (!select) return;

  const provider = getState().assistant?.provider;
  if (!provider?.id) {
    select.innerHTML = '<option value="">Aucun provider</option>';
    return;
  }

  const preset = PROVIDER_PRESETS.find(p => p.id === provider.id);
  let models = [];

  if (preset?.models?.length) {
    models = preset.models.map(m => ({ id: m.id, name: m.name || m.id }));
  }

  // Pour les providers locaux, charger les modèles disponibles dynamiquement
  if (preset?.category === 'local') {
    try {
      const dynamicModels = await fetchLocalModels(provider);
      if (dynamicModels.length > 0) {
        models = dynamicModels.map(m => ({ id: m.id, name: m.name || m.id }));
      }
    } catch {
      // Ignorer — utiliser les modèles du preset
    }
  }

  if (models.length === 0) {
    // Afficher au moins le modèle courant
    const currentModel = provider.model || '';
    select.innerHTML = currentModel
      ? `<option value="${escapeHtml(currentModel)}">${escapeHtml(currentModel)}</option>`
      : '<option value="">Aucun modèle</option>';
    return;
  }

  select.innerHTML = models.map(m => {
    const selected = m.id === provider.model ? 'selected' : '';
    return `<option value="${escapeHtml(m.id)}" ${selected}>${escapeHtml(m.name)}</option>`;
  }).join('');
}

/**
 * Gère le changement de sélection du modèle dans le header.
 */
function handleModelSelectChange(e) {
  const modelId = e.target.value;
  if (!modelId) return;
  actions.updateProvider({ model: modelId });
}

/* ---------- Markdown renderer (simple) ---------- */

function renderMarkdown(text) {
  if (!text) return '';

  // --- Étape 1 : extraire les blocs de code pour les protéger ---
  const codeBlocks = [];
  let cleaned = text.replace(/```(\w*)\r?\n([\s\S]*?)```/g, (_, lang, code) => {
    const idx = codeBlocks.length;
    codeBlocks.push(`<pre class="chat-msg__bubble-pre"><code>${escapeHtml(code.trimEnd())}</code></pre>`);
    return `\x00CB${idx}\x00`;
  });

  // --- Étape 2 : extraire le code inline ---
  const inlineCodes = [];
  cleaned = cleaned.replace(/`([^`\n]+)`/g, (_, code) => {
    const idx = inlineCodes.length;
    inlineCodes.push(`<code>${escapeHtml(code)}</code>`);
    return `\x00IC${idx}\x00`;
  });

  // --- Étape 3 : échapper le HTML restant ---
  let html = escapeHtml(cleaned);

  // --- Étape 4 : Markdown -> HTML ---
  // Headers (# … ####)
  html = html.replace(/^#### (.+)$/gm, '<h4>$1</h4>');
  html = html.replace(/^### (.+)$/gm, '<h3>$1</h3>');
  html = html.replace(/^## (.+)$/gm, '<h2>$1</h2>');
  html = html.replace(/^# (.+)$/gm, '<h1>$1</h1>');

  // Horizontal rule
  html = html.replace(/^---+$/gm, '<hr>');

  // Blockquotes
  html = html.replace(/^&gt; (.+)$/gm, '<blockquote>$1</blockquote>');

  // Bold + Italic
  html = html.replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>');
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');

  // Strikethrough
  html = html.replace(/~~(.+?)~~/g, '<del>$1</del>');

  // Links [text](url)
  html = html.replace(/\[(.+?)\]\((.+?)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');

  // Lists non ordonnées
  html = html.replace(/^[\-*] (.+)$/gm, '\x00ULI$1\x00');
  html = html.replace(/((?:\x00ULI[^\x00]*\x00\n?)+)/g, (m) => {
    const items = m.replace(/\x00ULI/g, '<li>').replace(/\x00/g, '</li>');
    return '<ul>' + items + '</ul>';
  });

  // Lists ordonnées
  html = html.replace(/^\d+\. (.+)$/gm, '\x00OLI$1\x00');
  html = html.replace(/((?:\x00OLI[^\x00]*\x00\n?)+)/g, (m) => {
    const items = m.replace(/\x00OLI/g, '<li>').replace(/\x00/g, '</li>');
    return '<ol>' + items + '</ol>';
  });

  // Paragraphs : double saut de ligne
  html = html
    .split(/\n{2,}/)
    .map(p => p.trim() ? `<p>${p.replace(/\n/g, '<br>')}</p>` : '')
    .join('');

  // --- Étape 5 : restaurer les blocs de code ---
  html = html.replace(/\x00CB(\d+)\x00/g, (_, i) => codeBlocks[Number(i)]);
  html = html.replace(/\x00IC(\d+)\x00/g, (_, i) => inlineCodes[Number(i)]);

  return html;
}
