#!/usr/bin/env node
/**
 * Final fix: read centerTabs.js, show lines 190-210, and reconstruct cssEscape.
 */
import fs from 'fs';

const FILE = 'src/code-city/quartierCenter/centerTabs.js';
let s = fs.readFileSync(FILE, 'utf8');

console.log('=== CURRENT LINES 190-210 ===');
const lines = s.split('\n');
for (let i = 189; i < Math.min(210, lines.length); i++) {
  console.log(`${i + 1}: ${lines[i]}`);
}

console.log('\n=== CURRENT escapeHtml/cssEscape definitions ===');
for (let i = 0; i < lines.length; i++) {
  if (/function (escapeHtml|cssEscape)\b/.test(lines[i])) {
    console.log(`Line ${i + 1}: ${lines[i]}`);
  }
}

// The issue: the migration script injected escapeHtml but removed cssEscape declaration.
// Current broken state around line 196-201:
//   function escapeHtml(s) { return ... }
//   (blank)
//     if (typeof CSS !== 'undefined' && CSS.escape) return CSS.escape(s);
//     return String(s).replace(/[^a-zA-Z0-9_-]/g, (c) => `\\${c}`);
//   }
// The `function cssEscape(s) {` line is missing.

// Find the orphaned body pattern and fix it
const orphanedPattern = /function escapeHtml\(s\) \{ return String\(s\)\.replace\([^}]+\}\s*\n\s*\n\s*if \(typeof CSS !== 'undefined' && CSS\.escape\) return CSS\.escape\(s\);/;

if (orphanedPattern.test(s)) {
  s = s.replace(orphanedPattern, (match) => {
    // Add "function cssEscape(s) {" before the if-statement
    return match.replace(
      /\n\s*\n\s*if \(typeof CSS/,
      '\n\nfunction cssEscape(s) {\n  if (typeof CSS'
    );
  });
  console.log('\n\u2713 Fix applied: added cssEscape function declaration');
  fs.writeFileSync(FILE, s);
} else {
  console.log('\n\u26A0 Orphaned pattern not found — trying alternative approach');

  // Alternative: find the exact broken region and reconstruct
  const brokenRegion = 'function escapeHtml(s) { return String(s).replace(/&/g, \'&amp;\').replace(/</g, \'&lt;\').replace(/>/g, \'&gt;\').replace(/"/g, \'&quot;\'); }\n\n\n  if (typeof CSS !== \'undefined\' && CSS.escape) return CSS.escape(s);';

  if (s.includes(brokenRegion)) {
    const fixed = 'function escapeHtml(s) { return String(s).replace(/&/g, \'&amp;\').replace(/</g, \'&lt;\').replace(/>/g, \'&gt;\').replace(/"/g, \'&quot;\'); }\n\nfunction cssEscape(s) {\n  if (typeof CSS !== \'undefined\' && CSS.escape) return CSS.escape(s);';
    s = s.replace(brokenRegion, fixed);
    console.log('\u2713 Fix applied via alternative pattern');
    fs.writeFileSync(FILE, s);
  } else {
    console.log('\u2717 Could not find broken region');
  }
}

console.log('\n=== AFTER FIX (lines 190-210) ===');
const lines2 = fs.readFileSync(FILE, 'utf8').split('\n');
for (let i = 189; i < Math.min(210, lines2.length); i++) {
  console.log(`${i + 1}: ${lines2[i]}`);
}
