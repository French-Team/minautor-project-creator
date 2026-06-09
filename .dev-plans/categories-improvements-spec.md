# Spec : Améliorations des catégories de la palette

## Contexte

L'application **Mermaid Canvas** dispose actuellement de **14 catégories** dans la sidebar gauche (palette), dont **6 ouvertes par défaut** (base, advanced, components, services, testing, devops). L'objectif est de :

1. **Fermer toutes les catégories par défaut** (sans exception)
2. **Ajouter 3 nouvelles catégories** (Architecture, Data/IA, Gestion de projet) + enrichir 3 existantes (Services, Tests, DevOps)
3. **Réorganiser les catégories par thème** (du général au spécialisé)
4. **Ajouter un bouton "Ouvrir/Fermer tout"**
5. **Conserver le comportement de recherche** : auto-ouvrir les catégories contenant des résultats

---

## État actuel

### 14 catégories existantes

| # | Catégorie | ID | Éléments | defaultOpen |
|---|---|---|---|---|
| 1 | Diagrammes de base | `base` | 7 | `true` ❌ |
| 2 | Éléments avancés | `advanced` | 6 | `true` ❌ |
| 3 | Composants | `components` | 6 | `true` ❌ |
| 4 | Services | `services` | 5 | `true` ❌ |
| 5 | Tests & Qualité | `testing` | 4 | `true` ❌ |
| 6 | DevOps & Infrastructure | `devops` | 5 | `true` ❌ |
| 7 | Sécurité | `security` | 4 | `false` ✓ |
| 8 | Design Patterns | `patterns` | 5 | `false` ✓ |
| 9 | Git & Versioning | `git` | 3 | `false` ✓ |
| 10 | Communication & Messaging | `messaging` | 4 | `false` ✓ |
| 11 | UI/UX Design | `uiux` | 4 | `false` ✓ |
| 12 | Gestion de dépendances | `dependencies` | 3 | `false` ✓ |
| 13 | Initialisation | `init` | 3 | `false` ✓ |
| 14 | Environnement | `env` | 3 | `false` ✓ |

**Total** : 62 éléments, ~110 variantes

---

## Décisions prises (entretien utilisateur)

### Round 1 — Périmètre
1. **Fermeture** : Toutes les catégories fermées par défaut, sans exception
2. **Améliorations** : Enrichir le contenu existant + Ajouter de nouvelles catégories
3. **Ordre** : Regrouper par thème — du général au spécialisé

### Round 2 — Contenu
4. **Nouvelles catégories** : 3 nouvelles catégories + enrichissement des existantes :
   - Architecture (nouvelle)
   - Data / IA (nouvelle)
   - Gestion de projet (nouvelle)
   - Qualité de code → fusionnée dans Tests & Qualité
   - Réseau & Infra → fusionnée dans DevOps & Infrastructure
   - Intégrations → fusionnée dans Services
5. **Enrichissement** : Au fil de l'eau (pas de plan fixe, on ajuste selon les besoins)
6. **Regroupement** : Du général au spécialisé

### Round 3 — UX
7. **Recherche** : Auto-ouvrir les catégories contenant des résultats lors de la recherche (comportement actuel conservé)
8. **Bouton** : Ajouter un bouton "Tout ouvrir / Tout fermer" en haut de la palette
9. **Nouvelles catégories** : 3 nouvelles catégories + enrichissement des existantes

### Round 4 — Validation
10. **Variantes** : Noms descriptifs partout — remplacer tous les "Standard" par des noms explicites
11. **Chevauchements** : Fusionner Réseau → DevOps, Qualité code → Tests, Intégrations → Services. Gestion de projet reste séparée
12. **Icônes inutilisées** : Intégrer les 8 icônes créées précédemment (beaker, play, serverStack, globe, cursor, eye, funnel, chartBar) dans les variantes des nouvelles catégories

---

## Plan d'implémentation

### A. Changement immédiat : Toutes les catégories fermées par défaut

Modifier `defaultOpen: true` → `defaultOpen: false` pour les 6 catégories actuellement ouvertes :
- `base`, `advanced`, `components`, `services`, `testing`, `devops`

### B. Bouton "Tout ouvrir / Tout fermer"

**Emplacement** : Dans la barre `sidebar__head`, à côté du compteur d'éléments.

