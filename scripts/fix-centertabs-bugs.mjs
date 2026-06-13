#!/usr/bin/env node
/**
 * Fix two bugs in centerTabs.js left by the emoji cleanup migration:
 *  1. cssEscape function declaration was removed but body left orphaned
 *  2. fimFloatingBtn.innerHTML = ; (empty assignment) on line ~130
 */
import fs from 'fs';

const FILE = 'src/code-city/quartierCenter/centerTabs.js';
let s = fs.readFileSync(FILE, 'utf8');
const original = s;

// Fix 1: Add back the missing cssEscape function declaration.
// The migration script injected escapeHtml before "function cssEscape(s) {",
// but the replace consumed the declaration line. So now the file has:
//   function escapeHtml(s) { ... }
//   (empty line)
//     if (typeof CSS !== 'undefined' && CSS.escape) return CSS.escape(s);
// We need to put back "function cssEscape(s) {" before that if-statement.
const orphanedBody = 'function escapeHtml(s) { return String(s).replace(/&/g, \'&amp;\').replace(/</g, \'&lt;\').replace(/>/g, \'&gt;\').replace(/"/g, \'&quot;\'); }\n\n\n  if (typeof CSS !== \'undefined\' && CSS.escape) return CSS.escape(s);';
if (s.includes(orphanedBody)) {
  const fixed = 'function escapeHtml(s) { return String(s).replace(/&/g, \'&amp;\').replace(/</g, \'&lt;\').replace(/>/g, \'&gt;\').replace(/"/g, \'&quot;\'); }\n\nfunction cssEscape(s) {\n  if (typeof CSS !== \'undefined\' && CSS.escape) return CSS.escape(s);';
  s = s.replace(orphanedBody, fixed);
  console.log('  \u2713 Fix 1: restored cssEscape function declaration');
} else {
  console.log('  \u26A0 Fix 1: orphaned body pattern not found (may already be fixed)');
}

// Fix 2: Empty fimFloatingBtn.innerHTML = ;
// The migration script tried to replace the FIM button innerHTML but the
// pattern didn't match exactly, leaving "fimFloatingBtn.innerHTML = ;"
const emptyAssignment = 'fimFloatingBtn.innerHTML = ;';
if (s.includes(emptyAssignment)) {
  // Reconstruct the FIM button with getChatIcon('bot', 14)
  const fixedFim = 'fimFloatingBtn.innerHTML = `<span class="fim-floating-btn__icon">${getChatIcon(\'bot\', 14)}</span> Compl\u00e9ter`;';
  s = s.replace(emptyAssignment, fixedFim);
  console.log('  \u2713 Fix 2: restored fimFloatingBtn.innerHTML with bot icon');
} else {
  console.log('  \u26A0 Fix 2: empty innerHTML not found (may already be fixed)');
}

if (s !== original) {
  fs.writeFileSync(FILE, s);
  console.log(`\n\u2192 ${FILE} updated`);
} else {
  console.log(`\n\u2192 ${FILE} unchanged`);
}

// Verify no other obvious issues
console.log('\n=== Verification ===');
const lines = s.split('\n');
for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  // Look for empty assignments like "x = ;" or "x.innerHTML = ;"
  if (/=\s*;/.test(line) && !line.trim().startsWith('//') && !line.trim().startsWith('*')) {
    console.log(`  \u26A0 Line ${i + 1}: "${line.trim()}"`);
  }
}
console.log(`Total lines: ${lines.length}`);
