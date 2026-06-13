"""Apply 2 edits to the spec file: enrich section 3.3 and add section 3.7."""

filepath = '.dev-plans/nœuds-proprietes-spec.md'
with open(filepath, 'r', encoding='utf-8') as f:
    content = f.read()

# ============================================================
# EDIT 1 : Enrichir section 3.3 avec 4 scénarios YAML détaillés
# ============================================================
old_33_marker_start = "### 3.3 Champs requis contextuels"
old_33_marker_end = "```\n\n### 3.4 Défauts intelligents"

start_idx = content.find(old_33_marker_start)
end_idx = content.find(old_33_marker_end)
if start_idx < 0 or end_idx < 0:
    print("EDIT 1: anchors not found")
    raise SystemExit(1)

old_33 = content[start_idx:end_idx]
print(f"EDIT 1: old section length = {len(old_33)} chars")

new_33 = """### 3.3 Champs requis contextuels

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
    pattern: '^\\$\\{[A-Z_]+\\}$|^[a-zA-Z0-9_-]+$'
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
    pattern: '^\\d+\\s*(req|req/min|req/hour|req/day)(,\\s*burst\\s*\\d+)?$'

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

"""

content = content[:start_idx] + new_33 + content[end_idx:]
print(f"EDIT 1: replaced {len(old_33)} chars with {len(new_33)} chars")

# ============================================================
# EDIT 2 : Ajouter section 3.7 avec exemple complet service-api
# ============================================================
old_36_marker = "**Note** : ces ajouts seront validés via les **scénarios** (section 6) avant d'être implémentés.\n\n---"
old_36_idx = content.find(old_36_marker)
if old_36_idx < 0:
    print("EDIT 2: anchor not found")
    raise SystemExit(1)

new_36 = old_36_marker + """

### 3.7 Exemple concret : nœud `service-api` enrichi (12 champs remplis)

Pour rendre concret tout ce qui précède, voici un **nœud `service-api` complètement rempli** avec les 12 champs cibles. C'est ce que l'agent IA verra dans le `sidecar JSON` et ce que l'utilisateur verra dans le `Markdown`.

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

## Propriétés (12 champs)

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

  - check: 'lastReviewed < today'
    then: 'la date ne doit pas être dans le futur'
    result: 'PASS'  # 2026-06-10 < today (2026-06-13)

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
"""

content = content[:old_36_idx] + new_36 + content[old_36_idx + len(old_36_marker):]
print("EDIT 2: section 3.7 added")

# Écrire le fichier
with open(filepath, 'w', encoding='utf-8') as f:
    f.write(content)

print(f"File written: {filepath}")
print(f"Final size: {len(content)} chars")
