#!/usr/bin/env node
/**
 * Migration script: replace remaining emojis in 4 UI files with getChatIcon calls.
 * Handles CRLF line endings reliably.
 */
import fs from 'fs';

const replacements = [
  // previewPanel.js
  {
    file: 'src/code-city/quartierCenter/previewPanel.js',
    edits: [
      {
        // Add import after chatPanel import
        find: "import { openChatPanel } from '../ai/chatPanel.js';",
        replace: "import { openChatPanel } from '../ai/chatPanel.js';\nimport { getChatIcon } from '../chatIcons.js';",
        once: true,
      },
      {
        // Replace analyseBtn innerHTML
        find: "analyseBtn.innerHTML = '<span class=\"preview-analyse-btn__icon\">\uD83E\uDD16</span> Analyser avec Mina';",
        replace: "analyseBtn.innerHTML = `<span class=\"preview-analyse-btn__icon\">${getChatIcon('bot', 14)}</span> Analyser avec Mina`;",
        once: true,
      },
    ],
  },
  // centerTabs.js
  {
    file: 'src/code-city/quartierCenter/centerTabs.js',
    edits: [
      {
        find: "import { triggerFimCompletion, insertFimCompletion, isFimAvailable } from '../ai/fimHandler.js';",
        replace: "import { triggerFimCompletion, insertFimCompletion, isFimAvailable } from '../ai/fimHandler.js';\nimport { getChatIcon } from '../chatIcons.js';",
        once: true,
      },
      {
        find: "fimFloatingBtn.innerHTML = '<span class=\"fim-floating-btn__icon\">\uD83E\uDD16</span> Compl\u00e9ter';",
        replace: "fimFloatingBtn.innerHTML = `<span class=\"fim-floating-btn__icon\">${getChatIcon('bot', 14)}</span> Compl\u00e9ter`;",
        once: true,
      },
      {
        find: "fimStatusEl.textContent = '\\u2713 ' + msg;",
        replace: "fimStatusEl.innerHTML = `${getChatIcon('check', 11)} ${escapeHtml(msg)}`;",
        once: true,
      },
      {
        find: "fimStatusEl.textContent = '\\u2717 ' + msg;",
        replace: "fimStatusEl.innerHTML = `${getChatIcon('x', 11)} ${escapeHtml(msg)}`;",
        once: true,
      },
      {
        // Add escapeHtml helper if not present
        find: "function cssEscape(s) {",
        replace: "function escapeHtml(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\"/g, '&quot;'); }\n\nfunction cssEscape(s) {",
        once: true,
      },
    ],
  },
  // centerAuxPanels.js
  {
    file: 'src/code-city/quartierRight/centerAuxPanels.js',
    edits: [
      {
        find: "copyIdBtn.textContent = '\u2713 Copi\u00e9';",
        replace: "copyIdBtn.innerHTML = getChatIcon('check', 12) + ' Copi\u00e9';",
        once: true,
      },
    ],
  },
  // toast.js
  {
    file: 'src/code-city/ai/toast.js',
    edits: [
      {
        // Add import at top (after first import or at the very beginning)
        find: "const TOAST_DEFAULTS = {",
        replace: "import { getChatIcon } from '../chatIcons.js';\n\nconst TOAST_DEFAULTS = {",
        once: true,
      },
      {
        // Replace ICONS object
        find: "const ICONS = {\n  success: '\u2713',\n  error: '\u2715',\n  warning: '\u26A0',\n  info: '\u2139',\n};",
        replace: "const ICONS = {\n  success: () => getChatIcon('check', 14),\n  error: () => getChatIcon('x', 14),\n  warning: () => getChatIcon('alert-triangle', 14),\n  info: () => getChatIcon('info', 14),\n};",
        once: true,
      },
      {
        // Update call site to invoke the function
        find: "${ICONS[type] || ICONS.info}",
        replace: "${(ICONS[type] || ICONS.info)()}",
        once: false,
      },
      {
        // Replace close button
        find: "`<button type=\"button\" class=\"toast__close\" aria-label=\"Fermer\">\u2715</button>`",
        replace: "`<button type=\"button\" class=\"toast__close\" aria-label=\"Fermer\">${getChatIcon('x', 12)}</button>`",
        once: true,
      },
    ],
  },
];

let totalApplied = 0;
let totalSkipped = 0;

for (const { file, edits } of replacements) {
  let s = fs.readFileSync(file, 'utf8');
  const original = s;
  for (const edit of edits) {
    if (s.includes(edit.find)) {
      if (edit.once) {
        s = s.replace(edit.find, edit.replace);
      } else {
        s = s.split(edit.find).join(edit.replace);
      }
      totalApplied++;
      console.log(`  \u2713 ${file}: applied "${edit.find.slice(0, 50)}..."`);
    } else {
      totalSkipped++;
      console.log(`  \u26A0 ${file}: SKIPPED (not found) "${edit.find.slice(0, 50)}..."`);
    }
  }
  if (s !== original) {
    fs.writeFileSync(file, s);
    console.log(`\u2192 ${file} written\n`);
  } else {
    console.log(`\u2192 ${file} unchanged\n`);
  }
}

console.log(`\n=== Summary ===`);
console.log(`Applied: ${totalApplied}`);
console.log(`Skipped: ${totalSkipped}`);
