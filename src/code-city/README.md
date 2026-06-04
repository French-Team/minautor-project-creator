# Code City — Architecture

Application modulaire de génération de diagrammes Mermaid organisée en quartiers.

## Layout

```
┌──────────────────────────────────────────┐
│  QUARTIER TOP (logo + actions)           │
├──────────┬───────────────────────────────┤
│          │  QUARTIER CENTER              │
│  LEFT    │  ├── canvas (éditeur)         │
│  (sidebar│  ├── preview                  │
│   palette│  ├── code                     │
│   +      │  └── propriétés               │
│   config)│                               │
├──────────┴───────────────────────────────┤
│  QUARTIER BOTTOM (status bar)            │
└──────────────────────────────────────────┘
```

## Modules

### `code-city.js`
Point d'entrée. Crée la structure HTML, initialise tous les quartiers,
restaure le graphe depuis localStorage.

### `state.js`
Store central : nœuds, arêtes, sélection, historique (undo/redo),
zoom/pan, snap-to-grid. Expose `getState()`, `subscribe()`, `actions.*`.

### `render/canvasRenderer.js`
Sync DOM ↔ state. Crée/met à jour les éléments `.canvas-element` et le SVG
d'arêtes. Gère drag, click-vs-drag, menus (node + port), connexions
(drag-to-connect + arm-to-connect), mouseleave→closeMenu.

### `icons.js`
25+ icônes SVG inline (getIcon, iconStart, iconRocket, etc.).
Registre par nom court.

### `mermaid/`
- `build.js` : construit le code Mermaid depuis l'état (`buildMermaidCode`).
  Gère mapping de formes, IDs, labels, descriptions.
- `parse.js` : parse le code Mermaid → état (nœuds + arêtes).
- `pipeline.js` : sync bidirectionnelle state ↔ textarea.
- `export.js` : export mmd/svg/png.

### `persistence.js`
Auto-save/localStorage + load/clear.

### `keyboard.js`
Raccourcis : Ctrl+Z (undo), Ctrl+Y/Ctrl+Shift+Z (redo), Ctrl+S (save),
Ctrl+A (select all).

### `quartierTop/`
- `logoTop/logoTop.js` : Logo SVG animé (badge "M" shimmer + texte reveal).
- `menuActionsTop/` : boutons effacer, exporter, thème, etc.

### `quartierLeft/`
- `fonctionsMermaidLeft/menuMermaidActionsLeft/menuMermaidActionsLeft.js` :
  Palette sidebar : 6 catégories accordéon, chaque carte = `<select>` de
  variantes (icône + couleur de fond). Drag & drop avec payload enrichi.

### `quartierCenter/`
- `centerTabs.js` : 4 onglets (Éditeur / Aperçu / Code / Propriétés).
- `previewPanel.js` : rendu Mermaid live, click → editor + center.
- `structureCanvasCenter/` : grille SVG, zoom/molette/pan, undo/redo.

### `quartierRight/`
- `centerAuxPanels.js` : onglets Code (copy) + Propriétés (formulaire
  label/description/métadonnées).
- `exportPanel.js` : panneau rétractable export mmd/svg/png.

### `quartierBottom/`
- `quartierBottom.js` : status bar → compteur nœuds, type message, theme.

## Fichiers supprimés (refacto)
- `utils.js` : fonctions dépréciées (showNotification, copyToClipboard, etc.)
  remplacées par `actions.setStatusMessage()` et code inline.
- `fonctionsCanvasCenter/` : no-op (rôle repris par canvasRenderer).
- `menuActionsCenter/` : no-op (rôle repris par Quartier Right).

## Dev
```bash
npm run dev    # lance Vite sur le port 8081
npm run build  # build production
```

## Stack
- Vite 5 + Mermaid 10
- CSS Grid + Custom Properties
- SVG inline (icônes, edges, logo, grille)
- localStorage persistence
- Pas de framework UI