**Comportement** :
- Par défaut (tout fermé) : le bouton affiche "Tout ouvrir"
- Si au moins 1 catégorie est ouverte : le bouton affiche "Tout fermer"
- Clic sur "Tout ouvrir" : ouvre toutes les catégories
- Clic sur "Tout fermer" : ferme toutes les catégories
- Le bouton ne change PAS pendant une recherche (le comportement de recherche auto-ouvre les résultats)

**Implémentation** :
- Ajouter un `<button>` dans `sidebar__head` (dans `code-city.js`)
- Exporter une fonction `toggleAllSections(open)` depuis `menuMermaidActionsLeft.js`
- Brancher le clic du bouton sur cette fonction
- Mettre à jour le texte/icône du bouton à chaque changement d'état

### C. Recherche : auto-ouvrir les résultats

**Comportement actuel** (déjà implémenté) :
```javascript
if (openSections.has(category.id) || q) section.classList.add('is-open');
```

Lorsqu'une recherche est active (`q` non vide), toutes les catégories contenant des résultats sont automatiquement ouvertes. Ce comportement est conservé tel quel.

**Amélioration** : Lorsque la recherche est effacée, restaurer l'état précédent (catégories qui étaient ouvertes avant la recherche).

### D. Regroupement par thème (17 catégories)

Nouvel ordre des catégories, regroupées par thème du général au spécialisé :

#### 🎨 Fondamentaux (2 catégories)
| # | Catégorie | ID | defaultOpen |
|---|---|---|---|
| 1 | Diagrammes de base | `base` | `false` |
| 2 | Éléments avancés | `advanced` | `false` |

#### 🖥️ Frontend (2 catégories)
| # | Catégorie | ID | defaultOpen |
|---|---|---|---|
| 3 | Composants | `components` | `false` |
| 4 | UI/UX Design | `uiux` | `false` |

#### ⚙️ Backend (2 catégories)
| # | Catégorie | ID | defaultOpen |
|---|---|---|---|
| 5 | Services (enrichie : + intégrations) | `services` | `false` |
| 6 | Communication & Messaging | `messaging` | `false` |

#### 🏗️ Architecture (2 catégories)
| # | Catégorie | ID | defaultOpen |
|---|---|---|---|
| 7 | **Architecture** (nouvelle) | `arch` | `false` |
| 8 | Design Patterns | `patterns` | `false` |

#### 📊 Data (1 catégorie)
| # | Catégorie | ID | defaultOpen |
|---|---|---|---|
| 9 | **Data / IA** (nouvelle) | `data` | `false` |

#### ✅ Qualité (1 catégorie)
| # | Catégorie | ID | defaultOpen |
|---|---|---|---|
| 10 | Tests & Qualité (enrichie : + qualité de code) | `testing` | `false` |

#### 📋 Processus (2 catégories)
| # | Catégorie | ID | defaultOpen |
|---|---|---|---|
| 11 | **Gestion de projet** (nouvelle) | `project` | `false` |
| 12 | Git & Versioning | `git` | `false` |

#### 🖧 Infrastructure (2 catégories)
| # | Catégorie | ID | defaultOpen |
|---|---|---|---|
| 13 | DevOps & Infrastructure (enrichie : + réseau) | `devops` | `false` |
| 14 | Sécurité | `security` | `false` |

#### 🛠️ Support (3 catégories)
| # | Catégorie | ID | defaultOpen |
|---|---|---|---|
| 15 | Gestion de dépendances | `dependencies` | `false` |
| 16 | Initialisation | `init` | `false` |
| 17 | Environnement | `env` | `false` |

**Total** : 17 catégories (~75 éléments, ~135 variantes)

> 3 catégories supprimées par fusion : Réseau & Infra → DevOps, Qualité de code → Tests, Intégrations → Services

---

### E. Nouvelles catégories + enrichissements

#### 7. `arch` — Architecture (6 éléments) — NOUVELLE
| Type | Label | Tooltip | Variantes |
|---|---|---|---|
| `arch-clean` | Clean Architecture | Architecture propre | Couches (module/indigo), Ports & Adapters (module/purple) |
| `arch-hexagonal` | Hexagonale | Architecture hexagonale | Hexagone (module/blue), CQRS (module/indigo) |
| `arch-microfrontend` | Micro-frontend | Frontend distribué | Indépendant (module/purple), Module Federation (module/blue) |
| `arch-monolith` | Monolithe | Application monolithique | Monolithique (module/slate), Modulaire (module/indigo) |
| `arch-event-driven` | Event-Driven | Architecture événementielle | EventEmitter (sparkles/blue), CQRS+ES (sparkles/purple) |
| `arch-serverless` | Serverless | Architecture serverless | Lambda (process/blue), Functions (process/purple) |

