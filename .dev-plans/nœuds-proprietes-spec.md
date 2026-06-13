# Spec — Enrichissement des Nœuds & Propriétés + Documentation Vivante

> **Statut** : Draft v1 — Juin 2026
> **Mission** : Personnaliser au maximum les ~153 nœuds existants (en route vers 1000+) pour qu'ils deviennent une **documentation vivante** parlante pour les agents IA qui écriront les projets.
> **Principe fondamental** : Le canvas EST la documentation. Les agents lisent les propriétés, pas du texte libre.

---

## 1. Vision & objectifs

### 1.1 Vision globale

Le projet est composé de **3 systèmes interconnectés** :

```
┌──────────────────────────────────────────────────────────────┐
│                  SYSTÈME 1 : CANVAS (production)               │
│  Le projet en cours. Nœuds + propriétés. Exporte vers l'agent │
└──────────────────────────────────────────────────────────────┘
                              ▲
                              │ alimente via découverte
                              │
┌──────────────────────────────────────────────────────────────┐
│         SYSTÈME 2 : COLLECTION DE NŒUDS (catalogue)           │
│  Les ~153+ types de nœuds disponibles (avec leurs propriétés) │
│  Enrichie en continu par les scénarios                       │
└──────────────────────────────────────────────────────────────┘
                              ▲
                              │ alimente via extraction
                              │
┌──────────────────────────────────────────────────────────────┐
│           SYSTÈME 3 : SCÉNARIOS (méta-outil dev)              │
│  Fichiers .md décrivant des projets fictifs pour brainstormer │
│  de nouveaux nœuds. JAMAIS livré avec le projet.              │
└──────────────────────────────────────────────────────────────┘
```

### 1.2 Objectifs mesurables

