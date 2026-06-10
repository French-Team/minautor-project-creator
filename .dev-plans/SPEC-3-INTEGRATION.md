# Spec 3 : Intégration dans le Workflow

> **Chaîne de specs** : [Spec 1 (Providers)](SPEC-1-PROVIDERS.md) → [Spec 2 (Assistant)](SPEC-2-ASSISTANT.md) → [Spec 3 (Intégration)](#spec-3--intégration-dans-le-workflow)

> ✅ **Statut d'implémentation** (mis à jour : juin 2026) :
>
> - **Implémenté** — toutes les fonctionnalités décrites sont en production
> - `src/code-city/ai/chatPanel.js` — panneau chat, streaming, typewriter, quick actions, Markdown (`marked` + `highlight.js`)
> - `src/code-city/ai/contextBuilder.js` — sérialisation canvas → texte pour prompts
> - `src/code-city/ai/fimHandler.js` — FIM inline Mistral (déclencheur `Ctrl+Shift+C`)
> - `src/code-city/ai/markdownRenderer.js` — ajouté dans le sprint [`chat-panel-improvements-spec.md`](chat-panel-improvements-spec.md)
> - Raccourcis câblés dans `src/code-city/keyboard.js` (`Ctrl+Shift+A`, `Ctrl+Shift+C`, `/`)
> - Cette spec reste la **référence du workflow utilisateur** (où apparaît l'IA, comment elle s'intègre aux actions de l'éditeur)

---

## Contexte

La [Spec 1 (Providers)](SPEC-1-PROVIDERS.md) configure le provider IA, la [Spec 2 (Assistant)](SPEC-2-ASSISTANT.md) définit le rôle et les capacités de l'assistant. Cette spec connecte le tout dans le **workflow utilisateur** : où et comment l'assistant apparaît dans l'application.

> **Note** : Cette spec est la **Spec 3 de 3**. Elle consomme le provider (Spec 1) et l'assistant (Spec 2) pour les intégrer dans l'application.

---

## Vision

L'assistant est accessible via un **panneau chat latéral** qui s'ouvre depuis la barre du haut. Il est aussi **contextuellement intégré** à certains endroits du workflow pour offrir de l'aide au bon moment.

---

## Points d'intégration

### A. Panneau Chat (principale)

Un nouveau bouton **"Assistant"** dans le header, après le bouton "Thème". Le clic ouvre un panneau latéral (style exportPanel) avec un interface de chat.

```
┌─────────────────────────────────────┐
│ 🤖 Assistant Mina              [✕] │
├─────────────────────────────────────┤
│                                     │
│  ┌───────────────────────────────┐  │
│  │ Bonjour ! Je suis Mina, ton  │  │
│  │ assistant de conception.      │  │
│  │                               │  │
│  │ Je vois ton canvas avec 5     │  │
│  │ nœuds. Comment puis-je t'aider│  │
│  │ ?                             │  │
│  └───────────────────────────────┘  │
│                                     │
│  ┌───────────────────────────────┐  │
│  │ Analyse mon diagramme         │  │
│  └───────────────────────────────┘  │
│                                     │
│  ┌───────────────────────────────┐  │
│  │ J'ai 8 nœuds, voici mon      │  │
│  │ analyse :                     │  │
│  │ ✅ Flux clair                 │  │
│  │ 🟠 Pas de monitoring          │  │
│  │ 🟡 Tests manquants            │  │
│  └───────────────────────────────┘  │
│                                     │
│  ── Actions rapides ────────────── │
│  [📊 Analyser] [💡 Suggérer]       │
│  [📝 Doc] [🔍 Enrichir sélection]  │
│                                     │
├─────────────────────────────────────┤
│ ┌─────────────────────────────┐ [➤] │
│ │ Pose ta question…           │      │
│ └─────────────────────────────┘      │
└─────────────────────────────────────┘
```

#### Comportement du panneau chat

| Élément | Comportement |
|---------|-------------|
| **Messages** | Bulles alternées (assistant = gauche, utilisateur = droite) |
| **Markdown** | Rendu Markdown dans les réponses de l'assistant |
| **Actions rapides** | Boutons cliquables qui pré-remplissent le prompt |
| **Input** | Textarea multi-ligne, Enter = envoyer, Shift+Enter = nouvelle ligne |
| **Loading** | Indicateur de frappe "Mina réfléchit…" pendant l'appel API |
| **Historique** | Scroll automatique vers le bas, historique en mémoire |
| **Provider non configuré** | Message : "Configure un provider dans Providers pour commencer" avec lien vers panneau Providers |
| **Erreur API** | Message d'erreur inline avec bouton "Réessayer" |

### B. Actions contextuelles (workflow)

En plus du panneau chat, des **boutons contextuels** apparaissent à des endroits stratégiques :

#### B1. Menu nœud (clic droit ou menu rapide)

Un nouvel élément **"💬 Demander à Mina"** dans le menu rapide de chaque nœud :

```
┌──────────────┐
│ ✏️ Éditer     │
│ 📋 Copier     │
│ 🔗 Connecter  │
│ ─────────── │
│ 💬 Demander à Mina │  ← NOUVEAU
│ 🗑️ Supprimer  │
└──────────────┘
```

**Comportement** : Ouvre le panneau chat avec un prompt pré-rempli :
```
Analyse le nœud "[label]" de type [type] et suggère des améliorations.
```

Le contexte du nœud (type, propriétés, arêtes) est inclus automatiquement.

#### B2. Bouton "Analyser" dans l'onglet Aperçu

Dans l'onglet **Aperçu** du centre, ajouter un bouton "🤖 Analyser ce diagramme" qui :
1. Ouvre le panneau chat
2. Envoie automatiquement : *"Analyse le diagramme complet et identifie les points forts, risques et suggestions d'amélioration."*
3. Le contexte complet du canvas (nœuds + arêtes) est envoyé

#### B3. Prompt contextuel dans l'export

Dans le panneau d'export, après le ZIP, ajouter un lien **"🤖 Générer la doc avec Mina"** qui :
1. Ouvre le panneau chat
2. Envoie : *"Génère la documentation complète pour le mode [selected/subtree/full]"*
3. La réponse est rendue en Markdown dans le chat

#### B4. Complétion inline (FIM — Fill-in-the-Middle)

Un mode spécial dans le panneau chat qui utilise `fimCompletion()` de la [Spec 1 (Providers)](SPEC-1-PROVIDERS.md) pour compléter du code directement depuis l'onglet **Code**.

**Prérequis** : Le provider doit être Mistral/Codestral (seul provider supportant le FIM).

**Déclenchement** :
1. L'utilisateur sélectionne du texte dans l'onglet **Code** (textarea `#code-preview`)
2. Un bouton flottant **"🤖 Compléter"** apparaît au-dessus de la sélection
3. Le clic envoie la sélection à Mina via `fimCompletion()`
4. Le résultat est inséré dans le textarea au curseur

```
┌──────────────────────────────────────┐
│  Code (onglet)                       │
│  ─────────────────────               │
│  flowchart TD                        │
│    A[Frontend] --> B[API Auth]       │
│    B --> C[DB]                       │
│    B --> D[▶ COMPLÉTER ICI]          │  ← Sélection = prefix
│    C --> E[Cache]                    │  ← Texte après = suffix
│                                      │
│  ┌──────────────────┐                │
│  │ 🤖 Compléter     │ ← Bouton FIM  │
│  └──────────────────┘                │
└──────────────────────────────────────┘
```

**Comportement détaillé** :

| Étape | Action |
|-------|--------|
| 1 | L'utilisateur sélectionne du texte dans `#code-preview` |
| 2 | Un bouton "🤖 Compléter" apparaît (positionné au-dessus de la sélection) |
| 3 | Clic sur le bouton → envoie `fimCompletion(provider, prefix, suffix)` |
| 4 | `prefix` = texte AVANT la sélection, `suffix` = texte APRÈS la sélection |
| 5 | Indicateur "Mina complète…" pendant l'appel |
| 6 | Le code généré est inséré au curseur (remplace la sélection ou s'ajoute) |
| 7 | La complétion est rendue en surbrillance temporaire (animation `fim-highlight`) |

**Mode alternative** : L'utilisateur peut aussi déclencher la complétion via :
- **Raccourci clavier** : `Ctrl+Shift+C` (quand le focus est dans le textarea Code)
- **Menu contextuel** : clic droit dans le textarea → "🤖 Compléter avec Mina"

**Sécurité** :
- Si le provider n'est pas Mistral/Codestral, le bouton "Compléter" est grisé avec tooltip "FIM disponible uniquement avec Codestral"
- Si aucun provider n'est configuré, le bouton ouvre le panneau Providers
- Timeout 15s pour les appels FIM (plus court que le chat car c'est de la complétion inline)

**UI dans le panneau chat** :

Le panneau chat affiche aussi un indicateur quand une complétion FIM est en cours :

```
┌─────────────────────────────────────┐
│ 🤖 Assistant Mina              [✕] │
├─────────────────────────────────────┤
│                                     │
│  ┌───────────────────────────────┐  │
│  │ 🤖 Complétion FIM en cours…  │  │
│  │ Prefix: 120 caractères       │  │
│  │ Suffix: 45 caractères        │  │
│  └───────────────────────────────┘  │
│                                     │
│  ── Actions rapides ────────────── │  │  [📊 Analyser] [💡 Suggérer]       │
│  [📝 Doc] [🔍 Enrichir]            │
│  [⚡ Compléter code] ← FIM         │
│                                     │
├─────────────────────────────────────┤
│ ┌─────────────────────────────┐ [➤] │
│ │ Pose ta question…           │      │
│ └─────────────────────────────┘      │
└─────────────────────────────────────┘
```

**Action rapide "⚡ Compléter code"** :
- Visible uniquement si le focus est dans l'onglet Code
- Si le focus est ailleurs : "Sélectionnez du texte dans l'onglet Code d'abord"

---

## Architecture technique

### Fichiers

```
src/code-city/ai/
├── providerPresets.js       — (Spec 1) Constantes providers
├── aiClient.js              — (Spec 1) Client API
├── systemPrompt.js          — (Spec 2) System prompt
├── chatHistory.js           — (Spec 2) Historique messages
├── quickActions.js          — (Spec 2) Actions rapides prédéfinies
├── chatPanel.js             — NOUVEAU : Panneau chat UI
├── fimHandler.js            — NOUVEAU : Complétion inline FIM (Codestral)
└── contextBuilder.js        — NOUVEAU : Construction du contexte canvas
```

### A. `chatPanel.js` — Panneau Chat

```js
// src/code-city/ai/chatPanel.js

import { getState, subscribe, actions } from '../state.js';
import { chatCompletion, testConnection } from './aiClient.js';
import { buildSystemMessages } from './systemPrompt.js';
import { trimHistory } from './chatHistory.js';

let panelEl = null;
let isOpen = false;
let isThinking = false;

/**
 * Initialise le panneau chat (câble les events, crée le DOM).
 */
export async function initializeChatPanel() {
  // Créer le panneau (pattern identique à exportPanel.js)
  // Le panneau est fermé par défaut
}

/**
 * Ouvre le panneau chat.
 * @param {string} [initialPrompt] — Prompt à envoyer automatiquement
 */
export async function openChatPanel(initialPrompt = '') {
  ensurePanelExists();
  isOpen = true;
  applyOpenState(true);

  if (initialPrompt) {
    await sendMessage(initialPrompt);
  }
}

/**
 * Envoie un message dans le chat.
 */
async function sendMessage(text) {
  if (!text.trim() || isThinking) return;

  const provider = getState().assistant?.provider;
  if (!provider?.id) {
    addSystemMessage('⚠️ Configure un provider dans le panneau Providers pour commencer.');
    return;
  }

  // Ajouter le message utilisateur
  addMessage('user', text);
  setInputValue('');

  // Indiquer que l'assistant réfléchit
  isThinking = true;
  showThinkingIndicator(true);

  try {
    // Construire les messages avec le contexte du canvas
    const graph = { nodes: getState().nodes, edges: getState().edges };
    const systemMessages = buildSystemMessages(graph);
    const history = getState().assistant.chatHistory || [];
    const allMessages = [...systemMessages, ...history, { role: 'user', content: text }];

    // Appel API
    const result = await chatCompletion(provider, trimHistory(allMessages));

    // Ajouter la réponse
    addMessage('assistant', result.content);

    // Mettre à jour l'historique
    actions.pushChatMessage({ role: 'user', content: text, timestamp: Date.now() });
    actions.pushChatMessage({ role: 'assistant', content: result.content, timestamp: Date.now() });

  } catch (error) {
    addSystemMessage(`❌ Erreur : ${error.message}`);
  } finally {
    isThinking = false;
    showThinkingIndicator(false);
  }
}

import { QUICK_ACTIONS } from './quickActions.js';
```

### B. `fimHandler.js` — Complétion inline FIM

```js
// src/code-city/ai/fimHandler.js

import { fimCompletion } from './aiClient.js';
import { getState } from '../state.js';

const FIM_TIMEOUT_MS = 15000;  // 15s timeout (plus court que le chat)

/**
 * Extrait le prefix (texte avant la sélection) et le suffix (texte après).
 * @param {HTMLTextAreaElement} textarea
 * @returns {{ prefix: string, suffix: string, selected: string } | null}
 */
export function extractFimParts(textarea) {
  const { selectionStart: start, selectionEnd: end, value } = textarea;
  if (start === end) return null;  // Pas de sélection

  return {
    prefix: value.slice(0, start),
    selected: value.slice(start, end),
    suffix: value.slice(end),
  };
}

/**
 * Déclenche la complétion FIM sur un textarea Code.
 * Extrait prefix/suffix, appelle fimCompletion, insère le résultat.
 *
 * @param {HTMLTextAreaElement} textarea - Le textarea #code-preview
 * @param {Function} [onStatus] - Callback pour afficher le statut dans le chat
 * @returns {Promise<string|null>} Le texte complété ou null si échec
 */
export async function triggerFimCompletion(textarea, onStatus) {
  const parts = extractFimParts(textarea);
  if (!parts) return null;

  const provider = getState().assistant?.provider;
  if (!provider?.id) {
    onStatus?.('error', 'Configure un provider dans le panneau Providers pour utiliser la complétion FIM.');
    return null;
  }
  if (provider.id !== 'mistral') {
    onStatus?.('error', 'La complétion FIM est disponible uniquement avec Mistral/Codestral.');
    return null;
  }

  onStatus?.('thinking', `Complétion FIM — prefix: ${parts.prefix.length} chars, suffix: ${parts.suffix.length} chars…`);

  try {
    // Appel FIM avec timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), FIM_TIMEOUT_MS);

    const result = await Promise.race([
      fimCompletion(provider, parts.prefix, parts.suffix),
      new Promise((_, reject) => {
        controller.signal.addEventListener('abort', () => reject(new Error('Timeout FIM (15s)')));
      }),
    ]);
    clearTimeout(timeoutId);

    if (!result.content) {
      onStatus?.('error', 'Aucune complétion générée.');
    }

    return result.content;

  } catch (error) {
    onStatus?.('error', `Erreur FIM : ${error.message}`);
    return null;
  }
}

/**
 * Insère le texte FIM dans le textarea à la position du curseur.
 * Ajoute une animation de surbrillance sur le texte inséré.
 *
 * @param {HTMLTextAreaElement} textarea
 * @param {string} completion - Le texte généré par FIM
 */
export function insertFimCompletion(textarea, completion) {
  if (!completion) return;

  const { selectionStart, selectionEnd, value } = textarea;
  const newValue = value.slice(0, selectionStart) + completion + value.slice(selectionEnd);

  textarea.value = newValue;
  textarea.selectionStart = selectionStart;
  textarea.selectionEnd = selectionStart + completion.length;
  textarea.focus();

  // Déclencher l'événement input pour synchroniser le state
  textarea.dispatchEvent(new Event('input', { bubbles: true }));

  // Animation de surbrillance
  textarea.classList.add('fim-highlight');
  setTimeout(() => textarea.classList.remove('fim-highlight'), 2000);
}
```

### CSS pour l'animation FIM

```css
/* Dans default.css — animation de surbrillance pour complétion FIM */
.fim-highlight {
  animation: fim-glow 2s ease-out;
}
@keyframes fim-glow {
  0%   { box-shadow: 0 0 0 2px var(--accent-soft), 0 0 12px rgba(59, 110, 245, 0.3); }
  100% { box-shadow: none; }
}
```

### B. `contextBuilder.js` — Contexte Canvas

```js
// src/code-city/ai/contextBuilder.js

/**
 * Construit le contexte du canvas pour les appels API.
 * Inclut les nœuds, arêtes, et la sélection courante.
 */
export function buildCanvasContext(graph, selectedNodeIds = []) {
  const { nodes, edges } = graph;

  const context = {
    totalNodes: nodes.filter(n => n.type !== 'hub').length,
    totalEdges: edges.length,
    nodes: nodes
      .filter(n => n.type !== 'hub')
      .map(n => ({
        id: n.id,
        type: n.type,
        label: n.label || n.id,
        description: n.description || '',
        priority: n.priority || 'medium',
        properties: n.properties || {},
        isSelected: selectedNodeIds.includes(n.id),
        connections: {
          incoming: edges.filter(e => e.to === n.id).map(e => e.from),
          outgoing: edges.filter(e => e.from === n.id).map(e => e.to),
        },
      })),
  };

  return context;
}

/**
 * Construit un prompt contextuel pour un nœud spécifique.
 */
export function buildNodePrompt(node, graph) {
  const incoming = graph.edges.filter(e => e.to === node.id);
  const outgoing = graph.edges.filter(e => e.from === node.id);

  return [
    `Nœud : ${node.label || node.id}`,
    `Type : ${node.type}`,
    `Priorité : ${node.priority || 'medium'}`,
    node.description ? `Description : ${node.description}` : '',
    Object.keys(node.properties || {}).length > 0
      ? `Propriétés : ${JSON.stringify(node.properties, null, 2)}`
      : '',
    incoming.length > 0
      ? `Entrées : ${incoming.map(e => e.from).join(', ')}`
      : 'Pas d\'entrées',
    outgoing.length > 0
      ? `Sorties : ${outgoing.map(e => e.to).join(', ')}`
      : 'Pas de sorties',
  ].filter(Boolean).join('\n');
}
```

### C. Modifications du header

```js
// Dans menuActionsTop.js — ordre des boutons dans le header :
// Effacer | Exporter | Thème | Providers | Assistant

<!-- existing buttons: Effacer, Exporter, séparateur, Thème -->

<div style="width: 1px; height: 18px; background: var(--border); margin: 0 4px;"></div>

<button class="btn btn--ghost" id="providers-btn" title="Configurer les providers IA">
    <!-- icône gear/cloud -->
    <span>Providers</span>
</button>

<div style="width: 1px; height: 18px; background: var(--border); margin: 0 4px;"></div>

<button class="btn btn--ghost" id="assistant-btn" title="Assistant IA">
    <svg class="btn__icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M12 2a4 4 0 0 0-4 4v2H6a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V10a2 2 0 0 0-2-2h-2V6a4 4 0 0 0-4-4z"/>
        <circle cx="12" cy="15" r="2"/>
    </svg>
    <span>Assistant</span>
</button>
```

### D. Raccourci clavier

```js
// Dans keyboard.js — ajouter les raccourcis IA

// Ctrl+Shift+A : ouvrir le panneau chat
if (e.ctrlKey && e.shiftKey && e.key === 'A') {
  e.preventDefault();
  openChatPanel();
}

// Ctrl+Shift+C : complétion inline FIM (quand focus dans #code-preview)
if (e.ctrlKey && e.shiftKey && e.key === 'C') {
  const codeArea = document.getElementById('code-preview');
  if (document.activeElement === codeArea && codeArea.selectionStart !== codeArea.selectionEnd) {
    e.preventDefault();
    // Callback onStatus route vers le panneau chat pour afficher le statut
    const onStatus = (type, msg) => {
      if (type === 'thinking') showChatStatus(msg);      // Affiche dans le panneau chat
      else if (type === 'error') addChatErrorMessage(msg);
      else if (type === 'done') addChatSuccessMessage(msg);
    };
    triggerFimCompletion(codeArea, onStatus).then((completion) => {
      if (completion) insertFimCompletion(codeArea, completion);
    });
  }
}
```

---

## Modifications des fichiers existants

| # | Fichier | Modification |
|---|---------|-------------|
| 1 | `menuActionsTop.js` | Ajouter boutons "Assistant" + "Providers" dans le HTML |
| 2 | `quartierTop.js` | Importer et initialiser `chatPanel` + `providerPanel` |
| 3 | `code-city.js` | Ajouter les imports et initialisations AI dans `initializeApp()` |
| 4 | `keyboard.js` | Ajouter raccourci `Ctrl+Shift+A` |
| 5 | `state.js` | Ajouter `state.assistant.chatHistory` + actions chat |
| 6 | `render/canvasRenderer.js` | Ajouter "💬 Demander à Mina" dans le menu nœud |
| 7 | `quartierCenter/previewPanel.js` | Ajouter bouton "🤖 Analyser" dans l'onglet Aperçu |
| 8 | `quartierRight/exportPanel.js` | Ajouter lien "🤖 Générer la doc avec Mina" |
| 9 | `quartierCenter/centerTabs.js` | Ajouter bouton flottant "🤖 Compléter" au-dessus de la sélection dans le textarea Code |
| 10 | `default.css` | Styles du panneau chat + boutons contextuels + bouton FIM flottant + animation `fim-highlight` |
| 11 | `src/code-city/ai/fimHandler.js` | **NOUVEAU** : Gestion de la complétion FIM (extractFimParts, triggerFimCompletion, insertFimCompletion) |

#### Bouton flottant FIM dans centerTabs.js

```js
// Dans centerTabs.js — bouton flottant "🤖 Compléter" au-dessus de la sélection

let fimFloatingBtn = null;

/**
 * Crée le bouton flottant FIM (une seule instance, réutilisée).
 */
function ensureFimFloatingBtn() {
  if (fimFloatingBtn) return fimFloatingBtn;
  fimFloatingBtn = document.createElement('button');
  fimFloatingBtn.className = 'fim-floating-btn';
  fimFloatingBtn.innerHTML = '🤖 Compléter';
  fimFloatingBtn.title = 'Compléter le code sélectionné (Ctrl+Shift+C)';
  fimFloatingBtn.style.display = 'none';
  fimFloatingBtn.addEventListener('click', () => {
    const codeArea = document.getElementById('code-preview');
    if (codeArea) triggerFimCompletion(codeArea, onFimStatus);
  });
  document.body.appendChild(fimFloatingBtn);
  return fimFloatingBtn;
}

/**
 * Met à jour la position du bouton flottant selon la sélection dans le textarea.
 */
function updateFimFloatingBtn(textarea) {
  const btn = ensureFimFloatingBtn();
  const { selectionStart, selectionEnd } = textarea;

  if (selectionStart === selectionEnd) {
    btn.style.display = 'none';
    return;
  }

  // Calculer la position approximative au-dessus de la sélection
  // (basé sur la taille des caractères et le scroll du textarea)
  const textBefore = textarea.value.slice(0, selectionStart);
  const lines = textBefore.split('\n');
  const lineIndex = lines.length - 1;
  const lineHeight = parseInt(getComputedStyle(textarea).lineHeight) || 18;

  const rect = textarea.getBoundingClientRect();
  const topOffset = rect.top + (lineIndex * lineHeight) - textarea.scrollTop - 32;
  const leftOffset = rect.left + 8;

  btn.style.display = 'block';
  btn.style.position = 'fixed';
  btn.style.top = `${Math.max(topOffset, rect.top + 4)}px`;
  btn.style.left = `${leftOffset}px`;
  btn.style.zIndex = '9999';
}

// Câbler l'écoute de sélection dans le textarea Code
document.getElementById('code-preview')?.addEventListener('select', (e) => {
  updateFimFloatingBtn(e.target);
});
document.getElementById('code-preview')?.addEventListener('input', (e) => {
  updateFimFloatingBtn(e.target);
});
// Masquer le bouton quand le focus quitte le textarea
document.getElementById('code-preview')?.addEventListener('blur', () => {
  setTimeout(() => { if (fimFloatingBtn) fimFloatingBtn.style.display = 'none'; }, 200);
});
```

```css
/* CSS pour le bouton flottant FIM */
.fim-floating-btn {
  position: fixed;
  padding: 4px 10px;
  font-size: 11px;
  font-weight: 600;
  font-family: inherit;
  background: var(--accent);
  color: #fff;
  border: none;
  border-radius: var(--radius-sm);
  cursor: pointer;
  box-shadow: var(--shadow-sm);
  transition: background var(--t-fast), transform var(--t-fast);
  white-space: nowrap;
  z-index: 9999;
}
.fim-floating-btn:hover {
  background: var(--accent-hover);
  transform: translateY(-1px);
}
.fim-floating-btn:disabled {
  background: var(--text-faint);
  cursor: not-allowed;
  transform: none;
}
```

---

## Plan de tests

### Tests E2E : `e2e/assistant.spec.js`

| # | Test | Vérification |
|---|------|-------------|
| 1 | Le bouton "Assistant" est visible dans le header | `page.locator('#assistant-btn').isVisible()` |
| 2 | Le clic ouvre le panneau chat | Le panneau a la classe `is-open` |
| 3 | Le panneau affiche un message de bienvenue | Texte "Bonjour" ou "Mina" visible |
| 4 | Les 4 actions rapides sont visibles | "Analyser", "Suggérer", "Doc", "Enrichir" |
| 5 | Cliquer "Analyser" envoie le prompt automatiquement | Le message utilisateur apparaît |
| 6 | Sans provider configuré, un message d'avertissement s'affiche | "Configure un provider" |
| 7 | Fermer le panneau via X ou Escape | Le panneau se ferme |
| 8 | Ctrl+Shift+A ouvre le panneau chat | Raccourci clavier fonctionne |
| 9 | Le bouton "Providers" est visible et ouvre son panneau | Double panneau fonctionne |

### Tests E2E : `e2e/assistant-context.spec.js`

| # | Test | Vérification |
|---|------|-------------|
| 1 | "Demander à Mina" dans le menu nœud ouvre le chat avec contexte | Le prompt contient le label du nœud |
| 2 | Le bouton "Analyser" dans l'onglet Aperçu ouvre le chat | Le prompt parle d'analyse du diagramme |
| 3 | Le contexte canvas est inclus dans les appels API | Vérifiable via mock |

### Tests E2E : `e2e/assistant-fim.spec.js`

| # | Test | Vérification |
|---|------|-------------|
| 1 | `extractFimParts` retourne prefix/suffix corrects | Sélection au milieu du texte |
| 2 | `extractFimParts` retourne null si pas de sélection | selectionStart === selectionEnd |
| 3 | `triggerFimCompletion` rejette les providers non-Mistral | Message d'erreur "disponible uniquement avec Mistral" |
| 4 | `triggerFimCompletion` rejette si pas de provider configuré | Message "Configure un provider" |
| 5 | `insertFimCompletion` insère le texte au bon endroit | Texte inséré entre prefix et suffix |
| 6 | `insertFimCompletion` ajoute la classe `fim-highlight` | Animation déclenchée |
| 7 | Le bouton flottant apparaît sur sélection dans le textarea Code | Bouton visible après sélection |
| 8 | Le bouton flottant disparaît quand la sélection est annulée | Bouton masqué |
| 9 | Ctrl+Shift+C déclenche la complétion FIM | Raccourci fonctionne dans le textarea Code |
| 10 | Avec Mistral configuré, la complétion FIM fonctionne | Mock de l'API retourne du code généré |

---

## Flux utilisateur complet

```
1. L'utilisateur ouvre l'app
   └─> Bouton "Providers" visible dans le header

2. Clic sur "Providers"
   └─> Panneau Providers s'ouvre
   └─> L'utilisateur choisit Ollama (local)
   └─> Configure l'URL localhost:11434
   └─> Teste la connexion → ✅
   └─> Sauvegarde

3. Clic sur "Assistant"
   └─> Panneau Chat s'ouvre
   └─> "Bonjour ! Je suis Mina..."

4. L'utilisateur ajoute des nœuds au canvas
   └─> 5 nœuds : API, Auth, DB, Frontend, CI/CD

5. Clic sur "📊 Analyser" (action rapide)
   └─> Prompt automatique envoyé avec contexte canvas
   └─> Mina analyse : "✅ Flux clair, 🟠 Pas de monitoring..."
   └─> L'utilisateur voit les suggestions

6. Clic droit sur nœud "API Auth" → "💬 Demander à Mina"
   └─> Panneau chat ouvre avec contexte du nœud
   └─> Mina suggère des propriétés pour le nœud

7. L'utilisateur exporte en ZIP
   └─> Clic sur "🤖 Générer la doc avec Mina"
   └─> Mina génère la documentation dans le chat
   └─> L'utilisateur copie-colle dans ses fichiers
```

---

## Risques

| Risque | Impact | Mitigation |
|--------|--------|------------|
| Latence API (providers locaux lents) | UX | Indicateur de frappe, timeout 30s, bouton "Annuler" |
| Token limit dépassé pour gros diagrammes | Fonction | Truncation intelligente du contexte (nœuds les plus pertinents) |
| Réponses hors-sujet de l'assistant | UX | System prompt strict, retry avec prompt reformulé |
| Panneau chat cache le canvas | UX | Panneau rétractable, largeur réduite par défaut |
| Historique chat trop long | Perf | Trim automatique (MAX_HISTORY_MESSAGES = 50) |
| Provider configuré mais hors-ligne | UX | Test de connexion au démarrage, retry automatique |

---

## Priorisation

```
Phase 1 (Provider + Panel UI)   ← Spec 1 → fondation
Phase 2 (Assistant + Prompt)    ← Spec 2 → cerveau
Phase 3 (Chat Panel)            ← Spec 3A → interface principale
Phase 4 (Actions contextuelles) ← Spec 3B → intégration fine
Phase 5 (Tests E2E)             ← validation
```

---

## Estimations totales (3 specs)

| Spec | Tâche | Estimation |
|------|-------|------------|
| **Spec 1** | Providers (presets, state, client, panel, persistence) | ~15h |
| **Spec 2** | Assistant (system prompt, chat history) | ~7h |
| **Spec 3** | Intégration (chat panel, context, quick actions, FIM, header, keyboard, tests) | ~24h |
| **Total** | | **~46h** |

---

## Résumé des 3 specs

| Spec | Sujet | Livrable | Fichiers principaux |
|------|-------|----------|-------------------|
| **[Spec 1](SPEC-1-PROVIDERS.md)** | Providers IA | Panneau de configuration providers (online + local) | `providerPresets.js`, `aiClient.js`, `providerPanel.js` |
| **[Spec 2](SPEC-2-ASSISTANT.md)** | Assistant Mina | System prompt, personnalité, capacités | `systemPrompt.js`, `chatHistory.js` |
| **[Spec 3](SPEC-3-INTEGRATION.md)** | Workflow | Panneau chat, actions contextuelles, raccourcis | `chatPanel.js`, `contextBuilder.js`, `quickActions.js` |
