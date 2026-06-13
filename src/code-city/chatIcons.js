/**
 * ChatIcons — Helper d'icônes SVG pour TOUTE l'application (juin 2026)
 *
 * **Source unique des icônes** depuis la suppression de `icons.js` :
 *   - UI du chat (search, send, stop, etc.)
 *   - Palette Mermaid (start, end, process, rocket, shield, etc.)
 *   - Inline SVGs (apiKeysModal, menuActionsTop, providerPanel, etc.)
 *
 * ~80 icônes au total, toutes depuis `lucide-static` (PascalCase) ou fallback
 * SVG custom pour les 4 cas non couverts par Lucide (broom, connect-hint,
 * hub, dotted).
 *
 * Usage :
 *   import { getChatIcon } from '../chatIcons.js';
 *   const svg = getChatIcon('search', 14);
 *
 * @module chatIcons
 */

import {
  // Chat panel UI
  Search, X, Undo2, Redo2, LayoutGrid, ZoomIn, ZoomOut, Maximize,
  Copy, FileText, RotateCcw, Edit, Send, Square, Check,
  Cloud, Sparkles, Code, Server,
  // Quick action icons (ex-ACTION_ICONS)
  BarChart, Lightbulb, Zap, Settings, RefreshCw,
  TriangleAlert, Trash, BookOpen, History, CircleX,
  TrendingUp,
  // Palette Mermaid (ex-icons.js — 30+ icônes)
  Play, User, Package, Star, Flag, BadgeCheck, Rocket, Inbox,
  GitBranch, Users, Shield, Key, Tag, Lock, FlaskConical, Layers,
  Globe, MousePointer, Eye, Filter, ArrowRight, Circle, Image, Box,
  FileJson, Download, Link2, Link2Off, Plus, Info, Sun, Bot, ChevronDown,
  HelpCircle, Cpu, Braces, ClipboardList, Save, Pencil, FileEdit,
} from 'lucide-static';

/* -------------------------------------------------------------------------- */
/*  Custom SVG fallbacks (Lucide n'a pas d'équivalent direct)                 */
/* -------------------------------------------------------------------------- */

/** Broom (balai) — pas d'équivalent Lucide. */
const BROOM_SVG_24 = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 4h6"/><path d="M14 4 9.5 8.5"/><path d="M14 10.5 9.5 15"/><path d="M19 9.5 14.5 14"/><path d="M21 4 14 11"/><path d="M3 21l12.5-12.5"/></svg>`;

/** Connect-hint (2 ports de nœuds reliés) — pas d'équivalent Lucide. */
const CONNECT_HINT_SVG_24 = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="5" cy="12" r="2.5"/><circle cx="19" cy="12" r="2.5"/><path d="M8 12h8"/><path d="M14 9l3 3-3 3"/></svg>`;

/** Hub (point central + lignes radiales) — pas d'équivalent Lucide. */
const HUB_SVG_24 = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M12 5V3m0 18v-2M5 12H3m18 0h-2M7.05 7.05 5.636 5.636m12.728 12.728L16.95 16.95M7.05 16.95l-1.414 1.414M18.364 5.636l-1.414 1.414"/></svg>`;

