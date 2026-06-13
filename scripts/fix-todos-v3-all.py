"""V3 DEFINITIVE: Apply ALL 5 fixes in one pass with proper error handling.
Critical: v1 crashed BEFORE writing, so FIX 1 (dates) was never persisted.
This script writes after EACH fix to prevent data loss.
"""

import sys
import io

# Force UTF-8 stdout
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

filepath = '.dev-plans/nœuds-proprietes-todos.md'

def apply_fix(content, old, new, fix_name, allow_count_zero=False):
    """Apply a single fix and return the updated content. Print status."""
    if old in content:
        new_content = content.replace(old, new)
        # Write immediately to prevent data loss on crash
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(new_content)
        print(f'OK: {fix_name}')
        return new_content
    else:
        if allow_count_zero:
            print(f'SKIP: {fix_name} (anchor not found, may be already applied)')
            return content
        else:
            print(f'FAIL: {fix_name} (anchor not found)')
            return content

with open(filepath, 'r', encoding='utf-8') as f:
    content = f.read()

original_length = len(content)
print(f'Starting: {original_length} chars')

# ============================================================
# FIX 1 : Date sliding (13/06 Sat -> 15/06 Mon, end 15/07 Tue)
# 25 replacements, write after each to prevent data loss
# ============================================================
fix1_replacements = [
    ('**Date cible de fin** : **1er août 2026** (~7 semaines)',
     '**Date cible de fin** : **mardi 15 juillet 2026** (~5 semaines)'),
    ('**Date de création** : 13 juin 2026',
     '**Date de création** : 13 juin 2026 (samedi, démarrage effectif lundi **15 juin 2026**)'),
    ('| **A** | Enrichissement des schémas (MVP) | 4.5j | 👤 @frontend-dev | — | 13/06 | 19/06 | ⬜ |',
     '| **A** | Enrichissement des schémas (MVP) | 4.5j | 👤 @frontend-dev | — | **15/06** (lundi) | **19/06** (vendredi) | ⬜ |'),
    ('| **B** | Documentation hybride (Markdown + JSON) | 6.5j | ⚙️ @backend-dev | A (≥ 🟡) | 16/06 | 25/06 | ⬜ |',
     '| **B** | Documentation hybride (Markdown + JSON) | 6.5j | ⚙️ @backend-dev | A (≥ 🟡) | **18/06** (mercredi) | **26/06** (vendredi) | ⬜ |'),
    ('| **C** | IA assistée (remplissage) | 6j | 🤖 @ai-engineer | A (✅) | 20/06 | 29/06 | ⬜ |',
     '| **C** | IA assistée (remplissage) | 6j | 🤖 @ai-engineer | A (✅) | **22/06** (lundi) | **29/06** (lundi) | ⬜ |'),
    ('| **D** | Champs requis contextuels | 3.5j | 👤 @frontend-dev | A (✅) | 20/06 | 25/06 | ⬜ |',
     '| **D** | Champs requis contextuels | 3.5j | 👤 @frontend-dev | A (✅) | **22/06** (lundi) | **25/06** (jeudi) | ⬜ |'),
    ('| **E** | API HTTP + Prompt (canaux 2+3) | 2.5j | ⚙️ @backend-dev | A (✅) + B (≥ 🟡) | 23/06 | 26/06 | ⬜ |',
     '| **E** | API HTTP + Webhooks (canaux 2+3+4) | 2.5j | ⚙️ @backend-dev | A (✅) + B (≥ 🟡) | **25/06** (mercredi) | **29/06** (lundi) | ⬜ |'),
    ('| **F** | Scénarios & découverte de nœuds | 6.5j | 🎨 @fullstack-dev | E (✅) | 27/06 | 06/07 | ⬜ |',
     '| **F** | Scénarios & découverte de nœuds | 6.5j | 🎨 @fullstack-dev | E (✅) | **30/06** (mardi) | **08/07** (mercredi) | ⬜ |'),
    ('| **G** | Nouvelles catégories (monitoring, compliance…) | 2j | 👤 @frontend-dev | F (≥ 🟡) | 04/07 | 07/07 | ⬜ |',
     '| **G** | Nouvelles catégories (monitoring, compliance…) | 2j | 👤 @frontend-dev | F (≥ 🟡) | **06/07** (lundi) | **08/07** (mercredi) | ⬜ |'),
    ('| **H** | Polish & optimisation | 3.5j | 🚀 @devops + 👑 @tech-lead | A-G (✅) | 08/07 | 13/07 | ⬜ |',
     '| **H** | Polish & optimisation | 3.5j | 🚀 @devops + 👑 @tech-lead | A-G (✅) | **09/07** (jeudi) | **15/07** (mardi) | ⬜ |'),
    ('**Date de fin optimale** : **13 juillet 2026** (5 semaines, 3 devs en parallèle)',
     '**Date de fin optimale** : **mardi 15 juillet 2026** (5 semaines, 3 devs en parallèle)'),
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
    ('**Cible** : 13/06 → 19/06',
     '**Cible** : **15/06 (lundi)** → **19/06 (vendredi)**'),
    ('**Cible** : 16/06 → 25/06',
     '**Cible** : **18/06 (mercredi)** → **26/06 (vendredi)**'),
    ('**Cible** : 20/06 → 29/06',
     '**Cible** : **22/06 (lundi)** → **29/06 (lundi)**'),
    ('**Cible** : 20/06 → 25/06',
     '**Cible** : **22/06 (lundi)** → **25/06 (jeudi)**'),
    ('**Cible** : 23/06 → 26/06',
     '**Cible** : **25/06 (mercredi)** → **29/06 (lundi)**'),
    ('**Cible** : 27/06 → 06/07',
     '**Cible** : **30/06 (mardi)** → **08/07 (mercredi)**'),
    ('**Cible** : 04/07 → 07/07',
     '**Cible** : **06/07 (lundi)** → **08/07 (mercredi)**'),
    ('**Cible** : 08/07 → 13/07',
     '**Cible** : **09/07 (jeudi)** → **15/07 (mardi)**'),
]

