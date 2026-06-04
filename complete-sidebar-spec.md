# Spec : Compléter les catégories de la sidebar

## Contexte

L'application **Mermaid Canvas** est un outil de diagrammation visuelle avec drag & drop qui génère du code Mermaid. La sidebar gauche (palette) contient actuellement **6 catégories** avec **24 éléments** au total. L'objectif est de compléter cette palette en enrichissant les catégories existantes et en en ajoutant de nouvelles pour couvrir le **développement logiciel général**.

---

## État actuel

### Catégories existantes (6 catégories, 24 éléments)

| Catégorie | ID | Éléments | Profondeur |
|---|---|---|---|
| Diagrammes de base | `base` | Début, Fin, Processus, Décision, Document, Utilisateur, Stockage | 7 éléments |
| Éléments avancés | `advanced` | Module, Important, Attention, Idée, Objectif, Succès | 6 éléments |
| Initialisation | `init` | Init Next.js, Init React, Init Vue | 3 éléments |
| Environnement | `env` | Env sécurisé, Variables d'env | 2 éléments |
| Composants | `components` | Header, Footer, Navbar | 3 éléments |
| Services | `services` | API, Auth, Database | 3 éléments |

### Architecture technique

- **Fichier palette** : `src/code-city/quartierLeft/fonctionsMermaidLeft/menuMermaidActionsLeft/menuMermaidActionsLeft.js`
  - Constante `PALETTE` = tableau de catégories
  - Chaque catégorie : `{ id, label, defaultOpen, items[] }`
  - Chaque item : `{ type, label, tooltip, variants[] }`
  - Chaque variante : `{ id, icon, color, label }`

- **Icônes** : `src/code-city/icons.js`
  - Registre `ICON_MAP` avec ~35 icônes SVG inline (style Heroicons 24/outline)
  - Fonction `getIcon(name)` pour récupérer une icône par nom
  - Icônes existantes réutilisables : `start`, `end`, `process`, `decision`, `document`, `user`, `storage`, `module`, `important`, `attention`, `idea`, `goal`, `success`, `rocket`, `inbox`, `xCircle`, `branch`, `users`, `cloud`, `sparkles`, `shield`, `key`, `arrow`, `dotted`, `bold`, `circle`, `code`, `photo`, `cube`, `link`, `cog`, `trash`, `disconnect`, `xMark`, `refresh`, `download`

- **Formes Mermaid** : `src/code-city/mermaid/build.js`
  - Mapping `SHAPE_BY_TYPE` : type → `{ open, close }` (forme Mermaid)
  - Formes actuellement utilisées : stadium `([...])`, rectangle `[...]`, losange `{...}`, document `[/.../]`, asymétrique `>...]`, cylindre `[([...])]`, sub-process `[[...]]`, cercle `(...)`
  - Fonction `shapeFor(type)` avec fallback par préfixe (`component-*` → module, `service-database` → storage)

- **CSS couleurs** : `src/styles/default.css`
  - Couleurs par `data-color` (variant) : blue, green, red, purple, orange, yellow, cyan, slate, indigo, amber, pink, emerald
  - Couleurs par `data-type` (fallback) pour chaque type de nœud
  - Support thème clair/sombre

---

## Décisions prises (entretien utilisateur)

### Round 1 — Vision
1. **Objectif** : Les deux — enrichir les catégories existantes ET ajouter de nouvelles
2. **Périmètre** : Développement logiciel général (pas uniquement web)
3. **Source** : L'assistant propose des idées basées sur les bonnes pratiques

### Round 2 — Contenu
4. **Variantes** : Garder le système actuel (1-3 variantes par élément avec icône/couleur)
5. **Nouvelles catégories** : Toutes les 8 proposées :
   - Tests & Qualité
   - DevOps & Infra
   - Gestion de dépendances
   - Design Patterns
   - Sécurité
   - UI/UX Design
   - Git & Versioning
   - Communication & Messaging
6. **Technologies** : Le plus large possible (générique, pas de techno spécifique)

