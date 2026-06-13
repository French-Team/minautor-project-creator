"""Fix 3 corrections + 2 nits flagged by code-reviewer on the TODO file.

Corrections:
1. Date de démarrage : 13/06/2026 (samedi) → 15/06/2026 (lundi). Toutes les dates glissent.
2. Comptage des sous-tâches : 41 → 39 (A=5, B=8, C=6, D=4, E=3, F=6, G=3, H=4 = 39).
3. Phase E.1 mentionne "11 endpoints" mais le spec §5.2.4 liste 17 endpoints. Clarifier.

Nits:
4. 'Statut global : 🟡 À démarrer' → '⬜ À démarrer' (cohérence avec la légende).
5. F.1 doit référencer les 3 noms de scénarios de la spec §6.5.
"""

filepath = '.dev-plans/nœuds-proprietes-todos.md'
with open(filepath, 'r', encoding='utf-8') as f:
    content = f.read()

original_length = len(content)

# ============================================================
# FIX 1 : Date de démarrage 13/06 → 15/06 (samedi → lundi)
# Toutes les dates cibles glissent d'1-2 jours ouvrés
# ============================================================
date_replacements = [
    # Header
    ('**Date cible de fin** : **1er août 2026** (~7 semaines)',
     '**Date cible de fin** : **mardi 15 juillet 2026** (~5 semaines)'),
    ('**Date de création** : 13 juin 2026',
     '**Date de création** : 13 juin 2026 (samedi, démarrage effectif lundi **15 juin 2026**)'),
    # Vue d'ensemble
    ('| **A** | Enrichissement des schémas (MVP) | 4.5j | 👤 @frontend-dev | — | 13/06 | 19/06 | ⬜ |',
     '| **A** | Enrichissement des schémas (MVP) | 4.5j | 👤 @frontend-dev | — | **15/06** (lundi) | **19/06** (vendredi) | ⬜ |'),
    ('| **B** | Documentation hybride (Markdown + JSON) | 6.5j | ⚙️ @backend-dev | A (≥ 🟡) | 16/06 | 25/06 | ⬜ |',
     '| **B** | Documentation hybride (Markdown + JSON) | 6.5j | ⚙️ @backend-dev | A (≥ 🟡) | **18/06** (mercredi) | **26/06** (vendredi) | ⬜ |'),
    ('| **C** | IA assistée (remplissage) | 6j | 🤖 @ai-engineer | A (✅) | 20/06 | 29/06 | ⬜ |',
     '| **C** | IA assistée (remplissage) | 6j | 🤖 @ai-engineer | A (✅) | **22/06** (lundi) | **29/06** (lundi) | ⬜ |'),
    ('| **D** | Champs requis contextuels | 3.5j | 👤 @frontend-dev | A (✅) | 20/06 | 25/06 | ⬜ |',
     '| **D** | Champs requis contextuels | 3.5j | 👤 @frontend-dev | A (✅) | **22/06** (lundi) | **25/06** (jeudi) | ⬜ |'),
    ('| **E** | API HTTP + Prompt (canaux 2+3) | 2.5j | ⚙️ @backend-dev | A (✅) + B (≥ 🟡) | 23/06 | 26/06 | ⬜ |',
     '| **E** | API HTTP + Webhooks (canaux 2+3) | 2.5j | ⚙️ @backend-dev | A (✅) + B (≥ 🟡) | **25/06** (mercredi) | **29/06** (lundi) | ⬜ |'),
    ('| **F** | Scénarios & découverte de nœuds | 6.5j | 🎨 @fullstack-dev | E (✅) | 27/06 | 06/07 | ⬜ |',
     '| **F** | Scénarios & découverte de nœuds | 6.5j | 🎨 @fullstack-dev | E (✅) | **30/06** (mardi) | **08/07** (mercredi) | ⬜ |'),
    ('| **G** | Nouvelles catégories (monitoring, compliance…) | 2j | 👤 @frontend-dev | F (≥ 🟡) | 04/07 | 07/07 | ⬜ |',
     '| **G** | Nouvelles catégories (monitoring, compliance…) | 2j | 👤 @frontend-dev | F (≥ 🟡) | **06/07** (lundi) | **08/07** (mercredi) | ⬜ |'),
    ('| **H** | Polish & optimisation | 3.5j | 🚀 @devops + 👑 @tech-lead | A-G (✅) | 08/07 | 13/07 | ⬜ |',
     '| **H** | Polish & optimisation | 3.5j | 🚀 @devops + 👑 @tech-lead | A-G (✅) | **09/07** (jeudi) | **15/07** (mardi) | ⬜ |'),
    # Critical path dates
    ('**Date de fin optimale** : **13 juillet 2026** (5 semaines, 3 devs en parallèle)',
     '**Date de fin optimale** : **mardi 15 juillet 2026** (5 semaines, 3 devs en parallèle)'),
    # Optimal plan table
    ('| **S1** (13-19/06) | **A** (enrichissement) | — | — |',
     '| **S1** (15-19/06) | **A** (enrichissement) | — | — |'),
    ('| **S2** (20-26/06) | **D** (requis contextuels) | **B** (doc hybride) | **C** (IA assistée) |',
     '| **S2** (22-26/06) | **D** (requis contextuels) | **B** (doc hybride) | **C** (IA assistée) |'),
    ('| **S3** (27/06-03/07) | — | **E** (API+Prompt) | — |',
     '| **S3** (29/06-03/07) | — | **E** (API+Webhooks) | — |'),
    ('| **S3-S4** (27/06-06/07) | — | — | **F** (scénarios, démarre 27/06 après E) |',
     '| **S3-S4** (29/06-08/07) | — | — | **F** (scénarios, démarre 30/06 après E) |'),
    ('| **S4** (04-10/07) | **G** (nouvelles catégories) | — | — |',
     '| **S4** (06-10/07) | **G** (nouvelles catégories) | — | — |'),
    ('| **S5** (08-13/07) | **H** (polish) | **H** (polish) | **H** (polish) |',
     '| **S5** (09-15/07) | **H** (polish) | **H** (polish) | **H** (polish) |'),
    # Phase A dates
    ('**Cible** : 13/06 → 19/06',
     '**Cible** : **15/06 (lundi)** → **19/06 (vendredi)**'),
    # Phase B dates
    ('**Cible** : 16/06 → 25/06',
     '**Cible** : **18/06 (mercredi)** → **26/06 (vendredi)**'),
    # Phase C dates
    ('**Cible** : 20/06 → 29/06',
     '**Cible** : **22/06 (lundi)** → **29/06 (lundi)**'),
    # Phase D dates
    ('**Cible** : 20/06 → 25/06',
     '**Cible** : **22/06 (lundi)** → **25/06 (jeudi)**'),
    # Phase E dates
    ('**Cible** : 23/06 → 26/06',
     '**Cible** : **25/06 (mercredi)** → **29/06 (lundi)**'),
    # Phase F dates
    ('**Cible** : 27/06 → 06/07',
     '**Cible** : **30/06 (mardi)** → **08/07 (mercredi)**'),
    # Phase G dates
    ('**Cible** : 04/07 → 07/07',
     '**Cible** : **06/07 (lundi)** → **08/07 (mercredi)**'),
    # Phase H dates
    ('**Cible** : 08/07 → 13/07',
     '**Cible** : **09/07 (jeudi)** → **15/07 (mardi)**'),
]