| # | Objectif | Cible | Métrique |
|---|----------|-------|----------|
| O1 | Enrichir les propriétés des nœuds existants | **6-12 champs par type** | Champs remplis / total champs |
| O2 | Pas de sous-types (pour l'instant) | Garder ~153 types | Nombre de types dans la palette |
| O3 | Champs requis contextuels | Si `auth='OAuth2'` → `clientId` requis | % nœuds avec champs critiques remplis |
| O4 | Défauts intelligents depuis le graphe | `service-api` → `service-database` ⇒ suggérer `storage: PostgreSQL` | % nœuds avec défauts pré-remplis |
| O5 | Documentation hybride (Markdown + JSON sidecar) | Double format | Tests de round-trip passent |
| O6 | IA assistée pour remplir | L'agent propose 80% des champs | Champs auto-remplis / total |
| O7 | Consommation multi-canal | ZIP + API + prompt | Au moins 2 canaux fonctionnels |
| O8 | Régénération live | Doc synchro à chaque modif | Latence < 500ms |
| O9 | Collection à 1000+ nœuds | Long terme | Nombre de types dans la palette |
| O10 | **Aucun** scénario dans le projet livré | 100% isolé | `git status` clean après export |

---

## 2. Périmètre (ce qui est IN / ce qui est OUT)

### 2.1 IN scope (à faire)

- ✅ **Enrichir les 17 catégories** de `propertySchemas.js` (process, decision, service, devops, arch, sec, data, proj, test, uiux, pattern, env, component, git, msg, init, dep)
- ✅ Ajouter de **nouvelles catégories** si nécessaire (ex: `monitoring`, `compliance`, `localization`, `mobile-native`, etc.)
- ✅ Champs **requis contextuels** (un champ devient requis selon la valeur d'un autre)
- ✅ **Défauts intelligents** basés sur le contexte du graphe (arêtes voisines)
- ✅ **Documentation hybride** : export Markdown + sidecar JSON
- ✅ **IA assistée** : l'agent peut proposer du contenu pour les champs
- ✅ **Consommation multi-canal** : ZIP (archivage), API (live), prompt (chat)
- ✅ **Régénération live** à chaque modification du canvas
- ✅ **Workflow scénarios** : dossier `scenarios/`, 3 fichiers de scénarios, extraction de termes
- ✅ Mécanisme d'**ajout de nouveaux nœuds** à la collection (palette + schemas)
- ✅ **Migrations** des anciens nœuds (propriétés absentes → défauts)

### 2.2 OUT scope (à NE PAS faire)

- ❌ **Sous-types** dans les catégories (ex: `service-api-rest` vs `service-api-grpc`) — reporté à une v2
- ❌ **Snapshots versionnés** de la collection (v1, v2, v3...) — la collection est open-ended
- ❌ **Templates de projet** (SaaS, e-commerce) — gérés par les scénarios, pas dans le canvas
- ❌ **Round-trip Mermaid ↔ propriétés** amélioré — la doc est séparée du code Mermaid
- ❌ **Mode multi-édition** de propriétés — édition single-node uniquement pour v1
- ❌ **Stockage des scénarios dans le repo canvas** — c'est un méta-outil, jamais commité

### 2.3 Questions ouvertes (à clarifier pendant l'implémentation)

| # | Question | Impact |
|---|----------|--------|
| Q1 | Comment l'agent propose-t-il des défauts depuis le graphe ? (logique embarquée vs appel API) | Architecture |
| Q2 | Le sidecar JSON a-t-il un schéma strict (JSON Schema) ou libre ? | Validation |
| Q3 | Les scénarios sont-ils versionnés (git) ou jetables ? | Workflow dev |
| Q4 | L'API de consommation expose-t-elle tout le canvas ou seulement les nœuds validés ? | Sécurité |
| Q5 | La régénération live est-elle debounced ou synchrone ? | Perf |

---

## 3. Enrichissement des propriétés (le cœur du sujet)

### 3.1 Profondeur cible : **6-12 champs par type**

Cible réaliste : **9 champs en moyenne** par type, répartis en :
- **2-3 champs d'identification** (nom, version, référence externe)
- **3-5 champs métier** (le cœur : ce qui définit le nœud)
- **2-3 champs de méta** (owner, dates, statut)

### 3.2 Pas de sous-types (pour l'instant)

On garde les **~153 types existants**. Les distinctions (REST vs GraphQL vs gRPC) se font via des **propriétés** (`protocol: 'REST' | 'GraphQL' | 'gRPC'`), pas via de nouveaux types.

**Exception documentée** : si un type nécessite > 20 champs pour couvrir tous ses cas, on le découpe en v2.

### 3.3 Champs requis contextuels

Un champ devient **requis** selon la valeur d'un autre champ. Cette section donne **4 scénarios réels** complets, du déclencheur jusqu'à l'affichage UI.

---

#### Scénario 1 : `service-api` avec authentification OAuth2

**Contexte métier** : Un endpoint qui s'authentifie via OAuth2 ne peut pas fonctionner sans 4 informations critiques (clientId, clientSecret, authUrl, tokenUrl). Si l'utilisateur choisit OAuth2 mais ne remplit pas ces 4 champs, l'agent qui lira la doc ne pourra pas implémenter l'endpoint.

**Schéma complet :**

```yaml
service-api:
  - key: auth
    type: select
    label: "Méthode d'authentification"
    options: ['None', 'API Key', 'JWT', 'OAuth2', 'Basic', 'mTLS']
    default: null
    required: false
    aiAssistable: true
    conditional_required:
      - when: { field: 'auth', equals: 'OAuth2' }
        fields: ['clientId', 'clientSecret', 'authUrl', 'tokenUrl', 'scopes']
        message: "OAuth2 nécessite 5 champs : identifiants, URLs du provider et scopes"
        severity: 'error'    # Bloque l'export si non rempli
      - when: { field: 'auth', equals: 'API Key' }
        fields: ['apiKeyName', 'apiKeyEnvVar']
        message: "API Key nécessite le nom du header ET la variable d'env qui contient la clé"
        severity: 'error'
      - when: { field: 'auth', equals: 'Basic' }
        fields: ['username', 'passwordEnvName']
        message: "Auth Basic : le username est en clair, le password DOIT être dans une var d'env"
        severity: 'error'
      - when: { field: 'auth', equals: 'mTLS' }
        fields: ['certPath', 'keyPath', 'caPath']
        message: "mTLS nécessite les 3 chemins vers les certificats"
        severity: 'error'

  - key: clientId
    type: text
    label: "Client ID OAuth2"
    placeholder: "${OAUTH_CLIENT_ID}"
    aiAssistable: true
    pattern: '^\$\{[A-Z_]+\}$|^[a-zA-Z0-9_-]+$'
    docsUrl: 'https://oauth.net/2/client-credentials/'

  - key: clientSecret
    type: password
    label: "Client Secret OAuth2"
    placeholder: "${OAUTH_CLIENT_SECRET}"
    # JAMAIS persisté en clair — toujours référencé via var d'env
    persistedAs: 'env-reference'

  - key: authUrl
    type: url
    label: "URL d'autorisation"
    placeholder: "https://auth.example.com/oauth/authorize"

  - key: tokenUrl
    type: url
    label: "URL du token"
    placeholder: "https://auth.example.com/oauth/token"

  - key: scopes
    type: text
    label: "Scopes requis"
    placeholder: "read:user, write:user"
```

**Comportement UI attendu :**
- User sélectionne `OAuth2` → 5 champs apparaissent avec un badge rouge "Requis" et une bordure rouge.
- User tente d'exporter sans remplir → message : *"OAuth2 nécessite 5 champs"* + bouton "Exporter" grisé.
- User vide `auth` → les 5 champs redeviennent optionnels (pas de validation).

**Comportement IA assistée :**
- Si `auth='OAuth2'` et que `authUrl` / `tokenUrl` ne sont pas remplis → l'IA peut proposer des URLs basées sur le provider (Google, GitHub, Auth0) si détecté via les arêtes voisines.

---

#### Scénario 2 : `proj-task` avec status='Bloqué'

**Contexte métier** : Une tâche bloquée sans raison documentée ne sert à rien. L'agent qui lira le canvas doit savoir POURQUOI la tâche est bloquée et QUI peut la débloquer.

**Schéma complet :**

```yaml
proj-task:
  - key: status
    type: select
    label: "Statut"
    options: ['À faire', 'En cours', 'En revue', 'Terminé', 'Bloqué', 'Annulé']
    default: 'À faire'
    required: true
    aiAssistable: false  # L'IA ne peut pas deviner le statut
    conditional_required:
      - when: { field: 'status', equals: 'Bloqué' }
        fields: ['blockerReason', 'blockerOwner', 'blockerSince', 'unblockPath']
        message: "Une tâche 'Bloqué' DOIT documenter la cause, le responsable et le chemin de déblocage"
        severity: 'error'
      - when: { field: 'status', equals: 'Terminé' }
        fields: ['completedAt', 'completionNotes']
        message: "Tâche terminée : date de fin + notes de complétion requises"
        severity: 'warning'  # Warning, pas error (rétro-compat OK)
      - when: { field: 'status', equals: 'Annulé' }
        fields: ['cancelledReason']
        message: "Annulation : raison requise pour la traçabilité"
        severity: 'warning'
      - when: { field: 'status', equals: 'En revue' }
        fields: ['reviewer']
        message: "Tâche en revue : nom du reviewer requis"
        severity: 'warning'

  - key: blockerReason
    type: textarea
    label: "Raison du blocage"
    placeholder: "Ex: En attente d'une décision produit sur le scope du MVP"
    rows: 3
    minLength: 20
    maxLength: 500

  - key: blockerOwner
    type: text
    label: "Responsable du déblocage"
    placeholder: "Nom ou @mention de la personne qui peut débloquer"
    pattern: '^[A-Za-zÀ-ÿ@][A-Za-zÀ-ÿ0-9 @_-]*$'

  - key: blockerSince
    type: date
    label: "Bloqué depuis"
    maxDate: 'today'  # Pas dans le futur

  - key: unblockPath
    type: textarea
    label: "Chemin de déblocage"
    placeholder: "Décrire les étapes concrètes pour débloquer (ex: 'attendre validation PO le 15/06')"
    rows: 3

  - key: completedAt
    type: date
    label: "Date de fin"
    maxDate: 'today'

  - key: completionNotes
    type: textarea
    label: "Notes de complétion"
    rows: 3

  - key: cancelledReason
    type: text
    label: "Raison d'annulation"
    maxLength: 200

  - key: reviewer
    type: text
    label: "Reviewer"
    placeholder: "Nom de la personne qui relit"
```

**Comportement UI attendu :**
- User passe status à `Bloqué` → 4 nouveaux champs apparaissent (rouge, requis).
- Le champ `blockerReason` a un compteur de caractères (min 20, ex: "..." avant d'atteindre 20).
- Si `blockerSince` est dans le futur → erreur "La date ne peut pas être dans le futur".
- Export ZIP : la section "## Notes" du .md affiche les infos de blocage de manière proéminente.

**Cas limite géré :** si une tâche passe de `Bloqué` à `En cours`, les champs `blocker*` ne sont **pas effacés** (gardés comme historique) mais deviennent "archivés" (affichés en gris, non requis).

---

#### Scénario 3 : `devops-ci` avec environment='Production'

**Contexte métier** : Un pipeline CI qui déploie en production nécessite des validations strictes (approbations, secrets, notifications) qu'un pipeline de dev/staging ne nécessite pas.

**Schéma complet :**

```yaml
devops-ci:
  - key: environment
    type: select
    label: "Environnement cible"
    options: ['dev', 'staging', 'production', 'preview']
    default: 'dev'
    required: true
    conditional_required:
      - when: { field: 'environment', equals: 'production' }
        fields: ['approvers', 'rollbackPlan', 'notifications', 'runbookUrl', 'secretsSource']
        message: "Un déploiement production DOIT avoir : approbations, plan de rollback, notifications et runbook"
        severity: 'error'
      - when: { field: 'environment', equals: 'staging' }
        fields: ['approvers']
        message: "Staging : au moins 1 approbateur requis (warning, pas error)"
        severity: 'warning'
      - when: { field: 'environment', equals: 'preview' }
        fields: []  # Pas de champs requis
        message: "Preview : aucune validation requise (déploiement auto)"

  - key: approvers
    type: multi-select
    label: "Approbateurs requis"
    options: ['@tech-lead', '@devops', '@product-owner', '@security-team']
    minItems: 1  # Au moins 1 approbateur
    dependsOn: 'environment'  # Visible seulement si env != 'dev' et != 'preview'

  - key: rollbackPlan
    type: textarea
    label: "Plan de rollback"
    placeholder: "Étapes pour revenir à la version précédente (ex: 'kubectl rollout undo, vérifier les health checks, attendre 5min')"
    rows: 5
    minLength: 50
    template: |
      1. Détection de l'incident : [comment ?]
      2. Décision de rollback : [qui décide ?]
      3. Exécution : [commande ou procédure]
      4. Vérification : [health checks, smoke tests]
      5. Communication : [qui prévenir ?]

  - key: notifications
    type: multi-select
    label: "Notifications en cas d'échec"
    options: ['slack-channel', 'pagerduty', 'email-team', 'discord-webhook']
    minItems: 1

  - key: runbookUrl
    type: url
    label: "URL du runbook"
    placeholder: "https://wiki.example.com/runbooks/prod-deploy"
    pattern: '^https://'

  - key: secretsSource
    type: select
    label: "Source des secrets"
    options: ['env-vars', 'vault', 'aws-secrets-manager', 'gcp-secret-manager', 'azure-key-vault']
    aiAssistable: true
    # Pas de default — l'user doit choisir consciemment
```

**Comportement UI attendu :**
- User sélectionne `production` → 5 nouveaux champs apparaissent (rouge, requis).
- Le champ `rollbackPlan` est un textarea avec un template pré-rempli (l'user doit personnaliser).
- Si `approvers` est vide → message "Au moins 1 approbateur requis pour production".
- Export : le .md affiche un encadré "⚠️ PRODUCTION DEPLOYMENT" en haut.

**Sécurité** : `rollbackPlan` n'est jamais auto-rempli par l'IA (trop critique, risque de faux sentiment de sécurité).

---

#### Scénario 4 : `data-ml` avec source='External API'

**Contexte métier** : Un modèle ML qui dépend d'une API externe doit documenter : les limites de taux, le contrat de données, la stratégie de fallback en cas d'indisponibilité. Sans ces infos, l'agent ne peut pas implémenter de gestion d'erreur robuste.

**Schéma complet :**

```yaml
data-ml:
  - key: source
    type: select
    label: "Source des données d'entraînement"
    options: ['Internal DB', 'External API', 'Public Dataset', 'User-Generated', 'Synthetic', 'Streaming']
    default: 'Internal DB'
    required: true
    conditional_required:
      - when: { field: 'source', equals: 'External API' }
        fields: ['apiEndpoint', 'rateLimit', 'dataContract', 'fallbackStrategy', 'authMethod']
        message: "Source 'External API' : endpoint, rate limit, contrat de données et stratégie de fallback REQUIS"
        severity: 'error'
      - when: { field: 'source', equals: 'Streaming' }
        fields: ['streamEndpoint', 'partitioning', 'consumerGroup', 'backpressureStrategy']
        message: "Streaming : endpoint, partitionnement, consumer group et gestion de la backpressure requis"
        severity: 'error'
      - when: { field: 'source', equals: 'Public Dataset' }
        fields: ['datasetUrl', 'license', 'lastVerified']
        message: "Dataset public : URL, licence et date de dernière vérification requis"
        severity: 'warning'

  - key: apiEndpoint
    type: url
    label: "Endpoint de l'API"
    placeholder: "https://api.example.com/v1/data"

  - key: rateLimit
    type: text
    label: "Limite de taux"
    placeholder: "1000 req/hour, burst 100/min"
    pattern: '^\d+\s*(req|req/min|req/hour|req/day)(,\s*burst\s*\d+)?$'

  - key: dataContract
    type: textarea
    label: "Contrat de données"
    placeholder: "Schéma JSON attendu (champs, types, nullabilité)"
    rows: 8
    language: 'json'
    template: |
      {
        "id": "string (UUID)",
        "timestamp": "ISO 8601",
        "value": "number",
        "metadata": "object | null"
      }

  - key: fallbackStrategy
    type: select
    label: "Stratégie de fallback"
    options: ['fail-fast', 'cached-data', 'default-value', 'queue-and-retry', 'circuit-breaker']
    aiAssistable: true
    smartDefault:
      fromEdges:
        - type: 'service-cache'  # Si connecté à un cache, fallback = cached-data
          suggest: 'cached-data'
        - type: 'msg-queue'      # Si connecté à une queue, fallback = queue-and-retry
          suggest: 'queue-and-retry'

  - key: authMethod
    type: select
    label: "Méthode d'auth API"
    options: ['None', 'API Key', 'OAuth2', 'mTLS']
    # Réutilise les mêmes conditional_required que service-api (DRY)

  - key: streamEndpoint
    type: text
    label: "Endpoint streaming (Kafka topic, Kinesis stream...)"

  - key: partitioning
    type: text
    label: "Stratégie de partitionnement"
    placeholder: "by user_id (16 partitions)"

  - key: consumerGroup
    type: text
    label: "Consumer group"

  - key: backpressureStrategy
    type: select
    label: "Gestion de la backpressure"
    options: ['drop-oldest', 'block-producer', 'spill-to-disk', 'scale-consumers']

  - key: datasetUrl
    type: url
    label: "URL du dataset"

  - key: license
    type: select
    label: "Licence"
    options: ['MIT', 'Apache-2.0', 'CC-BY-4.0', 'CC0', 'Proprietary', 'Other']

  - key: lastVerified
    type: date
    label: "Date de dernière vérification"
    maxDate: 'today'
```

**Comportement UI attendu :**
- User sélectionne `External API` → 5 champs requis apparaissent.
- Le champ `fallbackStrategy` a un défaut intelligent : si le nœud est connecté à `service-cache`, le défaut proposé est `cached-data` (badge "Suggéré par le contexte").
- Le champ `dataContract` est un textarea avec highlighting JSON et un template pré-rempli.

**Distinction importante** : `dataContract` n'est PAS validé comme JSON valide (on ne veut pas bloquer l'user). Juste un warning si la syntaxe est invalide.

---

#### Récapitulatif des 4 scénarios

| # | Type | Champ déclencheur | Valeur | Champs rendus requis | Sévérité |
|---|------|-------------------|--------|----------------------|----------|
| 1 | `service-api` | `auth` | `OAuth2` | 5 (clientId, clientSecret, authUrl, tokenUrl, scopes) | error |
| 2 | `proj-task` | `status` | `Bloqué` | 4 (blockerReason, blockerOwner, blockerSince, unblockPath) | error |
| 3 | `devops-ci` | `environment` | `production` | 5 (approvers, rollbackPlan, notifications, runbookUrl, secretsSource) | error |
| 4 | `data-ml` | `source` | `External API` | 5 (apiEndpoint, rateLimit, dataContract, fallbackStrategy, authMethod) | error |

**Pattern commun** : 4-5 champs requis par scénario, sévérité `error` par défaut, `warning` pour rétro-compat.

**Anti-pattern à éviter** : ne JAMAIS rendre un champ requis sans une vraie raison business. Un champ rendu "requis par défaut" sans contexte est du bruit.

```

### 3.4 Défauts intelligents depuis le contexte du graphe

L'agent (ou la logique embarquée) propose des défauts en analysant les **arêtes voisines** :

```js
// Exemple : service-api connecté à service-database
// → proposer storage dans service-api

function suggestDefaults(node, edges, allNodes) {
  const suggestions = {};
  
  // Si ce nœud a une arête vers un service-database
  const dbTarget = findNeighbor(node, edges, 'service-database');
  if (dbTarget && node.type === 'service-api') {
    suggestions.persistence = 'Oui'; // défaut
  }
  
  // Si ce nœud a une arête vers un service-cache
  const cacheTarget = findNeighbor(node, edges, 'service-cache');
  if (cacheTarget) {
    suggestions.caching = 'Lecture (GET)'; // défaut
  }
  
  return suggestions;
}
```

**Stratégies d'inférence** :
- **Voisinage direct** (1 arête) : défauts évidents (ex: si connecté à DB → utilise DB)
- **Voisinage étendu** (2-3 arêtes) : défauts moins certains (marquer comme "suggestion", pas défaut)
- **Patterns nommés** (ex: "CRUD classique") : charger un template de défauts

### 3.5 Inventaire des 17 catégories actuelles

Cible : enrichir chacune de 3-6 champs à 6-12 champs. Voici le plan détaillé :

| Catégorie | Actuel (3-6 champs) | Cible (6-12 champs) | Champs à ajouter |
|-----------|---------------------|----------------------|------------------|
| `process` | 3 (inputs, outputs, steps) | 8 (+5) | owner, frequency, trigger, estimatedDuration, dependencies |
| `decision` | 3 | 7 (+4) | stakeholders, decisionDate, reversibility, outcome |
| `service` | 6 | 12 (+6) | version, rateLimit, errorHandling, monitoring, dependencies, docsUrl |
| `devops` | 4 | 9 (+5) | environment, secrets, notifications, approvers, runbookUrl |
| `arch` | 5 | 8 (+3) | status, decidedBy, decidedAt, relatedDecisions |
| `sec` | 4 | 9 (+5) | cwe, cve, exploitAvailable, detectionMethod, responsePlan |
| `data` | 5 | 10 (+5) | schemaVersion, pii, retention, owner, quality, sla |
| `proj` | 5 | 10 (+5) | priority, labels, parentTask, sprint, storyPoints |
| `test` | 4 | 8 (+4) | environment, ciIntegration, flaky, lastRun |
| `uiux` | 4 | 8 (+4) | designTool, figmaUrl, darkMode, i18n |
| `pattern` | 4 | 6 (+2) | language, framework, exampleUrl |
| `env` | 3 | 6 (+3) | rotation, scope, source |
| `component` | 4 | 9 (+5) | framework, tests, storybook, a11y, bundleSize |
| `git` | 4 | 6 (+2) | baseBranch, reviewers, ciRequired |
| `msg` | 4 | 7 (+3) | ordering, persistence, schemaRegistry |
| `init` | 4 | 6 (+2) | nodeVersion, packageManager, scripts |
| `dep` | 4 | 7 (+3) | source, installedVersion, vulnerabilities |

**Total cible** : ~17 × 9 = **~150 champs structurés** (vs ~65 aujourd'hui).

### 3.6 Nouvelles catégories à créer (proposées)

| Nouvelle catégorie | Justification | Types concernés |
|--------------------|---------------|-----------------|
| `monitoring` | Observabilité = critique pour les agents | monitoring-metrics/logs/traces/alerting/dashboard/slo |
| `compliance` | Réglementation (RGPD, HIPAA, SOC2) | compliance-rgpd/hipaa/soc2/iso27001/audit |
| `localization` | i18n / l10n | l10n-translation/locale/format/currency |
| `mobile` | Spécificités mobile (iOS/Android) | mobile-ios/android/reactnative/permission/biometric |
| `api-versioning` | Stratégie de versioning API | api-version-deprecation/sunset/breaking-change |
| `feature-flag` | Feature flags | flag-toggle/rollout/segment/target |

**Note** : ces ajouts seront validés via les **scénarios** (section 6) avant d'être implémentés.

---

### 3.7 Exemple concret : nœud `service-api` enrichi (20 champs remplis)

Pour rendre concret tout ce qui précède, voici un **nœud `service-api` complètement rempli** avec 20 champs (3 identification + 13 métier + 4 méta). C'est délibérément au-dessus de la cible 6-12 pour illustrer le **nœud idéal "riche"** que l'agent préfère lire. C'est ce que l'agent IA verra dans le `sidecar JSON` et ce que l'utilisateur verra dans le `Markdown`.

#### Fichier `nodes/n1-user-auth.json` (sidecar — consommé par l'agent)

```json
{
  "id": "n1",
  "type": "service-api",
  "label": "User Auth",
  "description": "Service d'authentification des utilisateurs via OAuth2 (Google + GitHub). Gère le login, le refresh token et la révocation.",
  "priority": "high",
  "properties": {
    "version": "v1.2.3",
    "owner": "@alice",
    "externalRef": "https://wiki.example.com/services/user-auth",
    "endpoint": "/api/v1/auth",
    "method": "POST",
    "auth": "OAuth2",
    "clientId": "${OAUTH_GOOGLE_CLIENT_ID}",
    "clientSecret": "${OAUTH_GOOGLE_CLIENT_SECRET}",
    "authUrl": "https://accounts.google.com/o/oauth2/v2/auth",
    "tokenUrl": "https://oauth2.googleapis.com/token",
    "scopes": "openid, profile, email",
    "rateLimit": "100 req/min per IP, 1000 req/hour per user",
    "sla": "99.9% uptime, < 200ms p95 latency",
    "errorHandling": "Circuit breaker + exponential backoff (1s, 2s, 4s, 8s, max 30s)",
    "monitoring": "Datadog APM + custom metrics (auth_success_rate, token_refresh_duration)",
    "dependencies": [
      "n2-user-db (PostgreSQL — stocke les refresh tokens)",
      "n3-email (SendGrid — envoie les mails de confirmation)",
      "service-cache (Redis — cache des sessions OAuth)"
    ],
    "docsUrl": "https://wiki.example.com/services/user-auth",
    "deployment": "Kubernetes (3 replicas, HPA on CPU > 70%)",
    "lastReviewed": "2026-06-10"
  },
  "edges": [
    { "to": "n2", "relation": "reads-from", "label": "user credentials" },
    { "to": "n3", "relation": "triggers", "label": "send confirmation email" },
    { "to": "n-cache", "relation": "uses", "label": "cache sessions" }
  ],
  "metadata": {
    "createdAt": "2026-06-01T10:00:00Z",
    "updatedAt": "2026-06-12T15:30:00Z",
    "version": 3,
    "lastReviewedBy": "@bob",
    "tags": ["auth", "oauth2", "critical-path", "p0-incident"]
  }
}
```

#### Fichier `nodes/n1-user-auth.md` (humain + agent en lecture)

```markdown
# User Auth

> Service API · ID: n1 · Type: service-api · Priorité: HIGH
> Owner: @alice · Version: v1.2.3
> Dernière revue: 2026-06-10 par @bob

---

## Description

Service d'authentification des utilisateurs via OAuth2 (Google + GitHub). Gère le login, le refresh token et la révocation.

## Propriétés (20 champs)

### Identification
| Champ | Valeur |
|-------|--------|
| **Version** | v1.2.3 |
| **Owner** | @alice |
| **Référence externe** | [wiki/user-auth](https://wiki.example.com/services/user-auth) |

### Configuration métier
| Champ | Valeur |
|-------|--------|
| **Endpoint** | `POST /api/v1/auth` |
| **Authentification** | OAuth2 |
| **Client ID** | `${OAUTH_GOOGLE_CLIENT_ID}` (var d'env) |
| **Client Secret** | `${OAUTH_GOOGLE_CLIENT_SECRET}` (var d'env) |
| **Auth URL** | https://accounts.google.com/o/oauth2/v2/auth |
| **Token URL** | https://oauth2.googleapis.com/token |
| **Scopes** | openid, profile, email |
| **Rate Limit** | 100 req/min per IP, 1000 req/hour per user |
| **SLA** | 99.9% uptime, < 200ms p95 latency |
| **Error Handling** | Circuit breaker + exponential backoff (1s, 2s, 4s, 8s, max 30s) |
| **Monitoring** | Datadog APM + custom metrics (auth_success_rate, token_refresh_duration) |

### Méta
| Champ | Valeur |
|-------|--------|
| **Dependencies** | n2-user-db, n3-email, service-cache |
| **Docs URL** | [wiki/user-auth](https://wiki.example.com/services/user-auth) |
| **Deployment** | Kubernetes (3 replicas, HPA on CPU > 70%) |
| **Last Reviewed** | 2026-06-10 |

## Connexions

- → **[n2 — User DB](n2-user-db.md)** : lit les credentials (PostgreSQL)
- → **[n3 — Email Service](n3-email.md)** : déclenche l'envoi du mail de confirmation
- → **[n-cache — Cache Service](n-cache.md)** : utilise le cache pour les sessions OAuth

## Notes

- ⚠️ **Migration OAuth2 → OAuth2.1 prévue Q3 2026** — suivre l'issue #234
- 💡 Les client secrets sont **JAMAIS** commités — toujours via var d'env
- 📊 Le monitoring a 2 alertes critiques : `auth_success_rate < 95%` (P2) et `token_refresh_duration > 1s` (P3)
- 🏷️ Tags : `auth`, `oauth2`, `critical-path`, `p0-incident`
```

#### Décomposition : où chaque champ a été défini dans le schéma

| Champ rempli | Défini dans | Section du spec |
|--------------|-------------|-----------------|
| `version`, `owner`, `externalRef` | § 3.1 (identification) | Objectif O1 |
| `endpoint`, `method`, `auth` | § 3.5 (catégorie `service` — 12 champs) | Tableau 3.5 |
| `clientId`, `clientSecret`, `authUrl`, `tokenUrl`, `scopes` | § 3.3 (conditional_required pour OAuth2) | Scénario 1 |
| `rateLimit`, `sla`, `errorHandling`, `monitoring` | § 3.5 (champs ajoutés à `service`) | Tableau 3.5 |
| `dependencies` | § 3.4 (défauts intelligents depuis le graphe) | Section 3.4 |
| `docsUrl`, `deployment`, `lastReviewed` | § 3.1 (méta) | Objectif O1 |

#### Validation automatique appliquée à ce nœud

```yaml
# Quand l'utilisateur sauvegarde n1-user-auth :
validation:
  - check: 'auth == "OAuth2"'
    then: 'clientId, clientSecret, authUrl, tokenUrl, scopes doivent être remplis'
    result: 'PASS'  # Tous les 5 champs sont remplis

  - check: 'sla est rempli'
    then: 'doit matcher le pattern "99.9%|< 200ms p95"'
    result: 'PASS'

  - check: 'dependencies est un array non-vide'
    then: 'au moins 1 dépendance requise pour un service-api'
    result: 'PASS'  # 3 dépendances

  - check: 'externalRef est une URL valide'
    then: 'doit commencer par https://'
    result: 'PASS'

  - check: 'lastReviewed <= today'
    then: 'la date de dernière revue ne doit pas être dans le futur'
    result: 'PASS'  # lastReviewed = date dans le passé (≤ today)

status: 'VALID'  # Le nœud peut être exporté
```

#### Génération automatique (comment l'agent voit ce nœud)

Quand l'utilisateur demande à l'IA *"Implémente le service d'auth"*, l'agent reçoit **en contexte** :

```yaml
service: User Auth (n1)
type: service-api
priority: high
endpoint: POST /api/v1/auth
auth: OAuth2
client_id_env: OAUTH_GOOGLE_CLIENT_ID
client_secret_env: OAUTH_GOOGLE_CLIENT_SECRET
auth_url: https://accounts.google.com/o/oauth2/v2/auth
token_url: https://oauth2.googleapis.com/token
scopes: openid, profile, email
rate_limit: 100 req/min per IP
sla: 99.9% uptime, < 200ms p95
dependencies:
  - PostgreSQL (n2-user-db) — stocke refresh tokens
  - SendGrid (n3-email) — confirmation email
  - Redis (service-cache) — cache sessions
monitoring: Datadog APM
```

**L'agent a TOUT ce qu'il faut pour écrire le code** : endpoint, méthode, auth flow, secrets (via env), rate limit, SLA, dépendances. **Aucune question en suspens.**

C'est ça, la **documentation vivante** : un nœud bien rempli = une spec exécutable.

---


## 4. Documentation vivante (sortie)

### 4.1 Format hybride : **Markdown + sidecar JSON**

Chaque nœud exporté produit **2 fichiers** :

#### `nodes/n1-user-auth.md` (humain + agent en lecture)

```markdown
# User Auth

> Service API · ID: n1 · Type: service-api · Priorité: high

## Description
Service d'authentification des utilisateurs via OAuth2.

## Propriétés
| Champ | Valeur |
|-------|--------|
| Endpoint | `/api/v1/auth` |
| Méthode HTTP | POST |
| Authentification | OAuth2 |
| Version | v1.2.3 |
| Rate Limit | 100 req/min |
| SLA | 99.9%, <200ms p95 |

## Connexions
- → [User DB](n2-user-db.md) : lecture des credentials
- → [Email Service](n3-email.md) : envoi mail de confirmation

## Notes
- ⚠️ Migration OAuth2 → OAuth2.1 prévue Q3 2026
- TODOs : ajouter refresh token rotation
```

#### `nodes/n1-user-auth.json` (agent — parsable)

```json
{
  "id": "n1",
  "type": "service-api",
  "label": "User Auth",
  "description": "Service d'authentification...",
  "priority": "high",
  "properties": {
    "endpoint": "/api/v1/auth",
    "method": "POST",
    "auth": "OAuth2",
    "version": "v1.2.3",
    "rateLimit": "100 req/min",
    "sla": "99.9%, <200ms p95",
    "clientId": "${OAUTH_CLIENT_ID}",
    "clientSecret": "${OAUTH_CLIENT_SECRET}",
    "authUrl": "https://auth.example.com/oauth/authorize",
    "tokenUrl": "https://auth.example.com/oauth/token"
  },
  "edges": [
    { "to": "n2", "relation": "reads-from" },
    { "to": "n3", "relation": "triggers" }
  ],
  "metadata": {
    "createdAt": "2026-06-01T10:00:00Z",
    "updatedAt": "2026-06-12T15:30:00Z",
    "version": 3
  }
}
```

### 4.2 Structure de l'export ZIP

```
mon-projet-export/
├── README.md                      ← Synopsis + sommaire + stats
├── AGENTS.md                      ← Prompt système pour l'agent
├── index.json                     ← Catalogue de tous les nœuds
├── diagram.svg                    ← Le diagramme Mermaid
├── schema.json                    ← JSON Schema des propriétés
├── nodes/
│   ├── n1-user-auth.md
│   ├── n1-user-auth.json
│   ├── n2-user-db.md
│   ├── n2-user-db.json
│   └── ...
└── relations/
    ├── n1-n2.json
    └── ...
```

### 4.3 Régénération **live** (à chaque modification)

- Toute modification d'un nœud → regen de son `.md` + `.json` en < 500ms
- Pas de bouton "Régénérer" — c'est transparent
- Cache intelligent : si seul `updatedAt` change, on ne re-sérialise pas le contenu

---

## 5. Consommation multi-canal

### 5.1 Canal 1 : **Export ZIP** (archivage, livraison)

- Bouton "Exporter ZIP" dans le panneau export
- Téléchargement direct via `<a download>`
- Utilisation : archiver le projet, le passer à un agent externe

### 5.2 Canal 2 : **API HTTP** (live, agent-readable)

Le canvas expose une **API REST/JSON** pour permettre à un agent (ou un autre outil) de **lire** et **modifier** le canvas en live. L'API est la **source de vérité** — le ZIP et le prompt sont des **vues** dérivées.

> **Spec complète** : `/api/v1/openapi.yaml` est exposé par le serveur (self-documenting). Cette section est un **résumé** de la spec.

#### 5.2.1 Authentification

- **Méthode** : Bearer token (header `Authorization: Bearer <token>`)
- **Obtention** : token émis à la création du projet, stocké en `.env` (variable `CANVAS_API_TOKEN`)
- **Scopes** :
  - `canvas:read` — lecture seule (GET)
  - `canvas:write` — modification (POST/PATCH/DELETE sur `/api/v1/canvas/nodes|edges`)
  - `canvas:admin` — gestion de la collection (POST/PUT/DELETE sur `/api/v1/canvas/schema`)
- **Rotation** : via `POST /api/v1/auth/tokens/rotate` (l'ancien token expire dans 24h, le nouveau est retourné une fois)
- **Sécurité** :
  - JAMAIS transmis via query string (toujours header)
  - JAMAIS loggé côté serveur (masked dans les logs : `tk_abc...xyz`)
  - HTTPS obligatoire (rejet en HTTP clair en production, sauf `localhost` en dev)

#### 5.2.2 Versioning

- **Stratégie** : version dans l'URL (`/api/v1/...`)
- **Politique** :
  - **v1** = version stable actuelle
  - **Breaking changes** = nouvelle version majeure (`v2`)
  - **Deprecated endpoints** → header `Deprecation: true` + `Sunset: <date>` (RFC 8594)
  - **Support** : 12 mois après l'annonce de dépréciation
- **Header** : `X-API-Version` envoyé par le client (override l'URL) — utile pour tester
- **Négociation** : si absent dans l'URL, server répond avec la dernière version stable
- **Compatibilité descendante** : tout endpoint v1 reste accessible tant que la date de sunset n'est pas dépassée

#### 5.2.3 Rate limiting

- **Stratégie** : token bucket **par token** + par classe d'endpoint
- **Limites par défaut** (par token, par minute) :

| Endpoint class | Limite | Burst |
|----------------|--------|-------|
| `GET /v1/canvas` (index) | 60 | 10 |
| `GET /v1/canvas/nodes/*` | 300 | 50 |
| `POST / PATCH / DELETE` | 60 | 10 |
| `POST /v1/ai/*` (assist) | 10 | 2 |
| `GET /v1/canvas/export.zip` | 5 | 1 |
| `GET /v1/health` | unlimited | — |

- **Headers de réponse** (toujours présents) :
  - `X-RateLimit-Limit` : limite totale (fenêtre actuelle)
  - `X-RateLimit-Remaining` : requêtes restantes
  - `X-RateLimit-Reset` : timestamp de reset (epoch seconds)
- **Header sur 429** : `Retry-After: <seconds>`
- **Réponse 429** :

```json
{
  "error": "rate_limited",
  "message": "Too many requests. Try again in 42s.",
  "retryAfter": 42
}
```

#### 5.2.4 Endpoints

| Méthode | Path | Scope | Description |
|---------|------|-------|-------------|
| GET | `/api/v1/health` | none | Health check (200 si OK, 503 si degraded) |
| GET | `/api/v1/openapi.yaml` | none | Spec OpenAPI 3.1 (self-documenting) |
| GET | `/api/v1/canvas` | `canvas:read` | Index complet (nœuds + edges + métadata) |
| GET | `/api/v1/canvas/nodes` | `canvas:read` | Liste paginée + filtrable des nœuds |
| GET | `/api/v1/canvas/nodes/:id` | `canvas:read` | Détail d'un nœud |
| POST | `/api/v1/canvas/nodes` | `canvas:write` | Créer un nœud |
| PATCH | `/api/v1/canvas/nodes/:id` | `canvas:write` | Mettre à jour (partial, optimistic lock) |
| DELETE | `/api/v1/canvas/nodes/:id` | `canvas:write` | Supprimer (refuse si arêtes attachées → 409) |
| GET | `/api/v1/canvas/edges` | `canvas:read` | Liste des arêtes |
| POST | `/api/v1/canvas/edges` | `canvas:write` | Créer une arête |
| DELETE | `/api/v1/canvas/edges/:id` | `canvas:write` | Supprimer |
| GET | `/api/v1/canvas/schema` | `canvas:read` | JSON Schema de toutes les catégories |
| GET | `/api/v1/canvas/schema/:category` | `canvas:read` | Schéma d'une catégorie |
| GET | `/api/v1/canvas/export.zip` | `canvas:read` | Export ZIP complet |
| POST | `/api/v1/ai/suggest` | `canvas:write` | Demander à l'IA de suggérer du contenu |
| POST | `/api/v1/ai/validate` | `canvas:read` | Valider un nœud (champs requis contextuels) |
| POST | `/api/v1/auth/tokens/rotate` | `canvas:admin` | Rotation du token courant |

#### 5.2.5 Schemas de base

```typescript
// Réponse standardisée (enveloppe)
interface ApiResponse<T> {
  data: T;
  meta: {
    requestId: string;        // UUID pour tracer dans les logs
    timestamp: string;        // ISO 8601
    apiVersion: 'v1';
  };
}

// Erreur standardisée
interface ApiError {
  error: string;              // 'validation_error' | 'not_found' | 'unauthorized' | 'forbidden' | 'rate_limited' | 'conflict' | 'internal'
  message: string;            // Human-readable
  details?: {                 // Optionnel : erreurs par champ
    field: string;
    code: string;             // 'required' | 'pattern' | 'enum' | 'conditional_required'
    message: string;
    severity?: 'error' | 'warning';
  }[];
  requestId: string;
  retryAfter?: number;        // Pour 429
}

// Nœud
interface CanvasNode {
  id: string;                 // 'n1', 'n2'... (pattern: ^n[0-9]+$)
  type: string;               // 'service-api', 'proj-task'... (snake_case, 1-50 chars)
  label: string;              // 1-100 chars
  description?: string;       // 0-1000 chars
  priority: 'low' | 'medium' | 'high' | 'critical';
  properties: Record<string, unknown>;  // Validé contre /canvas/schema
  metadata: {
    createdAt: string;        // ISO 8601
    updatedAt: string;        // ISO 8601
    version: number;          // Incrémenté à chaque update
    tags?: string[];
  };
}

// Arête
interface CanvasEdge {
  id: string;                 // 'e1', 'e2'... (pattern: ^e[0-9]+$)
  from: string;               // node id
  to: string;                 // node id
  fromPort?: string;          // ex: 'hub-1' (pour les hubs)
  toPort?: string;
  label?: string;             // 0-100 chars
  relation?: 'reads-from' | 'triggers' | 'uses' | 'depends-on' | 'blocks' | 'relates-to';
}
```

#### 5.2.6 OpenAPI 3.1 spec (extrait)

La spec complète est exposée à `/api/v1/openapi.yaml`. Extrait ci-dessous :

```yaml
openapi: 3.1.0
info:
  title: Canvas API
  version: 1.0.0
  description: API REST/JSON pour lire et modifier le canvas (documentation vivante).
  contact:
    name: Canvas maintainers
    url: https://github.com/canvas-mermaid-generator

servers:
  - url: https://canvas.example.com
    description: Production
  - url: http://localhost:5173
    description: Dev local (Vite)

security:
  - bearerAuth: []

tags:
  - name: meta
    description: Health, OpenAPI, info
  - name: canvas
    description: Index complet (nœuds + edges)
  - name: nodes
    description: CRUD nœuds
  - name: edges
    description: CRUD arêtes
  - name: schema
    description: Schémas de propriétés
  - name: ai
    description: IA assistée
  - name: auth
    description: Authentification & rotation

paths:
  /api/v1/health:
    get:
      operationId: healthCheck
      summary: Health check
      tags: [meta]
      security: []
      responses:
        '200':
          description: OK
          content:
            application/json:
              schema:
                type: object
                properties:
                  status: { type: string, enum: [ok, degraded] }
                  version: { type: string }
                  uptime: { type: number }
                  checks:
                    type: object
                    properties:
                      database: { type: string, enum: [ok, down] }
                      cache: { type: string, enum: [ok, down] }
                      aiProviders: { type: string, enum: [ok, down] }

  /api/v1/canvas:
    get:
      operationId: getCanvas
      summary: Index complet (tous les nœuds + edges)
      tags: [canvas]
      security:
        - bearerAuth: [canvas:read]
      parameters:
        - $ref: '#/components/parameters/IfNoneMatch'
      responses:
        '200':
          description: OK
          headers:
            ETag: { schema: { type: string } }
            X-RateLimit-Limit: { schema: { type: integer } }
            X-RateLimit-Remaining: { schema: { type: integer } }
          content:
            application/json:
              schema:
                type: object
                required: [data, meta]
                properties:
                  data:
                    type: object
                    required: [nodes, edges, project]
                    properties:
                      nodes:
                        type: array
                        items: { $ref: '#/components/schemas/CanvasNode' }
                      edges:
                        type: array
                        items: { $ref: '#/components/schemas/CanvasEdge' }
                      project:
                        type: object
                        properties:
                          name: { type: string }
                          version: { type: string, pattern: '^\d+\.\d+\.\d+$' }
                  meta: { $ref: '#/components/schemas/Meta' }
        '304':
          description: Not Modified (ETag match)
        '401': { $ref: '#/components/responses/Unauthorized' }
        '429': { $ref: '#/components/responses/RateLimited' }

  /api/v1/canvas/nodes:
    get:
      operationId: listNodes
      summary: Liste paginée + filtrable des nœuds
      tags: [nodes]
      security:
        - bearerAuth: [canvas:read]
      parameters:
        - name: type
          in: query
          schema: { type: string }
          description: Filtrer par type (ex: 'service-api')
        - name: priority
          in: query
          schema:
            type: string
            enum: [low, medium, high, critical]
        - name: tag
          in: query
          schema: { type: string }
          description: Filtrer par tag (AND multi, OR si plusieurs fois)
        - name: limit
          in: query
          schema: { type: integer, default: 50, maximum: 200 }
        - name: cursor
          in: query
          schema: { type: string }
          description: Curseur de pagination
      responses:
        '200':
          description: OK
          content:
            application/json:
              schema:
                type: object
                properties:
                  data:
                    type: array
                    items: { $ref: '#/components/schemas/CanvasNode' }
                  pagination: { $ref: '#/components/schemas/Pagination' }
                  meta: { $ref: '#/components/schemas/Meta' }

    post:
      operationId: createNode
      summary: Créer un nœud
      tags: [nodes]
      security:
        - bearerAuth: [canvas:write]
      requestBody:
        required: true
        content:
          application/json:
            schema: { $ref: '#/components/schemas/NodeInput' }
      responses:
        '201':
          description: Created
          headers:
            Location:
              schema: { type: string, format: uri }
              description: URL du nœud créé (ex: /api/v1/canvas/nodes/n5)
          content:
            application/json:
              schema:
                type: object
                properties:
                  data: { $ref: '#/components/schemas/CanvasNode' }
                  meta: { $ref: '#/components/schemas/Meta' }
        '400': { $ref: '#/components/responses/ValidationError' }
        '401': { $ref: '#/components/responses/Unauthorized' }
        '422':
          description: Unprocessable Entity (champs requis contextuels non remplis)
          content:
            application/json:
              schema: { $ref: '#/components/schemas/ApiError' }

  /api/v1/canvas/nodes/{id}:
    parameters:
      - $ref: '#/components/parameters/NodeId'
    get:
      operationId: getNode
      summary: Détail d'un nœud
      tags: [nodes]
      security:
        - bearerAuth: [canvas:read]
      responses:
        '200':
          description: OK
          content:
            application/json:
              schema:
                type: object
                properties:
                  data: { $ref: '#/components/schemas/CanvasNode' }
                  meta: { $ref: '#/components/schemas/Meta' }
        '404': { $ref: '#/components/responses/NotFound' }

    patch:
      operationId: updateNode
      summary: Mettre à jour un nœud (partial, optimistic locking)
      tags: [nodes]
      security:
        - bearerAuth: [canvas:write]
      requestBody:
        required: true
        content:
          application/json:
            schema: { $ref: '#/components/schemas/NodePatch' }
      responses:
        '200':
          description: OK
          content:
            application/json:
              schema:
                type: object
                properties:
                  data: { $ref: '#/components/schemas/CanvasNode' }
                  meta: { $ref: '#/components/schemas/Meta' }
        '400': { $ref: '#/components/responses/ValidationError' }
        '404': { $ref: '#/components/responses/NotFound' }
        '409':
          description: Conflict (version mismatch via expectedVersion)
          content:
            application/json:
              schema: { $ref: '#/components/schemas/ApiError' }

    delete:
      operationId: deleteNode
      summary: Supprimer un nœud
      tags: [nodes]
      security:
        - bearerAuth: [canvas:write]
      responses:
        '204': { description: No Content }
        '404': { $ref: '#/components/responses/NotFound' }
        '409':
          description: Conflict (nœud a des arêtes attachées)
          content:
            application/json:
              schema: { $ref: '#/components/schemas/ApiError' }

  /api/v1/canvas/edges:
    get:
      operationId: listEdges
      summary: Liste des arêtes
      tags: [edges]
      security:
        - bearerAuth: [canvas:read]
      responses:
        '200':
          description: OK
          content:
            application/json:
              schema:
                type: object
                properties:
                  data:
                    type: array
                    items: { $ref: '#/components/schemas/CanvasEdge' }
                  meta: { $ref: '#/components/schemas/Meta' }
    post:
      operationId: createEdge
      summary: Créer une arête
      tags: [edges]
      security:
        - bearerAuth: [canvas:write]
      requestBody:
        required: true
        content:
          application/json:
            schema: { $ref: '#/components/schemas/EdgeInput' }
      responses:
        '201':
          description: Created
          content:
            application/json:
              schema:
                type: object
                properties:
                  data: { $ref: '#/components/schemas/CanvasEdge' }
                  meta: { $ref: '#/components/schemas/Meta' }

  /api/v1/canvas/schema:
    get:
      operationId: getSchema
      summary: JSON Schema de toutes les catégories (17 catégories)
      tags: [schema]
      security:
        - bearerAuth: [canvas:read]
      responses:
        '200':
          description: OK
          content:
            application/json:
              schema:
                type: object
                additionalProperties: { $ref: '#/components/schemas/PropertySchema' }

  /api/v1/canvas/schema/{category}:
    parameters:
      - name: category
        in: path
        required: true
        schema:
          type: string
          enum: [process, decision, service, devops, arch, sec, data, proj, test, uiux, pattern, env, component, git, msg, init, dep]
    get:
      operationId: getSchemaCategory
      summary: Schéma d'une catégorie
      tags: [schema]
      security:
        - bearerAuth: [canvas:read]
      responses:
        '200':
          description: OK
          content:
            application/json:
              schema: { $ref: '#/components/schemas/PropertySchema' }

  /api/v1/canvas/export.zip:
    get:
      operationId: exportZip
      summary: Export ZIP complet (équivalent du bouton export)
      tags: [canvas]
      security:
        - bearerAuth: [canvas:read]
      responses:
        '200':
          description: ZIP contenant nodes/, relations/, AGENTS.md, index.json, etc.
          content:
            application/zip:
              schema:
                type: string
                format: binary

  /api/v1/ai/suggest:
    post:
      operationId: aiSuggest
      summary: Demander à l'IA de suggérer du contenu pour un nœud
      tags: [ai]
      security:
        - bearerAuth: [canvas:write]
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              required: [nodeId, fields]
              properties:
                nodeId: { type: string, pattern: '^n[0-9]+$' }
                fields:
                  type: array
                  items: { type: string }
                  description: Liste des champs à proposer (ex: ['version', 'rateLimit'])
                context:
                  type: object
                  description: 'Contexte additionnel (description, edges voisines)'
      responses:
        '200':
          description: OK
          content:
            application/json:
              schema:
                type: object
                properties:
                  data:
                    type: object
                    additionalProperties:
                      type: object
                      properties:
                        value: { description: 'Valeur suggérée' }
                        confidence: { type: number, minimum: 0, maximum: 1 }
                        source: { type: string, enum: [graph-context, type-default, model-inference] }
                  meta: { $ref: '#/components/schemas/Meta' }

  /api/v1/ai/validate:
    post:
      operationId: aiValidate
      summary: Valider un nœud (champs requis contextuels + cohérence graphe)
      tags: [ai]
      security:
        - bearerAuth: [canvas:read]
      requestBody:
        required: true
        content:
          application/json:
            schema: { $ref: '#/components/schemas/CanvasNode' }
      responses:
        '200':
          description: OK
          content:
            application/json:
              schema:
                type: object
                properties:
                  data:
                    type: object
                    properties:
                      valid: { type: boolean }
                      errors:
                        type: array
                        items:
                          type: object
                          properties:
                            field: { type: string }
                            code: { type: string, enum: [required, pattern, enum, conditional_required, type_mismatch] }
                            message: { type: string }
                            severity: { type: string, enum: [error, warning] }
                  meta: { $ref: '#/components/schemas/Meta' }

  /api/v1/auth/tokens/rotate:
    post:
      operationId: rotateToken
      summary: Rotation du token courant (l ancien expire dans 24h)
      tags: [auth]
      security:
        - bearerAuth: [canvas:admin]
      responses:
        '200':
          description: OK
          content:
            application/json:
              schema:
                type: object
                properties:
                  data:
                    type: object
                    properties:
                      newToken: { type: string, description: 'NOUVEAU token (retourné UNE SEULE FOIS)' }
                      oldTokenExpiresAt: { type: string, format: date-time }
                  meta: { $ref: '#/components/schemas/Meta' }

components:
  securitySchemes:
    bearerAuth:
      type: http
      scheme: bearer
      bearerFormat: 'opaque-token'
      description: 'Token opaque émis à la création du projet. Stocké dans .env (CANVAS_API_TOKEN).'

  parameters:
    NodeId:
      name: id
      in: path
      required: true
      schema:
        type: string
        pattern: '^n[0-9]+$'
      description: 'ID du nœud (ex: n1, n42)'
    IfNoneMatch:
      name: If-None-Match
      in: header
      schema: { type: string }
      description: 'ETag pour conditional GET (304 si inchangé)'

  responses:
    Unauthorized:
      description: Token manquant ou invalide
      content:
        application/json:
          schema: { $ref: '#/components/schemas/ApiError' }
    NotFound:
      description: Ressource introuvable
      content:
        application/json:
          schema: { $ref: '#/components/schemas/ApiError' }
    ValidationError:
      description: Erreur de validation (schéma JSON)
      content:
        application/json:
          schema: { $ref: '#/components/schemas/ApiError' }
    RateLimited:
      description: Trop de requêtes
      headers:
        Retry-After: { schema: { type: integer } }
      content:
        application/json:
          schema: { $ref: '#/components/schemas/ApiError' }

  schemas:
    Meta:
      type: object
      required: [requestId, timestamp, apiVersion]
      properties:
        requestId: { type: string, format: uuid }
        timestamp: { type: string, format: date-time }
        apiVersion: { type: string, enum: ['v1'] }
    ApiError:
      type: object
      required: [error, message, requestId]
      properties:
        error:
          type: string
          enum: [validation_error, not_found, unauthorized, forbidden, rate_limited, conflict, unprocessable_entity, internal]
        message: { type: string }
        details:
          type: array
          items:
            type: object
            properties:
              field: { type: string }
              code: { type: string }
              message: { type: string }
              severity: { type: string, enum: [error, warning] }
        requestId: { type: string, format: uuid }
        retryAfter: { type: integer }
    Pagination:
      type: object
      properties:
        nextCursor: { type: string, nullable: true }
        hasMore: { type: boolean }
        total: { type: integer }
    CanvasNode:
      type: object
      required: [id, type, label, priority, properties, metadata]
      properties:
        id: { type: string, pattern: '^n[0-9]+$' }
        type: { type: string, pattern: '^[a-z][a-z0-9-]{1,49}$' }
        label: { type: string, minLength: 1, maxLength: 100 }
        description: { type: string, maxLength: 1000 }
        priority:
          type: string
          enum: [low, medium, high, critical]
        properties:
          type: object
          additionalProperties: true
        metadata:
          type: object
          required: [createdAt, updatedAt, version]
          properties:
            createdAt: { type: string, format: date-time }
            updatedAt: { type: string, format: date-time }
            version: { type: integer, minimum: 1 }
            tags:
              type: array
              items: { type: string }
    NodeInput:
      type: object
      required: [type, label, properties]
      properties:
        type: { type: string }
        label: { type: string, minLength: 1, maxLength: 100 }
        description: { type: string }
        priority:
          type: string
          enum: [low, medium, high, critical]
          default: medium
        properties: { type: object }
    NodePatch:
      type: object
      properties:
        label: { type: string }
        description: { type: string }
        priority: { type: string }
        properties: { type: object }
        tags:
          type: array
          items: { type: string }
        expectedVersion:
          type: integer
          description: 'Pour optimistic locking (renvoie 409 si mismatch)'
    CanvasEdge:
      type: object
      required: [id, from, to]
      properties:
        id: { type: string, pattern: '^e[0-9]+$' }
        from: { type: string }
        to: { type: string }
        fromPort: { type: string }
        toPort: { type: string }
        label: { type: string, maxLength: 100 }
        relation:
          type: string
          enum: [reads-from, triggers, uses, depends-on, blocks, relates-to]
    EdgeInput:
      type: object
      required: [from, to]
      properties:
        from: { type: string }
        to: { type: string }
        fromPort: { type: string }
        toPort: { type: string }
        label: { type: string, maxLength: 100 }
        relation:
          type: string
          enum: [reads-from, triggers, uses, depends-on, blocks, relates-to]
    PropertySchema:
      type: object
      description: 'JSON Schema par catégorie (17 catégories, 6-12 champs chacune, cf §3.5)'
      properties:
        category: { type: string }
        fields:
          type: array
          items:
            type: object
            properties:
              key: { type: string }
              type: { type: string, enum: [text, textarea, select, multi-select, date, url, password, number, boolean] }
              label: { type: string }
              required: { type: boolean }
              default: {}
              options:
                type: array
                items: { type: string }
              conditional_required:
                type: array
                items:
                  type: object
              aiAssistable: { type: boolean }
    Pagination:
      type: object
      description: 'Curseur de pagination (utilisé par /nodes?cursor=...)'
      properties:
        nextCursor:
          type: string
          nullable: true
          description: 'Curseur pour la page suivante (null si dernière page)'
        hasMore:
          type: boolean
          description: 'True si d autres pages existent'
        total:
          type: integer
          description: 'Nombre total de résultats (approximatif si > 1000)'
```

#### 5.2.7 Exemples curl (10 endpoints)

**Variable d'env** (à mettre dans `.env`) :
```bash
export CANVAS_API_TOKEN="tk_abc123def456..."
export CANVAS_BASE_URL="https://canvas.example.com"
```

**1. Health check (pas d'auth)**
```bash
curl -X GET "$CANVAS_BASE_URL/api/v1/health"
```
Réponse :
```json
{
  "status": "ok",
  "version": "1.0.0",
  "uptime": 12345,
  "checks": { "database": "ok", "cache": "ok", "aiProviders": "ok" }
}
```

**2. GET index complet (avec ETag pour conditional)**
```bash
curl -X GET "$CANVAS_BASE_URL/api/v1/canvas"   -H "Authorization: Bearer $CANVAS_API_TOKEN"   -H "Accept: application/json"   -D headers.txt
# Sauvegarder l'ETag pour les requêtes suivantes
ETAG=$(grep -i '^etag:' headers.txt | cut -d' ' -f2 | tr -d '
')
echo "ETag: $ETAG"
```
Réponse :
```json
{
  "data": {
    "nodes": [
      { "id": "n1", "type": "service-api", "label": "User Auth", "...": "..." },
      { "id": "n2", "type": "service-database", "label": "User DB", "...": "..." }
    ],
    "edges": [
      { "id": "e1", "from": "n1", "to": "n2", "relation": "reads-from" }
    ],
    "project": { "name": "MyApp", "version": "0.1.0" }
  },
  "meta": { "requestId": "uuid-...", "timestamp": "2026-06-13T12:00:00Z", "apiVersion": "v1" }
}
```

**3. GET nœud spécifique**
```bash
curl -X GET "$CANVAS_BASE_URL/api/v1/canvas/nodes/n1"   -H "Authorization: Bearer $CANVAS_API_TOKEN"
```

**4. POST créer un nœud**
```bash
curl -X POST "$CANVAS_BASE_URL/api/v1/canvas/nodes"   -H "Authorization: Bearer $CANVAS_API_TOKEN"   -H "Content-Type: application/json"   -d '{
    "type": "service-api",
    "label": "Payment Service",
    "description": "Service de paiement Stripe avec haute criticité",
    "priority": "high",
    "properties": {
      "version": "v1.0.0",
      "endpoint": "/api/v1/payments",
      "method": "POST",
      "auth": "API Key"
    }
  }'
```
Réponse 201 (avec header `Location: /api/v1/canvas/nodes/n5`) :
```json
{
  "data": {
    "id": "n5",
    "type": "service-api",
    "label": "Payment Service",
    "priority": "high",
    "properties": { "...": "..." },
    "metadata": { "version": 1, "createdAt": "2026-06-13T12:00:00Z", "updatedAt": "2026-06-13T12:00:00Z" }
  },
  "meta": { "...": "..." }
}
```

**5. PATCH update partiel (avec optimistic locking)**
```bash
# D'abord lire la version courante
CURRENT_VERSION=$(curl -s -X GET "$CANVAS_BASE_URL/api/v1/canvas/nodes/n5"   -H "Authorization: Bearer $CANVAS_API_TOKEN" | jq -r '.data.metadata.version')

# Puis patcher avec expectedVersion
curl -X PATCH "$CANVAS_BASE_URL/api/v1/canvas/nodes/n5"   -H "Authorization: Bearer $CANVAS_API_TOKEN"   -H "Content-Type: application/json"   -d "{
    "properties": { "rateLimit": "100 req/min" },
    "expectedVersion": $CURRENT_VERSION
  }"
```

**6. POST IA suggest (champs à proposer)**
```bash
curl -X POST "$CANVAS_BASE_URL/api/v1/ai/suggest"   -H "Authorization: Bearer $CANVAS_API_TOKEN"   -H "Content-Type: application/json"   -d '{
    "nodeId": "n5",
    "fields": ["version", "rateLimit", "sla", "monitoring"],
    "context": {
      "description": "Service de paiement Stripe avec haute criticité",
      "edges": ["n6-postgres", "n7-stripe-api"]
    }
  }'
```
Réponse :
```json
{
  "data": {
    "version": { "value": "v1.0.0", "confidence": 0.9, "source": "type-default" },
    "rateLimit": { "value": "100 req/min", "confidence": 0.7, "source": "model-inference" },
    "sla": { "value": "99.9% uptime, <300ms p95", "confidence": 0.85, "source": "model-inference" },
    "monitoring": { "value": "Datadog APM + alertes custom", "confidence": 0.6, "source": "model-inference" }
  },
  "meta": { "...": "..." }
}
```

**7. POST validate (avant export — détecte champs manquants)**
```bash
curl -X POST "$CANVAS_BASE_URL/api/v1/ai/validate"   -H "Authorization: Bearer $CANVAS_API_TOKEN"   -H "Content-Type: application/json"   -d '{
    "id": "n5",
    "type": "service-api",
    "label": "Payment Service",
    "priority": "high",
    "properties": { "version": "v1.0.0", "auth": "OAuth2" },
    "metadata": { "createdAt": "2026-06-13T12:00:00Z", "updatedAt": "2026-06-13T12:00:00Z", "version": 1 }
  }'
```
Réponse (avec `valid: false` car OAuth2 sans clientId/secret) :
```json
{
  "data": {
    "valid": false,
    "errors": [
      {
        "field": "clientId",
        "code": "conditional_required",
        "message": "OAuth2 nécessite 5 champs (cf §3.3 scénario 1)",
        "severity": "error"
      },
      {
        "field": "clientSecret",
        "code": "conditional_required",
        "message": "OAuth2 nécessite 5 champs (cf §3.3 scénario 1)",
        "severity": "error"
      }
    ]
  }
}
```

**8. GET export ZIP**
```bash
curl -X GET "$CANVAS_BASE_URL/api/v1/canvas/export.zip"   -H "Authorization: Bearer $CANVAS_API_TOKEN"   -o canvas-export.zip
# Vérifier la structure
unzip -l canvas-export.zip
```

**9. POST rotation du token**
```bash
# ⚠️ Sauvegarder le nouveau token IMMÉDIATEMENT (retourné une seule fois)
RESPONSE=$(curl -s -X POST "$CANVAS_BASE_URL/api/v1/auth/tokens/rotate"   -H "Authorization: Bearer $CANVAS_API_TOKEN")
NEW_TOKEN=$(echo "$RESPONSE" | jq -r '.data.newToken')
echo "$NEW_TOKEN" > .env.tmp

# Mettre à jour .env (multi-plateforme : Windows PowerShell, macOS, Linux)
mv .env.tmp .env
# Alternative Linux/macOS : sed -i.bak "s|^CANVAS_API_TOKEN=.*|CANVAS_API_TOKEN=$NEW_TOKEN|" .env && rm .env.bak
echo "Old token expires at: $(echo "$RESPONSE" | jq -r '.data.oldTokenExpiresAt')"
```

**10. GET OpenAPI spec (self-documenting)**
```bash
curl -X GET "$CANVAS_BASE_URL/api/v1/openapi.yaml"   -H "Authorization: Bearer $CANVAS_API_TOKEN"   -o openapi.yaml
# Valider la spec
npx swagger-cli validate openapi.yaml
# Générer un client TypeScript
npx openapi-typescript openapi.yaml --output src/types/canvas-api.ts
```

#### 5.2.8 Codes d'erreur

| Code | `error` | Description | Action |
|------|---------|-------------|--------|
| 400 | `validation_error` | Schéma JSON invalide | Corriger le payload |
| 401 | `unauthorized` | Token manquant/invalide | Vérifier `Authorization` |
| 403 | `forbidden` | Scope insuffisant | Utiliser un token admin |
| 404 | `not_found` | Ressource introuvable | Vérifier l'ID |
| 409 | `conflict` | Version mismatch (optimistic lock) ou arête attachée | Re-fetch + retry |
| 422 | `unprocessable_entity` | Champs requis contextuels non remplis | Compléter les champs |
| 429 | `rate_limited` | Trop de requêtes | Attendre `Retry-After` |
| 500 | `internal` | Erreur serveur | Réessayer + reporter |
| 503 | `service_unavailable` | Dépendance down (DB, cache, IA) | Réessayer + vérifier `/health` |

#### 5.2.9 Idempotence

- **GET** : idempotent (par définition)
- **POST** : NON idempotent par défaut → utiliser le header `Idempotency-Key: <uuid>` pour permettre le retry sécurisé
- **PATCH** : idempotent (le même patch appliqué 2x donne le même résultat)
- **DELETE** : idempotent (supprimer 2x = 404 la 2e fois, pas d'erreur critique)

**Idempotency-Key** : le server stocke la réponse 24h. Si une 2e requête arrive avec la même clé, la réponse stockée est renvoyée (pas de duplication).

#### 5.2.10 Sécurité

- **CORS** : `Access-Control-Allow-Origin: <whitelist>` (jamais `*` en production)
- **CSRF** : N/A (Bearer token, pas de cookies)
- **CSP** : headers stricts (`script-src 'self'`, pas d'`unsafe-inline`)
- **Audit log** : toutes les mutations loggées avec `requestId`, `userId`, `diff`
- **Secrets** : JAMAIS dans les réponses API (passwords, tokens, secrets → masqués `****`)
- **HTTPS** : obligatoire, HSTS activé, TLS 1.3+ uniquement
- **Input validation** : tous les payloads validés via JSON Schema AVANT traitement

---

### 5.3 Canal 3 : **Injection dans le prompt** (chat)

- Bouton "Copier dans le prompt" injecte le contexte dans le system prompt de Mina
- L'agent conversationnel (Mina) a alors accès au canvas comme contexte
- Utilisation : discussions itératives avec l'IA

### 5.4 Canal 4 : **Webhooks** (PUSH notifications, agent-proactif)

L'API REST (§5.2) est **pull** : l'agent doit interroger. Les **webhooks** sont **push** : le canvas notifie l'agent quand un événement se produit. Idéal pour les agents qui veulent **réagir en temps réel** aux modifications du canvas (auto-validation, sync CI/CD, déclenchement de builds, alertes).

#### 5.4.1 Concept

```
Canvas (server)                    Agent externe (subscriber)
     │                                      │
     │  1. POST /v1/webhooks (register)      │
     │ ─────────────────────────────────────>│
     │                                      │
     │  2. 201 Created + webhook_id          │
     │ <─────────────────────────────────────│
     │                                      │
     │  3. User crée un nœud dans l'UI      │
     │     (event interne: node.created)     │
     │                                      │
     │  4. POST <subscriber_url>             │
     │     Headers: X-Canvas-Signature, ...  │
     │     Body: { type: 'node.created', ... }│
     │ ─────────────────────────────────────>│
     │                                      │
     │  5. 200 OK (dans les 5s)              │
     │ <─────────────────────────────────────│
     │                                      │
     │  Si 5. ≠ 2xx, retry exponentiel       │
     │  (cf §5.4.7)                          │
```

**Différences avec l'API REST** :
- **REST (pull)** : l'agent demande → le canvas répond
- **Webhooks (push)** : le canvas notifie → l'agent reçoit et réagit

#### 5.4.2 Configuration (enregistrement d'un webhook)

**Endpoint** : `POST /api/v1/webhooks` (scope : `canvas:admin`)

**Request** :
```json
{
  "url": "https://my-agent.example.com/webhook-receiver",
  "events": ["node.created", "node.updated", "edge.added", "validation.failed"],
  "secret": "whsec_abc123def456...",  // Optionnel : généré par le serveur si omis
  "description": "CI/CD auto-deploy on auth service changes",
  "filters": {                         // Optionnel : ne recevoir que certains nœuds
    "nodeType": ["service-api", "devops-ci"],
    "priority": ["high", "critical"]
  },
  "active": true
}
```

**Response 201** :
```json
{
  "data": {
    "id": "wh_abc123",
    "url": "https://my-agent.example.com/webhook-receiver",
    "events": ["node.created", "node.updated", "edge.added", "validation.failed"],
    "secret": "whsec_abc123def456...",  // ⚠️ Retourné UNE SEULE FOIS, à stocker
    "createdAt": "2026-06-13T12:00:00Z",
    "active": true
  }
}
```

**⚠️ Le `secret` est retourné uniquement à la création.** Pour le retrouver plus tard, il faut le **rotater** via `POST /api/v1/webhooks/{id}/rotate-secret`.

**Autres endpoints de gestion** :
- `GET /api/v1/webhooks` — lister tous les webhooks du projet
- `GET /api/v1/webhooks/{id}` — détail
- `PATCH /api/v1/webhooks/{id}` — modifier (url, events, filters, active)
- `DELETE /api/v1/webhooks/{id}` — supprimer
- `POST /api/v1/webhooks/{id}/rotate-secret` — rotation du secret
- `GET /api/v1/webhooks/{id}/deliveries` — historique des livraisons (debug)
- `POST /api/v1/webhooks/{id}/test` — envoyer un event de test (`webhook.test`)

#### 5.4.3 Catalogue des event types

| Event | Trigger | Payload key | Catégorie |
|-------|---------|-------------|-----------|
| `node.created` | Un nœud est créé (UI ou API) | `data.node` | nodes |
| `node.updated` | Un nœud est modifié (PATCH) | `data.node` + `data.changes` | nodes |
| `node.deleted` | Un nœud est supprimé | `data.nodeId` | nodes |
| `edge.added` | Une arête est créée | `data.edge` | edges |
| `edge.deleted` | Une arête est supprimée | `data.edgeId` | edges |
| `canvas.snapshot.exported` | Export ZIP généré | `data.exportUrl` + `data.sizeBytes` | canvas |
| `ai.suggest.completed` | Suggestion IA terminée | `data.suggestions` | ai |
| `ai.validate.completed` | Validation asynchrone terminée | `data.report` | ai |
| `validation.failed` | Au moins un champ requis contextuel non rempli | `data.errors[]` | validation |
| `webhook.test` | Test manuel via `POST /webhooks/{id}/test` | `data.message` | meta |
| `webhook.disabled` | Auto-désactivation après N échecs consécutifs | `data.reason` | meta |

**Wildcard** : un subscriber peut s'abonner à `*` pour recevoir **tous** les events (utile pour les agents de monitoring/audit).

#### 5.4.4 Payload schema (enveloppe commune)

Tous les events suivent la même enveloppe :

```typescript
interface WebhookEvent<T = unknown> {
  id: string;              // 'evt_abc123' — unique, pour idempotence
  type: string;            // 'node.created' | 'node.updated' | ... (cf §5.4.3)
  createdAt: string;       // ISO 8601
  apiVersion: 'v1';
  data: T;                 // Spécifique à chaque event (cf §5.4.5)
  meta: {
    projectId: string;
    userId?: string;       // Si l'event a été déclenché par un user (UI) ou 'system' (auto)
    requestId?: string;    // Si l'event est issu d'une requête API
  };
}
```

#### 5.4.5 Payload schemas par event

**`node.created`** :
```json
{
  "id": "evt_abc123",
  "type": "node.created",
  "createdAt": "2026-06-13T12:00:00Z",
  "apiVersion": "v1",
  "data": {
    "node": {
      "id": "n5",
      "type": "service-api",
      "label": "Payment Service",
      "priority": "high",
      "properties": { "...": "..." },
      "metadata": { "version": 1, "createdAt": "...", "updatedAt": "..." }
    }
  },
  "meta": { "projectId": "proj_xyz", "userId": "user_alice" }
}
```

**`node.updated`** (avec diff) :
```json
{
  "id": "evt_def456",
  "type": "node.updated",
  "createdAt": "2026-06-13T12:05:00Z",
  "apiVersion": "v1",
  "data": {
    "node": { "...": "n5 complet (post-update)" },
    "changes": {
      "before": { "rateLimit": null, "version": 1 },
      "after":  { "rateLimit": "100 req/min", "version": 2 },
      "fields": ["rateLimit"]   // Liste des champs modifiés
    }
  },
  "meta": { "projectId": "proj_xyz", "userId": "user_bob", "requestId": "req_..." }
}
```

**`node.deleted`** :
```json
{
  "id": "evt_ghi789",
  "type": "node.deleted",
  "createdAt": "2026-06-13T12:10:00Z",
  "apiVersion": "v1",
  "data": {
    "nodeId": "n5",
    "type": "service-api",
    "label": "Payment Service"
  },
  "meta": { "projectId": "proj_xyz" }
}
```

**`edge.added` / `edge.deleted`** : similaire, avec `data.edge` (complet) ou `data.edgeId`.

**`validation.failed`** :
```json
{
  "id": "evt_jkl012",
  "type": "validation.failed",
  "createdAt": "2026-06-13T12:15:00Z",
  "apiVersion": "v1",
  "data": {
    "nodeId": "n5",
    "errors": [
      { "field": "clientId", "code": "conditional_required", "message": "OAuth2 nécessite clientId", "severity": "error" },
      { "field": "clientSecret", "code": "conditional_required", "message": "OAuth2 nécessite clientSecret", "severity": "error" }
    ],
    "blocking": true   // Si true, l'export est bloqué
  },
  "meta": { "projectId": "proj_xyz" }
}
```

#### 5.4.6 Headers de la requête webhook

Quand le canvas envoie un event au subscriber, la requête HTTP contient :

| Header | Valeur | Obligatoire |
|--------|--------|-------------|
| `Content-Type` | `application/json` | oui |
| `User-Agent` | `Canvas-Webhooks/1.0` | oui |
| `X-Canvas-Event-Id` | `evt_abc123` (idempotence) | oui |
| `X-Canvas-Event-Type` | `node.created` | oui |
| `X-Canvas-Signature` | `sha256=<hex>` (cf §5.4.7) | oui |
| `X-Canvas-Timestamp` | `1718280000` (epoch seconds, anti-replay) | oui |
| `X-Canvas-Delivery-Attempt` | `1` (1, 2, 3... jusqu'à 7) | oui |
| `X-Canvas-Project-Id` | `proj_xyz` | oui |
| `Retry-After` | (sur les retries, pas sur le 1er) | non |

#### 5.4.7 Signature verification (HMAC-SHA256)

**Objectif** : garantir que la requête vient bien du canvas (pas d'un attaquant).

**Algorithme** :
1. Le canvas construit le **string-to-sign** :
   ```
   {timestamp}.{body}
   ```
   où `timestamp` = valeur de `X-Canvas-Timestamp` (epoch seconds)
   et `body` = body JSON brut (string, pas re-sérialisé)

2. Le canvas calcule le **HMAC-SHA256** :
   ```
   signature = HMAC_SHA256(secret, string-to-sign)
   ```
   où `secret` = `whsec_...` retourné à la création du webhook

3. Le canvas envoie le header :
   ```
   X-Canvas-Signature: sha256=<hex(signature)>
   ```

**Vérification côté subscriber** (exemple Node.js) :

```javascript
import crypto from 'crypto';

function verifyWebhook(req, secret) {
  const signature = req.headers['x-canvas-signature'];
  const timestamp = req.headers['x-canvas-timestamp'];
  // ⚠️ req.body doit être un Buffer (utiliser express.raw() en middleware)
  // PAS req.body parsé (re-sérialisé change le contenu, le HMAC ne matchera plus)
  const body = req.body.toString('utf8');

  // 1. Vérifier que la signature est présente
  if (!signature || !signature.startsWith('sha256=')) {
    throw new Error('Missing or malformed signature');
  }

  // 2. Reconstruire le string-to-sign
  const stringToSign = `${timestamp}.${body}`;

  // 3. Calculer le HMAC
  const expected = 'sha256=' + crypto
    .createHmac('sha256', secret)
    .update(stringToSign)
    .digest('hex');

  // 4. Comparaison constant-time (anti timing attack)
  const sigBuffer = Buffer.from(signature);
  const expBuffer = Buffer.from(expected);
  if (sigBuffer.length !== expBuffer.length || !crypto.timingSafeEqual(sigBuffer, expBuffer)) {
    throw new Error('Invalid signature');
  }

  // 5. Vérifier le timestamp (anti replay attack)
  const now = Math.floor(Date.now() / 1000);
  const ts = parseInt(timestamp, 10);
  if (Math.abs(now - ts) > 300) {  // Tolérance : 5 minutes
    throw new Error('Timestamp too old or too far in future');
  }

  return true;
}

// Dans Express :
app.post('/webhook-receiver', express.raw({ type: 'application/json' }), (req, res) => {
  try {
    verifyWebhook(req, 'whsec_abc123...');
    // ⚠️ req.body est un Buffer (car express.raw() est utilisé)
    const event = JSON.parse(req.body.toString('utf8'));
    // Traiter l'event...
    res.status(200).send('OK');
  } catch (err) {
    res.status(401).send(err.message);
  }
});
```

**Pourquoi le timestamp est signé** : empêche un attaquant de rejouer une vieille requête capturée.

**Pourquoi `rawBody` est critique** : `req.body` est parsé et re-sérialisé par Express, ce qui change l'ordre des clés / les espaces. Le HMAC ne matcherait plus. Toujours utiliser le **raw body** (via `express.raw()` ou `body-parser` avec `verify` callback).

#### 5.4.8 Retry policy

Quand le subscriber répond **non-2xx** (timeout, 5xx, 4xx non-401), le canvas **retry** avec **backoff exponentiel** :

| Tentative | Délai après le précédent | Délai total écoulé | Header `X-Canvas-Delivery-Attempt` |
|-----------|--------------------------|---------------------|-------------------------------------|
| 1 (initial) | 0s | 0s | 1 |
| 2 | 1s | 1s | 2 |
| 3 | 5s | 6s | 3 |
| 4 | 30s | 36s | 4 |
| 5 | 2 min | 2 min 36s | 5 |
| 6 | 10 min | 12 min 36s | 6 |
| 7 | 1h | 1h 12 min 36s | 7 |
| **DONNER UP** | — | — | — |

> **Note** : Si la réponse est `429 Too Many Requests` avec un header `Retry-After`, ce délai PREND LE PAS sur le backoff exponentiel standard (on respecte la demande du subscriber). Si pas de `Retry-After`, on applique le backoff standard ci-dessus.

**Règles** :
- **Codes succès** : `200`, `201`, `202`, `204` → marqué comme delivered, pas de retry
- **Auth failures** : `401`, `403` → **PAS de retry** (le secret est mauvais, retry ne changera rien) → marqué comme `failed_permanent`
- **Autres 4xx** : `400`, `404`, `422` → **PAS de retry** (la requête est malformée, retry ne changera rien) → marqué comme `failed_permanent`
- **Rate limited** : `429` → **RETRY** (le subscriber est saturé, attendre soulage) — respecter le header `Retry-After` du subscriber s'il est présent, sinon backoff exponentiel standard
- **5xx, timeouts, network errors** : `500`, `502`, `503`, `504`, `ECONNRESET`, `ETIMEDOUT` → **RETRY** avec backoff exponentiel
- **Max attempts** : 7 (1 initial + 6 retries), puis marqué `failed_giveup`

**Auto-désactivation** : après **10 échecs consécutifs** (sur 10 events différents OU 7 retries d'un même event), le webhook est **automatiquement désactivé** (`active: false`) et un event `webhook.disabled` est envoyé à tous les autres webhooks (pour notification). L'admin doit le réactiver manuellement via `PATCH /api/v1/webhooks/{id}` avec `active: true`.

**Stockage des deliveries** : chaque tentative (succès ou échec) est loggée dans `GET /api/v1/webhooks/{id}/deliveries` avec :
- `eventId`, `attemptNumber`, `statusCode`, `responseTime`, `errorMessage`, `timestamp`

**Rétention** : 30 jours pour debug.

#### 5.4.9 Idempotence

Le subscriber **DOIT** être idempotent : le canvas peut envoyer le même event plusieurs fois (retry après un 5xx où la requête a été reçue mais la réponse perdue).

**Recommandation** : stocker les `X-Canvas-Event-Id` déjà traités (en cache, Redis, ou DB) et ignorer les doublons.

```javascript
const processed = new Set();  // En production : Redis avec TTL 7 jours

app.post('/webhook-receiver', (req, res) => {
  const eventId = req.headers['x-canvas-event-id'];

  if (processed.has(eventId)) {
    // Déjà traité, on répond OK sans re-traiter
    return res.status(200).send('Already processed');
  }

  // Traiter l'event...
  processEvent(JSON.parse(body));  // body est déjà un string (extrait de req.body plus haut)

  processed.add(eventId);
  res.status(200).send('OK');
});
```

#### 5.4.10 Sécurité

- **HTTPS obligatoire** : `http://` est refusé (sauf `localhost` en dev)
- **HMAC-SHA256** : obligatoire (cf §5.4.7) — pas de plaintext
- **Timestamp window** : 5 min max (anti-replay)
- **Secret rotation** : `POST /webhooks/{id}/rotate-secret` (l'ancien reste valide 24h pour ne pas casser le subscriber pendant le déploiement)
- **IP allowlist** (optionnel) : `webhookConfig.allowedIps` pour restreindre les IP du canvas (utile si le subscriber est derrière un firewall)
- **mTLS** (optionnel, B2B) : support de certificats clients mutuels pour les intégrations à haute sécurité
- **Audit log** : tous les deliveries (succès/échec) sont loggés avec `eventId`, `subscriberUrl`, `statusCode`, `responseTime`
- **PII filtering** : si `properties` contient des PII (mails, tokens en clair), un hook `webhookConfig.redactFields` peut les filtrer avant envoi

#### 5.4.11 Exemple end-to-end (Node.js subscriber complet)

```javascript
// receiver.js
import express from 'express';
import crypto from 'crypto';
import { Redis } from 'ioredis';

const app = express();
const redis = new Redis(process.env.REDIS_URL);
const WEBHOOK_SECRET = process.env.CANVAS_WEBHOOK_SECRET;  // whsec_...

// ⚠️ raw body CRITIQUE pour la vérification HMAC
app.post('/webhook-receiver',
  express.raw({ type: 'application/json' }),
  async (req, res) => {
    const signature = req.headers['x-canvas-signature'];
    const timestamp = req.headers['x-canvas-timestamp'];
    const eventId = req.headers['x-canvas-event-id'];
    const eventType = req.headers['x-canvas-event-type'];
    const body = req.body.toString('utf8');

    // 1. Vérification HMAC
    const stringToSign = `${timestamp}.${body}`;
    const expected = 'sha256=' + crypto
      .createHmac('sha256', WEBHOOK_SECRET)
      .update(stringToSign)
      .digest('hex');

    if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) {
      console.error('Invalid signature', { eventId, eventType });
      return res.status(401).send('Invalid signature');
    }

    // 2. Anti-replay : vérifier le timestamp
    const age = Math.floor(Date.now() / 1000) - parseInt(timestamp, 10);
    if (age > 300) {
      console.error('Timestamp too old', { eventId, age });
      return res.status(401).send('Stale timestamp');
    }

    // 3. Idempotence : vérifier si l'event a déjà été traité
    const isNew = await redis.set(`webhook:${eventId}`, '1', 'EX', 604800, 'NX');
    if (isNew !== 'OK') {
      console.log('Already processed', { eventId });
      return res.status(200).send('Already processed');
    }

    // 4. Traiter l'event
    const event = JSON.parse(body);
    try {
      switch (event.type) {
        case 'node.created':
          await onNodeCreated(event.data.node);
          break;
        case 'node.updated':
          await onNodeUpdated(event.data.node, event.data.changes);
          break;
        case 'validation.failed':
          await onValidationFailed(event.data);
          break;
        default:
          console.log('Unhandled event type', event.type);
      }
      res.status(200).send('OK');
    } catch (err) {
      console.error('Processing failed', { eventId, error: err.message });
      // 5xx pour retry, 4xx pour échec permanent
      res.status(500).send('Processing error');
    }
  }
);

async function onNodeCreated(node) {
  console.log('Node created', { id: node.id, type: node.type, label: node.label });
  // Ex: déclencher un CI, notifier Slack, mettre à jour un dashboard...
  await fetch('https://ci.example.com/trigger', {
    method: 'POST',
    body: JSON.stringify({ canvasNodeId: node.id, type: node.type })
  });
}

async function onNodeUpdated(node, changes) {
  console.log('Node updated', { id: node.id, changes: changes.fields });
  // Ex: re-valider, mettre à jour la doc...
}

async function onValidationFailed(data) {
  console.log('Validation failed', { nodeId: data.nodeId, errors: data.errors });
  // Ex: notifier l'équipe via Slack
}

app.listen(3000, () => console.log('Webhook receiver listening on :3000'));
```

#### 5.4.12 Monitoring & debugging

**Côté canvas** :
- Dashboard UI : `Settings → Webhooks` liste tous les webhooks avec leur état (active/disabled), le taux de succès, le dernier delivery
- `GET /api/v1/webhooks/{id}/deliveries?since=24h` : historique détaillé (status code, response time, error message)
- Alerting : si un webhook a un taux d'échec > 20% sur 1h, notification email

**Côté subscriber** :
- Logger le `X-Canvas-Request-Id` pour tracer côté canvas
- Logger le body brut (signe, pas en clair) pour debug
- Health check : exposer `/webhook-receiver/health` qui répond 200

**Test local** : utiliser `ngrok` ou `cloudflared` pour exposer `localhost:3000` en HTTPS public, puis configurer le webhook avec l'URL ngrok.

```bash
# Lancer le subscriber
node receiver.js &

# Exposer en HTTPS public
ngrok http 3000
# → https://abc123.ngrok.io

# Configurer le webhook (via curl ou UI)
curl -X POST "$CANVAS_BASE_URL/api/v1/webhooks"   -H "Authorization: Bearer $CANVAS_API_TOKEN"   -H "Content-Type: application/json"   -d '{
    "url": "https://abc123.ngrok.io/webhook-receiver",
    "events": ["node.created", "node.updated"],
    "description": "Local dev test"
  }'

# Tester
curl -X POST "$CANVAS_BASE_URL/api/v1/webhooks/wh_abc123/test"   -H "Authorization: Bearer $CANVAS_API_TOKEN"
```

---

### 5.5 Matrice canal × usage

| Canal | Cas d'usage | Fréquence | Latence acceptable | Direction |
|-------|-------------|-----------|-------------------|-----------|
| ZIP | Livraison finale, archivage | 1×/projet | OK si lent | Pull (download) |
| API | Agent en live, monitoring | 10-100×/jour | < 1s | Pull (GET) |
| Prompt | Chat itératif | À chaque message | < 200ms | Push (injection contexte) |
| **Webhooks** | **Notifications temps réel, CI/CD auto-trigger** | **10-1000×/jour** | **< 5s delivery** | **Push (event-driven)** |

---

## 6. Workflow scénarios (méta-outil de découverte)

### 6.1 Concept clé

Les scénarios sont un **méta-outil de brainstorming** entre l'utilisateur et l'IA, **JAMAIS** livré avec le projet. Ils servent à découvrir les **nœuds manquants** dans la collection actuelle.

### 6.2 Dossier `scenarios/`

```
canevas-mermaid-generator/  ← repo du canvas
├── src/                     ← code du canvas
├── scenarios/               ← ⚠️ MÉTA-OUTIL, jamais livré
│   ├── vitrine-perso.md     ← scénario 1 : site vitrine
│   ├── saas-b2b.md          ← scénario 2 : SaaS B2B
│   └── marketplace.md       ← scénario 3 : marketplace
├── .gitignore               ← ignore scenarios/ ? ou pas ?
```

**Note** : `scenarios/` n'est PAS dans `.gitignore` car on veut garder l'historique des scénarios pour la traçabilité. Mais ces fichiers ne sont **jamais inclus** dans les exports du canvas.

### 6.3 Template de scénario

```markdown
# Scénario : [Nom du projet fictif]

## Contexte
[Description du projet en 2-3 phrases. Pas de jargon technique.]

## Parcours utilisateur
[Walkthrough pas-à-pas d'un user story.]

### Étape 1 : [Titre]
**Action** : [Ce que l'utilisateur fait]
**Système** : [Ce que le système fait en réponse]
**Termes clés** : [Mots qui pourraient devenir des nœuds]

### Étape 2 : ...

## Contraintes identifiées
- [Liste des contraintes techniques, business, UX]

## Besoins implicites
- [Liste des besoins non explicites mais nécessaires]

## Termes candidats pour la collection
- [Liste brute des termes qui pourraient devenir de nouveaux nœuds]
```

### 6.4 Processus de découverte (la boucle)

```
1. ÉCRITURE
   └─ User écrit 1+ scénario(s) dans scenarios/
   
2. ANALYSE
   └─ User lance : "analyse les scénarios du dossier scenarios/"
   └─ IA lit les 3 fichiers, extrait les termes importants

3. EXTRACTION
   └─ IA propose une liste de termes (ex: "workflow", "type", "feature-flag")
   └─ User valide/refuse chaque terme

4. CLASSIFICATION
   └─ Pour chaque terme validé :
       ├─ Existe dans la collection actuelle ? → enrichir ses propriétés
       └─ N'existe pas ? → créer un nouveau nœud

5. ENRICHISSEMENT
   └─ Pour chaque nouveau nœud :
       ├─ Définir la catégorie (préfixe)
       ├─ Définir les 6-12 propriétés
       ├─ Ajouter aux défauts intelligents
       └─ Ajouter à la palette (menuMermaidActionsLeft.js)

6. ITÉRATION
   └─ Reprendre à l'étape 1 avec un nouveau scénario
```

### 6.5 Exemple concret

**Scénario** : "Site vitrine pour présenter un projet perso"

**Termes extraits par l'IA** :
- `vitrine` → nœud `web-static-site` (nouveau)
- `présentation` → propriété du nœud `component-section` (à enrichir)
- `portfolio` → nœud `web-portfolio` (nouveau)
- `responsive` → déjà existant
- `SEO` → nœud `seo-meta` (nouveau)
- `analytics` → nœud `monitoring-analytics` (nouveau)

**Après traitement** : la palette passe de 153 à 158 nœuds.

### 6.6 Distinction explicite (à respecter)

| Aspect | Canvas (livré) | Scénarios (méta) |
|--------|---------------|------------------|
| Localisation | `data/`, `src/` | `scenarios/` |
| Git | Committé | Commit possible (historique) |
| Export | OUI | **JAMAIS** dans l'export |
| Utilisation | Production | Brainstorming |
| Audience | Agents qui codent | User + IA qui brainstorm |
| Cycle de vie | Long | Jetable ou historique |

---

## 7. IA assistée (remplissage automatique)

### 7.1 L'IA propose, l'user valide

Workflow :
1. User crée un nœud
2. UI affiche "L'IA peut proposer du contenu pour ce nœud — [Lancer]"
3. IA lit le contexte (description + arêtes voisines + collection)
4. IA propose des valeurs pour 80% des champs
5. User valide/refuse champ par champ
6. Champs validés → intégrés comme valeurs (pas "suggestion")

### 7.2 Stratégie de proposition

| Champ | Source IA |
|-------|-----------|
| `description` | L'IA génère à partir du label + type |
| `endpoint` | L'IA déduit des conventions REST du projet |
| `version` | L'IA regarde les versions des autres nœuds du même type |
| `owner` | L'IA demande (jamais inféré) |
| `dependencies` | L'IA regarde les arêtes du graphe |
| `sla` | L'IA propose selon le type (service API → 99.9%) |

### 7.3 Gating

- L'IA ne propose QUE si la confiance > 70%
- Sinon, le champ reste vide avec un hint "À remplir manuellement"
- L'user peut toujours overrider une suggestion

---

## 8. Architecture technique

### 8.1 Fichiers impactés

```
src/code-city/
├── propertySchemas.js              ← ENRICHIR (17 → 17+ catégories, 6-12 champs)
├── menuMermaidActionsLeft.js       ← Enrichir les 153 types
├── state.js                        ← properties déjà supporté
├── quartierCenter/
│   ├── centerAuxPanels.js          ← Refonte du panneau propriétés
│   └── ...
├── mermaid/
│   ├── docGenerator.js             ← Templates par catégorie
│   ├── zipExporter.js              ← Export ZIP hybride
│   ├── pipeline.js                 ← Pipeline d'export
│   └── build.js                    ← Mermaid (peu de changements)
├── ai/
│   ├── promptEngine.js             ← Regen live
│   └── ...
└── ...
scenarios/                          ← NOUVEAU dossier
├── vitrine-perso.md                ← NOUVEAU
├── saas-b2b.md                     ← NOUVEAU
└── marketplace.md                  ← NOUVEAU
.dev-plans/
└── nœuds-proprietes-spec.md        ← CE FICHIER
```

### 8.2 Schéma d'un champ enrichi

```js
{
  key: 'auth',
  type: 'select',
  label: 'Authentification',
  options: ['None', 'API Key', 'JWT', 'OAuth2', 'Basic'],
  required: false,  // Toujours optionnel, mais peut devenir requis contextuellement
  default: null,    // Pas de défaut universel
  smartDefault: {   // Défaut intelligent depuis le contexte
    fromEdges: [
      { type: 'service-api', label: 'has X-Service' },
    ],
    suggest: 'JWT',  // ou fonction (node, neighbors) => string
  },
  conditionalRequired: [
    {
      when: { field: 'auth', equals: 'OAuth2' },
      fields: ['clientId', 'clientSecret', 'authUrl', 'tokenUrl'],
      message: "L'authentification OAuth2 requiert ces 4 champs",
    },
  ],
  aiAssistable: true,  // L'IA peut proposer
  aiPrompt: "Déduis le type d'auth depuis la description et les conventions du projet",
  examples: ['API Key', 'JWT', 'OAuth2'],
  docsUrl: 'https://oauth.net/2/',  // Lien vers doc officielle
}
```

### 8.3 Nouveaux composants

| Composant | Rôle | Fichier |
|-----------|------|---------|
| `PropertiesEnricher` | Applique les défauts intelligents au nœud | `src/code-city/ai/propertiesEnricher.js` |
| `ConditionalValidator` | Vérifie les champs requis contextuels | `src/code-city/ai/conditionalValidator.js` |
| `ScenarioAnalyzer` | Lit les scénarios, propose des termes | `src/code-city/ai/scenarioAnalyzer.js` |
| `LiveDocRegenerator` | Regen Markdown + JSON à chaque modif | `src/code-city/mermaid/liveDocRegenerator.js` |
| `CanvasAPI` | Expose le canvas via HTTP | `src/code-city/api/canvasAPI.js` |
| `PromptInjector` | Injecte le canvas dans le prompt système | `src/code-city/ai/promptInjector.js` |

### 8.4 Backward compatibility

- `properties: {}` déjà supporté par `state.js` (Phase 0 du plan v1)
- `metadata[]` conservé (champs libres) — coexiste avec `properties{}`
- Anciens nœuds (sans `properties`) → migration automatique : `properties: {}`
- Round-trip save/load : déjà géré

---

## 9. Plan de mise en œuvre (par phases)

### Phase A : Enrichissement des schémas (MVP)

**Objectif** : 6-12 champs par type, sans IA ni scénarios.

| # | Tâche | Fichiers | Effort |
|---|-------|----------|--------|
| A.1 | Enrichir `propertySchemas.js` (17 catégories, 6-12 champs chacune) | `propertySchemas.js` | 1-2j |
| A.2 | Mettre à jour le panneau propriétés (afficher 6-12 champs) | `centerAuxPanels.js` | 1j |
| A.3 | Validation des champs requis (basique, pas contextuel) | `propertySchemas.js` + UI | 0.5j |
| A.4 | Tests unitaires sur les schémas | `propertySchemas.test.js` (nouveau) | 0.5j |
| A.5 | Tests E2E : remplir un nœud de chaque catégorie | `e2e/properties.spec.js` | 1j |

**Livrable** : Les 17 catégories ont 6-12 champs. L'user peut les remplir. Pas encore d'IA.

### Phase B : Documentation hybride

**Objectif** : Export Markdown + sidecar JSON, regen live.

| # | Tâche | Fichiers | Effort |
|---|-------|----------|--------|
| B.1 | `liveDocRegenerator.js` : regen à chaque modif (debounced 500ms) | `mermaid/liveDocRegenerator.js` (nouveau) | 1j |
| B.2 | Templates Markdown par catégorie (17 templates) | `mermaid/docGenerator.js` (enrichir) | 1j |
| B.3 | Génération sidecar JSON (un fichier par nœud) | `mermaid/docGenerator.js` | 0.5j |
| B.4 | `zipExporter.js` : structure complète (nodes/, relations/, AGENTS.md) | `mermaid/zipExporter.js` (enrichir) | 1j |
| B.5 | `index.json` global (catalogue de tous les nœuds) | `mermaid/docGenerator.js` | 0.5j |
| B.6 | `AGENTS.md` auto-généré (prompt système résumé) | `mermaid/zipExporter.js` | 0.5j |
| B.7 | Tests : round-trip Markdown ↔ JSON | `docGenerator.test.js` | 1j |
| B.8 | Tests E2E : export ZIP, vérifier structure | `e2e/export.spec.js` (enrichir) | 1j |

**Livrable** : Export ZIP complet avec Markdown + JSON. Regen live fonctionnel.

### Phase C : IA assistée (remplissage)

**Objectif** : L'IA propose 80% des champs, l'user valide.

| # | Tâche | Fichiers | Effort |
|---|-------|----------|--------|
| C.1 | `propertiesEnricher.js` : défauts intelligents depuis le graphe | `ai/propertiesEnricher.js` (nouveau) | 2j |
| C.2 | `promptInjector.js` : injection du canvas dans le prompt | `ai/promptInjector.js` (nouveau) | 1j |
| C.3 | UI : bouton "L'IA propose" + affichage suggestions | `centerAuxPanels.js` | 1j |
| C.4 | UI : validation/refus champ par champ | `centerAuxPanels.js` | 0.5j |
| C.5 | Gating de confiance (seuil 70%) | `propertiesEnricher.js` | 0.5j |
| C.6 | Tests : scénarios de proposition | `propertiesEnricher.test.js` | 1j |

**Livrable** : L'IA propose, l'user valide, les champs sont remplis.

### Phase D : Champs requis contextuels

**Objectif** : Un champ devient requis selon la valeur d'un autre.

| # | Tâche | Fichiers | Effort |
|---|-------|----------|--------|
| D.1 | `conditionalValidator.js` : évalue les conditions | `ai/conditionalValidator.js` (nouveau) | 1j |
| D.2 | UI : indicateur visuel des champs requis | `centerAuxPanels.js` | 1j |
| D.3 | UI : message d'erreur contextuel | `centerAuxPanels.js` | 0.5j |
| D.4 | Tests : 10+ scénarios de validation | `conditionalValidator.test.js` | 1j |

**Livrable** : Champs requis contextuels fonctionnels.

### Phase E : API + Prompt (canaux 2 et 3)

**Objectif** : Consommation live via API et prompt.

| # | Tâche | Fichiers | Effort |
|---|-------|----------|--------|
| E.1 | `canvasAPI.js` : endpoints HTTP | `api/canvasAPI.js` (nouveau) | 1j |
| E.2 | Tests : endpoints répondent correctement | `canvasAPI.test.js` | 0.5j |
| E.3 | Bouton "Copier dans le prompt" dans l'UI | `ai/promptInjector.js` + UI | 0.5j |
| E.4 | Test E2E : clic → prompt mis à jour | `e2e/ai-integration.spec.js` | 0.5j |

**Livrable** : 3 canaux de consommation fonctionnels (ZIP + API + prompt).

### Phase F : Scénarios & découverte de nœuds

**Objectif** : Le méta-outil scénarios fonctionne.

| # | Tâche | Fichiers | Effort |
|---|-------|----------|--------|
| F.1 | Créer dossier `scenarios/` + 3 fichiers exemples | `scenarios/*.md` | 0.5j |
| F.2 | `scenarioAnalyzer.js` : lit les scénarios, extrait termes | `ai/scenarioAnalyzer.js` (nouveau) | 2j |
| F.3 | UI : panneau "Analyse des scénarios" | (nouveau panneau) | 1j |
| F.4 | UI : workflow de validation des termes | (nouveau panneau) | 1j |
| F.5 | Mécanisme d'ajout d'un nouveau nœud (palette + schema) | `propertySchemas.js` + `menuMermaidActionsLeft.js` | 1j |
| F.6 | Tests : 3 scénarios → 10+ termes extraits | `scenarioAnalyzer.test.js` | 1j |

**Livrable** : 3 scénarios dans `scenarios/`, workflow de découverte opérationnel.

### Phase G : Nouvelles catégories (monitoring, compliance, etc.)

**Objectif** : Étendre la palette avec les catégories révélées par les scénarios.

| # | Tâche | Fichiers | Effort |
|---|-------|----------|--------|
| G.1 | Ajouter `monitoring`, `compliance`, `localization`, etc. | `propertySchemas.js` | 1j |
| G.2 | Ajouter les types correspondants à la palette | `menuMermaidActionsLeft.js` | 0.5j |
| G.3 | Tests : nouveaux types fonctionnels | (enrichir tests existants) | 0.5j |

**Livrable** : +6 catégories, +30-50 types, ~200+ nœuds total.

### Phase H : Polish & optimisation

| # | Tâche | Effort |
|---|-------|--------|
| H.1 | Performance : regen live < 500ms pour 500 nœuds | 1j |
| H.2 | UX : animations, transitions, feedback visuel | 1j |
| H.3 | Tests de charge (500+ nœuds) | 0.5j |
| H.4 | Documentation utilisateur (README, guide) | 1j |

---

## 10. Métriques de succès

| Métrique | Cible | Comment mesurer |
|----------|-------|-----------------|
| Nombre de types de nœuds | 200+ | Compter dans `menuMermaidActionsLeft.js` |
| Nombre de champs moyens par catégorie | 9+ | Compter dans `propertySchemas.js` |
| % de nœuds avec champs critiques remplis | 80%+ | Audit sur un projet type |
| Latence de regen live | < 500ms pour 100 nœuds | Benchmark |
| Tests E2E passants | 100% | `npm run test:e2e` |
| Couverture tests unitaires | 80%+ | `npm run test:coverage` |
| Satisfaction UX (subjective) | "L'IA comprend mon projet" | Validation manuelle |

---

## 11. Risques & mitigations

| Risque | Impact | Mitigation |
|--------|--------|------------|
| Regen live trop lente | UX dégradée | Debounce 500ms, cache, lazy gen |
| Trop de champs → formulaire surchargé | UX | Sections repliables, tabs par groupe |
| L'IA propose des bêtises | Confiance perdue | Gating confiance 70%, validation humaine obligatoire |
| Scénarios polluent le projet | Confusion | `.gitignore` partiel + doc explicite + audit régulier |
| JSON Schema trop strict | Rigidité | Permettre champs custom (réservés `_custom_*`) |
| 1000+ nœuds → performance | Ralentissement | Lazy loading, recherche fuzzy, indexation |
| L'IA hallucine des termes inexistants | Faux nœuds | Validation manuelle obligatoire |
| Migration des anciens nœuds | Perte de données | Backward compat via `properties: {}` par défaut |

---

## 12. Décisions architecturales (verrouillées)

| # | Décision | Justification |
|---|----------|---------------|
| D1 | **Markdown + JSON sidecar** (pas juste Markdown) | Humain + agent, double usage |
| D2 | **Regen live** (pas bouton manuel) | UX transparente, doc toujours à jour |
| D3 | **Pas de sous-types** (pour l'instant) | 6-12 propriétés couvrent la plupart des cas |
| D4 | **Champs requis contextuels** (pas tous requis) | Flexibilité + rigueur |
| D5 | **Défauts intelligents depuis le graphe** | Moins de friction pour l'user |
| D6 | **IA propose, user valide** | Pas de surprise, confiance |
| D7 | **3 canaux de consommation** (ZIP, API, prompt) | Flexibilité maximale |
| D8 | **Scénarios = méta-outil** (jamais livré) | Distinction stricte, pas de pollution |
| D9 | **Collection "vivante" 1000+ nœuds** (pas versionnée) | Backward compat par propriétés optionnelles |
| D10 | **Pas de templates de projet** dans le canvas | Les scénarios suffisent |

---

## 13. Annexes

### 13.1 Inventaire des ~153 types actuels

(Extrait de `menuMermaidActionsLeft.js` — section "Palette" du plan v1)

```
base (7) : start, end, process, decision, document, user, storage
advanced (6) : module, important, attention, idea, goal, success
components (12) : component-header/footer/navbar/form/modal/table/sidebar/breadcrumb/stepper/tabs/drawer/card
uiux (6) : uiux-designsystem/responsive/a11y/animation/theming/gestures
services (12) : service-api/auth/database/cache/queue/notif/email/webhook/search/s3/payment/logging
messaging (9) : msg-event/websocket/rest/microservice/grpc/mqtt/sse/graphql-sub
arch (10) : arch-clean/hexagonal/microfrontend/monolith/event-driven/serverless/microservices/layered/soa/ddd
patterns (10) : pattern-singleton/observer/factory/adapter/strategy/decorator/builder/composite/proxy/state
data (7) : data-ml/training/pipeline/ai/warehouse/viz/streaming
testing (10) : test-unit/integration/e2e/coverage/lint/review/metrics/snapshot/perf/mutation
project (10) : proj-story/task/sprint/bug/ticket/roadmap/retro/backlog/estimation/milestone
git (7) : git-branch/merge/pr/tag/stash/cherrypick/revert
devops (12) : devops-ci/cd/container/monitoring/infra/dns/lb/cdn/registry/secrets/alerting/feature-flag
security (9) : sec-auth/encrypt/rbac/firewall/oauth2/ratelimit/cors/csp/audit
dependencies (8) : dep-package/version/mono/audit/license/update/registry/lockfile
init (7) : init-nextjs/react/vue/angular/svelte/nestjs/express
env (6) : env-secure/vars/config/secrets/feature-flag/staging/local
                       ─────────
                       ~153 types
```

### 13.2 Glossaire

| Terme | Définition |
|-------|------------|
| **Nœud** | Élément du canvas représentant un composant, service, tâche, etc. |
| **Propriété** | Champ structuré d'un nœud (clé/valeur typé) |
| **Catégorie** | Préfixe du type (ex: `devops` dans `devops-ci`) |
| **Scénario** | Méta-outil : projet fictif servant à brainstormer des nœuds |
| **Documentation vivante** | Doc auto-générée depuis le canvas, mise à jour live |
| **Sidecar JSON** | Fichier `.json` accompagnant un `.md` pour consommation machine |
| **Champ requis contextuel** | Champ qui devient requis selon la valeur d'un autre |
| **Défaut intelligent** | Valeur par défaut calculée depuis le contexte du graphe |
| **Collection** | Le catalogue complet des ~153+ types de nœuds |
| **Palette** | L'UI qui permet de choisir un type de nœud |

### 13.3 Références

- `.dev-plans/PLAN-PROPRIETES-EXPORT.md` — plan v1 (implémenté pour les phases 0-7)
- `src/code-city/propertySchemas.js` — état actuel (17 catégories, 3-6 champs)
- `src/code-city/menuMermaidActionsLeft.js` — palette des ~153 types
- `data/prompts/*.md` — exemples de prompts (utiles pour l'IA assistée)

---

**Spec maintenu par** : l'utilisateur + l'IA (Claude/Mina)
**Date de création** : Juin 2026
**Prochaine révision** : après Phase A (MVP enrichment)
