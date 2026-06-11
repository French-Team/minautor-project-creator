# Spec — Traçage du Chat Panel / Prompt Engine / Optimiseur

> **Version** : 1.3  
> **Statut** : Validé (3 rounds d'interview complétés) — prêt pour implémentation  
> **Date** : 2026-06-11  
> **Fichiers cibles** : `src/code-city/ai/chatPanel.js`, `src/code-city/ai/promptEngine.js`, `src/code-city/ai/optimizeResponse.js` (optimiseur), `src/code-city/ai/aiClient.js`, `src/code-city/ai/systemPrompt.js` (5 fichiers)

---

## 1. Vision & Contexte

L'utilisateur veut **tracer tout ce qui se passe dans le chat panel, le prompt engine et l'optimiseur**, directement dans la console du navigateur (DevTools). L'objectif est de pouvoir **suivre en temps réel** le cycle complet d'une interaction utilisateur :

```
[Utilisateur tape] → [CHAT] sendMessage ENTRY
                  → [PROMPT-ENGINE] categorizeMessage type=analysis
                  → [PROMPT-ENGINE] _getFromCache miss
                  → [PROMPT-ENGINE] composePrompt length=420
                  → [PROMPT-ENGINE] _enhancePromptViaApi success
                  → [PROMPT-ENGINE] _writeToFile POST /api/prompts 200
                  → [CHAT] createStreamingBubble
                  → [CHAT] onToken #1 len=15 cum=15/420
                  → [CHAT] onToken #2 len=15 cum=30/420
                  → ...
                  → [CHAT] onDone streamedContent.length=420
                  → [OPTIMIZER] optimizeResponse called (520 tok > 500 threshold)
                  → [OPTIMIZER] optimizeResponse success ratio=68%
                  → [OPTIMIZER] updateOptimizationStats saved=164
```

**Bénéfices :**
- Debug des régressions en dev (ex: pourquoi le streaming hang, pourquoi l'optimiseur ne se déclenche pas)
- Observabilité du PromptEngine (cache hits, échecs d'amélioration API, etc.)
- Compréhension des flows longs sans avoir à placer des breakpoints
- Audit rapide en cas de bug remonté par un utilisateur

---

## 2. Décisions architecturales (validées par interview)

| Décision | Choix | Justification |
|----------|-------|---------------|
| **Verbosité** | Trace complet (toujours, en dev) | L'utilisateur veut voir *tout*, pas de filtrage. Pattern simple. |
| **Format log** | Mixte : lisible + détails collapsibles | `console.log("[CHAT] sendMessage ENTRY text=...")` en première ligne + `console.group()` collapsibles avec détails (args, data) |
| **Activation** | Variable env **build-time** `VITE_CHAT_DEBUG=true` | Logs embarqués en dev uniquement, **strippés en prod** par tree-shaking / dead-code elimination (Vite/Rollup). Build séparé pour debug. |
| **Grouping** | Log plat (pas de hiérarchie de groupes) | Un événement = une ligne dans l'ordre chronologique. Pas de `console.group('sendMessage #42')` qui contientrait d'autres groupes. Chaque `console.group()` est **uniquement** pour les détails d'un événement. |
| **Timestamp** | `Date.now()` relatif (`+127ms`) | Lisible, format `console.log("[$+${elapsed}ms] ...")` |
| **Performance** | Pas de limite stricte | On log tout, même objets volumineux. Priorité debug > perf. |
| **Persistance** | Buffer copiable : `window.__CHAT_LOG_BUFFER = []` | Ring buffer en mémoire (max 500 entrées), accessible depuis DevTools pour copier/coller. Pas de fichier. |
| **Données sensibles** | Tout logger en clair | Clés API, prompts utilisateur, réponses : tout en clair. Pas de masquage. (Acceptable car logs strippés en prod.) |
| **Tests** | Capture + sample assertions | Tests unitaires (spy sur `console.log`) + tests E2E (page.on('console')) avec assertions sur échantillonnage. |

---

## 3. Architecture du système de traçage

### 3.1 Module de logging centralisé : `src/code-city/ai/traceLogger.js`

Helper unique pour tous les modules à tracer. Évite la duplication et centralise la configuration.

```js
/**
 * Trace Logger — Système de traçage centralisé
 *
 * Émet des logs vers la console DevTools et un buffer accessible via window.__CHAT_LOG_BUFFER.
 * Activé par VITE_CHAT_DEBUG=true au build, strippé en prod.
 *
 * Usage:
 *   import { traceChat, tracePromptEngine, traceOptimizer } from './traceLogger.js';
 *   traceChat('sendMessage ENTRY', { text, skipUser });
 *   traceChat('onToken', { tokenLen, cumLen });
 *
 * @module traceLogger
 */

// Constante remplacée par Vite au build : si VITE_CHAT_DEBUG !== 'true' ou '1',
// toutes les fonctions trace*() sont des no-ops (dead-code-eliminated en prod).
const CHAT_DEBUG = import.meta.env?.VITE_CHAT_DEBUG === 'true' ||
                   import.meta.env?.VITE_CHAT_DEBUG === '1' ||
                   false;

// Ring buffer accessible depuis la console DevTools
if (typeof window !== 'undefined' && !window.__CHAT_LOG_BUFFER) {
  window.__CHAT_LOG_BUFFER = [];
}
const MAX_BUFFER_SIZE = 500;
const t0 = Date.now();

/**
 * Émet un log du module chat panel.
 * @param {string} event - Nom de l'événement (ex: 'sendMessage', 'onToken')
 * @param {Object} [data] - Données associées (objet sérialisable)
 */
export function traceChat(event, data) {
  if (!CHAT_DEBUG) return;
  _emit('[CHAT]', event, data);
}

/**
 * Émet un log du module prompt engine.
 * @param {string} event
 * @param {Object} [data]
 */
export function tracePromptEngine(event, data) {
  if (!CHAT_DEBUG) return;
  _emit('[PROMPT-ENGINE]', event, data);
}

/**
 * Émet un log du module optimiseur.
 * @param {string} event
 * @param {Object} [data]
 */
export function traceOptimizer(event, data) {
  if (!CHAT_DEBUG) return;
  _emit('[OPTIMIZER]', event, data);
}

/**
 * Émet un log du module aiClient (chatCompletion / streamChatCompletion / parseOpenAIResponse).
 * @param {string} event
 * @param {Object} [data]
 */
export function traceAiClient(event, data) {
  if (!CHAT_DEBUG) return;
  _emit('[AI-CLIENT]', event, data);
}

/**
 * Émet un log du module systemPrompt (buildSystemMessages).
 * @param {string} event
 * @param {Object} [data]
 */
export function traceSystemPrompt(event, data) {
  if (!CHAT_DEBUG) return;
  _emit('[SYSTEM-PROMPT]', event, data);
}

/**
 * Émet un log dans la console et le buffer.
 * @private
 */
function _emit(prefix, event, data) {
  const elapsed = Date.now() - t0;
  const line = `${prefix} [+${elapsed}ms] ${event}`;
  if (data !== undefined) {
    // Format mixte : log court + console.group() collapsibles avec détails
    console.log(line);
    console.groupCollapsed(`${prefix} details`);
    console.log('event:', event);
    console.log('data:', data);
    console.log('time:', `${elapsed}ms`);
    console.groupEnd();
  } else {
    console.log(line);
  }

  // Push au buffer (copie shallow pour éviter mutations)
  if (typeof window !== 'undefined' && window.__CHAT_LOG_BUFFER) {
    const entry = { ts: Date.now(), elapsedMs: elapsed, prefix, event, data };
    window.__CHAT_LOG_BUFFER.push(entry);
    if (window.__CHAT_LOG_BUFFER.length > MAX_BUFFER_SIZE) {
      window.__CHAT_LOG_BUFFER.shift();
    }
  }
}
```

### 3.2 Variable d'env `VITE_CHAT_DEBUG`

À ajouter dans `vite.config.js` (ou `.env.development`) :

```bash
# .env.development (commité)
VITE_CHAT_DEBUG=true
```

```bash
# .env.production (commité, valeur safe par défaut)
VITE_CHAT_DEBUG=false
```

```bash
# .env.local (gitignored, pour override local)
VITE_CHAT_DEBUG=true
```

**Build prod :** `VITE_CHAT_DEBUG=false` → toutes les fonctions `trace*()` sont des no-ops (early return sur `if (!CHAT_DEBUG) return`). Vite/Rollup va dead-code-eliminate les `console.log` internes via tree-shaking. **Aucune fuite de logs en prod.**

**Build dev :** `VITE_CHAT_DEBUG=true` → tous les logs émis.

**Mode debug ponctuel :** L'utilisateur peut `VITE_CHAT_DEBUG=true npm run build` pour produire un build avec logs activés (pour debug en production sans exposer les sources).

---

## 4. Événements à logger

### 4.1 Module `chatPanel.js`

| Événement | Quand | Données (data) |
|-----------|-------|----------------|
| `sendMessage ENTRY` | Début de `sendMessage()` | `{ text: string.slice(0, 80), skipUser, isThinking, isOptimizing, hasProvider }` |
| `sendMessage SKIP` | Skip car `isThinking`/`isOptimizing`/pas de provider | `{ reason: 'thinking'\|'optimizing'\|'no-provider' }` |
| `user message pushed` | Après `actions.pushChatMessage` (user) | `{ textLen, timestamp }` |
| `promptEngine prepared` | Après `await promptEngine.preparePrompt` | `{ preparedId, type, cached, apiEnhanced, durationMs, tokenCount }` |
| `createStreamingBubble` | Création de la bulle de streaming | `{ className, hasExistingStreaming: boolean }` |
| `streamChatCompletion CALL` | Avant `await streamChatCompletion` | `{ provider, model, messagesLen, hasCustomPrompt }` |
| `onToken` | Pour chaque token reçu (throttle 1/10) | `{ tokenLen, cumLen, tokenCount, preview: string.slice(0, 40) }` |
| `onDone` | Fin du streaming | `{ streamedContentLen, durationMs, tokenCount }` |
| `onError` | Erreur pendant streaming | `{ errorMsg: string.slice(0, 200), hasPartialContent: boolean }` |
| `catch block` | Catch dans sendMessage | `{ errorName, errorMsg, hasPartialContent }` |
| `optimizeLastResponse CALL` | Début post-optimisation | `{ responseLen, tokenCount, threshold, willOptimize }` |
| `optimizeLastResponse SUCCESS` | Optimisation réussie | `{ originalLen, optimizedLen, compressionRatio, tokensSaved, durationMs }` |
| `optimizeLastResponse NO_CHANGE` | Optimisation retourne même contenu | `{ originalLen, optimizedLen }` |
| `optimizeLastResponse FAILED` | Optimisation échoue | `{ errorMsg, originalLen }` |
| `CATCH error` | Catch dans sendMessage après streaming | `{ errorName, errorMsg }` |
| `FINALLY` | Fin de sendMessage | `{ streamedContentLen, isThinking: false }` |

### 4.2 Module `promptEngine.js`

| Événement | Quand | Données (data) |
|-----------|-------|----------------|
| `categorizeMessage` | Catégorisation locale | `{ userMessageLen, detectedType, rulesMatched, durationMs }` |
| `cacheKey computed` | Calcul de la clé de cache | `{ type, contextHash, fullKey }` |
| `cache HIT` | Prompt trouvé dans le cache | `{ cacheKey, promptId, expiresInMs }` |
| `cache MISS` | Prompt pas dans le cache | `{ cacheKey }` |
| `cache PRUNE` | Entrées expirées supprimées | `{ removedCount, remainingCount }` |
| `cache SET` | Prompt stocké dans le cache | `{ cacheKey, promptId, expiresAt }` |
| `composePrompt` | Composition locale du prompt | `{ type, templateLen, composedLen, contextTextLen }` |
| `enhancePromptViaApi ENTRY` | Début amélioration API | `{ originalLen, tokenCount, model }` |
| `enhancePromptViaApi SKIP` | Skip (tokenCount < MIN_ENHANCEMENT_TOKENS) | `{ tokenCount, minRequired }` |
| `enhancePromptViaApi SUCCESS` | Amélioration réussie | `{ originalLen, enhancedLen, durationMs }` |
| `enhancePromptViaApi FAILED` | Amélioration échoue | `{ errorMsg, originalLen }` |
| `enhancePromptViaApi NO_CHANGE` | Modèle renvoie même contenu | `{ originalLen }` |
| `writeToFile CALL` | Écriture du prompt sur disque | `{ promptId, filePath, contentLen }` |
| `writeToFile SUCCESS` | POST /api/prompts 200 | `{ promptId, filePath, status }` |
| `writeToFile FAILED` | POST /api/prompts échoue | `{ promptId, errorMsg }` |
| `preparePrompt COMPLETE` | Fin de preparePrompt | `{ preparedId, type, cached, apiEnhanced, durationMs }` |
| `clearCache` | Cache vidé | `{ beforeSize, afterSize }` |
| `detectContextWindow` | Détection de la fenêtre de contexte | `{ modelId, detected, source: 'ollama-api'\|'table'\|'default' }` |

### 4.3 Module optimiseur (`optimizeResponse` + `optimizeLastResponse`)

| Événement | Quand | Données (data) |
|-----------|-------|----------------|
| `optimizeResponse ENTRY` | Début de `optimizeResponse()` | `{ responseLen, tokenCount, threshold, willOptimize }` |
| `optimizeResponse SKIP` | Skip (tokenCount ≤ threshold) | `{ tokenCount, threshold }` |
| `optimizeResponse NO_PROVIDER` | Pas de provider configuré | `{ hasProvider: false }` |
| `optimizeResponse API_CALL` | Avant `await chatCompletion` | `{ model, messagesLen, temperature, maxTokens }` |
| `optimizeResponse SUCCESS` | Optimisation réussie | `{ originalLen, optimizedLen, compressionRatio, durationMs, tokensSaved }` |
| `optimizeResponse EMPTY` | Réponse optimisée vide | `{ originalLen }` |
| `optimizeResponse FAILED` | Optimisation échoue | `{ errorMsg, originalLen }` |
| `optimizeLastResponse CALL` | Début dans chatPanel | `{ responseLen, tokenCount, threshold, willOptimize }` |
| `optimizeLastResponse SKIP` | Skip (tokenCount ≤ threshold) | `{ tokenCount, threshold, reason: 'below-threshold'\|'no-prompt' }` |
| `optimizeLastResponse BADGE optimizing` | Badge affiché | `{ bubbleClass }` |
| `optimizeLastResponse BADGE done` | Badge succès | `{ originalTokens, optimizedTokens, compressionRatio }` |
| `optimizeLastResponse BADGE no-change` | Badge "déjà concis" | `{ originalTokens, optimizedTokens }` |
| `optimizeLastResponse BADGE failed` | Badge échec | `{ errorMsg }` |
| `updateOptimizationStats` | Mise à jour des stats cumulées | `{ tokensSaved, originalTokens, newTotal, newCumul }` |
| `isOptimizing LOCK` | isOptimizing = true | `{ reason: 'start'\|'end', isOptimizing }` |

### 4.4 Module `aiClient.js` (chatCompletion, streamChatCompletion, parseOpenAIResponse)

| Événement | Quand | Données (data) |
|-----------|-------|----------------|
| `buildEndpointUrl` | Construction de l'URL endpoint | `{ providerId, baseUrl, model, endpoint }` |
| `chatCompletion ENTRY` | Début de `chatCompletion()` | `{ providerId, model, messagesLen, hasApiKey, maxRetries, requestFormat }` |
| `chatCompletion URL` | URL construite | `{ url, isProxified: boolean }` |
| `chatCompletion bodyBuilt` | Body de la requête construit | `{ bodyLen, requestFormat, model, hasSystemMsg, hasCustomPrompt }` |
| `chatCompletion fetch CALL` | Avant `await fetch()` | `{ url, bodyLen, timeoutMs: 30000 }` |
| `chatCompletion fetch OK` | Réponse HTTP 2xx | `{ status, durationMs }` |
| `chatCompletion fetch 4xx` | Réponse HTTP 4xx | `{ status, errorMsg, willRetryFormat, willRotateKey }` |
| `chatCompletion fetch 429` | Rate limit | `{ status, errorMsg, willRotate: boolean }` |
| `chatCompletion fetch 5xx` | Erreur serveur | `{ status, errorMsg }` |
| `chatCompletion formatRetry` | Switch OpenAI → Anthropic (OCZ) | `{ fromFormat: 'openai', toFormat: 'anthropic', reason }` |
| `chatCompletion keyRotation` | Rotation de clé API | `{ envKey, fromKey, toKey, reason: '429'\|'401'\|'timeout' }` |
| `chatCompletion keyExhausted` | Plus de clé de rotation | `{ envKey, attempts }` |
| `chatCompletion SUCCESS` | Retour réussi | `{ contentLen, usage, detectedFormat, attempts }` |
| `chatCompletion THROW` | Erreur finale | `{ errorMsg, status, attempts }` |
| `parseOpenAIResponse` | Parsing de la réponse | `{ format: 'openai'\|'anthropic'\|'gemini', contentLen, usage }` |
| `parseOpenAIResponse ERROR` | Format inconnu / output vide | `{ keys, errorMsg }` |
| `streamChatCompletion ENTRY` | Début de `streamChatCompletion()` | `{ providerId, model, hasSignal: boolean }` |
| `streamChatCompletion fallback gemini` | Fallback non-streaming Gemini | `{ providerId, reason: 'no-sse' }` |
| `streamChatCompletion fallback opencode-zen` | Fallback non-streaming OCZ | `{ providerId, reason: 'no-sse' }` |
| `streamChatCompletion chunk` | Chunk reçu (throttle 1/10) | `{ chunkLen, cumLen, chunkCount, preview }` |
| `streamChatCompletion DONE` | Stream terminé | `{ contentLen, durationMs, chunkCount }` |
| `streamChatCompletion ERROR` | Erreur pendant streaming | `{ errorMsg, hasPartialContent: boolean }` |
| `streamChatCompletion buffer residual` | Buffer résiduel traité | `{ linesProcessed }` |
| `fimCompletion ENTRY` | Début FIM (Mistral) | `{ prefixLen, suffixLen, model }` |
| `fimCompletion SUCCESS` | FIM réussi | `{ contentLen, usage, durationMs }` |
| `fimCompletion FAILED` | FIM échoue (provider ≠ mistral) | `{ providerId, errorMsg }` |

### 4.5 Module `systemPrompt.js` (`buildSystemMessages`)

| Événement | Quand | Données (data) |
|-----------|-------|----------------|
| `buildSystemMessages ENTRY` | Début de `buildSystemMessages()` | `{ hasCustomPrompt: boolean, mode: 'replace'\|'enrich', nodeCount, edgeCount }` |
| `buildSystemMessages REPLACE` | Mode `replace` (customPrompt utilisé tel quel) | `{ promptLen, nodesLen, edgesLen }` |
| `buildSystemMessages ENRICH` | Mode `enrich` (concaténation avec SYSTEM_PROMPT) | `{ customPromptLen, systemPromptLen, totalLen, mode }` |
| `buildSystemMessages DEFAULT` | Pas de customPrompt, construction défaut | `{ systemPromptLen, nodeSummaryLen, edgeSummaryLen, totalLen }` |
| `buildSystemMessages SUCCESS` | Retour réussi | `{ messagesLen, totalContentLen, durationMs }` |

### 4.6 Module `promptEngine.optimizeResponse` — préfixe dédié `[OPTIMIZER]`

La fonction `optimizeResponse` dans `src/code-city/ai/promptEngine.js` utilise
le helper `traceOptimizer` (préfixe dédié `[OPTIMIZER]`) — **et non**
`tracePromptEngine` — pour bien différencier les événements de
post-optimisation des événements de prompt prep. Cette séparation permet
de filtrer rapidement le flot d'optimisation dans la console DevTools sans
bruit ambiant lié à la catégorisation / cache / composition.

**Pourquoi un préfixe dédié ?** Le préfixe `[PROMPT-ENGINE]` regroupe tous
les événements liés à la *préparation* de prompt (catégorisation, cache,
composition, amélioration API, écriture disque). L'optimisation
post-réponse est un **flux séparé** déclenché après le streaming du LLM
principal, avec son propre cycle de vie (ENTRY → SKIP/NO_PROVIDER →
API_CALL → SUCCESS/EMPTY/FAILED).

**8 événements émis sous le préfixe `[OPTIMIZER]` :**

| Événement | Quand | Données (data) |
|-----------|-------|----------------|
| `optimizeResponse ENTRY` | Début de `optimizeResponse()` | `{ responseLen, tokenCount, threshold, willOptimize }` |
| `optimizeResponse SKIP` | Skip car réponse vide OU tokenCount ≤ threshold | `{ reason: 'empty-response' }` OU `{ tokenCount, threshold }` |
| `optimizeResponse NO_PROVIDER` | Pas de provider configuré | `{ hasProvider: false }` |
| `optimizeResponse API_CALL` | Avant `await chatCompletion` (appel LLM d'optimisation) | `{ model, messagesLen, temperature, maxTokens }` |
| `optimizeResponse SUCCESS` | Optimisation réussie | `{ originalLen, optimizedLen, compressionRatio, durationMs, tokensSaved }` |
| `optimizeResponse EMPTY` | Réponse optimisée vide | `{ originalLen }` |
| `optimizeResponse FAILED` | Optimisation échoue (catch) | `{ errorMsg, originalLen }` |
| `optimizeResponse ENRICH` | Mode `enrich` activé (concaténation avec prompt préparé) | `{ customPromptLen, systemPromptLen, enrichedLen }` |

**Note sur le double préfixe pour le flot d'optimisation** : la spec
différencie deux couches (cf. §4.3 pour le tableau complet) :
- **`[OPTIMIZER]` (helper `traceOptimizer`)** : émis par
  `promptEngine.optimizeResponse` — la fonction *métier* qui appelle le
  LLM d'optimisation et parse la réponse
- **`[CHAT]` (helper `traceChat`)** : émis par
  `chatPanel.optimizeLastResponse` — le wrapper qui orchestre l'appel
  (CALL/SKIP/BADGE done/no-change/failed/isOptimizing LOCK)

Cette séparation permet de tracer chaque couche indépendamment et de
diagnostiquer précisément si un échec vient de la fonction métier
(`[OPTIMIZER] FAILED` = problème LLM) ou du wrapper d'orchestration
(`[CHAT] BADGE failed` = exception JS dans chatPanel).

**Référence implémentation** : `src/code-city/ai/promptEngine.js` (import
`traceOptimizer` depuis `./traceLogger.js` ajouté en parallèle de
`tracePromptEngine`, cf. Sprint CT-4 v1.2 → v1.3).

---

## 5. Instrumentation dans le code

### 5.0 TraceLogger — extensions pour aiClient + systemPrompt + alignement [OPTIMIZER]

Ajouts dans `src/code-city/ai/traceLogger.js` :

```diff
  /**
   * Émet un log du module optimiseur.
+  *
+  * NOTE : ce helper est désormais utilisé dans `promptEngine.optimizeResponse`
+  * (cf. §4.6) pour émettre les 8 événements de post-optimisation sous le
+  * préfixe dédié `[OPTIMIZER]`. Auparavant, ces événements étaient émis
+  * sous `[PROMPT-ENGINE]` via `tracePromptEngine`, ce qui mélangait le
+  * flot d'optimisation avec le flot de prompt prep. L'alignement a eu lieu
+  * dans le Sprint CT-4 (v1.2 → v1.3 de cette spec).
   */
  export function traceOptimizer(event, data) { ... }

+ /**
+  * Émet un log du module aiClient.
+  */
+ export function traceAiClient(event, data) {
+   if (!CHAT_DEBUG) return;
+   _emit('[AI-CLIENT]', event, data);
+ }
+
+ /**
+  * Émet un log du module systemPrompt.
+  */
+ export function traceSystemPrompt(event, data) {
+   if (!CHAT_DEBUG) return;
+   _emit('[SYSTEM-PROMPT]', event, data);
+ }
```

**Préfixes ajoutés :**

| Module | Préfixe | Helper |
|--------|---------|--------|
| aiClient | `[AI-CLIENT]` | `traceAiClient` |
| systemPrompt | `[SYSTEM-PROMPT]` | `traceSystemPrompt` |
| optimiseur (post-optimisation) | `[OPTIMIZER]` | `traceOptimizer` *(aligné Sprint CT-4)* |

**Table d'alignement helper ↔ fichier** (Sprint CT-4 v1.3) :

| Helper | Préfixe | Fichier(s) utilisateur(s) | Événements typiques |
|--------|---------|---------------------------|---------------------|
| `traceChat` | `[CHAT]` | `chatPanel.js` | `sendMessage ENTRY`, `onToken`, `optimizeLastResponse CALL` |
| `tracePromptEngine` | `[PROMPT-ENGINE]` | `promptEngine.js` | `categorizeMessage`, `cache HIT/MISS`, `preparePrompt COMPLETE`, `enhancePromptViaApi SUCCESS` |
| `traceOptimizer` | `[OPTIMIZER]` | `promptEngine.js` (`optimizeResponse`) | `optimizeResponse ENTRY/SUCCESS/FAILED` *(Sprint CT-4 v1.3)* |
| `traceAiClient` | `[AI-CLIENT]` | `aiClient.js` | `chatCompletion ENTRY`, `streamChatCompletion chunk` |
| `traceSystemPrompt` | `[SYSTEM-PROMPT]` | `systemPrompt.js` | `buildSystemMessages ENTRY/SUCCESS` |

> **Note d'alignement historique** : avant le Sprint CT-4, les 8 événements
> `optimizeResponse*` étaient émis sous `[PROMPT-ENGINE]` (helper
> `tracePromptEngine`). Suite à l'alignement Sprint CT-4, ils sont émis sous
> `[OPTIMIZER]` (helper `traceOptimizer`) conformément au §4.6. Le
> E2E test 5 de `e2e/chat-trace.spec.js` accepte uniquement ce nouveau
> préfixe.

### 5.1 `chatPanel.js` — modifications

```diff
+ import { traceChat } from './traceLogger.js';

  async function sendMessage(text, options = {}) {
    const { skipUserMessage = false } = options;
+   traceChat('sendMessage ENTRY', {
+     text: text.slice(0, 80),
+     skipUser,
+     isThinking,
+     isOptimizing,
+     hasProvider: !!getState().assistant?.provider?.id,
+   });

    if (!text.trim() || isThinking || isOptimizing) {
+     traceChat('sendMessage SKIP', {
+       reason: !text.trim() ? 'empty' : isThinking ? 'thinking' : 'optimizing',
+     });
      return;
    }

    // ... user message push ...
+   traceChat('user message pushed', { textLen: text.length, timestamp: Date.now() });

    // ... prompt prepare ...
+   traceChat('promptEngine prepared', {
+     preparedId: prepared.id,
+     type: prepared.type,
+     cached: prepared.cached,
+     apiEnhanced: prepared.apiEnhanced,
+     durationMs: prepared.duration,
+     tokenCount: estimateTokens(prepared.prompt),
+   });

    // ... createStreamingBubble ...
+   traceChat('createStreamingBubble', { className: streamingBubble?.className });

    // ... streamChatCompletion ...
+   traceChat('streamChatCompletion CALL', {
+     provider: provider.id,
+     model: provider.model,
+     messagesLen: allMessages.length,
+     hasCustomPrompt: !!customPrompt,
+   });

    await streamChatCompletion(provider, trimHistory(allMessages), {
      onToken(token) {
+       // Throttle : 1 log par 10 tokens pour éviter de saturer la console
+       if (streamTokenCount % 10 === 0) {
+         traceChat('onToken', {
+           tokenLen: token.length,
+           cumLen: streamedContent.length + token.length,
+           tokenCount: streamTokenCount + 1,
+           preview: token.slice(0, 40),
+         });
+       }
        streamedContent += token;
        // ...
      },
      onDone() {
+       traceChat('onDone', {
+         streamedContentLen: streamedContent.length,
+         durationMs: Date.now() - streamStartTime,
+         tokenCount: streamTokenCount,
+       });
        // ...
      },
      onError(err) {
+       traceChat('onError', {
+         errorMsg: err?.message?.slice(0, 200),
+         hasPartialContent: streamedContent.length > 0,
+       });
        // ...
      },
    });

    // ... post-optimisation ...
+   traceChat('optimizeLastResponse CALL', {
+     responseLen: streamedContent.length,
+     tokenCount: estimateTokens(streamedContent),
+     threshold,
+     willOptimize: estimateTokens(streamedContent) > threshold,
+   });
    if (!skipUserMessage && streamedContent && !isOptimizing) {
      const tokenCount = estimateTokens(streamedContent);
      const threshold = getState().assistant?.optimizationThreshold || DEFAULT_OPTIMIZATION_THRESHOLD;
      if (tokenCount > threshold) {
+       traceChat('optimizeLastResponse WILL_OPTIMIZE', { tokenCount, threshold });
        await optimizeLastResponse(streamingBubble, streamedContent);
      }
    }
  }
```

### 5.2 `promptEngine.js` — modifications

```diff
+ import { tracePromptEngine } from './traceLogger.js';

  categorizeMessage(message) {
+   const t0 = Date.now();
    // ... existing code ...
+   const result = /* ... existing categorization logic ... */;
+   tracePromptEngine('categorizeMessage', {
+     userMessageLen: message.length,
+     detectedType: result,
+     rulesMatched: /* ... */,
+     durationMs: Date.now() - t0,
+   });
+   return result;
  }

  async preparePrompt(userMessage, graph, options = {}) {
+   const t0 = Date.now();
    // ... existing code ...

    // 2. Cache check
    if (!forceRefresh) {
      const cHash = hashContext(graph.nodes, graph.edges);
      const cacheKey = `${type}-${cHash}`;
+     tracePromptEngine('cacheKey computed', { type, contextHash: cHash, fullKey: cacheKey });
      const cached = this._getFromCache(cacheKey);
      if (cached) {
+       tracePromptEngine('cache HIT', { cacheKey, promptId: cached.id, expiresInMs: this._cache.get(cacheKey).expiresAt - Date.now() });
        // ...
      } else {
+       tracePromptEngine('cache MISS', { cacheKey });
      }
    }

    // 3. Compose
    let prompt = this.composePrompt(type, canvasCtx);
+   tracePromptEngine('composePrompt', {
+     type,
+     templateLen: PROMPT_TEMPLATES[type]?.length || 0,
+     composedLen: prompt.length,
+     contextTextLen: formatContextForTemplate(canvasCtx, type).length,
+   });

    // 3b. Enhance via API
    if (type !== 'conversation') {
      const state = getState();
      const provider = state.assistant?.provider;
      const hasPreparationModel = provider?.preparationModel &&
        typeof provider.preparationModel === 'string' &&
        provider.preparationModel.length > 0;

      if (hasPreparationModel) {
        originalPrompt = prompt;
+       tracePromptEngine('enhancePromptViaApi ENTRY', {
+         originalLen: prompt.length,
+         tokenCount: estimateTokens(prompt),
+         model: provider.preparationModel,
+       });
        const enhanced = await this._enhancePromptViaApi(prompt);
        if (enhanced) {
          prompt = enhanced;
+         tracePromptEngine('enhancePromptViaApi SUCCESS', {
+           originalLen: originalPrompt.length,
+           enhancedLen: enhanced.length,
+           durationMs: Date.now() - t0,
+         });
          apiEnhanced = true;
        }
      }
    }

    // ... rest ...

+   tracePromptEngine('preparePrompt COMPLETE', {
+     preparedId: prepared.id,
+     type: prepared.type,
+     cached: prepared.cached,
+     apiEnhanced,
+     durationMs: Date.now() - t0,
+   });
    return prepared;
  }

  async _writeToFile(prepared) {
+   tracePromptEngine('writeToFile CALL', {
+     promptId: prepared.id,
+     filePath: prepared.filePath,
+     contentLen: prepared.prompt.length,
+   });
    try {
      // ... existing fetch ...
      const resp = await fetch('/api/prompts', { ... });
      if (resp.ok) {
+       tracePromptEngine('writeToFile SUCCESS', {
+         promptId: prepared.id,
+         filePath: prepared.filePath,
+         status: resp.status,
+       });
      } else {
+       tracePromptEngine('writeToFile FAILED', {
+         promptId: prepared.id,
+         errorMsg: `HTTP ${resp.status}`,
+       });
      }
    } catch (err) {
+     tracePromptEngine('writeToFile FAILED', {
+       promptId: prepared.id,
+       errorMsg: err.message,
+     });
    }
  }

  clearCache() {
+   const beforeSize = this._cache.size;
    this._cache.clear();
+   tracePromptEngine('clearCache', { beforeSize, afterSize: this._cache.size });
  }

  _pruneCache() {
+   const beforeSize = this._cache.size;
    // ... existing code ...
+   const removedCount = beforeSize - this._cache.size;
+   if (removedCount > 0) {
+     tracePromptEngine('cache PRUNE', { removedCount, remainingCount: this._cache.size });
+   }
  }
```

### 5.3 Optimiseur — modifications

```diff
+ import { traceOptimizer } from './traceLogger.js';

  async optimizeResponse(response, preparedPrompt, provider) {
+   const t0 = Date.now();
    if (!response || !response.trim()) return null;
    if (!provider?.id) {
+     traceOptimizer('optimizeResponse NO_PROVIDER', { hasProvider: false });
      return null;
    }

    const tokenCount = estimateTokens(response);
    const threshold = DEFAULT_OPTIMIZATION_THRESHOLD;

+   traceOptimizer('optimizeResponse ENTRY', {
+     responseLen: response.length,
+     tokenCount,
+     threshold,
+     willOptimize: tokenCount > threshold,
+   });

    if (tokenCount <= threshold) {
+     traceOptimizer('optimizeResponse SKIP', { tokenCount, threshold });
      return null;
    }

    try {
+     traceOptimizer('optimizeResponse API_CALL', {
+       model: optimizationProvider.model,
+       messagesLen: 2,
+       temperature: 0.3,
+       maxTokens: optimizationProvider.maxTokens,
+     });
      const result = await chatCompletion(optimizationProvider, messages, { ... });
      const optimized = result?.content?.trim();
      if (!optimized) {
+       traceOptimizer('optimizeResponse EMPTY', { originalLen: response.length });
        return null;
      }
+     const tokensSaved = Math.max(0, tokenCount - estimateTokens(optimized));
+     const compressionRatio = Math.round((1 - optimized.length / response.length) * 100);
+     traceOptimizer('optimizeResponse SUCCESS', {
+       originalLen: response.length,
+       optimizedLen: optimized.length,
+       compressionRatio,
+       durationMs: Date.now() - t0,
+       tokensSaved,
+     });
      return optimized;
    } catch (err) {
+     traceOptimizer('optimizeResponse FAILED', {
+       errorMsg: err.message,
+       originalLen: response.length,
+     });
      return null;
    }
  }
```

#### `chatPanel.js` — `optimizeLastResponse()` + `showOptimizationBadge()` + `updateOptimizationStats()`

```diff
  async function optimizeLastResponse(bubble, originalContent) {
+   traceOptimizer('optimizeLastResponse CALL', {
+     responseLen: originalContent.length,
+     tokenCount: estimateTokens(originalContent),
+     threshold,
+     willOptimize: estimateTokens(originalContent) > threshold,
+   });
    if (!bubble || !originalContent || isOptimizing) {
+     traceOptimizer('optimizeLastResponse SKIP', {
+       reason: !bubble ? 'no-bubble' : !originalContent ? 'empty' : 'already-optimizing',
+     });
      return;
    }

    isOptimizing = true;
+   traceOptimizer('isOptimizing LOCK', { reason: 'start', isOptimizing: true });
    const provider = getState().assistant?.provider;
    const preparedPrompt = promptEngine?.getCurrentPrompt();

    if (!provider?.id || !preparedPrompt) {
+     traceOptimizer('optimizeLastResponse SKIP', { reason: 'no-prompt' });
      isOptimizing = false;
      return;
    }

    showOptimizationBadge(bubble, 'optimizing');

    try {
      const optimized = await promptEngine.optimizeResponse(originalContent, preparedPrompt, provider);

      if (optimized && optimized.trim() && optimized !== originalContent.trim()) {
+       traceOptimizer('optimizeLastResponse BADGE done', {
+         originalTokens: estimateTokens(originalContent),
+         optimizedTokens: estimateTokens(optimized),
+         compressionRatio: Math.round((1 - optimized.length / originalContent.length) * 100),
+       });
        // ... existing code (replace content, update state) ...
      } else {
+       traceOptimizer('optimizeLastResponse BADGE no-change', {
+         originalTokens: estimateTokens(originalContent),
+         optimizedTokens: estimateTokens(optimized || ''),
+       });
        showOptimizationBadge(bubble, 'no-change');
      }
    } catch (err) {
+     traceOptimizer('optimizeLastResponse BADGE failed', { errorMsg: err.message });
      showOptimizationBadge(bubble, 'failed');
    } finally {
      isOptimizing = false;
+     traceOptimizer('isOptimizing LOCK', { reason: 'end', isOptimizing: false });
    }
  }

  // Dans les actions ou l'appelant:
  function updateOptimizationStats(tokensSaved, originalTokens) {
+   traceOptimizer('updateOptimizationStats', {
+     tokensSaved,
+     originalTokens,
+     newTotal: actions.getOptimizationStats().totalOptimized + 1,
   });
    // ... existing code ...
  }
```

### 5.4 `aiClient.js` — modifications

```diff
+ import { traceAiClient } from './traceLogger.js';

  export function buildEndpointUrl(provider) {
+   const endpoint = /* ... existing logic ... */;
+   traceAiClient('buildEndpointUrl', {
+     providerId: provider.id,
+     baseUrl: provider.baseUrl,
+     model: provider.model,
+     endpoint,
+   });
+   return endpoint;
  }

  export async function chatCompletion(provider, messages, options = {}) {
+   const t0 = Date.now();
    const { maxRetries = 3, noRotation = false, onFormatDetected = null } = options;

+   traceAiClient('chatCompletion ENTRY', {
+     providerId: provider.id,
+     model: provider.model,
+     messagesLen: messages.length,
+     hasApiKey: !!provider.apiKey,
+     maxRetries,
+     requestFormat: provider.modelMeta?.requestFormat || 'openai',
+   });

    let url = buildEndpointUrl(provider);
    url = toLocalUrl(url, provider.id);
+   traceAiClient('chatCompletion URL', { url, isProxified: url.startsWith('/local-api/') });

    let headers = { 'Content-Type': 'application/json' };
    let body;
    let parseResponse;
    let apiKey = provider.apiKey;
    let requestFormat = provider.modelMeta?.requestFormat || 'openai';

    if (provider.id === 'gemini') {
      body = formatGeminiRequest(messages, provider.model, provider.temperature, provider.maxTokens);
      parseResponse = parseGeminiResponse;
    } else if (requestFormat === 'anthropic' && provider.id === 'opencode-zen') {
      if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`;
      body = formatAnthropicRequest(messages, provider.model, provider.temperature, provider.maxTokens);
      parseResponse = parseOpenAIResponse;
    } else {
      if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`;
      body = { model: provider.model, messages, temperature: provider.temperature, max_tokens: provider.maxTokens, stream: false };
      parseResponse = parseOpenAIResponse;
    }
+   traceAiClient('chatCompletion bodyBuilt', {
+     bodyLen: JSON.stringify(body).length,
+     requestFormat,
+     model: provider.model,
+     hasSystemMsg: !!messages.find((m) => m.role === 'system'),
+   });

    let lastError;
    let lastStatus = null;
    let retries = 0;
    let formatRetryDone = false;

    while (retries <= maxRetries) {
      try {
+       traceAiClient('chatCompletion fetch CALL', { url, bodyLen: JSON.stringify(body).length, timeoutMs: 30000 });
        const response = await fetch(url, {
          method: 'POST',
          headers,
          body: JSON.stringify(body),
          signal: AbortSignal.timeout(30000),
        });

        if (response.ok) {
+         traceAiClient('chatCompletion fetch OK', { status: response.status, durationMs: Date.now() - t0 });
          const data = await response.json();
          if (onFormatDetected && requestFormat !== (provider.modelMeta?.requestFormat || 'openai')) {
            onFormatDetected(requestFormat);
          }
          if (retries > 0) {
            toast.success(`Succès après ${retries} rotation(s)`, { duration: 3000 });
          }
+         const parsed = parseResponse(data, provider.id, provider.modelMeta);
+         traceAiClient('chatCompletion SUCCESS', {
+           contentLen: parsed.content?.length || 0,
+           usage: parsed.usage,
+           detectedFormat: provider.id === 'gemini' ? 'gemini' : requestFormat,
+           attempts: retries + 1,
+         });
+         return parsed;
        }

        if (response.status === 429 && !noRotation) {
          lastStatus = 429;
          const errorData = await response.json().catch(() => ({}));
          const errorMsg = errorData.error?.message || errorData.message || 'Rate limit exceeded';

          if (provider.envKey) {
            const nextKey = getNextApiKey(provider.envKey);
            if (nextKey) {
+             traceAiClient('chatCompletion keyRotation', {
+               envKey: provider.envKey,
+               fromKey: apiKey ? apiKey.slice(0, 8) + '...' : 'none',
+               toKey: nextKey.key,
+               reason: '429',
+             });
              apiKey = nextKey.value;
              retries++;
              continue;
            }
          }
+         traceAiClient('chatCompletion keyExhausted', { envKey: provider.envKey, attempts: retries + 1 });
          throw new Error(`${errorMsg} (429 Rate Limit - aucune clé de rotation disponible)`);
        }

        lastStatus = response.status;
        let errorMsg = `Erreur HTTP ${response.status}`;
        try {
          const errorData = await response.json();
          errorMsg = errorData.error?.message || errorData.message || errorMsg;
        } catch { /* ... */ }

+       if (response.status >= 400 && response.status < 500 && response.status !== 429) {
+         traceAiClient('chatCompletion fetch 4xx', { status: response.status, errorMsg: errorMsg.slice(0, 200) });
+       } else if (response.status >= 500) {
+         traceAiClient('chatCompletion fetch 5xx', { status: response.status, errorMsg: errorMsg.slice(0, 200) });
+       }

        if (provider.id === 'opencode-zen' &&
            requestFormat === 'openai' &&
            !formatRetryDone &&
            isFormatIncompatibleError(response.status, errorMsg)) {
+         traceAiClient('chatCompletion formatRetry', {
+           fromFormat: 'openai',
+           toFormat: 'anthropic',
+           reason: errorMsg.slice(0, 100),
+         });
          formatRetryDone = true;
          retries++;
          continue;
        }

        if (response.status === 401 && provider.envKey) {
          const nextKey = getNextApiKey(provider.envKey);
          if (nextKey) {
+           traceAiClient('chatCompletion keyRotation', {
+             envKey: provider.envKey,
+             fromKey: apiKey ? apiKey.slice(0, 8) + '...' : 'none',
+             toKey: nextKey.key,
+             reason: '401',
+             isQuotaError: isFreeQuotaExhaustedError(errorMsg),
+           });
            retries++;
            continue;
          }
+         traceAiClient('chatCompletion keyExhausted', { envKey: provider.envKey, attempts: retries + 1 });
          throw new Error(errorMsg);
        }

        throw new Error(errorMsg);

      } catch (err) {
        lastError = err;

        if (isTimeoutError(err) && provider.envKey) {
          const nextKey = getNextApiKey(provider.envKey);
          if (nextKey) {
+           traceAiClient('chatCompletion keyRotation', {
+             envKey: provider.envKey,
+             fromKey: apiKey ? apiKey.slice(0, 8) + '...' : 'none',
+             toKey: nextKey.key,
+             reason: 'timeout',
+           });
            retries++;
            continue;
          }
        }

        if (retries >= maxRetries) {
+         traceAiClient('chatCompletion THROW', { errorMsg: err.message.slice(0, 200), status: lastStatus, attempts: retries + 1 });
          throw err;
        }

+       traceAiClient('chatCompletion THROW', { errorMsg: err.message.slice(0, 200), status: lastStatus, attempts: retries + 1 });
        throw err;
      }
    }
  }

  export function parseOpenAIResponse(data, providerId = '', modelMeta = null) {
+   let detectedFormat = 'unknown';
    if (data.choices?.[0]) {
+     detectedFormat = 'openai';
+     const choice = data.choices[0];
+     const content = choice.message?.content || choice.text || '';
+     traceAiClient('parseOpenAIResponse', {
+       format: detectedFormat,
+       contentLen: content.length,
+       usage: {
+         promptTokens: data.usage?.prompt_tokens || 0,
+         completionTokens: data.usage?.completion_tokens || 0,
+       },
+     });
      return {
        content,
        usage: {
          promptTokens: data.usage?.prompt_tokens || 0,
          completionTokens: data.usage?.completion_tokens || 0,
        },
      };
    }

    if (data.output !== undefined) {
+     if (Array.isArray(data.output) && data.output.length === 0) {
+       detectedFormat = 'opencode-zen-empty';
+     } else if (Array.isArray(data.output)) {
+       detectedFormat = 'opencode-zen-array';
+     } else if (typeof data.output === 'string') {
+       detectedFormat = 'opencode-zen-string';
+     } else {
+       detectedFormat = 'opencode-zen-object';
+     }
+     traceAiClient('parseOpenAIResponse', {
+       format: detectedFormat,
+       contentLen: 0, // calculé dans chaque branche return
+       usage: {},
+     });
+     return { /* ... existing logic retourne content + usage ... */ };
    }

+   traceAiClient('parseOpenAIResponse ERROR', {
+     keys: Object.keys(data || {}),
+     errorMsg: 'Format inconnu (ni choices ni output)',
+   });
    throw new Error(`Réponse API invalide: ni choices ni output. Format: ${JSON.stringify(Object.keys(data || {}))}`);
  }

  export function parseGeminiResponse(data) {
+   const parsed = { content: data.candidates?.[0]?.content?.parts?.[0]?.text || '', usage: { /* ... */ } };
+   traceAiClient('parseOpenAIResponse', {
+     format: 'gemini',
+     contentLen: parsed.content.length,
+     usage: parsed.usage,
+   });
+   return parsed;
  }

  export async function streamChatCompletion(provider, messages, { onToken, onDone, onError }, signal) {
+   const t0 = Date.now();
+   let chunkCount = 0;
+   traceAiClient('streamChatCompletion ENTRY', {
+     providerId: provider.id,
+     model: provider.model,
+     hasSignal: !!signal,
+   });

    if (provider.id === 'gemini') {
+     traceAiClient('streamChatCompletion fallback gemini', { providerId: provider.id, reason: 'no-sse' });
      const result = await chatCompletion(provider, messages);
      if (onToken) onToken(result.content);
      if (onDone) onDone();
      return result;
    }

    if (provider.id === 'opencode-zen') {
+     traceAiClient('streamChatCompletion fallback opencode-zen', { providerId: provider.id, reason: 'no-sse' });
      const result = await chatCompletion(provider, messages);
      const fullContent = result.content || '';
      const CHUNK_SIZE = 20;

      for (let i = 0; i < fullContent.length; i += CHUNK_SIZE) {
        const chunk = fullContent.slice(i, i + CHUNK_SIZE);
        chunkCount++;
+       if (chunkCount % 5 === 0) {
+         traceAiClient('streamChatCompletion chunk', {
+           chunkLen: chunk.length,
+           cumLen: Math.min(i + CHUNK_SIZE, fullContent.length),
+           chunkCount,
+           preview: chunk.slice(0, 40),
+         });
+       }
        if (onToken) onToken(chunk);
        await new Promise((resolve) => setTimeout(resolve, 0));
      }

      if (onDone) onDone();
+     traceAiClient('streamChatCompletion DONE', { contentLen: fullContent.length, durationMs: Date.now() - t0, chunkCount });
      return result;
    }

    // ... (SSE stream loop existant) ...
    // Pour chaque chunk OpenAI ou Anthropic valide :
    //   chunkCount++;
    //   if (chunkCount % 5 === 0) {
    //     traceAiClient('streamChatCompletion chunk', { chunkLen, cumLen: fullContent.length, chunkCount, preview });
    //   }
    // Avant le return final :
+   traceAiClient('streamChatCompletion DONE', {
+     contentLen: fullContent.length,
+     durationMs: Date.now() - t0,
+     chunkCount,
+   });
    return { content: fullContent, usage };
  }

  export async function fimCompletion(provider, prefix, suffix) {
+   const t0 = Date.now();
+   traceAiClient('fimCompletion ENTRY', { prefixLen: prefix.length, suffixLen: suffix.length, model: provider.model });
    if (provider.id !== 'mistral') {
+     traceAiClient('fimCompletion FAILED', { providerId: provider.id, errorMsg: "FIM n'est supporté que par Mistral" });
      throw new Error("FIM n'est supporté que par Mistral");
    }
    // ... (fetch + parse existants) ...
    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
+     traceAiClient('fimCompletion FAILED', { providerId: provider.id, errorMsg: error.error?.message || `HTTP ${response.status}` });
      throw new Error(error.error?.message || `Erreur HTTP ${response.status}`);
    }
    const data = await response.json();
    const result = {
      content: data.choices[0].message?.content || data.choices[0].text || '',
      usage: { promptTokens: data.usage?.prompt_tokens || 0, completionTokens: data.usage?.completion_tokens || 0 },
    };
+   traceAiClient('fimCompletion SUCCESS', { contentLen: result.content.length, usage: result.usage, durationMs: Date.now() - t0 });
    return result;
  }
```

### 5.5 `systemPrompt.js` — modifications

```diff
+ import { traceSystemPrompt } from './traceLogger.js';

  export function buildSystemMessages(graph, customPrompt = null, mode = 'replace') {
+   const t0 = Date.now();
+   const nodeCount = graph?.nodes?.length || 0;
+   const edgeCount = graph?.edges?.length || 0;
+   traceSystemPrompt('buildSystemMessages ENTRY', {
+     hasCustomPrompt: !!customPrompt,
+     mode,
+     nodeCount,
+     edgeCount,
+   });

    if (customPrompt) {
      if (mode === 'enrich') {
+       const enriched = customPrompt + '\n\n---\n\n' + SYSTEM_PROMPT;
+       traceSystemPrompt('buildSystemMessages ENRICH', {
+         customPromptLen: customPrompt.length,
+         systemPromptLen: SYSTEM_PROMPT.length,
+         totalLen: enriched.length,
+         mode,
+       });
+       const messages = [{ role: 'system', content: enriched }];
+       traceSystemPrompt('buildSystemMessages SUCCESS', {
+         messagesLen: messages.length,
+         totalContentLen: messages[0].content.length,
+         durationMs: Date.now() - t0,
+       });
+       return messages;
      }
+     const messages = [{ role: 'system', content: customPrompt }];
+     traceSystemPrompt('buildSystemMessages REPLACE', { promptLen: customPrompt.length });
+     traceSystemPrompt('buildSystemMessages SUCCESS', {
+       messagesLen: messages.length,
+       totalContentLen: messages[0].content.length,
+       durationMs: Date.now() - t0,
+     });
+     return messages;
    }

    const { nodes, edges } = graph;

    const nodeSummary = nodes
      .filter((n) => n.type !== 'hub')
      .map((n) => {
        const desc = n.description ? ': ' + n.description.slice(0, 80) : '';
        return `- [${n.type}] ${n.label || n.id}${desc}`;
      })
      .join('\n');

    const edgeSummary = edges
      .map((e) => {
        const fromNode = nodes.find((n) => n.id === e.from);
        const toNode = nodes.find((n) => n.id === e.to);
        return `- ${fromNode?.label || e.from} -> ${toNode?.label || e.to}`;
      })
      .join('\n');

    const contextParts = [
      SYSTEM_PROMPT,
      '',
      '---',
      '',
      '## État actuel du canvas',
      '',
      `**${nodes.length} nœuds**, **${edges.length} arêtes**`,
      '',
    ];

    if (nodeSummary) {
      contextParts.push('### Nœuds');
      contextParts.push(nodeSummary);
      contextParts.push('');
    }
    if (edgeSummary) {
      contextParts.push('### Connexions');
      contextParts.push(edgeSummary);
      contextParts.push('');
    }

+   traceSystemPrompt('buildSystemMessages DEFAULT', {
+     systemPromptLen: SYSTEM_PROMPT.length,
+     nodeSummaryLen: nodeSummary.length,
+     edgeSummaryLen: edgeSummary.length,
+     totalLen: contextParts.join('\n').length,
+   });
    const messages = [{ role: 'system', content: contextParts.join('\n') }];
+   traceSystemPrompt('buildSystemMessages SUCCESS', {
+     messagesLen: messages.length,
+     totalContentLen: messages[0].content.length,
+     durationMs: Date.now() - t0,
+   });
    return messages;
  }
```

---

## 6. Format et conventions

### 6.1 Préfixes

| Module | Préfixe | Exemple |
|--------|---------|---------|
| Chat panel | `[CHAT]` | `[CHAT] [+127ms] sendMessage ENTRY` |
| Prompt engine | `[PROMPT-ENGINE]` | `[PROMPT-ENGINE] [+892ms] cache HIT` |
| Optimiseur | `[OPTIMIZER]` | `[OPTIMIZER] [+4521ms] optimizeResponse SUCCESS` |
| aiClient | `[AI-CLIENT]` | `[AI-CLIENT] [+1342ms] chatCompletion fetch OK` |
| systemPrompt | `[SYSTEM-PROMPT]` | `[SYSTEM-PROMPT] [+892ms] buildSystemMessages REPLACE` |

### 6.2 Format mixte (lisible + détails collapsibles)

```
[CHAT] [+127ms] sendMessage ENTRY                          ← Log principal (toujours visible)
  ▼ [CHAT] details                                        ← Groupe collapsible
    event:  sendMessage ENTRY
    data:   { text: 'Analyse le canvas...', skipUser: false, ... }
    time:   127ms
```

Avantage : on voit d'un coup d'œil les événements importants (première ligne), mais on peut déplier pour les détails si besoin.

### 6.3 Format timestamp

`[+${elapsed}ms]` où `elapsed = Date.now() - t0` (t0 = timestamp de la première trace au chargement du module). Relatif à la session.

---

## 7. Tests

### 7.1 Tests unitaires vitest : `src/code-city/ai/traceLogger.test.js`

```js
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { traceChat, tracePromptEngine, traceOptimizer } from './traceLogger.js';

describe('traceLogger', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    if (window.__CHAT_LOG_BUFFER) window.__CHAT_LOG_BUFFER.length = 0;
  });

  it('traceChat émet un log console avec préfixe [CHAT]', () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    traceChat('sendMessage ENTRY', { text: 'hello' });
    expect(spy).toHaveBeenCalled();
    expect(spy.mock.calls[0][0]).toMatch(/^\[CHAT\] \[\+\d+ms\] sendMessage ENTRY$/);
  });

  it('traceChat ajoute au buffer __CHAT_LOG_BUFFER', () => {
    traceChat('onToken', { tokenLen: 5 });
    expect(window.__CHAT_LOG_BUFFER).toHaveLength(1);
    expect(window.__CHAT_LOG_BUFFER[0]).toMatchObject({
      prefix: '[CHAT]',
      event: 'onToken',
      data: { tokenLen: 5 },
    });
  });

  it('buffer est limité à 500 entrées (FIFO)', () => {
    for (let i = 0; i < 600; i++) {
      traceChat('test', { i });
    }
    expect(window.__CHAT_LOG_BUFFER).toHaveLength(500);
    expect(window.__CHAT_LOG_BUFFER[0].data.i).toBe(100); // 100 premières évincées
  });

  it('tracePromptEngine utilise le préfixe [PROMPT-ENGINE]', () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    tracePromptEngine('cache HIT', { cacheKey: 'analysis-abc' });
    expect(spy.mock.calls[0][0]).toMatch(/^\[PROMPT-ENGINE\]/);
  });

  it('traceOptimizer utilise le préfixe [OPTIMIZER]', () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    traceOptimizer('optimizeResponse SUCCESS', { tokensSaved: 100 });
    expect(spy.mock.calls[0][0]).toMatch(/^\[OPTIMIZER\]/);
  });

  it('format mixte : première ligne + console.groupCollapsed() pour détails', () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const groupSpy = vi.spyOn(console, 'groupCollapsed').mockImplementation(() => {});
    const groupEndSpy = vi.spyOn(console, 'groupEnd').mockImplementation(() => {});
    traceChat('onToken', { tokenLen: 5, cumLen: 10 });
    expect(logSpy).toHaveBeenCalledTimes(4); // 1 header + 3 détails (event, data, time)
    expect(groupSpy).toHaveBeenCalledWith(expect.stringContaining('[CHAT] details'));
    expect(groupEndSpy).toHaveBeenCalled();
  });

  it('pas de console.group() si pas de data', () => {
    const groupSpy = vi.spyOn(console, 'groupCollapsed').mockImplementation(() => {});
    traceChat('event simple');
    expect(groupSpy).not.toHaveBeenCalled();
  });
});
```

### 7.2 Tests E2E playwright : `e2e/chat-trace.spec.js`

```js
import { test, expect } from '@playwright/test';
import { setupProvider, sendSmokeMessage, openChatRobust, skipIfNoKey } from '../helpers/providerTest.js';

test.describe('Chat trace @debug', () => {
  test.beforeEach(async ({ page }) => {
    skipIfNoKey(test, 'openrouter');
    await page.goto('/');
    await page.waitForSelector('.canvas-content', { timeout: 10000 });

    // Capturer tous les logs de la console
    page.on('console', (msg) => {
      const text = msg.text();
      if (text.startsWith('[CHAT]') || text.startsWith('[PROMPT-ENGINE]') || text.startsWith('[OPTIMIZER]') || text.startsWith('[AI-CLIENT]') || text.startsWith('[SYSTEM-PROMPT]')) {
        console.log(`[CAPTURED] ${text}`);
      }
    });
  });

  test('sendMessage émet [CHAT] sendMessage ENTRY + [CHAT] onDone', async ({ page }) => {
    const captured = [];
    page.on('console', (msg) => {
      const text = msg.text();
      if (text.includes('[CHAT]')) captured.push(text);
    });

    await setupProvider(page, 'openrouter');
    await openChatRobust(page);
    await sendSmokeMessage(page, 'Dis bonjour', 30_000);

    // Vérifier qu'on a au moins les événements principaux
    const events = captured.join('\n');
    expect(events).toContain('sendMessage ENTRY');
    expect(events).toContain('createStreamingBubble');
    expect(events).toContain('onDone');
  });

  test('promptEngine émet [PROMPT-ENGINE] preparePrompt COMPLETE', async ({ page }) => {
    const captured = [];
    page.on('console', (msg) => {
      const text = msg.text();
      if (text.includes('[PROMPT-ENGINE]')) captured.push(text);
    });

    await setupProvider(page, 'openrouter');
    await openChatRobust(page);
    await sendSmokeMessage(page, 'Analyse la structure du projet', 30_000);

    const events = captured.join('\n');
    expect(events).toContain('categorizeMessage');
    expect(events).toMatch(/cache (HIT|MISS)/);
    expect(events).toContain('composePrompt');
    expect(events).toContain('preparePrompt COMPLETE');
  });

  test('buffer __CHAT_LOG_BUFFER est exposé sur window', async ({ page }) => {
    await setupProvider(page, 'openrouter');
    await openChatRobust(page);
    await sendSmokeMessage(page, 'Test', 30_000);

    const bufferLen = await page.evaluate(() => window.__CHAT_LOG_BUFFER?.length || 0);
    expect(bufferLen).toBeGreaterThan(0);

    const firstEntry = await page.evaluate(() => window.__CHAT_LOG_BUFFER?.[0]);
    expect(firstEntry).toMatchObject({
      ts: expect.any(Number),
      prefix: expect.stringMatching(/^\[(CHAT|PROMPT-ENGINE|OPTIMIZER|AI-CLIENT|SYSTEM-PROMPT)\]$/),
      event: expect.any(String),
    });
  });
});
```

### 7.3 Test "smoke" : `e2e/chat-trace-smoke.spec.js`

Vérifie qu'au moins un log de chaque préfixe est émis lors d'un chat simple :

```js
test('chat complet émet les 3 types de logs', async ({ page }) => {
  const prefixes = new Set();
  page.on('console', (msg) => {
    const text = msg.text();
    if (text.startsWith('[CHAT]')) prefixes.add('CHAT');
    if (text.startsWith('[PROMPT-ENGINE]')) prefixes.add('PROMPT-ENGINE');
    if (text.startsWith('[OPTIMIZER]')) prefixes.add('OPTIMIZER');
    if (text.startsWith('[AI-CLIENT]')) prefixes.add('AI-CLIENT');
    if (text.startsWith('[SYSTEM-PROMPT]')) prefixes.add('SYSTEM-PROMPT');
  });

  await setupProvider(page, 'openrouter');
  await openChatRobust(page);
  await sendSmokeMessage(page, 'Bonjour', 30_000);

  expect(prefixes.has('CHAT')).toBe(true);
  expect(prefixes.has('PROMPT-ENGINE')).toBe(true);
  expect(prefixes.has('AI-CLIENT')).toBe(true);
  expect(prefixes.has('SYSTEM-PROMPT')).toBe(true);
  // OPTIMIZER peut être absent si la réponse est courte
});
```

---

## 8. Plan d'implémentation

### Phase CT-1 : Module traceLogger (fondation)

| # | Tâche | Fichiers | Effort |
|---|-------|----------|--------|
| 1.1 | Créer `src/code-city/ai/traceLogger.js` (helpers `traceChat`, `tracePromptEngine`, `traceOptimizer` + buffer `window.__CHAT_LOG_BUFFER`) | `traceLogger.js` | 1h |
| 1.2 | Ajouter `VITE_CHAT_DEBUG` dans `.env.development` (true) et `.env.production` (false) | `.env.*` | 0.25h |
| 1.3 | Tests unitaires `traceLogger.test.js` (7 tests) | `traceLogger.test.js` | 1h |

### Phase CT-2 : Instrumentation chatPanel.js

| # | Tâche | Fichiers | Effort |
|---|-------|----------|--------|
| 2.1 | Ajouter imports `traceChat` + instrumentation `sendMessage` (15 événements) | `chatPanel.js` | 2h |
| 2.2 | Instrumentation `optimizeLastResponse` + `showOptimizationBadge` (8 événements) | `chatPanel.js` | 1h |
| 2.3 | Tests E2E `chat-trace.spec.js` (4 tests) | `e2e/chat-trace.spec.js` | 1.5h |

### Phase CT-3 : Instrumentation promptEngine.js

| # | Tâche | Fichiers | Effort |
|---|-------|----------|--------|
| 3.1 | Instrumentation `categorizeMessage`, `composePrompt`, `preparePrompt` (12 événements) | `promptEngine.js` | 1.5h |
| 3.2 | Instrumentation `_getFromCache`, `_setCache`, `_pruneCache`, `clearCache` (5 événements) | `promptEngine.js` | 0.5h |
| 3.3 | Instrumentation `_enhancePromptViaApi` (5 événements) | `promptEngine.js` | 0.5h |
| 3.4 | Instrumentation `_writeToFile` (3 événements) | `promptEngine.js` | 0.5h |
| 3.5 | Instrumentation `optimizeResponse` (8 événements) | `promptEngine.js` | 0.5h |
| 3.6 | Test E2E `chat-trace-smoke.spec.js` (1 test) | `e2e/chat-trace-smoke.spec.js` | 0.5h |

### Phase CT-3.5 : Instrumentation aiClient.js (extension scope)

| # | Tâche | Fichiers | Effort |
|---|-------|----------|--------|
| 3.5.1 | Instrumentation `buildEndpointUrl`, `chatCompletion` ENTRY/URL/body/fetch/formatRetry/keyRotation/SUCCESS/THROW (14 événements) | `aiClient.js` | 2h |
| 3.5.2 | Instrumentation `parseOpenAIResponse` + `parseGeminiResponse` (4 événements) | `aiClient.js` | 0.5h |
| 3.5.3 | Instrumentation `streamChatCompletion` ENTRY/fallback/chunk/DONE/ERROR/buffer residual (7 événements) | `aiClient.js` | 1.5h |
| 3.5.4 | Instrumentation `fimCompletion` (3 événements) | `aiClient.js` | 0.5h |

### Phase CT-3.6 : Instrumentation systemPrompt.js (extension scope)

| # | Tâche | Fichiers | Effort |
|---|-------|----------|--------|
| 3.6.1 | Instrumentation `buildSystemMessages` ENTRY/REPLACE/ENRICH/DEFAULT/SUCCESS (5 événements) | `systemPrompt.js` | 0.5h |

**Sous-total extension** : ~5h en plus

### Phase CT-4 : Polish & validation

| # | Tâche | Fichiers | Effort |
|---|-------|----------|--------|
| 4.1 | Lancer vitest : 0 régression sur 380+ tests existants | - | 0.5h |
| 4.2 | Lancer playwright @slow : 42 ✅ / 6 ⏭️ / 1 ❌ → valider que les logs ne cassent rien | - | 0.5h |
| 4.3 | Mettre à jour `CHANGELOG.md` avec entrée "Système de traçage" | `CHANGELOG.md` | 0.25h |
| 4.4 | Mettre à jour `e2e/README.md` avec section "Chat trace" | `e2e/README.md` | 0.25h |

**Total estimé initial** : ~10.75h (~1.5j)
**Total avec extension aiClient + systemPrompt** : ~15.75h (~2j)

---

## 9. Risques et mitigations

| Risque | Impact | Mitigation |
|--------|--------|------------|
| **Fuite de logs en prod** (clés API visibles) | 🔴 Sécurité | `VITE_CHAT_DEBUG=false` par défaut en prod + dead-code-elimination Vite → pas de code des `trace*()` en bundle prod. Vérifier le build prod avec `grep -r "traceChat" dist/` (doit être 0). |
| **Performance dégradée** (surtout `onToken` à chaque token) | 🟡 UX (lag console) | Throttle `onToken` à 1/10 tokens. Pas de JSON.stringify d'objets > 100 chars. |
| **Buffer `__CHAT_LOG_BUFFER` trop gros** | 🟡 Mémoire | Ring buffer FIFO max 500 entrées. |
| **Bruit excessif dans la console** | 🟢 Dev comfort | Préfixes `[CHAT]`, `[PROMPT-ENGINE]`, `[OPTIMIZER]` permettent de filtrer rapidement. |
| **Tests E2E flaky** (console events async) | 🟡 CI | `await page.waitForTimeout(500)` après sendSmokeMessage avant d'inspecter le buffer. |
| **Régression sur les tests existants** (logs qui modifient l'ordre) | 🟡 Validation | Tests E2E existants valident le comportement, pas la console → faible risque. Tests unitaires spy console.log isolés. |
| **Throttle onToken 1/10 manque certains événements** | 🟢 Debug | Acceptable : onToken eventuel est pour la visu, pas le diagnostic. Les autres événements (sendMessage, onDone, preparePrompt) sont non-throttle. |

---

## 10. Métriques de succès (Definition of Done)

- [ ] Module `traceLogger.js` créé avec **5 helpers** (`traceChat`, `tracePromptEngine`, `traceOptimizer`, `traceAiClient`, `traceSystemPrompt`)
- [ ] Variable env `VITE_CHAT_DEBUG` configurée (true en dev, false en prod)
- [ ] 15+ événements instrumentés dans `chatPanel.js`
- [ ] 25+ événements instrumentés dans `promptEngine.js` (catégorisation, cache, composition, enhance, writeToFile, **8 événements optimizeResponse sous `[OPTIMIZER]`**)
- [ ] 28+ événements instrumentés dans `aiClient.js` (chatCompletion + streamChatCompletion + parseOpenAIResponse + fimCompletion)
- [ ] 5+ événements instrumentés dans `systemPrompt.js` (buildSystemMessages)
- [ ] Buffer `window.__CHAT_LOG_BUFFER` (max 500 entrées) accessible depuis DevTools
- [ ] Format mixte : log court + `console.groupCollapsed()` avec détails
- [ ] **Alignement helper ↔ fichier** (Sprint CT-4 v1.3) : `traceOptimizer` utilisé pour les 8 événements `optimizeResponse*` dans `promptEngine.js` (cf. §4.6 + §5.0)
- [ ] Tests unitaires `traceLogger.test.js` : 7+ tests passent
- [ ] Tests E2E `chat-trace.spec.js` : 4+ tests passent
- [ ] Test E2E `chat-trace-with-llm.spec.js` (gated `E2E_WITH_LLM=true`) : 1 test passe
- [ ] `npx vitest run` → 404+ tests passent (0 régression)
- [ ] `E2E_WITH_LLM=true npx playwright test e2e/chat-trace.spec.js` → 5/5 tests passent (validation end-to-end Sprint CT-4)
- [ ] `npx playwright test e2e/providers/ --grep @slow` → 42 ✅ / 6 ⏭️ / 1 ❌ (comme avant instrumentation)
- [ ] Build prod `dist/` ne contient aucun appel à `trace*` (vérifié avec grep)
- [ ] `CHANGELOG.md` mis à jour
- [ ] `e2e/README.md` mis à jour

---

## 11. Annexes

### A. Exemple de sortie console

```
[CHAT] [+12ms] sendMessage ENTRY
  ▼ [CHAT] details
    event:  sendMessage ENTRY
    data:   { text: 'Analyse la structure', skipUser: false, isThinking: false, isOptimizing: false, hasProvider: true }
    time:   12ms
[CHAT] [+45ms] user message pushed
  ▼ [CHAT] details
    event:  user message pushed
    data:   { textLen: 21, timestamp: 1717600000123 }
    time:   45ms
[PROMPT-ENGINE] [+892ms] categorizeMessage
  ▼ [PROMPT-ENGINE] details
    event:  categorizeMessage
    data:   { userMessageLen: 21, detectedType: 'analysis', durationMs: 1 }
    time:   892ms
[PROMPT-ENGINE] [+894ms] cacheKey computed
  ▼ [PROMPT-ENGINE] details
    event:  cacheKey computed
    data:   { type: 'analysis', contextHash: 'a1b2c3', fullKey: 'analysis-a1b2c3' }
    time:   894ms
[PROMPT-ENGINE] [+895ms] cache MISS
[PROMPT-ENGINE] [+896ms] composePrompt
  ▼ [PROMPT-ENGINE] details
    event:  composePrompt
    data:   { type: 'analysis', templateLen: 380, composedLen: 540, contextTextLen: 160 }
    time:   896ms
[PROMPT-ENGINE] [+1234ms] enhancePromptViaApi SUCCESS
  ▼ [PROMPT-ENGINE] details
    event:  enhancePromptViaApi SUCCESS
    data:   { originalLen: 540, enhancedLen: 620, durationMs: 338 }
    time:   1234ms
[PROMPT-ENGINE] [+1245ms] preparePrompt COMPLETE
[PROMPT-ENGINE] [+1248ms] writeToFile CALL
[PROMPT-ENGINE] [+1339ms] writeToFile SUCCESS
  ▼ [PROMPT-ENGINE] details
    event:  writeToFile SUCCESS
    data:   { promptId: '2026-06-10T15:30:42-analysis', filePath: 'data/prompts/2026-06-10T15:30:42-analysis.md', status: 200 }
    time:   1339ms
[CHAT] [+1340ms] promptEngine prepared
[CHAT] [+1341ms] createStreamingBubble
[CHAT] [+1342ms] streamChatCompletion CALL
  ▼ [CHAT] details
    event:  streamChatCompletion CALL
    data:   { provider: 'openrouter', model: 'qwen/qwen3.5-9b', messagesLen: 3, hasCustomPrompt: true }
    time:   1342ms
[CHAT] [+2145ms] onToken
  ▼ [CHAT] details
    event:  onToken
    data:   { tokenLen: 15, cumLen: 15, tokenCount: 1, preview: 'Voici mon analyse' }
    time:   2145ms
[CHAT] [+3250ms] onToken
  ▼ [CHAT] details
    event:  onToken
    data:   { tokenLen: 12, cumLen: 27, tokenCount: 2, preview: ' de la structure' }
    time:   3250ms
...
[CHAT] [+8934ms] onDone
  ▼ [CHAT] details
    event:  onDone
    data:   { streamedContentLen: 412, durationMs: 7594, tokenCount: 28 }
    time:   8934ms
[CHAT] [+8935ms] optimizeLastResponse CALL
  ▼ [CHAT] details
    event:  optimizeLastResponse CALL
    data:   { responseLen: 412, tokenCount: 103, threshold: 500, willOptimize: false }
    time:   8935ms
[CHAT] [+8936ms] FINALLY
```

### B. Variables d'env

```bash
# .env.development
VITE_CHAT_DEBUG=true

# .env.production
VITE_CHAT_DEBUG=false

# .env.local (override local, gitignored)
VITE_CHAT_DEBUG=true
```

### C. Accès au buffer depuis DevTools

```js
// Dans la console DevTools
window.__CHAT_LOG_BUFFER.slice(-20)  // 20 dernières entrées
window.__CHAT_LOG_BUFFER.filter(e => e.prefix === '[CHAT]')  // uniquement chat
window.__CHAT_LOG_BUFFER.filter(e => e.event.includes('onToken'))  // tokens uniquement
copy(window.__CHAT_LOG_BUFFER)  // copier dans le presse-papier pour partage
```

### D. Références

- `src/code-city/ai/chatPanel.js` — chat panel (cible instrumentation)
- `src/code-city/ai/promptEngine.js` — prompt engine + **optimiseur `optimizeResponse` (utilise `traceOptimizer` → préfixe `[OPTIMIZER]`, cf. §4.6)**
- `src/code-city/ai/aiClient.js` — appels API LLM (cible instrumentation : `buildEndpointUrl`, `chatCompletion`, `streamChatCompletion`, `parseOpenAIResponse`, `parseGeminiResponse`, `fimCompletion`)
- `src/code-city/ai/systemPrompt.js` — construction des messages système (cible instrumentation : `buildSystemMessages`)
- `vite.config.js` — config Vite (variable env `VITE_CHAT_DEBUG`)
- `e2e/helpers/providerTest.js` — helpers E2E (déjà importé dans les tests)
