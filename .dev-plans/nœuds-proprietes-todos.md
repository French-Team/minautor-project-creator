# TODO — Plan d'exécution structuré des 8 phases (A→H)

> **Spec source** : [`.dev-plans/nœuds-proprietes-spec.md`](./nœuds-proprietes-spec.md) (§9 — Plan de mise en œuvre)
> **Date de création** : 13 juin 2026 (samedi, démarrage effectif lundi **15 juin 2026**)
> **Estimation totale** : **~25 jours** (single fullstack) ou **~12-15 jours** (3 devs en parallèle)
**Sous-tâches** : **39** (A=5, B=8, C=6, D=4, E=3, F=6, G=3, H=4)
**Sous-tâches** : **39** (A=5, B=8, C=6, D=4, E=3, F=6, G=3, H=4)
> **Date cible de fin** : **mardi 15 juillet 2026** (~5 semaines)
> **Statut global** : ⬜ À démarrer

---

## 📖 Légende

### Statuts
- ⬜ **À faire** — pas commencé
- 🟡 **En cours** — démarré, < 50% terminé
- 🔵 **En review** — terminé, en attente de code-review ou PO validation
- ✅ **Terminé** — mergé en main + testé
- ❌ **Bloqué** — dépendance manquante ou décision à prendre
- 🚫 **Annulé** — scope réduit ou reporté

### Owners (rôles suggérés)
- 👤 `@frontend-dev` — UI/UX, CSS, state management
- ⚙️ `@backend-dev` — API, DB, server-side logic
- 🤖 `@ai-engineer` — prompts, agent logic, IA assistée
- 🎨 `@fullstack-dev` — capable de tout (phases transverses)
- 👑 `@tech-lead` — review, décisions architecturales, unblock
- 🚀 `@devops` — CI/CD, infra, monitoring
- 🧪 `@qa` — tests E2E, validation fonctionnelle

### Effort
Format : `Xd` (X jours-homme, base 8h/jour ouvré)

### Dépendances
- **Bloque** : la phase ne peut PAS démarrer tant que cette autre n'est pas ≥ 🟡 (en cours)
- **Synchronisé avec** : la phase doit être mergée EN MÊME TEMPS (même PR ou PRs coordonnées)
- **Parallélisable avec** : la phase peut démarrer dès que sa dépendance "bloque" est ≥ 🟡

---

## 🎯 Vue d'ensemble (8 phases)

| # | Phase | Effort | Owner principal | Dépendances | Cible début | Cible fin | Statut |
|---|-------|--------|------------------|--------------|-------------|-----------|--------|
| **A** | Enrichissement des schémas (MVP) | 4.5j | 👤 @frontend-dev | — | **15/06** (lundi) | **19/06** (vendredi) | ⬜ |
| **B** | Documentation hybride (Markdown + JSON) | 6.5j | ⚙️ @backend-dev | A (≥ 🟡) | **18/06** (mercredi) | **26/06** (vendredi) | ⬜ |
| **C** | IA assistée (remplissage) | 6j | 🤖 @ai-engineer | A (✅) | **22/06** (lundi) | **29/06** (lundi) | ⬜ |
| **D** | Champs requis contextuels | 3.5j | 👤 @frontend-dev | A (✅) | **22/06** (lundi) | **25/06** (jeudi) | ⬜ |
| **E** | API HTTP + Webhooks (canaux 2+3+4) | 2.5j | ⚙️ @backend-dev | A (✅) + B (≥ 🟡) | **25/06** (mercredi) | **29/06** (lundi) | ⬜ |
| **F** | Scénarios & découverte de nœuds | 6.5j | 🎨 @fullstack-dev | E (✅) | **30/06** (mardi) | **08/07** (mercredi) | ⬜ |
| **G** | Nouvelles catégories (monitoring, compliance…) | 2j | 👤 @frontend-dev | F (≥ 🟡) | **06/07** (lundi) | **08/07** (mercredi) | ⬜ |
| **H** | Polish & optimisation | 3.5j | 🚀 @devops + 👑 @tech-lead | A-G (✅) | **09/07** (jeudi) | **15/07** (mardi) | ⬜ |

