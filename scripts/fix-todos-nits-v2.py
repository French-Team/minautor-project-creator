"""Re-run fixes 2-5 (FIX 1 dates already applied successfully in previous run).
Use ASCII-safe prints to avoid UnicodeEncodeError on Windows cp1252.
"""

import sys
import io

# Force UTF-8 stdout
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

filepath = '.dev-plans/nœuds-proprietes-todos.md'
with open(filepath, 'r', encoding='utf-8') as f:
    content = f.read()

original_length = len(content)

# ============================================================
# FIX 2 : Comptage des sous-tâches 41 -> 39
# ============================================================
old_count_block = """**Effort total** : 35j-homme en séquentiel, mais **~12-15j-homme en parallèle optimal** (3 devs)."""
new_count_block = """**Effort total** : **~35j-homme** en séquentiel, mais **~12-15j-homme en parallèle optimal** (3 devs).

**Sous-tâches totales** : **39** (A=5, B=8, C=6, D=4, E=3, F=6, G=3, H=4) — détail dans chaque phase ci-dessous."""

if old_count_block in content:
    content = content.replace(old_count_block, new_count_block)
    print('FIX 2 (sub-task count 41 to 39): OK')
else:
    print('FIX 2: anchor not found')
    raise SystemExit(1)

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
# FIX 3 : Phase E - "11 endpoints" -> clarification
# ============================================================
old_e1 = """| **E.1** | `canvasAPI.js` : 11 endpoints REST (cf spec §5.2.4) | `src/code-city/api/canvasAPI.js` (nouveau) | 1j | @backend-dev | ⬜ |
| **E.2** | `webhooks.js` : 7 endpoints + delivery worker (cf spec §5.4) | `src/code-city/api/webhooks.js` (nouveau) | 1j | @backend-dev | ⬜ |"""

new_e1 = """| **E.1** | `canvasAPI.js` : 17 endpoints REST (cf spec §5.2.4 — health, openapi, canvas CRUD, nodes CRUD, edges CRUD, schema, export.zip, ai/suggest, ai/validate) | `src/code-city/api/canvasAPI.js` (nouveau) | 1j | @backend-dev | ⬜ |
| **E.2** | `webhooks.js` : 7 endpoints management + 1 delivery worker (cf spec §5.4.2 — POST/GET/PATCH/DELETE/rotate-secret/deliveries/test) | `src/code-city/api/webhooks.js` (nouveau) | 1j | @backend-dev | ⬜ |"""

if old_e1 in content:
    content = content.replace(old_e1, new_e1)
    print('FIX 3 (E.1 endpoint count 11 to 17): OK')
else:
    print('FIX 3: anchor not found')

# Also update the title of Phase E
old_e_title = "## 📋 Détail Phase E — API HTTP + Prompt (canaux 2+3)"
new_e_title = "## 📋 Détail Phase E — API HTTP + Webhooks (canaux 2+3+4)"

if old_e_title in content:
    content = content.replace(old_e_title, new_e_title)
    print('FIX 3b (Phase E title): OK')
else:
    print('FIX 3b: anchor not found')

# Also update the acceptance criteria
old_e_criteria = "- [ ] 11 endpoints REST documentés dans §5.2.4 fonctionnent"
new_e_criteria = "- [ ] 17 endpoints REST documentés dans §5.2.4 fonctionnent"
if old_e_criteria in content:
    content = content.replace(old_e_criteria, new_e_criteria)
    print('FIX 3c (Phase E acceptance): OK')
else:
    print('FIX 3c: anchor not found')

# Update livrable
old_e_livrable = "**Livrable** : 2 nouveaux canaux de consommation fonctionnels (API + Webhooks)."
new_e_livrable = "**Livrable** : 3 nouveaux canaux de consommation fonctionnels (API + Webhooks + Prompt injection)."
if old_e_livrable in content:
    content = content.replace(old_e_livrable, new_e_livrable)
    print('FIX 3d (Phase E livrable): OK')
else:
    print('FIX 3d: anchor not found')

# Update the Vue d'ensemble row for Phase E
old_vue_e = "| **E** | API HTTP + Prompt (canaux 2+3) | 2.5j | ⚙️ @backend-dev | A (✅) + B (≥ 🟡) | **25/06** (mercredi) | **29/06** (lundi) | ⬜ |"
new_vue_e = "| **E** | API HTTP + Webhooks (canaux 2+3+4) | 2.5j | ⚙️ @backend-dev | A (✅) + B (≥ 🟡) | **25/06** (mercredi) | **29/06** (lundi) | ⬜ |"
if old_vue_e in content:
    content = content.replace(old_vue_e, new_vue_e)
    print('FIX 3e (Vue d ensemble Phase E): OK')
else:
    print('FIX 3e: anchor not found')

# Update the optimal plan table for S3
old_s3 = "| **S3** (29/06-03/07) | — | **E** (API+Prompt) | — |"
new_s3 = "| **S3** (29/06-03/07) | — | **E** (API+Webhooks) | — |"
if old_s3 in content:
    content = content.replace(old_s3, new_s3)
    print('FIX 3f (S3 plan): OK')
else:
    print('FIX 3f: anchor not found')

# ============================================================
# FIX 4 (NIT) : Statut global : 🟡 -> ⬜
# ============================================================
old_status = "**Statut global** : 🟡 À démarrer"
new_status = "**Statut global** : ⬜ À démarrer"
if old_status in content:
    content = content.replace(old_status, new_status)
    print('FIX 4 (statut global icon): OK')
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
new_f1_crit = "- [ ] 3 scénarios dans `scenarios/` (cf spec §6.5 : vitrine-perso, saas-b2b, marketplace)"
if old_f1_crit in content:
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
