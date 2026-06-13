"""Fix 2 nits flagged by code-reviewer:
1. Remove invalid // comments from JSON example (would fail to parse)
2. Replace hardcoded date '2026-06-10 < today (2026-06-13)' with generic expression
"""

filepath = '.dev-plans/nœuds-proprietes-spec.md'
with open(filepath, 'r', encoding='utf-8') as f:
    content = f.read()

original_length = len(content)

# ============================================================
# FIX 1 : Retirer les commentaires // du JSON
# ============================================================
old_json = '''  "properties": {
    // === 1-3 : Identification ===
    "version": "v1.2.3",
    "owner": "@alice",
    "externalRef": "https://wiki.example.com/services/user-auth",

    // === 4-8 : Métier (cœur) ===
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

    // === 9-12 : Méta ===
    "dependencies": [
      "n2-user-db (PostgreSQL — stocke les refresh tokens)",
      "n3-email (SendGrid — envoie les mails de confirmation)",
      "service-cache (Redis — cache des sessions OAuth)"
    ],
    "docsUrl": "https://wiki.example.com/services/user-auth",
    "deployment": "Kubernetes (3 replicas, HPA on CPU > 70%)",
    "lastReviewed": "2026-06-10"
  },'''

new_json = '''  "properties": {
    "_group_1_identification": {
      "_note": "Champs 1-3 : identification (version, owner, ref externe)",
      "version": "v1.2.3",
      "owner": "@alice",
      "externalRef": "https://wiki.example.com/services/user-auth"
    },
    "_group_2_metier": {
      "_note": "Champs 4-13 : configuration métier (le cœur du service)",
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
      "monitoring": "Datadog APM + custom metrics (auth_success_rate, token_refresh_duration)"
    },
    "_group_3_meta": {
      "_note": "Champs 14-17 : méta (dependencies, docs, deployment, lastReviewed)",
      "dependencies": [
        "n2-user-db (PostgreSQL — stocke les refresh tokens)",
        "n3-email (SendGrid — envoie les mails de confirmation)",
      "service-cache (Redis — cache des sessions OAuth)"
      ],
      "docsUrl": "https://wiki.example.com/services/user-auth",
      "deployment": "Kubernetes (3 replicas, HPA on CPU > 70%)",
      "lastReviewed": "2026-06-10"
    }
  },'''

if old_json in content:
    content = content.replace(old_json, new_json)
    print('FIX 1 (JSON comments removed): OK')
else:
    print('FIX 1: anchor not found')
    raise SystemExit(1)

# ============================================================
# FIX 2 : Remplacer la date hardcodée par une expression générique
# ============================================================
old_date_block = '''  - check: 'lastReviewed < today'
    then: 'la date ne doit pas être dans le futur'
    result: 'PASS'  # 2026-06-10 < today (2026-06-13)

status: 'VALID'  # Le nœud peut être exporté'''

new_date_block = '''  - check: 'lastReviewed <= today'
    then: 'la date de dernière revue ne doit pas être dans le futur'
    result: 'PASS'  # lastReviewed = 2026-06-10 (≤ today)

status: 'VALID'  # Le nœud peut être exporté'''

if old_date_block in content:
    content = content.replace(old_date_block, new_date_block)
    print('FIX 2 (hardcoded date replaced): OK')
else:
    print('FIX 2: anchor not found')
    raise SystemExit(1)

# Écrire le fichier
with open(filepath, 'w', encoding='utf-8') as f:
    f.write(content)

print(f'\nFinal size: {len(content)} chars (was {original_length})')
print(f'Delta: {len(content) - original_length} chars')
