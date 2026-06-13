"""Replace section 5.2 with a complete API contract."""

filepath = '.dev-plans/nœuds-proprietes-spec.md'
with open(filepath, 'r', encoding='utf-8') as f:
    content = f.read()

old_marker_start = "### 5.2 Canal 2 : **API endpoint** (live)"
old_marker_end = "### 5.3 Canal 3 : **Injection dans le prompt** (chat)"

start_idx = content.find(old_marker_start)
end_idx = content.find(old_marker_end)
if start_idx < 0 or end_idx < 0:
    raise SystemExit(f"Markers not found: start={start_idx}, end={end_idx}")

old_52 = content[start_idx:end_idx]
print(f"Old section length: {len(old_52)} chars")

new_52 = """### 5.2 Canal 2 : **API HTTP** (live, agent-readable)

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
                          version: { type: string, pattern: '^\\d+\\.\\d+\\.\\d+$' }
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
curl -X GET "$CANVAS_BASE_URL/api/v1/canvas" \
  -H "Authorization: Bearer $CANVAS_API_TOKEN" \
  -H "Accept: application/json" \
  -D headers.txt
# Sauvegarder l'ETag pour les requêtes suivantes
ETAG=$(grep -i '^etag:' headers.txt | cut -d' ' -f2 | tr -d '\r')
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
curl -X GET "$CANVAS_BASE_URL/api/v1/canvas/nodes/n1" \
  -H "Authorization: Bearer $CANVAS_API_TOKEN"
```

**4. POST créer un nœud**
```bash
curl -X POST "$CANVAS_BASE_URL/api/v1/canvas/nodes" \
  -H "Authorization: Bearer $CANVAS_API_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
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
CURRENT_VERSION=$(curl -s -X GET "$CANVAS_BASE_URL/api/v1/canvas/nodes/n5" \
  -H "Authorization: Bearer $CANVAS_API_TOKEN" | jq -r '.data.metadata.version')

# Puis patcher avec expectedVersion
curl -X PATCH "$CANVAS_BASE_URL/api/v1/canvas/nodes/n5" \
  -H "Authorization: Bearer $CANVAS_API_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"properties\": { \"rateLimit\": \"100 req/min\" },
    \"expectedVersion\": $CURRENT_VERSION
  }"
```

**6. POST IA suggest (champs à proposer)**
```bash
curl -X POST "$CANVAS_BASE_URL/api/v1/ai/suggest" \
  -H "Authorization: Bearer $CANVAS_API_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
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
curl -X POST "$CANVAS_BASE_URL/api/v1/ai/validate" \
  -H "Authorization: Bearer $CANVAS_API_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
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
curl -X GET "$CANVAS_BASE_URL/api/v1/canvas/export.zip" \
  -H "Authorization: Bearer $CANVAS_API_TOKEN" \
  -o canvas-export.zip
# Vérifier la structure
unzip -l canvas-export.zip
```

**9. POST rotation du token**
```bash
# ⚠️ Sauvegarder le nouveau token IMMÉDIATEMENT (retourné une seule fois)
RESPONSE=$(curl -s -X POST "$CANVAS_BASE_URL/api/v1/auth/tokens/rotate" \
  -H "Authorization: Bearer $CANVAS_API_TOKEN")
NEW_TOKEN=$(echo "$RESPONSE" | jq -r '.data.newToken')
echo "$NEW_TOKEN" > .env.new

# Mettre à jour .env
sed -i.bak "s|^CANVAS_API_TOKEN=.*|CANVAS_API_TOKEN=$NEW_TOKEN|" .env
echo "Old token expires at: $(echo "$RESPONSE" | jq -r '.data.oldTokenExpiresAt')"
```

**10. GET OpenAPI spec (self-documenting)**
```bash
curl -X GET "$CANVAS_BASE_URL/api/v1/openapi.yaml" \
  -H "Authorization: Bearer $CANVAS_API_TOKEN" \
  -o openapi.yaml
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

"""

content = content[:start_idx] + new_52 + content[end_idx:]
print(f"New section length: {len(new_52)} chars")

with open(filepath, 'w', encoding='utf-8') as f:
    f.write(content)

print(f"\nFile updated: {filepath}")
print(f"Final size: {len(content)} chars")
