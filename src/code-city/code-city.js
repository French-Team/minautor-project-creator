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
import { loadEnvKeys } from './ai/envLoader.js';
import { validateStoredProvider } from './ai/providerLoader.js';
import { initializeProviderPanel } from './ai/providerPanel.js';
import { initializeChatPanel } from './ai/chatPanel.js';
import { initAssistant } from './state.js';
import { getChatIcon } from './chatIcons.js';

export async function initializeApp() {
    console.log('🏙️ Initialisation de Code City...');

    try {
        // 1) Structure HTML + thème (synchrone, bloque l'UI)
        createBaseStructure();
        initializeTheme();

        // 1b) Charger les clés API depuis le serveur env (/.env)
        await loadEnvKeys();

        // 1c) Charger la config assistant depuis le fichier JSON
        await initAssistant();

        // 1d) Valider le provider stocké (depuis JSON maintenant)
        validateStoredProvider();

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
            initializeProviderPanel(),
            initializeChatPanel(),
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
                    <span class="sidebar__search-icon">${getChatIcon('search', 14)}</span>
                    <input type="text" class="sidebar__search-input" id="palette-search" placeholder="Rechercher…" autocomplete="off" />
                    <button class="sidebar__search-clear" id="palette-search-clear" title="Effacer" aria-label="Effacer la recherche" hidden>${getChatIcon('x', 12)}</button>
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
                            <button class="tbtn" id="undo-btn" title="Annuler (Ctrl+Z)" disabled>${getChatIcon('undo', 16)}</button>
                            <button class="tbtn" id="redo-btn" title="Rétablir (Ctrl+Y)" disabled>${getChatIcon('redo', 16)}</button>
                        </div>
                        <div class="toolbar__sep"></div>
                        <div class="toolbar__group">
                            <button class="tbtn" id="grid-toggle" title="Afficher/masquer la grille">${getChatIcon('grid', 16)}</button>
                            <button class="tbtn" id="zoom-out" title="Zoom arrière">${getChatIcon('zoom-out', 16)}</button>
                            <span class="toolbar__zoom" id="zoom-level">100%</span>
                            <button class="tbtn" id="zoom-in" title="Zoom avant">${getChatIcon('zoom-in', 16)}</button>
                            <button class="tbtn" id="fit-to-screen" title="Ajuster à la vue">${getChatIcon('fit-to-screen', 16)}</button>
                        </div>
                        <div class="toolbar__sep"></div>
                        <div class="toolbar__group">
                            <span class="toolbar__hint" title="Cliquez sur le port sortie d'un nœud puis sur le port entrée d'un autre">${getChatIcon('connect-hint', 13)}<span>Connecter</span></span>
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
                        <button class="btn btn--sm" id="copy-code-btn">${getChatIcon('copy', 13)}<span>Copier</span></button>
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

            <!-- ========== PROVIDERS PANEL (rétractable, fermé par défaut) ========== -->
            <div class="app__providers" id="app-providers" aria-hidden="true">
                <div class="app__providers-backdrop" id="app-providers-backdrop"></div>
                <aside class="app__providers-panel" role="dialog" aria-labelledby="app-providers-title">
                    <header class="app__providers-header">
                        <h2 id="app-providers-title" class="app__providers-title">Providers IA</h2>
                        <button type="button" class="app__providers-close" id="app-providers-close" aria-label="Fermer le panneau providers">${getChatIcon('x', 16)}</button>
                    </header>
                    <div class="app__providers-body" id="app-providers-body">
                        <!-- Rempli dynamiquement par providerPanel.js -->
                    </div>
                </aside>
            </div>

            <!-- ========== CHAT PANEL (rétractable, fermé par défaut) ========== -->
            <div class="app__chat" id="app-chat" aria-hidden="true">
                <div class="app__chat-backdrop" id="app-chat-backdrop"></div>
                <aside class="app__chat-panel" role="dialog" aria-labelledby="app-chat-title">
                    <header class="app__chat-header">
                        <div class="app__chat-header-center">
                            <div class="app__chat-provider-bar" id="app-chat-provider-bar">
                            <!-- Rempli dynamiquement par chatPanel.js -->
                            </div>
                            <h2 id="app-chat-title" class="app__chat-title">Mina</h2>
                            <div class="app__chat-header-banner-wrap">
                                <img class="app__chat-header-img" src="assets/mina-banniere.jpg" alt="Mina" />
                            </div>
                        </div>
                        <div class="app__chat-header-right">
                            <button type="button" class="app__chat-clear" id="app-chat-clear" title="Vider le chat" aria-label="Vider l'historique du chat">${getChatIcon('broom', 14)}</button>
                            <button type="button" class="app__chat-close" id="app-chat-close" aria-label="Fermer le panneau chat">${getChatIcon('x', 16)}</button>
                        </div>
                    </header>
                    <!-- Topbar sticky : historique des prompts + compteur de tokens -->
                    <div class="app__chat-topbar" id="app-chat-topbar">
                        <!-- Rempli dynamiquement par chatPanel.js -->
                    </div>
                    <div class="chat-messages" id="app-chat-body">
                        <!-- Rempli dynamiquement par chatPanel.js -->
                    </div>
                    <div class="chat-quick-actions" id="chat-quick-actions">
                        <!-- Rempli dynamiquement par chatPanel.js -->
                    </div>
                    <div class="chat-input-area" id="chat-input-area">
                        <!-- Rempli dynamiquement par chatPanel.js -->
                    </div>
                </aside>
            </div>

            <!-- ========== EXPORT PANEL (rétractable, fermé par défaut) ========== -->
            <div class="app__export" id="app-export" aria-hidden="true">
                <div class="app__export-backdrop" id="app-export-backdrop"></div>
                <aside class="app__export-panel" role="dialog" aria-labelledby="app-export-title">
                    <header class="app__export-header">
                        <h2 id="app-export-title" class="app__export-title">Exporter</h2>
                        <button type="button" class="app__export-close" id="app-export-close" aria-label="Fermer le panneau d'export">${getChatIcon('x', 16)}</button>
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