**Effort total** : **~35j-homme** en séquentiel, mais **~12-15j-homme en parallèle optimal** (3 devs).

**Sous-tâches totales** : **39** (A=5, B=8, C=6, D=4, E=3, F=6, G=3, H=4) — détail dans chaque phase ci-dessous.

---

## 🔗 Dépendances inter-phases (diagramme)

```
                    ┌──────────────┐
                    │   PHASE A    │  ← Fondation : enrichir schemas
                    │  4.5j (FE)   │
                    └──────┬───────┘
                           │ (≥ 🟡 débloque B ; ✅ débloque C, D, E)
              ┌────────────┼────────────┬──────────────┐
              │            │            │              │
              ▼ (≥ 🟡)     ▼ (✅)       ▼ (✅)         ▼ (✅)
       ┌────────────┐ ┌────────────┐ ┌────────────┐ ┌────────────┐
       │  PHASE B   │ │  PHASE C   │ │  PHASE D   │ │  PHASE E   │
       │ 6.5j (BE)  │ │  6j (AI)   │ │ 3.5j (FE)  │ │ 2.5j (BE)  │
       └──────┬─────┘ └────────────┘ └────────────┘ └──────┬─────┘
              │                                           │ (✅ débloque F)
              │ (≥ 🟡 débloque E)                         │
              └─────────────────┐                         │
                                │                         ▼ (✅)
                         ┌────────────┐          ┌────────────┐
                         │  PHASE E   │          │  PHASE F   │
                         │ 2.5j (BE)  │          │ 6.5j (FS)  │
                         └────────────┘          └──────┬─────┘
                                                        │ (≥ 🟡 débloque G)
                                                        ▼
                                                 ┌────────────┐
                                                 │  PHASE G   │
                                                 │  2j (FE)   │
                                                 └──────┬─────┘
                                                        │ (✅ débloque H)
                                                        ▼
                                                 ┌────────────┐
                                                 │  PHASE H   │
                                                 │ 3.5j (DE)  │
                                                 └────────────┘
```

**Légende** :
- `─→` = "débloque" (la phase cible ne peut pas démarrer avant que la source atteigne ce statut)
- `A (≥ 🟡)` = la phase A doit être au moins "En cours" (donc ≥ 50% avancée)
- `A (✅)` = la phase A doit être "Terminée" (mergée + testée)

---

## 🚨 Critical path (chemin critique)

Le **chemin critique** est la séquence de phases qui détermine la date de fin minimale. Tout retard sur ces phases retarde le projet entier.

```
A (4.5j) → B (6.5j) → E (2.5j) → F (6.5j) → G (2j) → H (3.5j)
```

**Total critical path** : **25 jours** (= 5 semaines en séquentiel strict)

**Phases hors critical path** (peuvent être parallélisées sans retard) :
- **C** (IA, 6j) : peut démarrer dès A terminé, en parallèle avec B
- **D** (Requis contextuels, 3.5j) : peut démarrer dès A terminé, en parallèle avec B et C

### Plan optimal avec 3 devs

| Semaine | @frontend-dev | @backend-dev | @ai-engineer |
|---------|---------------|---------------|----------------|
| **S1** (15-19/06) | **A** (enrichissement) | — | — |
| **S2** (22-26/06) | **D** (requis contextuels) | **B** (doc hybride) | **C** (IA assistée) |
| **S3** (29/06-03/07) | — | **E** (API+Webhooks) | — |
| **S3-S4** (29/06-08/07) | — | — | **F** (scénarios, démarre 30/06 après E) |
| **S4** (06-10/07) | **G** (nouvelles catégories) | — | — |
| **S5** (09-15/07) | **H** (polish) | **H** (polish) | **H** (polish) |

**Date de fin optimale** : **mardi 15 juillet 2026** (5 semaines, 3 devs en parallèle)

---

## 📋 Détail Phase A — Enrichissement des schémas (MVP)

**Objectif** : 17 catégories à 6-12 champs chacune, sans IA ni scénarios.

