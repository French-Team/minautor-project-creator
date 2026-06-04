/**
 * Code City - Application principale
 * Point d'entrée pour l'architecture en 5 quartiers
 *
 * Structure HTML (source unique de vérité) :
 *   .app
 *     ├── .app__top        (header)        — logo + actions (dont Export)
 *     ├── .app__left       (sidebar)       — palette d'éléments
 *     ├── .app__main       (center)        — 4 onglets :
 *     │     ├── .main__tabs                  Éditeur / Aperçu / Code / Propriétés
 *     │     ├── .main__panel[editor]   → toolbar + canvas
 *     │     │     ├── .toolbar
 *     │     │     └── .canvas-area
 *     │     │           ├── .canvas-grid
 *     │     │           ├── .canvas-content
 *     │     │           └── .canvas-overlay
 *     │     ├── .main__panel[preview]  → rendu Mermaid pleine zone
 *     │     ├── .main__panel[code]     → éditeur 2-way binding
 *     │     └── .main__panel[properties] → formulaire du nœud
 *     ├── .app__bottom     (statusbar)
 *     └── .app__export     (panneau rétractable)  — méthodes d'export
 *           └── .app__export-backdrop
 *           └── .app__export-panel
 *                 ├── header (titre + bouton fermer)
 *                 └── body (liste des formats)
 */

import { initializeQuartierTop } from './quartierTop/quartierTop.js';
import { initializeQuartierLeft } from './quartierLeft/quartierLeft.js';
import { toggleAllSections } from './quartierLeft/fonctionsMermaidLeft/menuMermaidActionsLeft/menuMermaidActionsLeft.js';
import { initializeQuartierCenter } from './quartierCenter/quartierCenter.js';
import { initializeCenterAuxPanels } from './quartierRight/centerAuxPanels.js';
import { initializeExportPanel } from './quartierRight/exportPanel.js';
import { initializeQuartierBottom } from './quartierBottom/quartierBottom.js';
import { initializeTheme } from './quartierTop/menuActionsTop/themeClairSombreActionTop.js';
import { initializeHistoryCanvasCenter } from './quartierCenter/structureCanvasCenter/historyCanvasCenter.js';
import { installKeyboardShortcuts } from './keyboard.js';
import { restoreFromStorage, startAutoSave } from './persistence.js';

export async function initializeApp() {
    console.log('🏙️ Initialisation de Code City...');

    try {
        // 1) Structure HTML + thème (synchrone, bloque l'UI)
        createBaseStructure();
        initializeTheme();

        // 2) Boutons undo/redo + raccourcis clavier
        initializeHistoryCanvasCenter();
        installKeyboardShortcuts();

        // 3) Quartiers (asynchrones, en parallèle)
        await Promise.all([
            initializeQuartierTop(),
            initializeQuartierLeft(),
            initializeQuartierCenter(),
            initializeCenterAuxPanels(),
            initializeExportPanel(),
            initializeQuartierBottom()
        ]);

        // 3b) Bouton collapse
        const collapseBtn = document.getElementById('palette-collapse-btn');
        if (collapseBtn) {
            collapseBtn.addEventListener('click', () => {
                const anyOpen = collapseBtn.textContent === 'Tout fermer';
                toggleAllSections(!anyOpen);
            });
        }

        // 4) Restauration localStorage puis auto-save
        const restored = restoreFromStorage();
        if (restored) {
            console.log('💾 Graphe restauré depuis localStorage');
        }
        startAutoSave();

        console.log('✅ Code City initialisée avec succès');
    } catch (error) {
        console.error('❌ Erreur lors de l\'initialisation de Code City:', error);
        throw error;
    }
}