fix1_count = 0
fix1_skipped = 0
for i, (old, new) in enumerate(fix1_replacements, 1):
    if old in content:
        content = content.replace(old, new)
        fix1_count += 1
    else:
        fix1_skipped += 1
        print(f'  FIX 1.{i} SKIP: {old[:50]}...')

# Write FIX 1 immediately
with open(filepath, 'w', encoding='utf-8') as f:
    f.write(content)
print(f'FIX 1 (date sliding): {fix1_count}/{len(fix1_replacements)} applied, {fix1_skipped} skipped')

# ============================================================
# FIX 2 : Sub-task count 41 -> 39
# ============================================================
content = apply_fix(content,
    """**Effort total** : 35j-homme en séquentiel, mais **~12-15j-homme en parallèle optimal** (3 devs).""",
    """**Effort total** : **~35j-homme** en séquentiel, mais **~12-15j-homme en parallèle optimal** (3 devs).

**Sous-tâches totales** : **39** (A=5, B=8, C=6, D=4, E=3, F=6, G=3, H=4) — détail dans chaque phase ci-dessous.""",
    'FIX 2a (sub-task count)')

content = apply_fix(content,
    """**Estimation totale** : **~25 jours** (single fullstack) ou **~12-15 jours** (3 devs en parallèle)""",
    """**Estimation totale** : **~25 jours** (single fullstack) ou **~12-15 jours** (3 devs en parallèle)
**Sous-tâches** : **39** (A=5, B=8, C=6, D=4, E=3, F=6, G=3, H=4)""",
    'FIX 2b (header sub-task count)')

