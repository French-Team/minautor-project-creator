#!/usr/bin/env node
/**
 * validate-lucide-imports.mjs
 *
 * Script de validation pour la migration lucide-static.
 * Vérifie que :
 *   1. Tous les noms importés depuis `lucide-static` existent réellement
 *      dans la version installée du package (évite les erreurs runtime
 *      "does not provide an export named ...").
 *   2. Aucun import ne référence un nom obsolète (PascalCase-only depuis
 *      lucide-static v1.x — ex: TriangleAlert au lieu de alertTriangle).
 *   3. Tous les arguments kebab-case passés à `getChatIcon('name', ...)`
 *      existent dans la map `ICONS` de `chatIcons.js` (évite les typos
 *      type 'serach' vs 'search' qui renverraient silencieusement '').
 *
 * Usage :
 *   node scripts/validate-lucide-imports.mjs
 *   node scripts/validate-lucide-imports.mjs --strict   # exit 1 si warnings
 *   node scripts/validate-lucide-imports.mjs --self-test   # vérifie que le
 *                                                           # script détecte
 *                                                           # bien une typo
 *
 * Exit codes :
 *   0 — toutes les imports et tous les appels sont valides
 *   1 — au moins un import invalide, un appel invalide, ou un warning
 *       en mode --strict
 */

import { readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const PROJECT_ROOT = resolve(__dirname, '..');
const SRC_DIR = join(PROJECT_ROOT, 'src');
const LUCIDE_ENTRY = join(PROJECT_ROOT, 'node_modules', 'lucide-static', 'dist', 'esm', 'lucide-static.mjs');
const CHAT_ICONS_FILE = join(PROJECT_ROOT, 'src', 'code-city', 'chatIcons.js');

const args = new Set(process.argv.slice(2));
const strict = args.has('--strict');
const selfTest = args.has('--self-test');

// ---------- 1) Extraire les exports de lucide-static ----------
let lucideExports = new Set();
try {
  const mjs = readFileSync(LUCIDE_ENTRY, 'utf8');
  // Format: "export { default as Name, default as Name2, ... }"
  // Stratégie : matcher "default as PascalCaseIdentifier" en début de bloc
  // Note : `*` (et non `+`) pour accepter les noms courts comme "X" (1 char).
  const re = /default\s+as\s+([A-Z][A-Za-z0-9_]*)/g;
  let m;
  while ((m = re.exec(mjs)) !== null) {
    lucideExports.add(m[1]);
  }
} catch (err) {
  console.error(`❌ Cannot read lucide-static entry: ${LUCIDE_ENTRY}`);
  console.error(`   ${err.message}`);
  console.error(`   Hint: run \`npm install\` first.`);
  process.exit(1);
}

console.log(`✅ lucide-static exports found: ${lucideExports.size}`);

// ---------- 2) Extraire la map ICONS de chatIcons.js ----------
/**
 * Parse le fichier chatIcons.js et retourne la liste des clés de l'objet ICONS.
 * Approche : on repère `const ICONS = { ... }`, on équilibre les accolades,
 * puis on **strippe les commentaires ligne (`//`) et bloc (`/* ... *​/`)** avant
 * d'extraire les clés. Cela évite de capturer `// 'foo-bar': Something,`
 * comme une clé valide.
 */
function parseIconsMap(filePath) {
  const content = readFileSync(filePath, 'utf8');
  const startMatch = content.match(/const\s+ICONS\s*=\s*\{/);
  if (!startMatch) {
    console.error(`❌ Could not find "const ICONS = {" in ${filePath}`);
    console.error(`   Hint: chatIcons.js was renamed or restructured.`);
    process.exit(1);
  }
  const startIdx = startMatch.index + startMatch[0].length;
  // Trouver l'accolade fermante correspondante
  let depth = 1;
  let endIdx = startIdx;
  for (let i = startIdx; i < content.length; i++) {
    const c = content[i];
    if (c === '{') depth++;
    else if (c === '}') {
      depth--;
      if (depth === 0) { endIdx = i; break; }
    }
  }
  let block = content.slice(startIdx, endIdx);

  // Strip block comments /* ... */ (non-greedy, multiline).
  // TODO: cette regex est naïve — elle strippe aussi `/* ... */` qui apparaît
  // à l'intérieur d'une valeur string, ex: `'foo': "a /* not a comment */ b"`.
  // Pour le chatIcons.js actuel, les valeurs sont des identifiants PascalCase
  // (Search, BROOM_SVG_24, …) donc ça ne casse pas. Si un futur contributeur
  // ajoute une valeur string contenant `/*`, l'extraction de clés pourrait
  // être silencieusement cassée. Une solution robuste = parser AST.
  block = block.replace(/\/\*[\s\S]*?\*\//g, '');
  // Strip line comments // ... (per-line)
  block = block
    .split('\n')
    .map(line => line.replace(/\/\/.*$/, ''))
    .join('\n');

  // Capturer les clés 'foo': ou "foo":
  const keyRe = /['"]([a-z0-9-]+)['"]\s*:/g;
  const keys = new Set();
  let m;
  while ((m = keyRe.exec(block)) !== null) {
    keys.add(m[1]);
  }
  return keys;
}

let iconKeys = new Set();
try {
  iconKeys = parseIconsMap(CHAT_ICONS_FILE);
} catch (err) {
  console.error(`❌ Cannot parse ICONS map in ${CHAT_ICONS_FILE}`);
  console.error(`   ${err.message}`);
  process.exit(1);
}
console.log(`✅ chatIcons ICONS map keys: ${iconKeys.size}`);

// ---------- 3) Scanner récursivement src/ pour les imports ----------
const JS_KEYWORDS = new Set(['as', 'from']);

let totalImportFiles = 0;
let totalImports = 0;
const invalidImports = [];
const importWarnings = [];

function walk(dir) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) {
      if (entry === 'node_modules' || entry.startsWith('.')) continue;
      walk(full);
    } else if (/\.(js|mjs|cjs)$/.test(entry)) {
      scanImports(full);
      scanGetChatIconCalls(full);
    }
  }
}

function scanImports(filePath) {
  const content = readFileSync(filePath, 'utf8');
  const re = /import\s*\{([^}]+)\}\s*from\s*['"]lucide-static['"]/g;
  let m;
  while ((m = re.exec(content)) !== null) {
    totalImportFiles++;
    let inner = m[1];
    // Strip block comments /* ... */ à l'intérieur du bloc d'import
    inner = inner.replace(/\/\*[\s\S]*?\*\//g, '');
    // Strip line comments // ... (per-line) — important : les commentaires
    // de section dans un bloc d'import (ex: `// Quick action icons`) contiennent
    // des mots comme "Chat", "Quick", "Stats" qui seraient sinon capturés
    // comme des noms d'import invalides.
    inner = inner
      .split('\n')
      .map(line => line.replace(/\/\/.*$/, ''))
      .join('\n');
    const nameMatches = inner.match(/[A-Za-z_][A-Za-z0-9_]*/g) || [];
    for (const name of nameMatches) {
      if (JS_KEYWORDS.has(name)) continue;
      totalImports++;
      if (!lucideExports.has(name)) {
        const rel = relative(PROJECT_ROOT, filePath);
        const lineNum = content.slice(0, m.index).split('\n').length;
        invalidImports.push({ file: rel, line: lineNum, name });
      } else if (name[0] !== name[0].toUpperCase()) {
        // Lucide v1.x utilise PascalCase : Search, pas search
        const rel = relative(PROJECT_ROOT, filePath);
        const lineNum = content.slice(0, m.index).split('\n').length;
        importWarnings.push({ file: rel, line: lineNum, name, msg: 'lowercase first letter — lucide-static uses PascalCase' });
      }
    }
  }
}

// ---------- 4) Scanner les appels getChatIcon('name', ...) ----------
/**
 * On repère les appels `getChatIcon('xxx', ...)` ou `getChatIcon("xxx", ...)`
 * dans les template literals, expressions, et autres contextes.
 * Supporte aussi l'optional chaining `getChatIcon?.('xxx', ...)` pour rester
 * robuste face au code défensif.
 * On ignore :
 *   - les chaînes vides (defensive code)
 *   - les lignes de commentaire (heuristique : // au début de la ligne)
 *   - les occurrences dans chatIcons.js lui-même (le source de vérité)
 */
const invalidCalls = [];

function scanGetChatIconCalls(filePath) {
  const content = readFileSync(filePath, 'utf8');
  const rel = relative(PROJECT_ROOT, filePath);
  if (rel === relative(PROJECT_ROOT, CHAT_ICONS_FILE)) return; // ignorer la source

  // Regex : getChatIcon (éventuellement ?. puis ( puis 'string', "string" ou `string`
  // Supporte les 3 types de guillemets JS pour ne pas rater les template literals
  // passés en argument (ex: getChatIcon(`search`, 14) — peu courant, mais possible).
  // Note : on capture aussi getChatIconCheckBold (qui prend toujours 'check' en
  // interne, clé valide → ne déclenchera pas d'erreur).
  const callRe = /getChatIcon(?:CheckBold)?\s*\??\s*\(\s*(['"`])([^'"`]+)\1/g;
  let m;
  while ((m = callRe.exec(content)) !== null) {
    const name = m[2];
    if (!name) continue;
    // Filtrer les template interpolations : `search-${var}` ne doit pas être
    // capturé comme nom d'icône. Les vrais noms kebab-case ne contiennent
    // jamais ${}, donc tout nom avec ${ est forcément une interpolation.
    if (name.includes('${')) continue;
    // Filtrer les commentaires en remontant au début de la ligne
    const lineStart = content.lastIndexOf('\n', m.index) + 1;
    const linePrefix = content.slice(lineStart, m.index);
    if (linePrefix.trim().startsWith('//')) continue;
    if (linePrefix.includes('/*') && !linePrefix.includes('*/')) continue;

    if (!iconKeys.has(name)) {
      const lineNum = content.slice(0, m.index).split('\n').length;
      invalidCalls.push({ file: rel, line: lineNum, name });
    }
  }
}

walk(SRC_DIR);

// ---------- 5) Distance de Levenshtein pour suggestions ----------
function levenshtein(a, b) {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  const dp = Array.from({ length: a.length + 1 }, () => new Array(b.length + 1).fill(0));
  for (let i = 0; i <= a.length; i++) dp[i][0] = i;
  for (let j = 0; j <= b.length; j++) dp[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,        // suppression
        dp[i][j - 1] + 1,        // insertion
        dp[i - 1][j - 1] + cost, // substitution
      );
    }
  }
  return dp[a.length][b.length];
}

/**
 * Suggère les noms les plus proches, avec une distance max **relative à la
 * longueur du nom** (sinon les noms courts comme 'x' génèrent un flood de
 * suggestions). Formule : `max(2, floor(name.length / 3))`.
 *   - 'x' (1 char) → max 2 → filtre sévère
 *   - 'serach' (6 chars) → max 2 → suggère 'search' (distance 2)
 *   - 'undoo' (5 chars) → max 2 → suggère 'undo' (distance 1)
 */
function suggestClosest(bad, pool, maxSuggestions = 3) {
  const maxDistance = Math.max(2, Math.floor(bad.length / 3));
  return [...pool]
    .map(name => ({ name, d: levenshtein(bad, name) }))
    .filter(s => s.d > 0 && s.d <= maxDistance)
    .sort((a, b) => a.d - b.d)
    .slice(0, maxSuggestions)
    .map(s => s.name);
}

// ---------- 6) Self-test : injecter une typo, vérifier qu'on la détecte ----------
function runSelfTest() {
  console.log(`\n🧪 Self-test: injecting a fake typo in code-city.js...`);
  const targetFile = join(PROJECT_ROOT, 'src', 'code-city', 'code-city.js');
  const original = readFileSync(targetFile, 'utf8');
  const typoCall = "getChatIcon('serach'";
  const validCall = "getChatIcon('search'";
  if (!original.includes(validCall)) {
    console.error(`   ❌ Self-test aborted: could not find expected call "${validCall}" in code-city.js`);
    process.exit(1);
  }
  const corrupted = original.replace(validCall, typoCall);
  let testInvalid = [];
  let testSuggestions = [];
  let testRestored = false;
  // **Filet de sécurité signal** : `try/finally` ne protège PAS contre SIGINT
  // (Ctrl+C) ou SIGTERM — Node ne unwind pas les finally blocks lors d'un kill
  // par signal. On enregistre donc des handlers qui restaurant le fichier
  // avant de quitter, puis on les déregister à la fin normale.
  // Note : SIGHUP n'est pas listé — c'est un no-op sur Windows (la plateforme
  // du projet) et on évite de suggérer une protection qui n'existe pas.
  const signalHandlers = new Map();
  const restoreAndExit = (code) => {
    if (!testRestored) {
      try { writeFileSync(targetFile, original); } catch { /* best effort */ }
      testRestored = true;
    }
    process.exit(code);
  };
  for (const sig of ['SIGINT', 'SIGTERM']) {
    const handler = () => restoreAndExit(1);
    signalHandlers.set(sig, handler);
    process.on(sig, handler);
  }
  try {
    writeFileSync(targetFile, corrupted);
    // Re-scanner
    const re = /getChatIcon\s*\??\s*\(\s*(['"`])([^'"`]+)\1/g;
    let m;
    while ((m = re.exec(corrupted)) !== null) {
      if (m[2] === 'serach') {
        testInvalid.push({ name: m[2], file: 'code-city.js', line: 0 });
        testSuggestions = suggestClosest('serach', iconKeys);
      }
    }
  } finally {
    // **Toujours** restaurer le fichier, même en cas d'exception
    writeFileSync(targetFile, original);
    testRestored = true;
    // Déregister les handlers de signal maintenant que la restore est faite
    for (const [sig, handler] of signalHandlers) {
      process.off(sig, handler);
    }
  }
  if (testInvalid.length === 0) {
    console.error(`   ❌ Self-test FAILED: typo 'serach' was NOT detected.`);
    process.exit(1);
  }
  if (testSuggestions[0] !== 'search') {
    console.error(`   ❌ Self-test FAILED: expected first suggestion 'search', got '${testSuggestions[0] || '<none>'}'.`);
    process.exit(1);
  }
  if (!testRestored) {
    console.error(`   ❌ Self-test FAILED: file was not restored.`);
    process.exit(1);
  }
  console.log(`   ✅ Typo 'serach' detected, suggestion 'search' is correct, file restored.`);
}

// ---------- 7) Rapport ----------
console.log(`\n📊 Scanned: ${totalImportFiles} lucide-static import(s) across src/`);

if (importWarnings.length > 0) {
  console.log(`\n⚠️  ${importWarnings.length} import warning(s) :`);
  for (const w of importWarnings) {
    console.log(`   ${w.file}:${w.line}  ${w.name}  — ${w.msg}`);
  }
}

if (invalidImports.length > 0) {
  console.log(`\n❌ ${invalidImports.length} INVALID lucide-static import(s) :`);
  for (const inv of invalidImports) {
    const suggestions = suggestClosest(inv.name, lucideExports);
    console.log(`   ${inv.file}:${inv.line}  ${inv.name}`);
    if (suggestions.length > 0) {
      console.log(`     → did you mean: ${suggestions.join(', ')} ?`);
    }
  }
}

if (invalidCalls.length > 0) {
  console.log(`\n❌ ${invalidCalls.length} INVALID getChatIcon(...) call(s) :`);
  for (const inv of invalidCalls) {
    const suggestions = suggestClosest(inv.name, iconKeys);
    console.log(`   ${inv.file}:${inv.line}  getChatIcon('${inv.name}')`);
    if (suggestions.length > 0) {
      console.log(`     → did you mean: ${suggestions.map(s => `'${s}'`).join(', ')} ?`);
    }
  }
}

if (invalidImports.length > 0 || invalidCalls.length > 0) {
  console.log(`\n🚨 Migration is BROKEN. Fix the issues above before running the app.`);
  if (selfTest) runSelfTest();
  process.exit(1);
}

console.log(`\n✅ All lucide-static imports AND all getChatIcon() calls are valid.`);
if (importWarnings.length > 0 && strict) {
  console.log(`🚨 Strict mode: warnings treated as errors.`);
  if (selfTest) runSelfTest();
  process.exit(1);
}
if (selfTest) runSelfTest();