#### 9. `data` — Data / IA (4 éléments) — NOUVELLE
| Type | Label | Tooltip | Variantes |
|---|---|---|---|
| `data-ml` | Modèle ML | Modèle de machine learning | Classification (cube/blue), Régression (cube/indigo) |
| `data-training` | Données d'entraînement | Dataset d'entraînement | Dataset (storage/blue), Augmentation (storage/purple) |
| `data-pipeline` | Pipeline de données | ETL / streaming | ETL (process/blue), Stream (process/cyan) |
| `data-ai` | API IA | API d'intelligence artificielle | LLM (sparkles/purple), Vision (sparkles/blue) |

#### 11. `project` — Gestion de projet (5 éléments) — NOUVELLE
| Type | Label | Tooltip | Variantes |
|---|---|---|---|
| `proj-story` | User Story | Récit utilisateur | Simple (document/blue), Epic (document/purple) |
| `proj-task` | Tâche | Tâche de développement | Principale (process/blue), Sous-tâche (process/indigo) |
| `proj-sprint` | Sprint | Itération / sprint | Scrum (rocket/blue), Kanban (rocket/green) |
| `proj-bug` | Bug / Incident | Bug ou incident | Bug (xCircle/red), Incident (attention/orange) |
| `proj-ticket` | Ticket | Ticket / issue | Normal (tag/blue), Urgent (tag/red) |

#### Enrichissement de `services` — Ajout d'éléments d'intégration
| Type | Label | Tooltip | Variantes |
|---|---|---|---|
| `service-notif` | Notifications | Notifications push/SMS | Push (sparkles/blue), SMS (sparkles/green) |
| `service-email` | Email Service | Service d'email | Transactionnel (document/blue), Marketing (document/purple) |
| `service-webhook` | Webhooks | Hooks HTTP | Entrant (link/blue), Sortant (link/orange) |

#### Enrichissement de `testing` — Ajout d'éléments de qualité de code
| Type | Label | Tooltip | Variantes |
|---|---|---|---|
| `test-lint` | Linting | Linting & formatage | ESLint (beaker/blue), Prettier (beaker/purple) |
| `test-review` | Code Review | Revue de code | Solo (eye/orange), Pair Programming (users/blue) |
| `test-metrics` | Métriques | Métriques de code | Complexité (chartBar/amber), Duplication (chartBar/red) |

#### Enrichissement de `devops` — Ajout d'éléments réseau
| Type | Label | Tooltip | Variantes |
|---|---|---|---|
| `devops-dns` | DNS | Résolution DNS | Principal (globe/blue), Failover (globe/indigo) |
| `devops-lb` | Load Balancer | Répartition de charge | Round Robin (serverStack/blue), HA (serverStack/indigo) |
| `devops-cdn` | CDN | Content Delivery Network | Standard (cloud/cyan), Edge (cloud/blue) |

---

## Icônes utilisées

Toutes les icônes nécessaires existent déjà dans le registre (aucune création requise) :

| Icône | Usage dans les nouvelles catégories |
|---|---|
| `module` | Architecture (arch-*) |
| `sparkles` | Architecture (arch-event-driven), Data (data-ai), Services (service-notif) |
| `process` | Architecture (arch-serverless), Data (data-pipeline), Tests (test-lint/review/metrics), DevOps (devops-dns/lb), Gestion de projet (proj-task) |
| `cube` | Data (data-ml) |
| `storage` | Data (data-training) |
| `document` | Gestion de projet (proj-story), Services (service-email) |
| `rocket` | Gestion de projet (proj-sprint) |
| `xCircle` | Gestion de projet (proj-bug) |
| `attention` | Gestion de projet (proj-bug) |
| `tag` | Gestion de projet (proj-ticket) |
| `link` | Services (service-webhook) |
| `beaker` | Tests (test-lint) — icône intégrée ✓ |
| `eye` | Tests (test-review) — icône intégrée ✓ |
| `chartBar` | Tests (test-metrics) — icône intégrée ✓ |
| `globe` | DevOps (devops-dns) — icône intégrée ✓ |
| `serverStack` | DevOps (devops-lb) — icône intégrée ✓ |