**Owner** : 👤 @frontend-dev
**Effort** : 4.5j
**Cible** : **15/06 (lundi)** → **19/06 (vendredi)**

| Tâche | Description | Fichiers | Effort | Owner | Statut |
|-------|-------------|----------|--------|-------|--------|
| **A.1** | Enrichir `propertySchemas.js` (17 catégories, 6-12 champs) | `src/code-city/propertySchemas.js` | 1.5j | @frontend-dev | ⬜ |
| **A.2** | Mettre à jour le panneau propriétés (afficher 6-12 champs) | `src/code-city/quartierCenter/centerAuxPanels.js` | 1j | @frontend-dev | ⬜ |
| **A.3** | Validation des champs requis (basique, pas contextuel) | `propertySchemas.js` + UI | 0.5j | @frontend-dev | ⬜ |
| **A.4** | Tests unitaires sur les schémas | `src/code-city/propertySchemas.test.js` (nouveau) | 0.5j | @frontend-dev | ⬜ |
| **A.5** | Tests E2E : remplir un nœud de chaque catégorie | `e2e/properties.spec.js` | 1j | @qa | ⬜ |

**Critères d'acceptation** :
- [ ] Les 17 catégories ont 6-12 champs (vs 3-6 actuellement)
- [ ] Le panneau UI affiche tous les champs sans scroll excessif
- [ ] Les champs requis basiques bloquent l'export
- [ ] Coverage tests unitaires ≥ 80%
- [ ] Tests E2E passent sur 5 catégories au moins

**Livrable** : Les 17 catégories ont 6-12 champs. L'user peut les remplir. Pas encore d'IA.

**Débloque** : B (≥ 🟡), C (✅), D (✅), E (✅)

---

## 📋 Détail Phase B — Documentation hybride

**Objectif** : Export Markdown + sidecar JSON, regen live.

**Owner** : ⚙️ @backend-dev
**Effort** : 6.5j
**Cible** : **18/06 (mercredi)** → **26/06 (vendredi)**
**Dépendances** : A (≥ 🟡)

| Tâche | Description | Fichiers | Effort | Owner | Statut |
|-------|-------------|----------|--------|-------|--------|
| **B.1** | `liveDocRegenerator.js` : regen à chaque modif (debounced 500ms) | `src/code-city/mermaid/liveDocRegenerator.js` (nouveau) | 1j | @backend-dev | ⬜ |
| **B.2** | Templates Markdown par catégorie (17 templates) | `src/code-city/mermaid/docGenerator.js` (enrichir) | 1j | @backend-dev | ⬜ |
| **B.3** | Génération sidecar JSON (un fichier par nœud) | `mermaid/docGenerator.js` | 0.5j | @backend-dev | ⬜ |
| **B.4** | `zipExporter.js` : structure complète (nodes/, relations/, AGENTS.md) | `src/code-city/mermaid/zipExporter.js` (enrichir) | 1j | @backend-dev | ⬜ |
| **B.5** | `index.json` global (catalogue de tous les nœuds) | `mermaid/docGenerator.js` | 0.5j | @backend-dev | ⬜ |
| **B.6** | `AGENTS.md` auto-généré (prompt système résumé) | `mermaid/zipExporter.js` | 0.5j | @backend-dev | ⬜ |
| **B.7** | Tests : round-trip Markdown ↔ JSON | `docGenerator.test.js` | 1j | @qa | ⬜ |
| **B.8** | Tests E2E : export ZIP, vérifier structure | `e2e/export.spec.js` (enrichir) | 1j | @qa | ⬜ |

**Critères d'acceptation** :
- [ ] Toute modification d'un nœud déclenche regen en < 500ms
- [ ] Export ZIP contient : `README.md`, `AGENTS.md`, `index.json`, `diagram.svg`, `nodes/`, `relations/`
- [ ] Round-trip MD ↔ JSON : 0 perte d'info
- [ ] Tests E2E export passent

**Livrable** : Export ZIP complet avec Markdown + JSON. Regen live fonctionnel.

**Débloque** : E (≥ 🟡)

---

