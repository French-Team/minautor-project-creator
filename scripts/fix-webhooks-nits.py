"""Fix 2 nits flagged by code-reviewer on §5.4 Webhooks:
1. §5.4.7: req.rawBody → req.body.toString('utf8') in standalone snippet
2. §5.4.8: add 429 to retry list
"""

filepath = '.dev-plans/nœuds-proprietes-spec.md'
with open(filepath, 'r', encoding='utf-8') as f:
    content = f.read()

# ============================================================
# FIX 1 : §5.4.7 — req.rawBody → req.body.toString('utf8')
# The §5.4.7 standalone snippet uses req.rawBody (undefined with express.raw())
# The §5.4.11 example already uses req.body.toString('utf8') correctly
# ============================================================
old_547 = """function verifyWebhook(req, secret) {
  const signature = req.headers['x-canvas-signature'];
  const timestamp = req.headers['x-canvas-timestamp'];
  const body = req.rawBody;  // ⚠️ String brut, PAS req.body (re-sérialisé change le contenu)

  // 1. Vérifier que la signature est présente
  if (!signature || !signature.startsWith('sha256=')) {
    throw new Error('Missing or malformed signature');
  }

  // 2. Reconstruire le string-to-sign
  const stringToSign = `${timestamp}.${body}`;"""

new_547 = """function verifyWebhook(req, secret) {
  const signature = req.headers['x-canvas-signature'];
  const timestamp = req.headers['x-canvas-timestamp'];
  // ⚠️ req.body doit être un Buffer (utiliser express.raw() en middleware)
  // PAS req.body parsé (re-sérialisé change le contenu, le HMAC ne matchera plus)
  const body = req.body.toString('utf8');

  // 1. Vérifier que la signature est présente
  if (!signature || !signature.startsWith('sha256=')) {
    throw new Error('Missing or malformed signature');
  }

  // 2. Reconstruire le string-to-sign
  const stringToSign = `${timestamp}.${body}`;"""

if old_547 in content:
    content = content.replace(old_547, new_547)
    print('FIX 1 (§5.4.7 req.body.toString): OK')
else:
    print('FIX 1: anchor not found')
    raise SystemExit(1)

# Also fix the Express setup comment in §5.4.7 that mentions req.rawBody
old_547_setup = """// Dans Express :
app.post('/webhook-receiver', express.raw({ type: 'application/json' }), (req, res) => {
  try {
    verifyWebhook(req, 'whsec_abc123...');
    const event = JSON.parse(req.rawBody);
    // Traiter l'event...
    res.status(200).send('OK');
  } catch (err) {
    res.status(401).send(err.message);
  }
});"""

new_547_setup = """// Dans Express :
app.post('/webhook-receiver', express.raw({ type: 'application/json' }), (req, res) => {
  try {
    verifyWebhook(req, 'whsec_abc123...');
    // ⚠️ req.body est un Buffer (car express.raw() est utilisé)
    const event = JSON.parse(req.body.toString('utf8'));
    // Traiter l'event...
    res.status(200).send('OK');
  } catch (err) {
    res.status(401).send(err.message);
  }
});"""

if old_547_setup in content:
    content = content.replace(old_547_setup, new_547_setup)
    print('FIX 1b (§5.4.7 Express setup): OK')
else:
    print('FIX 1b: anchor not found')
    # Non-blocking, continue

# ============================================================
# FIX 2 : §5.4.8 — add 429 to retry list
# ============================================================
old_548 = """- **Codes succès** : `200`, `201`, `202`, `204` → marqué comme delivered, pas de retry
- **Auth failures** : `401`, `403` → **PAS de retry** (le secret est mauvais, retry ne changera rien) → marqué comme `failed_permanent`
- **Autres 4xx** : `400`, `404`, `422` → **PAS de retry** (la requête est malformée, retry ne changera rien) → marqué comme `failed_permanent`
- **5xx, timeouts, network errors** : `500`, `502`, `503`, `504`, `ECONNRESET`, `ETIMEDOUT` → **RETRY** avec backoff
- **Max attempts** : 7 (1 initial + 6 retries), puis marqué `failed_giveup`"""

new_548 = """- **Codes succès** : `200`, `201`, `202`, `204` → marqué comme delivered, pas de retry
- **Auth failures** : `401`, `403` → **PAS de retry** (le secret est mauvais, retry ne changera rien) → marqué comme `failed_permanent`
- **Autres 4xx** : `400`, `404`, `422` → **PAS de retry** (la requête est malformée, retry ne changera rien) → marqué comme `failed_permanent`
- **Rate limited** : `429` → **RETRY** (le subscriber est saturé, attendre soulage) — respecter le header `Retry-After` du subscriber s'il est présent, sinon backoff exponentiel standard
- **5xx, timeouts, network errors** : `500`, `502`, `503`, `504`, `ECONNRESET`, `ETIMEDOUT` → **RETRY** avec backoff exponentiel
- **Max attempts** : 7 (1 initial + 6 retries), puis marqué `failed_giveup`"""

if old_548 in content:
    content = content.replace(old_548, new_548)
    print('FIX 2 (§5.4.8 429 retry): OK')
else:
    print('FIX 2: anchor not found')
    raise SystemExit(1)

# Update the retry table header to include 429
old_548_table_note = """| 7 | 1h | 1h 12 min 36s | 7 |
| **DONNER UP** | — | — | — |"""

new_548_table_note = """| 7 | 1h | 1h 12 min 36s | 7 |
| **DONNER UP** | — | — | — |

> **Note** : Si la réponse est `429 Too Many Requests` avec un header `Retry-After`, ce délai PREND LE PAS sur le backoff exponentiel standard (on respecte la demande du subscriber). Si pas de `Retry-After`, on applique le backoff standard ci-dessus."""

if old_548_table_note in content:
    content = content.replace(old_548_table_note, new_548_table_note)
    print('FIX 2b (§5.4.8 table note for 429): OK')
else:
    print('FIX 2b: anchor not found')
    # Non-blocking

with open(filepath, 'w', encoding='utf-8') as f:
    f.write(content)

print(f'\nFile updated: {filepath}')
print(f'Final size: {len(content)} chars')
