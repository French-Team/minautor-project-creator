# Chat Panel — Améliorations & Éléments à finir

> **Date :** 9 juin 2026
> **Statut :** 🟢 En cours (sprint actuel en implémentation)
> **Objectif :** Lister les éléments à finir et les améliorations de la fenêtre de chat (Mina).
> **Contexte :** La fenêtre de chat est un panneau latéral rétractable (slide-in depuis la droite) avec streaming SSE, rendu Markdown maison, et intégration poussée avec les providers IA.

---

## Table des matières

1. [Résumé des décisions](#1-résumé-des-décisions)
2. [État des lieux : bugs et correctifs](#2-état-des-lieux--bugs-et-correctifs)
3. [Amélioration A — Rendu Markdown (librairie marked)](#3-amélioration-a--rendu-markdown-librairie-marked)
4. [Amélioration B — Effet Typewriter & streaming amélioré](#4-amélioration-b--effet-typewriter--streaming-amélioré)
5. [Amélioration C — Raccourci clavier / (slash)](#5-amélioration-c--raccourci-clavier--slash)
6. [Amélioration D — UX Messages & Interactions](#6-amélioration-d--ux-messages--interactions)
7. [Amélioration E — Design & CSS](#7-amélioration-e--design--css)
8. [Amélioration F — Icônes SVG & Barre d'actions catégorisée](#8-amélioration-f--icônes-svg--barre-dactions-catégorisée)
9. [Fichiers impactés](#9-fichiers-impactés)
10. [Phases & priorisation](#10-phases--priorisation)
11. [Tests](#11-tests)

---

## 1. Résumé des décisions

| Décision | Choix retenu | Statut |
|----------|-------------|--------|
| Librairie Markdown | **marked** + **highlight.js** via `marked-highlight` | ✅ **Fait** |
| Syntax highlighting | **highlight.js** via marked + marked-highlight | ✅ **Fait** |
| Effet streaming | **Typewriter lettre par lettre** avec curseur | ✅ **Fait** |
| Raccourci clavier chat | **`/`** pour focus l'input | ✅ **Fait** |
| Placeholder input | **« Que veux-tu faire ? »** | ✅ Fait |
| Confirmation clear | **Oui** (modale window.confirm) | ✅ **Fait** |
| Stats streaming | Header + barre de progression + fade out 2s | ✅ **Fait** |
| Noms grecs providers | À conserver | ✅ Conservé |
| **Emojis → Icônes SVG** | **ACTION_ICONS dans quickActions.js** | ✅ **Fait** |
| **Barre d'actions** | **Multi-selects catégorisés** | ✅ **Fait** |
| **Enter/Shift+Enter** | **Déjà implémenté** | ✅ **Vérifié** |

---

## 2. État des lieux : bugs et correctifs

### 2.1 Bugs corrigés ✅

| # | Problème | Fichier | Gravité | Correctif |
|---|----------|---------|---------|-----------|
| **B2** | `handleRegenerateMessage()` — clearChatHistory() persiste un tableau vide. Si la régénération échoue après le clear, l'historique est perdu définitivement. | `state.js` / `chatPanel.js` | 🔴 Critique | **Nouvelle action `popLastChatMessage(role)`** — supprime UNIQUEMENT le dernier message du state si le rôle correspond, un seul appel persist. Plus de duplication du message user. |
| **B3** | `handleInputKeydown` attaché à `#app-chat-body`, mais le textarea `#chat-input` est dans `#chat-input-area` (sibling, pas enfant). L'événement keydown ne remontait pas → Enter ne fonctionnait pas. | `chatPanel.js` | 🟡 Faible | **Listener déplacé** du `#app-chat-body` vers le textarea directement dans `renderInputArea()`. |
| **B5** | `placeholder=""` dans le textarea — pas de guidance utilisateur. | `chatPanel.js` | 🟢 Info | **Changement** `placeholder="Que veux-tu faire ?"` |

### 2.2 Bugs à vérifier / à faire

| # | Problème | Fichier | Gravité | Statut |
|---|----------|---------|---------|--------|
| B1 | `renderMarkdown()` — Listes pouvaient mal s'afficher (renderer maison remplacé par `marked`) | chatPanel.js | 🟠 Moyen | ✅ Obsolète (renderer remplacé par marked) |
| B4 | `renderQuickActions()` — Les selects sont recréés à chaque render (mineur) | chatPanel.js | 🟡 Faible | 🟡 Accepté (mineur, pas de régression) |
| B6 | `scrollToBottom()` — Pas de throttling, crée des rAF inutiles si appelé N fois | chatPanel.js | 🟢 Info | ✅ **Corrigé** (scrollThrottleTimer) |

### 2.3 Fonctionnalités existantes (✅ OK)

| Fonctionnalité | Statut | Notes |
|---------------|--------|-------|
| Streaming en temps réel | ✅ OK | SSE avec throttle 40ms |
| Bouton Stop | ✅ OK | AbortController |
| Régénération de réponse | ✅ OK | B2 corrigé |
| Copie de message | ✅ OK | Avec feedback ✓ 1.5s |
| Barre de providers dans header | ✅ OK | 8 providers listés |
| Noms grecs | ✅ OK | Conservé |
| Persistance historique | ✅ OK | Via /api/state |
| Ouverture/fermeture | ✅ OK | Backdrop, Escape, toggle |
| **Enter = Envoyer, Shift+Enter = NL** | ✅ OK | handleInputKeydown |
| **Icônes SVG (vs emojis)** | ✅ OK | ACTION_ICONS + getActionIcon() |
| **Barre d'actions catégorisée** | ✅ OK | 3 selects (Analyse/Doc/Édition) |

---

## 3. Amélioration A — Rendu Markdown (librairie marked)

### 3.1 Problème

Le renderer Markdown actuel est maison (`renderMarkdown()` dans `chatPanel.js`). Il ne supporte **pas** :
- Les tableaux (| colonne | colonne |)
- La coloration syntaxique dans les blocs de code
- Les images ![alt](url)
- Les listes imbriquées
- Le HTML échappé correctement (certains cas limites)

### 3.2 Solution : Remplacer par `marked`

**Pourquoi `marked` plutôt que `markdown-it` ?**
- Plus léger (10KB vs 15KB gzipped)
- Rapide (parsing synchrone, pas de build step)
- Extensible (plugins pour la coloration syntaxique)
- Support natif des tableaux (GFM)
- Compatible avec `highlight.js` pour la coloration syntaxique

### 3.3 Architecture

```mermaid
flowchart LR
    A[token stream] --> B[marked.parse\navec options GFM]
    B --> C{highlight.js\ndisponible ?}
    C -->|Oui| D[highlightAuto\nsur blocs ```]
    C -->|Non| E[<pre><code>] brut
    D --> F[HTML final\navec classes hljs]
    E --> F
    F --> G[innerHTML\nbulle chat]
```

### 3.4 Migration

- **Fichier à créer :** `src/code-city/ai/markdownRenderer.js`
- **Fichier à modifier :** `src/code-city/ai/chatPanel.js` — supprimer `renderMarkdown()` (lignes 953-1015), importer depuis markdownRenderer.js
- **npm :** `npm install marked`

### 3.5 Gestion du streaming avec marked

⚠️ Pendant le streaming, le texte est partiel (`## Tit` au lieu de `## Titre`). `marked` peut générer du HTML invalide. Solution :

```javascript
function renderStreamingMarkdown(text) {
  try {
    return renderMarkdown(text);
  } catch {
    return escapeHtml(text);
  }
}
```

---

## 4. Amélioration B — Effet Typewriter & streaming amélioré

### 4.1 Problème

Le streaming utilise un **throttle de 40ms** pour le rendu Markdown, donnant l'impression que le texte arrive par « paquets » saccadés.

### 4.2 Solution : Typewriter lettre par lettre

Deux couches de rendu :
1. **Couche rapide** (tous les 10ms) : ajoute les nouvelles lettres au DOM directement (sans Markdown) — effet typewriter
2. **Couche lente** (tous les 500ms ou à la fin) : applique le rendu Markdown complet

### 4.3 Algorithme

```javascript
let typewriterTimer = null;     // Timer pour effet typewriter (10ms)
let markdownSyncTimer = null;   // Timer pour sync Markdown (500ms)
let displayedLength = 0;        // Nb de caractères déjà affichés

function onToken(token) {
  streamedContent += token;
  streamTokenCount++;

  if (!typewriterTimer) {
    typewriterTimer = setTimeout(() => {
      typewriterTimer = null;
      const delta = streamedContent.slice(displayedLength);
      appendTypewriterText(delta);
      displayedLength += delta.length;
    }, 10);
  }

  if (!markdownSyncTimer) {
    markdownSyncTimer = setTimeout(() => {
      markdownSyncTimer = null;
      applyMarkdownToBubble(streamedContent);
    }, 500);
  }
}
```

### 4.4 Stats streaming améliorées (optionnel)

- Déplacer les stats **dans le header du chat** (à côté du titre)
- Ajouter une **barre de progression** visible
- Disparition après 2s post-streaming

---

## 5. Amélioration C — Raccourci clavier `/` (slash)

### 5.1 Solution

Ajouter le raccourci `/` pour ouvrir le panneau chat et focus l'input.

**Comportement :**
- Chat fermé → `/` ouvre + focus input
- Chat ouvert → `/` focus input
- Input/textarea actif → `/` tapé normalement

### 5.2 Implémentation

```javascript
// Dans initializeChatPanel() ou code-city.js
document.addEventListener('keydown', (e) => {
  if (shouldIgnoreEvent(e)) return;
  if (e.key === '/' && !e.ctrlKey && !e.metaKey && !e.shiftKey) {
    e.preventDefault();
    if (!isOpen) openChatPanel();
    else panelEl?.querySelector('#chat-input')?.focus();
  }
});
```

---

## 6. Amélioration D — UX Messages & Interactions

### 6.1 Confirmation avant de vider le chat

```javascript
clearBtn.addEventListener('click', () => {
  const history = getState().assistant.chatHistory || [];
  if (history.length === 0) return;
  if (window.confirm(`Vider l'historique (${history.length} message${history.length > 1 ? 's' : ''}) ?`)) {
    actions.clearChatHistory();
    renderPanelContent();
  }
});
```

### 6.2 Placeholder ✅ FAIT

`placeholder="Que veux-tu faire ?"` — implémenté.

### 6.3 Scroll throttle ✅ FAIT

```javascript
let scrollThrottleTimer = null;
function scrollToBottom() {
  if (scrollThrottleTimer) return;
  scrollThrottleTimer = requestAnimationFrame(() => {
    scrollThrottleTimer = null;
    const body = panelEl?.querySelector('#app-chat-body');
    if (body) body.scrollTop = body.scrollHeight;
  });
}
```

### 6.4 Édition des messages utilisateur (optionnel)

Bouton modifier au survol des messages user → remet le message dans le textarea pour édition. À repousser.

---

## 7. Amélioration E — Design & CSS

### 7.1 Curseur typewriter amélioré

```css
.chat-streaming-cursor {
  display: inline-block;
  width: 2px;
  height: 1em;
  background: var(--accent);
  margin-left: 1px;
  animation: cursor-blink 0.8s step-end infinite;
  vertical-align: text-bottom;
}
@keyframes cursor-blink {
  0%, 100% { opacity: 1; }
  50% { opacity: 0; }
}
```

### 7.2 Code highlighting (highlight.js)

CSS highlight.js avec thèmes clair/sombre. À faire en même temps que `marked`.

---

## 8. Amélioration F — Icônes SVG & Barre d'actions catégorisée ✅

> **Implémenté le 9 juin 2026**

### 8.1 Remplacement des émojis par des icônes SVG

Tous les émojis présents dans le panneau chat ont été remplacés par des icônes SVG vectorielles :

| Emoji | Icône SVG | Utilisation |
|-------|-----------|-------------|
| `📊` | bar-chart | Action Analyser |
| `💡` | lightbulb | Action Suggérer |
| `📝` | file-text | Action Doc |
| `🔍` | search | Action Enrichir |
| `⚡` | zap | Action Compléter code + barre actions |
| `⚙️` | settings | Notice provider non configuré |
| `🔄` | refresh | Bouton Réessayer |
| `⚠️` | alert-triangle | Message d'avertissement |
| `❌` | x-circle | Messages d'erreur |

**Architecture :**

Les icônes sont définies dans `src/code-city/ai/quickActions.js` via l'objet `ACTION_ICONS` :
```javascript
export const ACTION_ICONS = {
  'bar-chart': `<svg width="14" height="14" viewBox="0 0 24 24" ...>...</svg>`,
  'lightbulb': `...`,
  // ... 9 icônes au total
};
```

Un helper `getActionIcon(key, size)` dans `chatPanel.js` permet de les utiliser avec taille ajustable.

**Sécurité :** Les icônes dans les messages système (`warning`, `error`) sont injectées via `createElement` + `appendChild` DOM manipulation, pas via innerHTML, pour éviter les risques XSS. Le contenu textuel est passé via `document.createTextNode()`.

### 8.2 Barre d'actions rapides catégorisée

**Avant :** Un seul `<select>` avec 5 actions plates.

**Après :** Trois `<select>` catégorisés :

```
[📊 ANALYSE] [▼]   [📝 DOC] [▼]   [⚡ ÉDITION] [▼]
     └ Analyser          └ Générer doc    └ Enrichir sélection
     └ Suggérer                           └ Compléter code
```

**Structure des données (`quickActions.js`) :**

```javascript
export const QUICK_ACTION_CATEGORIES = [
  {
    id: 'analysis',
    label: 'Analyse',
    icon: 'bar-chart',
    actions: [
      { id: 'analyze', label: 'Analyser', icon: 'bar-chart', prompt: '...' },
      { id: 'suggest', label: 'Suggérer', icon: 'lightbulb', prompt: '...' },
    ],
  },
  {
    id: 'documentation',
    label: 'Documentation',
    icon: 'file-text',
    actions: [
      { id: 'doc', label: 'Générer doc', icon: 'file-text', prompt: '...' },
    ],
  },
  {
    id: 'editing',
    label: 'Édition',
    icon: 'zap',
    actions: [
      { id: 'enrich', label: 'Enrichir sélection', icon: 'search', prompt: '...' },
      { id: 'fim', label: 'Compléter code', icon: 'zap', prompt: '...' },
    ],
  },
];
```

**Extensibilité :** Pour ajouter une nouvelle catégorie, il suffit d'ajouter un objet dans `QUICK_ACTION_CATEGORIES`. La barre s'adapte automatiquement.

### 8.3 Enter / Shift+Enter ✅ Vérifié

| Touche | Comportement | Statut |
|--------|-------------|--------|
| `Enter` | Envoyer le message | ✅ |
| `Shift+Enter` | Nouvelle ligne dans le textarea | ✅ |

Le code `handleInputKeydown` gère cela correctement :
```javascript
if (e.key === 'Enter' && !e.shiftKey) {
  e.preventDefault();
  // send message
}
// Shift+Enter = comportement par défaut = nouvelle ligne
```

### 8.4 CSS associé

Nouveaux sélecteurs CSS ajoutés :
- `.chat-quick-category` — conteneur flex pour chaque catégorie
- `.chat-quick-category__label` — label avec icône + texte
- `.chat-msg__inline-icon` — icône inline dans les messages système
- `.chat-quick-select` — refonte avec flèche déroulante SVG custom

---

## 9. Fichiers impactés

### 9.1 Nouveaux fichiers

| Fichier | Description | Statut |
|---------|-------------|--------|
| `src/code-city/ai/markdownRenderer.js` | Renderer Markdown basé sur `marked` + `highlight.js` via `markedHighight` | ✅ **Fait** |
| `.dev-plans/chat-panel-improvements-spec.md` | Ce fichier | ✅ |

### 9.2 Fichiers modifiés

| Fichier | Changement | Statut |
|---------|-----------|--------|
| `src/code-city/ai/quickActions.js` | Nouvelle structure `QUICK_ACTION_CATEGORIES` + `ACTION_ICONS` (9 SVG) | ✅ |
| `src/code-city/ai/chatPanel.js` | `getActionIcon()`, SVGs, multi-select, B2/B3/B5, migration marked | ✅ |
| `src/styles/default.css` | Layout catégories, `chat-msg__inline-icon`, option styling, notice SVG, thèmes hljs (GitHub light + dark) | ✅ |
| `src/code-city/state.js` | Nouvelle action `popLastChatMessage(role)` | ✅ |

### 9.3 Dépendances npm installées

```bash
npm install marked                # ~10KB gzipped
npm install marked-highlight      # Extension marked pour highlight.js
npm install highlight.js          # ~26KB gzipped
```

---

## 10. Phases & priorisation

### Phase P0 — Fondamentales (sprint actuel)

| # | Tâche | Effort | Statut |
|---|-------|--------|--------|
| 0 | **Correction B2** (perte historique régénération) | 1h | ✅ |
| 1 | **Correction B3** (Enter ne fonctionne pas) | 15min | ✅ |
| 2 | **Correction B5** (placeholder vide) | 5min | ✅ |
| 3 | **Barre d'actions catégorisée** + icônes SVG | 2h | ✅ |
| 4 | Installer `marked` + intégrer `markdownRenderer.js` | 2h | ✅ |
| 5 | Remplacer `renderMarkdown()` par `marked.parse()` | 1h | ✅ |
| 6 | CSS : styles pour tableaux, images, code | 1h | ✅ (via marked GFM) |
| 7 | Ajouter placeholder « Que veux-tu faire ? » | 15min | ✅ |
| 8 | Ajouter confirmation avant `clearChatHistory()` | 30min | ✅ |

### Phase P1 — UX Streaming (prochain sprint)

| # | Tâche | Effort | Statut |
|---|-------|--------|--------|
| 9 | Remplacer throttle 40ms par typewriter lettre par lettre | 3h | ✅ |
| 10 | Améliorer le curseur clignotant (CSS animation) | 30min | ✅ |
| 11 | Améliorer les stats de streaming (design + position) | 1h | ✅ |
| 12 | Ajouter raccourci `/` pour focus input | 30min | ✅ |
| 13 | Corriger le scroll throttle (`scrollToBottom`) | 30min | ✅ |
| 14 | Tester le rendu Markdown avec streaming (comportement partiel) | 1h | ✅ |

### Phase P2 — Améliorations visuelles (futur)

| # | Tâche | Effort | Statut |
|---|-------|--------|--------|
| 15 | Ajouter `highlight.js` pour coloration syntaxique | 2h | ✅ |
| 16 | Theme CSS pour hljs (clair + sombre) | 1h | ✅ |
| 17 | Ajouter bouton modifier sur les messages user | 2h | ⏳ reporté |
| 18 | Améliorer les transitions d'ouverture/fermeture du panneau | 1h | ⏳ reporté |

---

## 11. Tests

### 11.1 Tests unitaires (vitest) — 290 tests ✅

| Testez | Ce qu'il teste | Statut |
|--------|---------------|--------|
| `state.test.js` | `popLastChatMessage()` (nouvelle action) | ✅ |
| `quickActions.test.js` | Structure `QUICK_ACTION_CATEGORIES` | ⏳ À ajouter |

### 11.2 Tests E2E (Playwright) — 18 nouveaux tests ✅

| Test | Description | Statut |
|------|-------------|--------|
| assistant.spec.js | Ouverture/fermeture, messages | ✅ Existant |
| assistant-context.spec.js | Contexte canvas | ✅ Existant |
| assistant-fim.spec.js | FIM | ✅ Existant |
| **streaming-rendering.spec.js** | **18 tests** : rendu Markdown, curseur, `/`, stats header, confirmation, quick actions | ✅ **Nouveau** |

---

## Annexe A : Questions en suspens

| Question | Réponse | Statut |
|----------|---------|--------|
| Librairie Markdown ? | marked | ✅ Fait (v18.0.5) |
| Effet typewriter ? | Lettre par lettre avec curseur | ✅ |
| Raccourci `/` ? | Oui | ✅ |
| Placeholder input ? | « Que veux-tu faire ? » | ✅ |
| Confirmation clear ? | Oui | ✅ |
| Stats streaming ? | Header + barre progression + fade out 2s | ✅ |
| **Emojis → SVG ?** | **Oui, via ACTION_ICONS** | ✅ |
| **Barre d'actions catégorisée ?** | **Oui, 3 catégories** | ✅ |
| **Enter/Shift+Enter ?** | **Déjà OK** | ✅ |

---

*Fin du document. Spec validée — P0+P1 terminées, P2 reporté.*