## 📋 Détail Phase C — IA assistée (remplissage)

**Objectif** : L'IA propose 80% des champs, l'user valide.

**Owner** : 🤖 @ai-engineer
**Effort** : 6j
**Cible** : **22/06 (lundi)** → **29/06 (lundi)**
**Dépendances** : A (✅)

| Tâche | Description | Fichiers | Effort | Owner | Statut |
|-------|-------------|----------|--------|-------|--------|
| **C.1** | `propertiesEnricher.js` : défauts intelligents depuis le graphe | `src/code-city/ai/propertiesEnricher.js` (nouveau) | 2j | @ai-engineer | ⬜ |
| **C.2** | `promptInjector.js` : injection du canvas dans le prompt | `src/code-city/ai/promptInjector.js` (nouveau) | 1j | @ai-engineer | ⬜ |
| **C.3** | UI : bouton "L'IA propose" + affichage suggestions | `centerAuxPanels.js` | 1j | @frontend-dev | ⬜ |
| **C.4** | UI : validation/refus champ par champ | `centerAuxPanels.js` | 0.5j | @frontend-dev | ⬜ |
| **C.5** | Gating de confiance (seuil 70%) | `propertiesEnricher.js` | 0.5j | @ai-engineer | ⬜ |
| **C.6** | Tests : scénarios de proposition | `propertiesEnricher.test.js` | 1j | @qa | ⬜ |

**Critères d'acceptation** :
- [ ] L'IA propose ≥ 80% des champs automatiquement
- [ ] Gating confiance ≥ 70% fonctionne (champs incertains non proposés)
- [ ] L'user peut overrider toute suggestion
- [ ] Tests couvrent 10+ scénarios de proposition

**Livrable** : L'IA propose, l'user valide, les champs sont remplis.

**Hors critical path** (peut être parallélisé avec B, D, E).

---

## 📋 Détail Phase D — Champs requis contextuels

**Objectif** : Un champ devient requis selon la valeur d'un autre.

**Owner** : 👤 @frontend-dev
**Effort** : 3.5j
**Cible** : **22/06 (lundi)** → **25/06 (jeudi)**
**Dépendances** : A (✅)

| Tâche | Description | Fichiers | Effort | Owner | Statut |
|-------|-------------|----------|--------|-------|--------|
| **D.1** | `conditionalValidator.js` : évalue les conditions | `src/code-city/ai/conditionalValidator.js` (nouveau) | 1j | @frontend-dev | ⬜ |
| **D.2** | UI : indicateur visuel des champs requis | `centerAuxPanels.js` | 1j | @frontend-dev | ⬜ |
| **D.3** | UI : message d'erreur contextuel | `centerAuxPanels.js` | 0.5j | @frontend-dev | ⬜ |
| **D.4** | Tests : 10+ scénarios de validation (cf §3.3 spec) | `conditionalValidator.test.js` | 1j | @qa | ⬜ |

**Critères d'acceptation** :
- [ ] Les 4 scénarios de §3.3 (OAuth2, Bloqué, Production, External API) fonctionnent
- [ ] Badge rouge "Requis" sur les champs conditionnels
- [ ] Message d'erreur contextuel affiché
- [ ] Tests : 10+ scénarios passent (cf spec §3.3)

**Livrable** : Champs requis contextuels fonctionnels.

**Hors critical path** (le plus rapide, parallélisable avec C, E).

---

## 📋 Détail Phase E — API HTTP + Webhooks (canaux 2+3+4)

**Objectif** : Consommation live via API REST et prompt injection.

**Owner** : ⚙️ @backend-dev
**Effort** : 2.5j
**Cible** : **25/06 (mercredi)** → **29/06 (lundi)**
**Dépendances** : A (✅) + B (≥ 🟡)