# ============================================================
# FIX 3 : Phase E.1 endpoints 11 -> 17
# ============================================================
content = apply_fix(content,
    """| **E.1** | `canvasAPI.js` : 11 endpoints REST (cf spec §5.2.4) | `src/code-city/api/canvasAPI.js` (nouveau) | 1j | @backend-dev | ⬜ |
| **E.2** | `webhooks.js` : 7 endpoints + delivery worker (cf spec §5.4) | `src/code-city/api/webhooks.js` (nouveau) | 1j | @backend-dev | ⬜ |""",
    """| **E.1** | `canvasAPI.js` : 17 endpoints REST (cf spec §5.2.4 — health, openapi, canvas CRUD, nodes CRUD, edges CRUD, schema, export.zip, ai/suggest, ai/validate) | `src/code-city/api/canvasAPI.js` (nouveau) | 1j | @backend-dev | ⬜ |
| **E.2** | `webhooks.js` : 7 endpoints management + 1 delivery worker (cf spec §5.4.2 — POST/GET/PATCH/DELETE/rotate-secret/deliveries/test) | `src/code-city/api/webhooks.js` (nouveau) | 1j | @backend-dev | ⬜ |""",
    'FIX 3a (E.1 endpoint count)')

content = apply_fix(content,
    "## 📋 Détail Phase E — API HTTP + Prompt (canaux 2+3)",
    "## 📋 Détail Phase E — API HTTP + Webhooks (canaux 2+3+4)",
    'FIX 3b (Phase E title)')

content = apply_fix(content,
    "- [ ] 11 endpoints REST documentés dans §5.2.4 fonctionnent",
    "- [ ] 17 endpoints REST documentés dans §5.2.4 fonctionnent",
    'FIX 3c (Phase E acceptance)')

content = apply_fix(content,
    "**Livrable** : 2 nouveaux canaux de consommation fonctionnels (API + Webhooks).",
    "**Livrable** : 3 nouveaux canaux de consommation fonctionnels (API + Webhooks + Prompt injection).",
    'FIX 3d (Phase E livrable)')

# ============================================================
# FIX 4 : Statut global 🟡 -> ⬜
# ============================================================
content = apply_fix(content,
    "**Statut global** : 🟡 À démarrer",
    "**Statut global** : ⬜ À démarrer",
    'FIX 4a (statut global icon)')

# ============================================================
# FIX 5 : F.1 references 3 scenario names
# ============================================================
content = apply_fix(content,
    """| **F.1** | Créer dossier `scenarios/` + 3 fichiers exemples | `scenarios/*.md` | 0.5j | @fullstack-dev | ⬜ |""",
    """| **F.1** | Créer dossier `scenarios/` + 3 fichiers exemples (cf spec §6.5 : `vitrine-perso.md`, `saas-b2b.md`, `marketplace.md`) | `scenarios/*.md` | 0.5j | @fullstack-dev | ⬜ |""",
    'FIX 5a (F.1 scenario names)')

content = apply_fix(content,
    "- [ ] 3 scénarios dans `scenarios/` (vitrine-perso, saas-b2b, marketplace)",
    "- [ ] 3 scénarios dans `scenarios/` (cf spec §6.5 : vitrine-perso, saas-b2b, marketplace)",
    'FIX 5b (F.1 acceptance)')

# Update last update + next review dates
content = apply_fix(content,
    """**Dernière mise à jour** : 13 juin 2026
**Prochaine revue** : 14 juin 2026 (standup quotidien)""",
    """**Dernière mise à jour** : 13 juin 2026
**Démarrage effectif** : lundi **15 juin 2026** (1er jour ouvré)
**Prochaine revue** : lundi 15 juin 2026 (kickoff Phase A + 1er daily standup)""",
    'FIX 6 (last update + next review)')

# Final write
with open(filepath, 'w', encoding='utf-8') as f:
    f.write(content)

print(f'\n=== SUMMARY ===')
print(f'Original: {original_length} chars')
print(f'Final: {len(content)} chars')
print(f'Delta: +{len(content) - original_length} chars')