date_fix_count = 0
for old, new in date_replacements:
    if old in content:
        content = content.replace(old, new)
        date_fix_count += 1
    else:
        print(f'  DATE FIX MISS: {old[:60]}...')

print(f'FIX 1 (date sliding): {date_fix_count}/{len(date_replacements)} replacements applied')

# ============================================================
# FIX 2 : Comptage des sous-tâches 41 → 39
# ============================================================
old_count_block = """**Effort total** : 35j-homme en séquentiel, mais **~12-15j-homme en parallèle optimal** (3 devs)."""
new_count_block = """**Effort total** : **~35j-homme** en séquentiel, mais **~12-15j-homme en parallèle optimal** (3 devs).

**Sous-tâches totales** : **39** (A=5, B=8, C=6, D=4, E=3, F=6, G=3, H=4) — détail dans chaque phase ci-dessous."""

if old_count_block in content:
    content = content.replace(old_count_block, new_count_block)
    print('FIX 2 (sub-task count 41→39): OK')
else:
    print('FIX 2: anchor not found')

# Also update the spec reference at the top
old_spec_effort = """**Estimation totale** : **~25 jours** (single fullstack) ou **~12-15 jours** (3 devs en parallèle)"""
new_spec_effort = """**Estimation totale** : **~25 jours** (single fullstack) ou **~12-15 jours** (3 devs en parallèle)
**Sous-tâches** : **39** (A=5, B=8, C=6, D=4, E=3, F=6, G=3, H=4)"""

if old_spec_effort in content:
    content = content.replace(old_spec_effort, new_spec_effort)
    print('FIX 2b (header effort): OK')
else:
    print('FIX 2b: anchor not found')

# ============================================================
# FIX 3 : Phase E — "11 endpoints" → clarification
# ============================================================
old_e1 = """| **E.1** | `canvasAPI.js` : 11 endpoints REST (cf spec §5.2.4) | `src/code-city/api/canvasAPI.js` (nouveau) | 1j | @backend-dev | ⬜ |
| **E.2** | `webhooks.js` : 7 endpoints + delivery worker (cf spec §5.4) | `src/code-city/api/webhooks.js` (nouveau) | 1j | @backend-dev | ⬜ |"""

new_e1 = """| **E.1** | `canvasAPI.js` : 17 endpoints REST (cf spec §5.2.4 — health, openapi, canvas CRUD, nodes CRUD, edges CRUD, schema, export.zip, ai/suggest, ai/validate) | `src/code-city/api/canvasAPI.js` (nouveau) | 1j | @backend-dev | ⬜ |
| **E.2** | `webhooks.js` : 7 endpoints management + 1 delivery worker (cf spec §5.4.2 — POST/GET/PATCH/DELETE/rotate-secret/deliveries/test) | `src/code-city/api/webhooks.js` (nouveau) | 1j | @backend-dev | ⬜ |"""

