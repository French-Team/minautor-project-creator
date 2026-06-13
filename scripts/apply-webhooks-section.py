"""Insert new §5.4 'Webhooks' section and shift existing §5.4 'Matrice' to §5.5."""

filepath = '.dev-plans/nœuds-proprietes-spec.md'
with open(filepath, 'r', encoding='utf-8') as f:
    content = f.read()

# Anchor: the existing 5.4 section header
old_anchor = """### 5.4 Matrice canal × usage

| Canal | Cas d'usage | Fréquence | Latence acceptable |
|-------|-------------|-----------|-------------------|
| ZIP | Livraison finale, archivage | 1×/projet | OK si lent |
| API | Agent en live, monitoring | 10-100×/jour | < 1s |
| Prompt | Chat itératif | À chaque message | < 200ms |"""

new_content = """### 5.4 Canal 4 : **Webhooks** (PUSH notifications, agent-proactif)

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
  const body = req.rawBody;  // ⚠️ String brut, PAS req.body (re-sérialisé change le contenu)

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
    const event = JSON.parse(req.rawBody);
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

**Règles** :
- **Codes succès** : `200`, `201`, `202`, `204` → marqué comme delivered, pas de retry
- **Auth failures** : `401`, `403` → **PAS de retry** (le secret est mauvais, retry ne changera rien) → marqué comme `failed_permanent`
- **Autres 4xx** : `400`, `404`, `422` → **PAS de retry** (la requête est malformée, retry ne changera rien) → marqué comme `failed_permanent`
- **5xx, timeouts, network errors** : `500`, `502`, `503`, `504`, `ECONNRESET`, `ETIMEDOUT` → **RETRY** avec backoff
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
  processEvent(JSON.parse(req.rawBody));

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
curl -X POST "$CANVAS_BASE_URL/api/v1/webhooks" \
  -H "Authorization: Bearer $CANVAS_API_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://abc123.ngrok.io/webhook-receiver",
    "events": ["node.created", "node.updated"],
    "description": "Local dev test"
  }'

# Tester
curl -X POST "$CANVAS_BASE_URL/api/v1/webhooks/wh_abc123/test" \
  -H "Authorization: Bearer $CANVAS_API_TOKEN"
```

---

### 5.5 Matrice canal × usage

| Canal | Cas d'usage | Fréquence | Latence acceptable | Direction |
|-------|-------------|-----------|-------------------|-----------|
| ZIP | Livraison finale, archivage | 1×/projet | OK si lent | Pull (download) |
| API | Agent en live, monitoring | 10-100×/jour | < 1s | Pull (GET) |
| Prompt | Chat itératif | À chaque message | < 200ms | Push (injection contexte) |
| **Webhooks** | **Notifications temps réel, CI/CD auto-trigger** | **10-1000×/jour** | **< 5s delivery** | **Push (event-driven)** |"""

if old_anchor in content:
    content = content.replace(old_anchor, new_content)
    print('EDIT (insert §5.4 + renumber): OK')
else:
    print('EDIT: anchor not found')
    raise SystemExit(1)

with open(filepath, 'w', encoding='utf-8') as f:
    f.write(content)

print(f'\nFile updated: {filepath}')
print(f'Final size: {len(content)} chars')
