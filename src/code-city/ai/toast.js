/**
 * Toast Service — Notifications toast réutilisables
 *
 * Service global pour afficher des notifications toast n'importe où dans le code.
 * Usage :
 *   import { toast } from './toast.js';
 *   toast.success('Sauvegardé !');
 *   toast.error('Erreur de connexion');
 *   toast.info('Nouveau provider ajouté');
 *   toast.warning('Clé API invalide');
 *   toast.show('Message custom', { type: 'success', duration: 5000, closable: true });
 *
 * Le service gère :
 *   - Création du conteneur DOM au premier appel
 *   - Auto-suppression après duration (défaut: 3500ms)
 *   - Fermeture manuelle via bouton ✕
 *   - Max 5 toasts visibles (les plus anciens sont supprimés)
 *   - Animation d'entrée/sortie
 *   - Position : coin bas-droite
 *
 * @module toast
 */

const TOAST_DEFAULTS = {
  duration: 3500,
  closable: true,
  maxVisible: 5,
};

const ICONS = {
  success: '✓',
  error: '✕',
  warning: '⚠',
  info: 'ℹ',
};

let containerEl = null;
let toastCount = 0;

/**
 * Crée le conteneur DOM des toasts (une seule fois).
 */
function ensureContainer() {
  if (containerEl && document.body.contains(containerEl)) return containerEl;

  containerEl = document.createElement('div');
  containerEl.className = 'toast-container';
  containerEl.setAttribute('aria-live', 'polite');
  containerEl.setAttribute('aria-atomic', 'false');
  document.body.appendChild(containerEl);
  return containerEl;
}

/**
 * Supprime un toast avec animation de sortie.
 * @param {HTMLElement} el
 */
function removeToast(el) {
  if (!el || !el.parentNode) return;
  el.classList.add('toast--exit');
  el.addEventListener('animationend', () => {
    el.remove();
    // Nettoyer le conteneur s'il est vide
    if (containerEl && containerEl.children.length === 0) {
      containerEl.remove();
      containerEl = null;
    }
  }, { once: true });
}

/**
 * Limite le nombre de toasts visibles.
 */
function enforceMaxVisible(max) {
  if (!containerEl) return;
  const toasts = containerEl.querySelectorAll('.toast:not(.toast--exit)');
  const excess = toasts.length - max;
  for (let i = 0; i < excess; i++) {
    removeToast(toasts[i]);
  }
}

/**
 * Affiche un toast.
 *
 * @param {string} message - Message à afficher
 * @param {Object} [options]
 * @param {'success'|'error'|'warning'|'info'} [options.type='info'] - Type de toast
 * @param {number}  [options.duration=3500] - Durée en ms (0 = pas d'auto-suppression)
 * @param {boolean} [options.closable=true] - Afficher le bouton de fermeture
 * @returns {HTMLElement} L'élément DOM du toast (pour fermeture manuelle)
 */
function showToast(message, options = {}) {
  const { type = 'info', duration, closable } = { ...TOAST_DEFAULTS, ...options };
  const finalDuration = duration ?? TOAST_DEFAULTS.duration;

  const container = ensureContainer();
  enforceMaxVisible(TOAST_DEFAULTS.maxVisible);

  const id = `toast-${++toastCount}`;
  const el = document.createElement('div');
  el.className = `toast toast--${type}`;
  el.id = id;
  el.setAttribute('role', 'alert');

  el.innerHTML = `
    <span class="toast__icon">${ICONS[type] || ICONS.info}</span>
    <span class="toast__message">${escapeHtml(message)}</span>
    ${closable ? `<button type="button" class="toast__close" aria-label="Fermer">✕</button>` : ''}
  `;

  // Fermeture manuelle
  const closeBtn = el.querySelector('.toast__close');
  if (closeBtn) {
    closeBtn.addEventListener('click', () => removeToast(el));
  }

  // Auto-suppression
  let timer = null;
  if (finalDuration > 0) {
    timer = setTimeout(() => {
      removeToast(el);
    }, finalDuration);

    // Pause au survol
    el.addEventListener('mouseenter', () => {
      if (timer) clearTimeout(timer);
    });
    el.addEventListener('mouseleave', () => {
      if (finalDuration > 0) {
        timer = setTimeout(() => removeToast(el), finalDuration);
      }
    });
  }

  container.appendChild(el);
  return el;
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Service toast — API publique.
 *
 * Usage :
 *   toast.success('Fait !');
 *   toast.error('Erreur');
 *   toast.info('Info');
 *   toast.warning('Attention');
 *   toast.show('Custom', { type: 'success', duration: 5000 });
 */
export const toast = {
  /** Notification de succès (vert) */
  success(message, options) {
    return showToast(message, { ...options, type: 'success' });
  },

  /** Notification d'erreur (rouge) */
  error(message, options) {
    return showToast(message, { ...options, type: 'error' });
  },

  /** Notification d'information (bleu) */
  info(message, options) {
    return showToast(message, { ...options, type: 'info' });
  },

  /** Notification d'avertissement (orange) */
  warning(message, options) {
    return showToast(message, { ...options, type: 'warning' });
  },

  /** Affiche un toast avec contrôle total */
  show(message, options) {
    return showToast(message, options);
  },

  /** Ferme tous les toasts actifs */
  dismissAll() {
    if (!containerEl) return;
    const toasts = containerEl.querySelectorAll('.toast');
    toasts.forEach((el) => removeToast(el));
  },
};