if old_e1 in content:
    content = content.replace(old_e1, new_e1)
    print('FIX 3 (E.1 endpoint count 11→17 + clarification): OK')
else:
    print('FIX 3: anchor not found')

# Also update the title of Phase E (was "API HTTP + Prompt" should be "API HTTP + Webhooks")
old_e_title = "## 📋 Détail Phase E — API HTTP + Prompt (canaux 2+3)"
new_e_title = "## 📋 Détail Phase E — API HTTP + Webhooks (canaux 2+3+4)"

if old_e_title in content:
    content = content.replace(old_e_title, new_e_title)
    print('FIX 3b (Phase E title): OK')
else:
    print('FIX 3b: anchor not found')

# Also update the "11 endpoints répondent correctement" in acceptance criteria
old_e_criteria = "- [ ] 11 endpoints REST documentés dans §5.2.4 fonctionnent"
new_e_criteria = "- [ ] 17 endpoints REST documentés dans §5.2.4 fonctionnent"
if old_e_criteria in content:
    content = content.replace(old_e_criteria, new_e_criteria)
    print('FIX 3c (Phase E acceptance criteria): OK')
else:
    print('FIX 3c: anchor not found')

# Also update "2 nouveaux canaux" → "3 nouveaux canaux"
old_e_livrable = "**Livrable** : 2 nouveaux canaux de consommation fonctionnels (API + Webhooks)."
new_e_livrable = "**Livrable** : 3 nouveaux canaux de consommation fonctionnels (API + Webhooks + Prompt injection)."
if old_e_livrable in content:
    content = content.replace(old_e_livrable, new_e_livrable)
    print('FIX 3d (Phase E livrable): OK')
else:
    print('FIX 3d: anchor not found')

# ============================================================
# FIX 4 (NIT) : 'Statut global : 🟡 À démarrer' → '⬜ À démarrer'
# ============================================================
old_status = "**Statut global** : 🟡 À démarrer"
new_status = "**Statut global** : ⬜ À démarrer"
if old_status in content:
    content = content.replace(old_status, new_status)
    print('FIX 4 (statut global 🟡→⬜): OK')
else:
    print('FIX 4: anchor not found')

# Also the last line
old_last_status = "**Statut global** : 🟡 À démarrer — Phase A commence lundi 16/06 (ou 13/06 si on est agile)"
new_last_status = "**Statut global** : ⬜ À démarrer — Phase A commence lundi **15/06/2026** (1er jour ouvré après la création de ce fichier)"
if old_last_status in content:
    content = content.replace(old_last_status, new_last_status)
    print('FIX 4b (last status): OK')
else:
    print('FIX 4b: anchor not found')

# ============================================================
# FIX 5 (NIT) : F.1 doit référencer les 3 scénarios de la spec §6.5
# ============================================================
old_f1 = """| **F.1** | Créer dossier `scenarios/` + 3 fichiers exemples | `scenarios/*.md` | 0.5j | @fullstack-dev | ⬜ |"""

new_f1 = """| **F.1** | Créer dossier `scenarios/` + 3 fichiers exemples (cf spec §6.5 : `vitrine-perso.md`, `saas-b2b.md`, `marketplace.md`) | `scenarios/*.md` | 0.5j | @fullstack-dev | ⬜ |"""

if old_f1 in content:
    content = content.replace(old_f1, new_f1)
    print('FIX 5 (F.1 scenario names): OK')
else:
    print('FIX 5: anchor not found')

# Also update the F.1 acceptance criteria
old_f1_crit = "- [ ] 3 scénarios dans `scenarios/` (vitrine-perso, saas-b2b, marketplace)"
if old_f1_crit in content:
    # Already correct, but add explicit reference
    new_f1_crit = "- [ ] 3 scénarios dans `scenarios/` (cf spec §6.5 : vitrine-perso, saas-b2b, marketplace)"
    content = content.replace(old_f1_crit, new_f1_crit)
    print('FIX 5b (F.1 acceptance): OK')
else:
    print('FIX 5b: anchor not found')

# Update last update + next review dates
old_dates = """**Dernière mise à jour** : 13 juin 2026
**Prochaine revue** : 14 juin 2026 (standup quotidien)"""
new_dates = """**Dernière mise à jour** : 13 juin 2026
**Démarrage effectif** : lundi **15 juin 2026** (1er jour ouvré)
**Prochaine revue** : lundi 15 juin 2026 (kickoff Phase A + 1er daily standup)"""
if old_dates in content:
    content = content.replace(old_dates, new_dates)
    print('FIX dates (last update + next review): OK')
else:
    print('FIX dates: anchor not found')

# Write the file
with open(filepath, 'w', encoding='utf-8') as f:
    f.write(content)

print(f'\nFile updated: {filepath}')
print(f'Delta: {len(content) - original_length} chars')
print(f'Final size: {len(content)} chars')