| Tâche | Description | Fichiers | Effort | Owner | Statut |
|-------|-------------|----------|--------|-------|--------|
| **E.1** | `canvasAPI.js` : 17 endpoints REST (cf spec §5.2.4 — health, openapi, canvas CRUD, nodes CRUD, edges CRUD, schema, export.zip, ai/suggest, ai/validate) | `src/code-city/api/canvasAPI.js` (nouveau) | 1j | @backend-dev | ⬜ |
| **E.2** | `webhooks.js` : 7 endpoints management + 1 delivery worker (cf spec §5.4.2 — POST/GET/PATCH/DELETE/rotate-secret/deliveries/test) | `src/code-city/api/webhooks.js` (nouveau) | 1j | @backend-dev | ⬜ |
| **E.3** | Tests : endpoints répondent correctement (200/400/401/429) | `canvasAPI.test.js` + `webhooks.test.js` | 0.5j | @qa | ⬜ |

**Critères d'acceptation** :
- [ ] 17 endpoints REST documentés dans §5.2.4 fonctionnent
- [ ] 7 endpoints webhooks + delivery worker fonctionnent
- [ ] HMAC-SHA256 vérifiable côté subscriber
- [ ] Tests : 200/400/401/429/500 couvrent les codes d'erreur

**Livrable** : 3 nouveaux canaux de consommation fonctionnels (API + Webhooks + Prompt injection).

**Débloque** : F (✅)

---

## 📋 Détail Phase F — Scénarios & découverte de nœuds

**Objectif** : Le méta-outil scénarios fonctionne.

**Owner** : 🎨 @fullstack-dev
**Effort** : 6.5j
**Cible** : **30/06 (mardi)** → **08/07 (mercredi)**
**Dépendances** : E (✅)

| Tâche | Description | Fichiers | Effort | Owner | Statut |
|-------|-------------|----------|--------|-------|--------|
| **F.1** | Créer dossier `scenarios/` + 3 fichiers exemples (cf spec §6.5 : `vitrine-perso.md`, `saas-b2b.md`, `marketplace.md`) | `scenarios/*.md` | 0.5j | @fullstack-dev | ⬜ |
| **F.2** | `scenarioAnalyzer.js` : lit les scénarios, extrait termes | `src/code-city/ai/scenarioAnalyzer.js` (nouveau) | 2j | @ai-engineer | ⬜ |
| **F.3** | UI : panneau "Analyse des scénarios" | (nouveau panneau UI) | 1j | @frontend-dev | ⬜ |
| **F.4** | UI : workflow de validation des termes | (nouveau panneau UI) | 1j | @frontend-dev | ⬜ |
| **F.5** | Mécanisme d'ajout d'un nouveau nœud (palette + schema) | `propertySchemas.js` + `menuMermaidActionsLeft.js` | 1j | @fullstack-dev | ⬜ |
| **F.6** | Tests : 3 scénarios → 10+ termes extraits | `scenarioAnalyzer.test.js` | 1j | @qa | ⬜ |

**Critères d'acceptation** :
- [ ] 3 scénarios dans `scenarios/` (cf spec §6.5 : vitrine-perso, saas-b2b, marketplace)
- [ ] L'IA extrait ≥ 10 termes par scénario
- [ ] L'user peut valider/refuser chaque terme
- [ ] Un terme validé peut être ajouté à la collection en 1 clic
- [ ] Les scénarios ne sont JAMAIS dans l'export ZIP

**Livrable** : 3 scénarios dans `scenarios/`, workflow de découverte opérationnel.

**Débloque** : G (≥ 🟡)

---

## 📋 Détail Phase G — Nouvelles catégories

**Objectif** : Étendre la palette avec les catégories révélées par les scénarios.

**Owner** : 👤 @frontend-dev
**Effort** : 2j
**Cible** : **06/07 (lundi)** → **08/07 (mercredi)**
**Dépendances** : F (≥ 🟡)

| Tâche | Description | Fichiers | Effort | Owner | Statut |
|-------|-------------|----------|--------|-------|--------|
| **G.1** | Ajouter `monitoring`, `compliance`, `localization`, `mobile`, `api-versioning`, `feature-flag` | `propertySchemas.js` | 1j | @frontend-dev | ⬜ |
| **G.2** | Ajouter les types correspondants à la palette | `menuMermaidActionsLeft.js` | 0.5j | @frontend-dev | ⬜ |
| **G.3** | Tests : nouveaux types fonctionnels | (enrichir tests existants) | 0.5j | @qa | ⬜ |

