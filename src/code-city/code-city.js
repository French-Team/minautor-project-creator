/**
 * Code City - Application principale
 * Point d'entrée pour l'architecture en 5 quartiers
 *
 * Structure HTML (source unique de vérité) :
 *   .app
 *     ├── .app__top        (header)        — logo + actions
 *     ├── .app__left       (sidebar)       — palette d'éléments
 *     ├── .app__main       (center)        — toolbar + canvas
 *     │     ├── .toolbar
 *     │     └── .canvas-area
 *     │           ├── .canvas-grid
 *     │           ├── .canvas-content
 *     │           └── .canvas-overlay
 *     ├── .app__right      (sidebar)       — onglets Aperçu / Code / Propriétés
 *     └── .app__bottom     (statusbar)
 */

import { initializeQuartierTop } from './quartierTop/quartierTop.js';
import { initializeQuartierLeft } from './quartierLeft/quartierLeft.js';
import { initializeQuartierCenter } from './quartierCenter/quartierCenter.js';
import { initializeQuartierRight } from './quartierRight/quartierRight.js';
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
            initializeQuartierRight(),
            initializeQuartierBottom()
        ]);

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
                    <span>Palette d'éléments</span>
                </div>
                <div class="sidebar__body">
                    <div class="elements-category">
                        <h6>Diagrammes de base</h6>
                        <div class="elements-grid" id="categorie-1"></div>
                    </div>
                    <div class="elements-category">
                        <h6>Éléments avancés</h6>
                        <div class="elements-grid" id="categorie-2"></div>
                    </div>
                    <div class="elements-category">
                        <h6>Variantes visuelles</h6>
                        <div class="elements-grid" id="categorie-3"></div>
                    </div>
                </div>
            </aside>

            <!-- ========== CENTER ========== -->
            <main class="app__main">
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
            </main>

            <!-- ========== RIGHT ========== -->
            <aside class="app__right">
                <div class="tabs" role="tablist">
                    <button class="tab is-active" data-tab="preview" role="tab">Aperçu</button>
                    <button class="tab" data-tab="code" role="tab">Code</button>
                    <button class="tab" data-tab="properties" role="tab" id="properties-tab">Propriétés</button>
                </div>

                <div class="tabpanel is-active" data-panel="preview" role="tabpanel">
                    <div class="preview-frame" id="preview-container">
                        <span>Le diagramme apparaîtra ici dès qu'il y aura des éléments.</span>
                    </div>
                </div>

                <div class="tabpanel" data-panel="code" role="tabpanel">
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

                <div class="tabpanel" data-panel="properties" role="tabpanel">
                    <div id="properties-container">
                        <div class="prop-empty">Sélectionnez un nœud pour modifier ses propriétés.</div>
                    </div>
                </div>
            </aside>

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
        </div>
    `;

    console.log('🏗️ Structure HTML de base créée');
}