/** Dotted arrow (flèche pointillée) — pas d'équivalent Lucide. */
const DOTTED_SVG_24 = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" stroke-dasharray="4 4"><path d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3"/></svg>`;

/* -------------------------------------------------------------------------- */
/*  Mapping nom logique → SVG Lucide (24×24) ou custom                        */
/* -------------------------------------------------------------------------- */

const ICONS = {
  /* === Chat panel UI === */
  'search': Search,
  'x': X,
  'close': X,
  'undo': Undo2,
  'redo': Redo2,
  'grid': LayoutGrid,
  'zoom-in': ZoomIn,
  'zoom-out': ZoomOut,
  'maximize': Maximize,
  'fit-to-screen': Maximize,
  'copy': Copy,
  'file-text': FileText,
  'file': FileText,
  'rotate-ccw': RotateCcw,
  'regenerate': RotateCcw,
  'edit': Edit,
  'send': Send,
  'square': Square,
  'stop': Square,
  'check': Check,
  'cloud': Cloud,
  'sparkles': Sparkles,
  'code': Code,
  'server': Server,
  /* === Quick action icons (ex-ACTION_ICONS) === */
  'bar-chart': BarChart,
  'lightbulb': Lightbulb,
  'zap': Zap,
  'settings': Settings,
  'refresh': RefreshCw,
  'alert-triangle': TriangleAlert,
  'trash': Trash,
  'book-open': BookOpen,
  'history': History,
  'x-circle': CircleX,
  'trending-up': TrendingUp,
  /* === Palette Mermaid (ex-icons.js — 30+ clés) === */
  // Node types
  'start': Play,
  'end': Square,
  'process': Cpu,
  'decision': HelpCircle,
  'document': FileText,
  'user': User,
  'storage': Server,
  'module': Package,
  'important': Star,
  'attention': TriangleAlert,
  'idea': Lightbulb,
  'goal': Flag,
  'success': BadgeCheck,
  // Variants
  'rocket': Rocket,
  'inbox': Inbox,
  'xCircle': CircleX,
  'hub': HUB_SVG_24, // custom
  'branch': GitBranch,
  'users': Users,
  'shield': Shield,
  'key': Key,
  'tag': Tag,
  'lock': Lock,
  'beaker': FlaskConical,
  'play': Play,
  'serverStack': Layers,
  'globe': Globe,
  'cursor': MousePointer,
  'eye': Eye,
  'funnel': Filter,
  'chartBar': BarChart,
  // Connectors
  'arrow': ArrowRight,
  'dotted': DOTTED_SVG_24, // custom
  'bold': ArrowRight,
  'circle': Circle,
  'clipboard-list': ClipboardList, // exportPanel mode "Plan complet"
  // Export menu
  'photo': Image,
  'image': Image, // alias (exportPanel)
  'cube': Box,
  'json': FileJson,
  'file-json': FileJson, // alias (exportPanel)
  'braces': Braces, // alias (exportPanel — iconJson)
  'download': Download,
  // UI actions
  'link': Link2,
  'unlink': Link2Off, // alias (canvasRenderer)
  'cog': Settings,
  'disconnect': Link2Off,
  'xMark': X,
  'git-branch': GitBranch, // alias (canvasRenderer)
  /* === Inline SVGs (apiKeysModal, menuActionsTop, etc.) === */
  'plus': Plus,
  'info': Info,
  'sun': Sun,
  'bot': Bot,
  'chevron-down': ChevronDown,
  /* === Custom fallbacks (Lucide n'a pas ces icônes) === */
  'broom': BROOM_SVG_24,
  'connect-hint': CONNECT_HINT_SVG_24,
  /* === Provider panel actions === */
  'save': Save,    // providerPanel "Enregistrer"
  'pencil': Pencil, // providerPanel "Modifier"
  'refresh-cw': RefreshCw, // alias (apiKeysModal rotation)
  'file-edit': FileEdit, // alias (apiKeysModal hint)
};

/**
 * Tailles prédéfinies communes.
 */
export const CHAT_ICON_SIZES = {
  xs: 10,
  sm: 12,
  md: 14,
  lg: 16,
  xl: 18,
};

/**
 * Retourne le HTML SVG pour une icône, redimensionné.
 *
 * @param {string} name - Nom logique de l'icône (kebab-case ou camelCase)
 * @param {number} [size=14] - Taille en pixels (largeur = hauteur)
 * @param {string} [className] - Classe CSS optionnelle à ajouter au <svg>
 * @returns {string} Le HTML SVG, ou '' si l'icône n'existe pas
 */
export function getChatIcon(name, size = 14, className) {
  let svg = ICONS[name];
  if (!svg) {
    console.warn(`[chatIcons] Unknown icon: "${name}"`);
    return '';
  }
  if (size !== 24) {
    svg = svg
      .replace(/width="24"/, `width="${size}"`)
      .replace(/height="24"/, `height="${size}"`);
  }
  if (className) {
    svg = svg.replace(/^<svg /, `<svg class="${className}" `);
  }
  return svg;
}

/**
 * Variante de l'icône "check" avec un stroke plus épais (feedback visuel copy).
 * Centralisée ici pour éviter le hack `replace(/stroke-width="2"/, ...)` éparpillé.
 *
 * @param {number} [size=12] - Taille en pixels
 * @returns {string} Le HTML SVG du check en stroke bold
 */
export function getChatIconCheckBold(size = 12) {
  return getChatIcon('check', size).replace(/stroke-width="2"/, 'stroke-width="2.5"');
}