**Critères d'acceptation** :
- [ ] +6 catégories ajoutées
- [ ] +30-50 types ajoutés (vs 153 de base)
- [ ] Total ≥ 200 types dans la palette

**Livrable** : +6 catégories, +30-50 types, ~200+ nœuds total.

**Débloque** : H (✅)

---

## 📋 Détail Phase H — Polish & optimisation

**Objectif** : Performance, UX, charge, doc utilisateur.

**Owner** : 🚀 @devops + 👑 @tech-lead
**Effort** : 3.5j
**Cible** : **09/07 (jeudi)** → **15/07 (mardi)**
**Dépendances** : A-G (✅)

| Tâche | Description | Fichiers | Effort | Owner | Statut |
|-------|-------------|----------|--------|-------|--------|
| **H.1** | Performance : regen live < 500ms pour 500 nœuds | (optimisation) | 1j | @devops | ⬜ |
| **H.2** | UX : animations, transitions, feedback visuel | (CSS + UI) | 1j | @frontend-dev | ⬜ |
| **H.3** | Tests de charge (500+ nœuds) | (k6 / artillery) | 0.5j | @qa | ⬜ |
| **H.4** | Documentation utilisateur (README, guide, screenshots) | `README.md` + `docs/` | 1j | @tech-lead | ⬜ |

**Critères d'acceptation** :
- [ ] Regen live < 500ms pour 500 nœuds (mesuré avec k6)
- [ ] Animations fluides (60 FPS)
- [ ] Tests E2E + unitaires à 100% verts
- [ ] README à jour avec screenshots, guide d'utilisation, FAQ

**Livrable** : Production-ready, documenté, optimisé.

---

## ⚠️ Risques de planning

| # | Risque | Impact | Probabilité | Mitigation |
|---|--------|--------|-------------|------------|
| **R1** | Phase A (enrichissement) prend +50% de temps (sous-estimation 6-12 champs) | Retarde B, C, D, E | 🟡 Moyen | Commencer par 3 catégories pilotes pour calibrer l'effort |
| **R2** | L'IA (Phase C) hallucine des champs, gating confiance ne suffit pas | Retarde C | 🟡 Moyen | Tests intensifs sur scénarios réels avant de ship |
| **R3** | Phase B (regen live) trop lente pour 500+ nœuds | Bloque Phase H | 🔴 Élevé | Benchmarker tôt (fin S1), debounce agressif si besoin |
| **R4** | Webhooks delivery worker (Phase E.2) complexe (retry, HMAC, queue) | Retarde F | 🟡 Moyen | Utiliser une lib existante (BullMQ + ioredis) |
| **R5** | Scénarios (Phase F) révèlent trop de nouveaux nœuds → scope creep | Retarde G | 🟢 Faible | Limiter à 10 termes max par scénario initialement |
| **R6** | Phase G (nouvelles catégories) nécessite des décisions métier | Bloque H | 🟢 Faible | Valider les catégories avec @product-owner avant G.1 |
| **R7** | Charge 500+ nœuds trop ambitieuse (Phase H.1) | Repousse H.1 | 🟡 Moyen | Réduire à 200 nœuds si perf insuffisante |
| **R8** | Owner @frontend-dev indispo pendant S2-S3 | Bloque D, G | 🟡 Moyen | Backup : @fullstack-dev peut prendre le relais |

**Plan B si retard majeur (>2 semaines)** :
- Décaler H (polish) à S6
- Reporter webhooks (Phase E.2) à un sprint ultérieur
- Sortir en v1 sans IA (Phase C) si nécessaire

---

## ✅ Checklist globale (quand marquer le projet "Done")

### Technique
- [ ] Les 17 catégories enrichies (Phase A ✅)
- [ ] Documentation hybride fonctionnelle (Phase B ✅)
- [ ] API REST + Webhooks opérationnels (Phase E ✅)
- [ ] Scénarios → nouveaux nœuds (Phase F ✅)
- [ ] ≥ 200 types dans la palette (Phase G ✅)
- [ ] Regen live < 500ms pour 200+ nœuds (Phase H ✅)
- [ ] Tests E2E + unitaires à 100% verts
- [ ] Coverage ≥ 80%