---

## Nouvelles formes Mermaid (SHAPE_BY_TYPE)

Ajouter dans `build.js` :

| Nouveau type | Forme Mermaid | Raison |
|---|---|---|
| `arch-*` | `[[...]]` (sub-process/module) | Architecture/module |
| `data-*` | `[...]` (rectangle/process) | Processus de données |
| `proj-*` | `[...]` (rectangle/process) | Processus projet |
| `service-notif` | `[/.../]` (document) | Communication/notification |
| `service-email` | `[/.../]` (document) | Communication/email |
| `service-webhook` | `[/.../]` (document) | Communication/webhook |
| `test-lint` | `[...]` (rectangle/process) | Processus qualité |
| `test-review` | `[...]` (rectangle/process) | Processus qualité |
| `test-metrics` | `[...]` (rectangle/process) | Processus qualité |
| `devops-dns` | `[...]` (rectangle/process) | Infrastructure réseau |
| `devops-lb` | `[...]` (rectangle/process) | Infrastructure réseau |
| `devops-cdn` | `[...]` (rectangle/process) | Infrastructure réseau |

Mettre à jour `shapeFor()` avec les nouveaux préfixes.

---

## Nouvelles couleurs CSS

Les couleurs existantes suffisent pour les nouvelles catégories. Aucune nouvelle couleur `data-color` nécessaire.

Ajouter les règles `data-type` (light + dark) pour les ~24 nouveaux types (arch-*, data-*, proj-*, service-notif/email/webhook, test-lint/review/metrics, devops-dns/lb/cdn).

---

## Fichiers à modifier

1. **`src/code-city/quartierLeft/fonctionsMermaidLeft/menuMermaidActionsLeft/menuMermaidActionsLeft.js`**
   - Changer `defaultOpen: true` → `false` pour base, advanced, components, services, testing, devops
   - Ajouter 3 nouvelles catégories (arch, data, project)
   - Enrichir 3 catégories existantes (services +3, testing +3, devops +3)
   - Réordonner les catégories par thème
   - Remplacer les noms "Standard" par des noms descriptifs
   - Exporter `toggleAllSections(open)` pour le bouton

2. **`src/code-city/code-city.js`**
   - Ajouter le bouton "Tout ouvrir / Tout fermer" dans `sidebar__head`
   - Brancher le clic sur `toggleAllSections`

3. **`src/code-city/mermaid/build.js`**
   - Ajouter ~12 nouveaux types dans `SHAPE_BY_TYPE`
   - Mettre à jour `shapeFor()` avec les nouveaux préfixes (arch-*, data-*, proj-*)

4. **`src/code-city/icons.js`**
   - Aucune nouvelle icône nécessaire (les 10 créées précédemment suffisent)
   - Les icônes inutilisées (beaker, play, serverStack, globe, cursor, eye, funnel, chartBar) seront intégrées dans les variantes

5. **`src/styles/default.css`**
   - Ajouter les couleurs `data-type` (light + dark) pour les ~12 nouveaux types
   - Ajouter le style du bouton "Tout ouvrir / Tout fermer"

---

## Résumé des totaux

| Métrique | Actuel | Après |
|---|---|---|
| Catégories | 14 | 17 |
| Éléments | 62 | ~75 |
| Variantes | ~110 | ~135 |
| defaultOpen: true | 6 | 0 |
| Bouton collapse | Non | Oui |
| Icônes inutilisées | 8 | 0 (toutes intégrées) |

---

## Contraintes et notes

1. **Toutes fermées** : `defaultOpen: false` pour toutes les 17 catégories, sans exception
2. **Recherche conservée** : Le comportement actuel d'auto-ouverture lors de la recherche est maintenu
3. **Regroupement thématique** : 9 groupes visuels (Fondamentaux, Frontend, Backend, Architecture, Data, Qualité, Processus, Infrastructure, Support)
4. **Enrichissement au fil de l'eau** : Les catégories existantes seront enrichies progressivement, pas dans cette itération
5. **Bouton collapse** : Toggle "Tout ouvrir / Tout fermer" dans le header de la sidebar
