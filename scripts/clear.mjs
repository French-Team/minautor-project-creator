/**
 * clear.mjs — Vide le terminal
 *
 * Cross-platform : utilise les séquences ANSI (ESC[2J = efface l'écran,
 * ESC[H = cursor en haut à gauche). Marche dans Windows Terminal,
 * PowerShell 7+, et tous les terminaux Unix.
 *
 * Pour les vieux consoles Windows (cmd.exe), `cls` reste plus fiable mais
 * n'est pas scriptable depuis Node sans spawn. On tente les ANSI d'abord,
 * puis un fallback `console.clear()` (Node 16+).
 */

import process from 'node:process';

if (process.stdout.isTTY) {
  process.stdout.write('\x1B[2J\x1B[H');
} else if (typeof console.clear === 'function') {
  console.clear();
} else {
  // Dernier recours : quelques newlines
  process.stdout.write('\n'.repeat(process.stdout.rows || 50));
}
