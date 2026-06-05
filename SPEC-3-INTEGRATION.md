# Spec 3 : Intégration dans le Workflow

> **Chaîne de specs** : [Spec 1 (Providers)](SPEC-1-PROVIDERS.md) → [Spec 2 (Assistant)](SPEC-2-ASSISTANT.md) → [Spec 3 (Intégration)](#spec-3--intégration-dans-le-workflow)

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
// Dans keyboard.js — ajouter Ctrl+Shift+A pour ouvrir le chat

if (e.ctrlKey && e.shiftKey && e.key === 'A') {
  e.preventDefault();
  openChatPanel();
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
| 9 | `default.css` | Styles du panneau chat + boutons contextuels |

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
| **Spec 3** | Intégration (chat panel, context, quick actions, header, keyboard, tests) | ~20h |
| **Total** | | **~42h** |

---

## Résumé des 3 specs

| Spec | Sujet | Livrable | Fichiers principaux |
|------|-------|----------|-------------------|
| **[Spec 1](SPEC-1-PROVIDERS.md)** | Providers IA | Panneau de configuration providers (online + local) | `providerPresets.js`, `aiClient.js`, `providerPanel.js` |
| **[Spec 2](SPEC-2-ASSISTANT.md)** | Assistant Mina | System prompt, personnalité, capacités | `systemPrompt.js`, `chatHistory.js` |
| **[Spec 3](SPEC-3-INTEGRATION.md)** | Workflow | Panneau chat, actions contextuelles, raccourcis | `chatPanel.js`, `contextBuilder.js`, `quickActions.js` |