### Documentation
- [ ] Spec à jour (`.dev-plans/nœuds-proprietes-spec.md`)
- [ ] TODOs à jour (ce fichier)
- [ ] README utilisateur avec screenshots
- [ ] Guide de contribution (pour ajouter un nouveau type)
- [ ] Changelog (`.dev-plans/CHANGELOG.md` à créer)

### Métriques (cf spec §10)
- [ ] Nombre de types ≥ 200
- [ ] Nombre moyen de champs par catégorie ≥ 9
- [ ] ≥ 80% des nœuds avec champs critiques remplis (sur un projet type)
- [ ] Latence regen live < 500ms pour 100 nœuds

### Validation utilisateur
- [ ] 1 projet test complet créé par un user non-tech
- [ ] 1 agent IA (Mina) a pu lire le canvas et générer du code cohérent
- [ ] Feedback UX collecté et appliqué (≥ 5 retours)

---

## 🔗 Liens utiles

- **Spec source** : [`.dev-plans/nœuds-proprietes-spec.md`](./nœuds-proprietes-spec.md) (2 764 lignes)
- **Spec v0 (implémentée)** : [`.dev-plans/PLAN-PROPRIETES-EXPORT.md`](./PLAN-PROPRIETES-EXPORT.md) — phases 0-7
- **Code source** :
  - `src/code-city/propertySchemas.js` (à enrichir en Phase A)
  - `src/code-city/mermaid/docGenerator.js` (à enrichir en Phase B)
  - `src/code-city/ai/propertiesEnricher.js` (nouveau en Phase C)
  - `src/code-city/ai/conditionalValidator.js` (nouveau en Phase D)
  - `src/code-city/api/canvasAPI.js` (nouveau en Phase E)
  - `src/code-city/api/webhooks.js` (nouveau en Phase E)
  - `src/code-city/ai/scenarioAnalyzer.js` (nouveau en Phase F)
  - `scenarios/*.md` (nouveau en Phase F)

### Branches git suggérées
- `main` — prod
- `feature/phase-A-enrichissement` — Phase A
- `feature/phase-B-doc-hybride` — Phase B
- `feature/phase-C-ia-assistee` — Phase C
- `feature/phase-D-requis-contextuels` — Phase D
- `feature/phase-E-api-webhooks` — Phase E
- `feature/phase-F-scenarios` — Phase F
- `feature/phase-G-nouvelles-categories` — Phase G
- `feature/phase-H-polish` — Phase H

### Outils recommandés
- **Project management** : GitHub Projects / Linear (backlog + sprint planning)
- **Code review** : GitHub PRs (2 reviewers minimum : tech-lead + 1 dev)
- **CI/CD** : GitHub Actions (lint + tests + build à chaque PR)
- **Documentation** : Markdown dans `.dev-plans/` (versionnée avec le code)

---

## 📊 Tracking

**Mise à jour** : Mettre à jour ce fichier à chaque fin de journée (statut des tâches, blockers découverts, dérives vs planning).

**Cérémonies suggérées** :
- **Daily standup** (15min) : où en suis-je, blockers, prochaines 24h
- **Weekly review** (1h le vendredi) : statut global, dérives, ajustements
- **Demo de fin de phase** (1h) : présentation du livrable + feedback PO

**Métriques à tracker en continu** :
- % completion par phase
- Vélocité (story points / sprint)
- Burndown chart (idéal vs réel)
- Nombre de bugs ouverts / fermés

---

**Dernière mise à jour** : 13 juin 2026
**Démarrage effectif** : lundi **15 juin 2026** (1er jour ouvré)
**Prochaine revue** : lundi 15 juin 2026 (kickoff Phase A + 1er daily standup)
**Statut global** : ⬜ À démarrer — Phase A commence lundi 16/06 (ou 13/06 si on est agile)
