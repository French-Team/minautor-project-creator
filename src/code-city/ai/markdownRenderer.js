/**
 * Markdown Renderer
 *
 * Wrapper autour de `marked` pour le rendu Markdown → HTML sécurisé.
 * - GFM activé (tableaux, strikethrough, task lists, autolinks)
 * - HTML sanitisé : seules les balises autorisées sont conservées
 * - Gère le streaming (Markdown partiel) sans casser le rendu
 *
 * @module markdownRenderer
 */

import { marked } from 'marked';
import { markedHighlight } from 'marked-highlight';
import hljs from 'highlight.js';
import { escapeHtml } from '../utils/html.js';

/* ------------------------------------------------------------------ */
/*  Configuration marked + highlight.js                               */
/* ------------------------------------------------------------------ */

/**
 * Configure l'extension markedHighlight pour la coloration syntaxique.
 * - LangPrefix : 'hljs ' pour que highlight.js reconnaisse ses classes
 * - Fallback : 'plaintext' si le langage demandé n'est pas supporté
 */
marked.use(
  markedHighlight({
    langPrefix: 'hljs language-',
    highlight(code, lang) {
      const language = hljs.getLanguage(lang) ? lang : 'plaintext';
      return hljs.highlight(code, { language }).value;
    },
  })
);

// Renderer personnalise : ouvrir les liens dans un nouvel onglet
marked.use({
  renderer: {
    link({ href, title, text }) {
      const titleAttr = title ? ` title="${title}"` : '';
      return `<a href="${href}" target="_blank" rel="noopener noreferrer"${titleAttr}>${text}</a>`;
    },
  },
});

/* ------------------------------------------------------------------ */
/*  Tags / attributs autorisés (whitelist de sécurité)                */
/* ------------------------------------------------------------------ */

/** Balises HTML produites par marked que l'on autorise. */
const ALLOWED_TAGS = new Set([
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'p', 'ul', 'ol', 'li',
  'strong', 'em', 'b', 'i', 'u',
  'a', 'code', 'pre', 'blockquote', 'hr', 'br',
  'table', 'thead', 'tbody', 'tfoot', 'tr', 'th', 'td',
  'table', 'thead', 'tbody', 'tfoot', 'tr', 'th', 'td',
  'del', 'ins', 'sup', 'sub', 'small',
  'input', 'span', 'div',
  'img',
  'dl', 'dt', 'dd',
]);

/** Attributs autorisés (sur n'importe quelle balise autorisée). */
const ALLOWED_ATTRS = new Set([
  'href', 'target', 'rel', 'title',
  'src', 'alt', 'width', 'height',
  'type', 'checked', 'disabled',
  'class', 'id',
  'colspan', 'rowspan',
  'start', 'reversed',
  'lang',
]);

/** Attributs qui contiennent une URI (doivent être sécurisés contre javascript:). */
const URI_ATTRS = new Set(['href', 'src']);

/* ------------------------------------------------------------------ */
/*  Sanitizer                                                         */
/* ------------------------------------------------------------------ */

/**
 * Nettoie le HTML produit par marked : supprime les balises et attributs
 * non autorisés, et les URLs dangereuses (javascript:, data:, vbscript:).
 * @param {string} html - HTML brut produit par marked
 * @returns {string} HTML nettoyé et sûr
 */
function sanitizeHtml(html) {
  const DANGEROUS_SCHEMES = /^\s*(?:javascript|data|vbscript|livescript):/i;
  const EVENT_HANDLER = /^on\w+$/i;

  return html.replace(/<\/?(\w+)([\s\S]*?)>/g, (match, tagName, attrsPart) => {
    const lowerTag = tagName.toLowerCase();

    // Balise non autorisée → supprimer (garder uniquement le contenu textuel)
    if (!ALLOWED_TAGS.has(lowerTag)) {
      return '';
    }

    // Balise fermante → OK
    if (match.startsWith('</')) {
      return match;
    }

    // Auto-fermante sans attributs → OK
    if (!attrsPart.trim()) {
      return match.endsWith('/>') ? `<${lowerTag} />` : `<${lowerTag}>`;
    }

    // Extraire et filtrer les attributs
    const safeAttrs = [];
    const attrRegex = /(\w+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g;
    let attrMatch;

    while ((attrMatch = attrRegex.exec(attrsPart)) !== null) {
      const attrName = attrMatch[1].toLowerCase();
      const attrValue = attrMatch[2] !== undefined ? attrMatch[2] : (attrMatch[3] || '');

      // Ignorer les gestionnaires d'événements
      if (EVENT_HANDLER.test(attrName)) {
        continue;
      }

      // Ignorer les attributs non autorisés
      if (!ALLOWED_ATTRS.has(attrName)) {
        continue;
      }

      // Vérifier les attributs URI (href, src, etc.)
      if (URI_ATTRS.has(attrName) && DANGEROUS_SCHEMES.test(attrValue)) {
        continue;
      }

      safeAttrs.push(`${attrName}="${attrValue.replace(/"/g, '&quot;')}"`);
    }

    const attrStr = safeAttrs.length > 0 ? ' ' + safeAttrs.join(' ') : '';
    return match.endsWith('/>') ? `<${lowerTag}${attrStr} />` : `<${lowerTag}${attrStr}>`;
  });
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                           */
/* ------------------------------------------------------------------ */

/**
 * Échappe le HTML (pour fallback sécurité ou affichage streaming).
 * @param {string} str
 * @returns {string}
 */
/* ------------------------------------------------------------------ */
/*  API publique                                                      */
/* ------------------------------------------------------------------ */

/**
 * Rend du Markdown en HTML sécurisé.
 *
 * @param {string} text - Texte Markdown en entrée
 * @returns {string} HTML nettoyé et prêt à injecter dans le DOM
 *
 * @example
 * renderMarkdown('# Hello\n\nThis is **bold** and `code`.')
 * // → '<h1>Hello</h1>\n<p>This is <strong>bold</strong> and <code>code</code>.</p>\n'
 */
export function renderMarkdown(text) {
  if (!text) return '';

  try {
    let html = marked.parse(text, {
      async: false,
      gfm: true,
      breaks: true,   // Sauts de ligne simples -> <br> dans les paragraphes
    });

    // Sanitisation
    html = sanitizeHtml(html);

    // Ajouter la classe CSS attendue par le projet sur les blocs <pre>
    html = html.replace(/<pre>/g, '<pre class="chat-msg__bubble-pre">');

    return html;
  } catch (err) {
    console.warn('⚠️ Markdown rendering error, using escaped fallback:', err);
    return escapeHtml(text);
  }
}

/**
 * Version « streaming-safe » du renderer.
 * Pendant le streaming, le Markdown peut être partiel/incomplet et marked
 * peut générer du HTML invalide. On attrape les erreurs et on retourne
 * le texte échappé en fallback.
 *
 * @param {string} text - Texte Markdown partiel
 * @returns {string} HTML (ou texte échappé en fallback)
 */
export function renderStreamingMarkdown(text) {
  if (!text) return '';

  try {
    let html = marked.parse(text, {
      async: false,
      gfm: true,
      breaks: true,
    });
    html = sanitizeHtml(html);
    html = html.replace(/<pre>/g, '<pre class="chat-msg__bubble-pre">');
    return html;
  } catch {
    // Streaming partiel : on retourne du texte échappé
    return escapeHtml(text);
  }
}