function createBaseStructure() {
    const appContainer = document.querySelector('.app-container');
    if (!appContainer) {
        console.error('❌ Conteneur .app-container non trouvé');
        return;
    }

    appContainer.innerHTML = `
        <div class="app theme-light">

            <!-- ========== TOP ========== -->
            <header class="app__top">
                <div class="brand">
                    <span class="brand__mark">M</span>
                    <span>Mermaid Canvas</span>
                </div>
                <div class="top__actions">
                    <!-- Les boutons sont injectés par quartierTop/menuActionsTop -->
                </div>
            </header>

            <!-- ========== LEFT ========== -->
            <aside class="app__left">
                <div class="sidebar__head">
                    <span>Palette</span>
                    <div class="sidebar__head-right">
                        <button class="sidebar__collapse-btn" id="palette-collapse-btn" title="Ouvrir toutes les catégories">Tout ouvrir</button>
                        <span class="sidebar__count" id="palette-count"></span>
                    </div>
                </div>
                <div class="sidebar__search">
                    <svg class="sidebar__search-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <circle cx="11" cy="11" r="7"/>
                        <path d="M21 21l-4.3-4.3"/>
                    </svg>
                    <input type="text" class="sidebar__search-input" id="palette-search" placeholder="Rechercher…" autocomplete="off" />
                    <button class="sidebar__search-clear" id="palette-search-clear" title="Effacer" aria-label="Effacer la recherche" hidden>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <line x1="18" y1="6" x2="6" y2="18"/>
                            <line x1="6" y1="6" x2="18" y2="18"/>
                        </svg>
                    </button>
                </div>
                <div class="sidebar__body" id="palette-container">
                    <!-- Rempli dynamiquement par menuMermaidActionsLeft -->
                </div>
            </aside>

            <!-- ========== CENTER ========== -->
            <main class="app__main">
                <div class="main__tabs" role="tablist">
                    <button class="main__tab is-active" data-center-tab="editor" role="tab">Éditeur</button>
                    <button class="main__tab" data-center-tab="preview" role="tab">Aperçu</button>
                    <button class="main__tab" data-center-tab="code" role="tab">Code</button>
                    <button class="main__tab" data-center-tab="properties" role="tab" id="properties-tab">Propriétés</button>
                </div>

                <div class="main__panel is-active" data-center-panel="editor" role="tabpanel">
                    <div class="toolbar">
                        <div class="toolbar__group">
                            <button class="tbtn" id="undo-btn" title="Annuler (Ctrl+Z)" disabled>
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                    <path d="M3 7v6h6"/>
                                    <path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6.7 2.8L3 13"/>
                                </svg>
                            </button>
                            <button class="tbtn" id="redo-btn" title="Rétablir (Ctrl+Y)" disabled>
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                    <path d="M21 7v6h-6"/>
                                    <path d="M3 17a9 9 0 0 1 9-9 9 9 0 0 1 6.7 2.8L21 13"/>
                                </svg>
                            </button>
                        </div>
                        <div class="toolbar__sep"></div>
                        <div class="toolbar__group">
                            <button class="tbtn" id="grid-toggle" title="Afficher/masquer la grille">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                    <rect x="3" y="3" width="18" height="18" rx="2"/>
                                    <path d="M9 3v18M15 3v18M3 9h18M3 15h18"/>
                                </svg>
                            </button>
                            <button class="tbtn" id="zoom-out" title="Zoom arrière">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                    <circle cx="11" cy="11" r="7"/>
                                    <path d="M21 21l-4.3-4.3"/>
                                    <path d="M8 11h6"/>
                                </svg>
                            </button>
                            <span class="toolbar__zoom" id="zoom-level">100%</span>
                            <button class="tbtn" id="zoom-in" title="Zoom avant">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                    <circle cx="11" cy="11" r="7"/>
                                    <path d="M21 21l-4.3-4.3"/>
                                    <path d="M8 11h6M11 8v6"/>
                                </svg>
                            </button>
                            <button class="tbtn" id="fit-to-screen" title="Ajuster à la vue">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                    <path d="M3 7V3h4M21 7V3h-4M3 17v4h4M21 17v4h-4"/>
                                    <path d="M3 12h18M12 3v18"/>
                                </svg>
                            </button>
                        </div>
                        <div class="toolbar__sep"></div>
                        <div class="toolbar__group">
                            <span class="toolbar__hint" title="Cliquez sur le port sortie d'un nœud puis sur le port entrée d'un autre">
                                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                    <circle cx="5" cy="12" r="2.5"/>
                                    <circle cx="19" cy="12" r="2.5"/>
                                    <path d="M8 12h8"/>
                                    <path d="M14 9l3 3-3 3"/>
                                </svg>
                                <span>Connecter</span>
                            </span>
                        </div>
                    </div>

                    <div class="canvas-area">
                        <div class="canvas-grid" id="canvas-grid"></div>
                        <div class="canvas-content" id="canvas-content"></div>
                        <div class="canvas-overlay" id="canvas-overlay"></div>
                    </div>
                </div>

                <div class="main__panel" data-center-panel="preview" role="tabpanel">
                    <div class="preview-frame" id="preview-container">
                        <span>Le diagramme apparaîtra ici dès qu'il y aura des éléments.</span>
                    </div>
                </div>

                <div class="main__panel" data-center-panel="code" role="tabpanel">
                    <div class="code-toolbar">
                        <button class="btn btn--sm" id="copy-code-btn">
                            <svg class="btn__icon" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                <rect x="9" y="9" width="13" height="13" rx="2"/>
                                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                            </svg>
                            <span>Copier</span>
                        </button>
                        <span class="hint">Modifications synchronisées</span>
                    </div>
                    <textarea id="code-preview" class="code-area" spellcheck="false" placeholder="Le code Mermaid apparaîtra ici…"></textarea>
                </div>

                <div class="main__panel" data-center-panel="properties" role="tabpanel">
                    <div id="properties-container">
                        <div class="prop-empty">Sélectionnez un nœud pour modifier ses propriétés.</div>
                    </div>
                </div>
            </main>

            <!-- ========== BOTTOM ========== -->
            <footer class="app__bottom">
                <div class="status-row">
                    <span class="status-pill">Éléments <b id="element-count">0</b></span>
                    <span class="status-pill">Zoom <b id="zoom-status">100%</b></span>
                </div>
                <div class="status-row status-row--center">
                    <span class="status-msg" id="status-message" data-type="info">Prêt</span>
                </div>
                <div class="status-row">
                    <span class="status-pill">Thème <b id="theme-status">Clair</b></span>
                </div>
            </footer>

            <!-- ========== EXPORT PANEL (rétractable, fermé par défaut) ========== -->
            <div class="app__export" id="app-export" aria-hidden="true">
                <div class="app__export-backdrop" id="app-export-backdrop"></div>
                <aside class="app__export-panel" role="dialog" aria-labelledby="app-export-title">
                    <header class="app__export-header">
                        <h2 id="app-export-title" class="app__export-title">Exporter</h2>
                        <button type="button" class="app__export-close" id="app-export-close" aria-label="Fermer le panneau d'export">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                <path d="M18 6L6 18M6 6l12 12"/>
                            </svg>
                        </button>
                    </header>
                    <div class="app__export-body" id="app-export-body">
                        <!-- Rempli dynamiquement par exportPanel.js -->
                    </div>
                </aside>
            </div>
        </div>
    `;

    console.log('🏗️ Structure HTML de base créée');
}