### Round 3 — Structure
7. **Profondeur** : Variable selon la catégorie (certaines riches, d'autres plus légères)
8. **Formes Mermaid** : Utiliser des icônes (pas de nouvelles formes Mermaid pour l'instant — les types inconnus tombent sur le rectangle par défaut via `shapeFor()`)
9. **Réorganisation** : Réorganiser les catégories existantes pour une meilleure cohérence

### Round 4 — Validation
10. **Icônes** : Garder les 10 icônes proposées (tag, lock, beaker, play, server, globe, cursor, eye, funnel, chart) — pour usage futur et variantes additionnelles
11. **Doublons msg-rest / service-api** : Garder les deux — `service-api` est un service (REST/GraphQL), `msg-rest` est une requête HTTP brute (GET/POST), concepts différents
12. **Noms de variantes** : Noms descriptifs partout — remplacer "Standard" par un nom explicite (ex: Fonction, Automatisé, Filtrage, Classe, Interface, Composition, Bibliothèque, Sémantique, Simple, Bidirectionnel, Indépendant, Basique)
13. **Couleurs CSS** : Ajouter uniquement `teal` et `rose` (pas de lime, violet, sky — les 12 couleurs existantes suffisent)

---

## Plan d'implémentation

### A. Réorganisation des catégories existantes

Les 6 catégories actuelles seront restructurées pour une meilleure cohérence thématique :

#### 1. `base` — Diagrammes de base (conservée telle quelle)
| Type | Label | Tooltip | Variantes |
|---|---|---|---|
| `start` | Début | Point de départ | Standard (start/green), Lancement (rocket/blue), Réception (sparkles/cyan) |
| `end` | Fin | Point de fin | Standard (end/red), Validée (success/green), Échec (xCircle/orange) |
| `process` | Processus | Étape de traitement | Standard (process/blue), Données (storage/indigo), API (code/purple) |
| `decision` | Décision | Point de décision | Standard (decision/yellow), Branchement (branch/orange) |
| `document` | Document | Document ou fichier | Document (document/blue), Image (photo/purple), Code (code/slate) |
| `user` | Utilisateur | Action utilisateur | Utilisateur (user/cyan), Équipe (users/blue) |
| `storage` | Stockage | Sauvegarde de données | Serveur (storage/slate), Cloud (cloud/blue) |

#### 2. `advanced` — Éléments avancés (conservée telle quelle)
| Type | Label | Tooltip | Variantes |
|---|---|---|---|
| `module` | Module | Module ou fonction | Module (module/indigo), Composant (cube/purple) |
| `important` | Important | Point important | Standard (important/amber) |
| `attention` | Attention | Point d'attention | Standard (attention/orange) |
| `idea` | Idée | Idée ou concept | Standard (idea/pink) |
| `goal` | Objectif | Objectif à atteindre | Standard (goal/emerald) |
| `success` | Succès | Succès ou accomplissement | Standard (success/green) |

#### 3. `components` — Composants UI (enrichie)
| Type | Label | Tooltip | Variantes |
|---|---|---|---|
| `component-header` | Header | Composant Header | Minimal (module/blue), Avec recherche (module/purple) |
| `component-footer` | Footer | Composant Footer | Basique (module/slate), Avec réseaux (module/blue) |
| `component-navbar` | Navbar | Composant Navbar | Horizontale (module/blue), Verticale (module/purple) |
| `component-form` | Formulaire | Composant Formulaire | Simple (module/blue), Multi-étapes (module/indigo) |
| `component-modal` | Modal | Fenêtre modale | Basique (module/purple), Confirmation (module/orange) |
| `component-table` | Tableau | Composant Tableau | Simple (module/slate), Avec pagination (module/blue) |

#### 4. `services` — Services (enrichie)
| Type | Label | Tooltip | Variantes |
|---|---|---|---|
| `service-api` | API | Service API | REST (code/blue), GraphQL (code/purple) |
| `service-auth` | Auth | Service d'authentification | JWT (key/blue), OAuth (key/indigo) |
| `service-database` | Database | Service de base de données | PostgreSQL (storage/blue), MongoDB (storage/green) |
| `service-cache` | Cache | Service de cache | Redis (storage/red), Memcached (storage/orange) |
| `service-queue` | File d'attente | Service de message/queue | RabbitMQ (process/blue), Kafka (process/purple) |

#### 5. `init` — Initialisation (conservée telle quelle)
| Type | Label | Tooltip | Variantes |
|---|---|---|---|
| `init-nextjs` | Init Next.js | Initialiser un projet Next.js | TypeScript (rocket/blue), JavaScript (rocket/yellow) |
| `init-react` | Init React | Initialiser un projet React | Vite (rocket/blue), CRA (cube/orange) |
| `init-vue` | Init Vue | Initialiser un projet Vue | Vite (rocket/green), CLI (code/blue) |

#### 6. `env` — Environnement (enrichie)
| Type | Label | Tooltip | Variantes |
|---|---|---|---|
| `env-secure` | Env sécurisé | Mettre en place un environnement sécurisé | Standard (shield/green), Renforcé (shield/red) |
| `env-vars` | Variables d'env | Configurer les variables d'environnement | Local (cog/blue), Production (cog/red) |
| `env-config` | Configuration | Fichier de configuration | JSON (document/blue), YAML (document/purple) |

---

### B. Nouvelles catégories (8 catégories)

#### 7. `testing` — Tests & Qualité (4 éléments)
| Type | Label | Tooltip | Variantes |
|---|---|---|---|
| `test-unit` | Test unitaire | Test unitaire | Fonction (success/green), Mock (process/blue) |
| `test-integration` | Test d'intégration | Test d'intégration | Module (success/indigo), API (code/purple) |
| `test-e2e` | Test E2E | Test end-to-end | Cypress (process/blue), Playwright (process/purple) |
| `test-coverage` | Couverture | Couverture de code | Rapport (document/green), Seuil (goal/emerald) |

#### 8. `devops` — DevOps & Infrastructure (5 éléments)
| Type | Label | Tooltip | Variantes |
|---|---|---|---|
| `devops-ci` | CI | Intégration continue | GitHub Actions (process/blue), GitLab CI (process/orange) |
| `devops-cd` | CD | Déploiement continu | Automatisé (rocket/blue), Canary (rocket/amber) |
| `devops-container` | Container | Conteneurisation | Docker (cube/blue), Kubernetes (cube/indigo) |
| `devops-monitoring` | Monitoring | Supervision | Logs (document/slate), Métriques (process/green) |
| `devops-infra` | Infrastructure | Infrastructure as Code | Terraform (module/purple), Ansible (module/red) |

#### 9. `dependencies` — Gestion de dépendances (3 éléments)
| Type | Label | Tooltip | Variantes |
|---|---|---|---|
| `dep-package` | Package | Bibliothèque / package | NPM (module/red), PyPI (module/blue) |
| `dep-version` | Versioning | Gestion de version | Semver (tag/blue), Lock (shield/slate) |
| `dep-mono` | Monorepo | Gestion monorepo | Workspaces (module/indigo), Turborepo (module/purple) |

#### 10. `patterns` — Design Patterns (5 éléments)
| Type | Label | Tooltip | Variantes |
|---|---|---|---|
| `pattern-singleton` | Singleton | Instance unique | Classe (module/indigo) |
| `pattern-observer` | Observer | Patron observateur | Événement (sparkles/blue), Réactif (sparkles/purple) |
| `pattern-factory` | Factory | Fabrique | Simple (cube/blue), Abstraite (cube/indigo) |
| `pattern-adapter` | Adapter | Adaptateur | Interface (branch/orange) |
| `pattern-strategy` | Strategy | Stratégie | Composition (branch/purple) |

#### 11. `security` — Sécurité (4 éléments)
| Type | Label | Tooltip | Variantes |
|---|---|---|---|
| `sec-auth` | Authentification | Mécanisme d'authentification | MFA (shield/green), SSO (shield/blue) |
| `sec-encrypt` | Chiffrement | Chiffrement des données | TLS (lock/blue), AES (lock/indigo) |
| `sec-rbac` | Contrôle d'accès | Gestion des rôles | RBAC (users/amber), ACL (key/orange) |
| `sec-firewall` | Pare-feu | Protection réseau | Filtrage (shield/red), WAF (shield/orange) |

#### 12. `uiux` — UI/UX Design (4 éléments)
| Type | Label | Tooltip | Variantes |
|---|---|---|---|
| `uiux-designsystem` | Design System | Système de design | Bibliothèque (cube/blue), Tokens (cube/purple) |
| `uiux-responsive` | Responsive | Adaptation responsive | Mobile (photo/cyan), Desktop (photo/slate) |
| `uiux-a11y` | Accessibilité | Accessibilité (a11y) | Sémantique (users/emerald), WCAG (users/green) |
| `uiux-animation` | Animation | Animations & transitions | CSS (sparkles/pink), JS (sparkles/purple) |

#### 13. `git` — Git & Versioning (3 éléments)
| Type | Label | Tooltip | Variantes |
|---|---|---|---|
| `git-branch` | Branche | Gestion de branches | Feature (branch/blue), Release (branch/green) |
| `git-merge` | Merge / Rebase | Fusion de branches | Merge (branch/indigo), Rebase (branch/purple) |
| `git-pr` | Pull Request | Demande de fusion | Simple (code/blue), Code Review (code/orange) |

#### 14. `messaging` — Communication & Messaging (4 éléments)
| Type | Label | Tooltip | Variantes |
|---|---|---|---|
| `msg-event` | Événement | Système d'événements | EventEmitter (sparkles/blue), Pub/Sub (sparkles/purple) |
| `msg-websocket` | WebSocket | Communication temps réel | Bidirectionnel (link/cyan), Socket.IO (link/blue) |
| `msg-rest` | Requête HTTP | Communication REST | GET (arrow/blue), POST (arrow/green) |
| `msg-microservice` | Microservice | Architecture microservices | Indépendant (cube/indigo), Gateway (cube/purple) |

---

## Nouvelles icônes à créer dans `icons.js`

Les icônes suivantes doivent être ajoutées au registre `ICON_MAP` (style Heroicons 24/outline, viewBox 24×24, stroke-width 1.5) :

| Nom | Usage | Description |
|---|---|---|
| `tag` | Versioning | Étiquette / tag |
| `lock` | Chiffrement | Cadenas fermé |
| `beaker` | Tests | Bécher / fiole de test |
| `play` | CI/CD | Bouton play |
| `server` | Infrastructure | Serveur (différent de storage) |
| `globe` | API/Web | Globe terrestre |
| `cursor` | UI/UX | Curseur / pointeur |
| `eye` | Monitoring | Œil / surveillance |
| `funnel` | Filtre | Entonnoir |
| `chart` | Métriques | Graphique |

> **Note** : Certaines icônes existantes peuvent être réutilisées pour éviter d'en créer trop. Par exemple, `shield` pour la sécurité, `branch` pour Git, `cube` pour les patterns, `sparkles` pour les événements.

---

## Nouvelles couleurs CSS à ajouter

2 nouvelles couleurs à ajouter aux sélecteurs `[data-color="..."]` dans `default.css` (light + dark) :

| Couleur | Usage suggéré | Light bg / border | Dark bg / border |
|---|---|---|---|
| `teal` | Tests, monitoring | `#ccfbf1` / `#5eead4` | `#134e4a` / `#14b8a6` |
| `rose` | Alertes, sécurité | `#ffe4e6` / `#fda4af` | `#881337` / `#f43f5e` |

> **Note** : Les 12 couleurs existantes (blue, green, red, purple, orange, yellow, cyan, slate, indigo, amber, pink, emerald) suffisent largement. On n'ajoute que teal et rose pour plus de diversité dans les nouvelles catégories (tests, sécurité, monitoring).

---

## Modifications des formes Mermaid (SHAPE_BY_TYPE)

L'utilisateur a précisé que les icônes sont utilisées (pas de nouvelles formes Mermaid). Les nouveaux types seront ajoutés au mapping `SHAPE_BY_TYPE` dans `build.js` avec des formes existantes appropriées :

| Nouveau type | Forme Mermaid | Raison |
|---|---|---|
| `test-*` | `[...]` (rectangle/process) | Étape de processus |
| `devops-*` | `[...]` (rectangle/process) | Étape de processus |
| `dep-*` | `[[...]]` (sub-process/module) | Module/bibliothèque |
| `pattern-*` | `[[...]]` (sub-process/module) | Pattern/module |
| `sec-*` | `([...])` (stadium) | Point de sécurité (comme start/end) |
| `uiux-*` | `[[...]]` (sub-process/module) | Composant UI |
| `git-*` | `([...])` (stadium) | Action de versioning |
| `msg-*` | `[/.../]` (document) | Communication/message |
| `component-form` | `[[...]]` (sub-process/module) | Composant |
| `component-modal` | `[[...]]` (sub-process/module) | Composant |
| `component-table` | `[[...]]` (sub-process/module) | Composant |
| `service-cache` | `[([...])]` (cylindre/storage) | Stockage cache |
| `service-queue` | `[...]` (rectangle/process) | Processus de queue |
| `env-config` | `[/.../]` (document) | Fichier de configuration |

---

## Fichiers à modifier

1. **`src/code-city/quartierLeft/fonctionsMermaidLeft/menuMermaidActionsLeft/menuMermaidActionsLeft.js`**
   - Modifier la constante `PALETTE` avec les 14 catégories
   - Réorganiser l'ordre des catégories existantes
   - Ajouter les nouveaux items et variantes

2. **`src/code-city/icons.js`**
   - Ajouter ~10 nouvelles fonctions d'icônes SVG
   - Ajouter les entrées correspondantes dans `ICON_MAP`

3. **`src/code-city/mermaid/build.js`**
   - Étendre `SHAPE_BY_TYPE` avec les nouveaux types
   - Mettre à jour `shapeFor()` pour les nouveaux préfixes

4. **`src/styles/default.css`**
   - Ajouter les couleurs `data-type` (light + dark) pour les ~30 nouveaux types de nœuds (test-*, devops-*, dep-*, pattern-*, sec-*, uiux-*, git-*, msg-*, component-form/modal/table, service-cache/queue, env-config)
   - Ajouter 2 nouvelles couleurs `data-color` : `teal` et `rose` (light + dark)
   - Les variantes existantes réutilisent les 12 couleurs `data-color` déjà présentes (blue, green, red, purple, orange, yellow, cyan, slate, indigo, amber, pink, emerald)

---

## Résumé des totaux

| Métrique | Actuel | Après |
|---|---|---|
| Catégories | 6 | 14 |
| Éléments | 24 | ~56 |
| Variantes (total) | ~48 | ~100 |
| Icônes | ~35 | ~45 |
| Formes Mermaid | 13 | ~20 |

---

## Ordre des catégories dans la sidebar

1. **Diagrammes de base** (`base`) — `defaultOpen: true`
2. **Éléments avancés** (`advanced`) — `defaultOpen: true`
3. **Composants UI** (`components`) — `defaultOpen: true`
4. **Services** (`services`) — `defaultOpen: true`
5. **Tests & Qualité** (`testing`) — `defaultOpen: true`
6. **DevOps & Infrastructure** (`devops`) — `defaultOpen: true`
7. **Sécurité** (`security`) — `defaultOpen: false`
8. **Design Patterns** (`patterns`) — `defaultOpen: false`
9. **Git & Versioning** (`git`) — `defaultOpen: false`
10. **Communication & Messaging** (`messaging`) — `defaultOpen: false`
11. **UI/UX Design** (`uiux`) — `defaultOpen: false`
12. **Gestion de dépendances** (`dependencies`) — `defaultOpen: false`
13. **Initialisation** (`init`) — `defaultOpen: false`
14. **Environnement** (`env`) — `defaultOpen: false`

> Les 6 premières catégories sont ouvertes par défaut (les plus utilisées). Les 8 suivantes sont fermées par défaut pour ne pas surcharger la sidebar.

---

## Contraintes et notes

1. **Pas de nouvelles formes Mermaid** : Les types inconnus tombent sur le rectangle par défaut. Les icônes dans la palette suffisent à distinguer visuellement les éléments.
2. **Système de variantes conservé** : Chaque élément a 1-3 variantes avec icône + couleur + label.
3. **Générique** : Pas de technologies spécifiques (pas de "React Hook", "Vue Router", etc.). Les catégories Init et Services restent car elles sont déjà établies.
4. **Noms en français** : Labels et tooltips en français, IDs en anglais (slug).
5. **Profondeur variable** : 3-5 éléments par catégorie selon la richesse du domaine.
