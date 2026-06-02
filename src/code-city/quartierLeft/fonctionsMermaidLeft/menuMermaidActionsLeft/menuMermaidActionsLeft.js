/**
 * Menu Mermaid Actions Left - Gestion des éléments draggables de la sidebar
 *
 * Chaque élément de la palette décrit un TYPE de nœud Mermaid (`type`).
 * Au drag, on transfère `{ type, label, icon }` via `application/json`.
 * Le canvas renderer (render/canvasRenderer.js) reçoit la payload, crée
 * le nœud dans le state et le rend.
 */

const PALETTE = [
  // Catégorie 1 — Diagrammes de base
  {
    category: 1,
    items: [
      { type: 'start',    icon: '🟢', label: 'Début',       tooltip: 'Nœud de départ' },
      { type: 'end',      icon: '🔴', label: 'Fin',         tooltip: 'Nœud de fin' },
      { type: 'process',  icon: '⚡', label: 'Processus',   tooltip: 'Étape de traitement' },
      { type: 'decision', icon: '❓', label: 'Décision',    tooltip: 'Point de décision' },
      { type: 'document', icon: '📄', label: 'Document',    tooltip: 'Document ou fichier' },
      { type: 'user',     icon: '👤', label: 'Utilisateur', tooltip: 'Action utilisateur' },
      { type: 'storage',  icon: '💾', label: 'Stockage',    tooltip: 'Sauvegarde de données' },
    ],
  },
  // Catégorie 2 — Éléments avancés
  {
    category: 2,
    items: [
      { type: 'module',    icon: '📦', label: 'Module',    tooltip: 'Module ou fonction' },
      { type: 'important', icon: '⭐', label: 'Important', tooltip: 'Point important' },
      { type: 'attention', icon: '⚠️', label: 'Attention', tooltip: "Point d'attention" },
      { type: 'idea',      icon: '💡', label: 'Idée',      tooltip: 'Idée ou concept' },
      { type: 'goal',      icon: '🎯', label: 'Objectif',  tooltip: 'Objectif à atteindre' },
      { type: 'success',   icon: '🏆', label: 'Succès',    tooltip: 'Succès ou accomplissement' },
    ],
  },
  // Catégorie 3 — Variantes visuelles
  {
    category: 3,
    items: [
      { type: 'process', icon: '🎨', label: 'Stylé',   tooltip: 'Processus mis en valeur' },
      { type: 'process', icon: '🔥', label: 'Animé',   tooltip: 'Processus à effet visuel' },
      { type: 'process', icon: '🌟', label: 'Spécial', tooltip: 'Processus spécial' },
    ],
  },
];

export async function initializeMenuMermaidActionsLeft() {
  console.log('📋 Initialisation de la palette...');
  try {
    const cats = [1, 2, 3].map((n) => document.getElementById(`categorie-${n}`));
    if (cats.some((c) => !c)) {
      throw new Error('Conteneurs de catégories non trouvés');
    }

    PALETTE.forEach((group, idx) => {
      populateCategory(cats[idx], group.items);
    });

    console.log('✅ Palette initialisée');
  } catch (error) {
    console.error('❌ Erreur lors de l\'initialisation de la palette:', error);
    throw error;
  }
}

function populateCategory(container, items) {
  container.innerHTML = '';
  for (const item of items) {
    const el = document.createElement('div');
    el.className = 'element-card';
    el.draggable = true;
    el.dataset.type = item.type;
    el.title = item.tooltip;
    el.innerHTML = `
      <span class="element-card__icon">${item.icon}</span>
      <span class="element-card__label">${item.label}</span>
    `;

    el.addEventListener('dragstart', (e) => {
      const payload = JSON.stringify({
        type: item.type,
        label: item.label,
        icon: item.icon,
      });
      e.dataTransfer.setData('application/json', payload);
      e.dataTransfer.setData('text/plain', payload);
      e.dataTransfer.effectAllowed = 'copy';
      el.classList.add('is-dragging');
    });
    el.addEventListener('dragend', () => {
      el.classList.remove('is-dragging');
    });

    container.appendChild(el);
  }
}
