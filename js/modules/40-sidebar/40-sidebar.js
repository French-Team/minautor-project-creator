/**
 * MODULE SIDEBAR-40 : Gestion de la Barre Latérale
 * Gère l'interface de la barre latérale et les interactions
 */

import { sidebarConfig } from './40-sidebar-config.js';

class SidebarModule {
    constructor() {
        this.sidebar = null;
        this.sidebarToggle = null;
        this.panels = new Map();
        this.activePanel = null;
        this.isInitialized = false;
        
        this.init();
    }

    async init() {
         console.log('📋 Initialisation 40-sidebar...');

         // Attendre que le DOM soit prêt
         if (document.readyState !== 'loading') {
             console.log('📋 DOM déjà chargé, initialisation immédiate');
         } else {
             console.log('📋 En attente du chargement du DOM...');
             await new Promise(resolve => {
                 if (document.readyState !== 'loading') {
                     resolve();
                 } else {
                     document.addEventListener('DOMContentLoaded', resolve);
                 }
             });
         }

         this.setupSidebar();
         this.setupPanels();
         this.populateElementCategories(); // NOUVEAU: Remplir les catégories
         this.bindEvents();

         this.isInitialized = true;
         console.log('✅ 40-sidebar prêt');
     }

    /**
     * Configuration de la barre latérale
     */
    setupSidebar() {
        this.sidebar = document.getElementById('sidebar');
        this.sidebarToggle = document.getElementById('sidebarToggle');
        
        if (!this.sidebar) {
            console.warn('Sidebar DOM non trouvée');
            return;
        }
        
        console.log('Barre latérale configurée');
    }

    /**
     * Configuration des panneaux
     */
    setupPanels() {
        const panelElements = this.sidebar?.querySelectorAll('.sidebar-panel');
        
        if (panelElements) {
            panelElements.forEach(panel => {
                const panelId = panel.id || panel.getAttribute('data-panel');
                this.panels.set(panelId, {
                    element: panel,
                    isOpen: false,
                    title: panel.querySelector('.panel-title')?.textContent || panelId
                });
            });
        }
        
        console.log(`Panneaux configurés: ${this.panels.size}`);
    }

    /**
      * Peuple les catégories d'éléments dans la sidebar
      */
     populateElementCategories() {
         console.log('🎨 Recherche du conteneur elementCategories...');

         const elementCategories = document.getElementById('elementCategories');
         if (!elementCategories) {
             console.error('❌ Conteneur elementCategories non trouvé dans le DOM!');
             console.log('DOM actuel:', document.body.innerHTML);
             return;
         }

         console.log('✅ Conteneur elementCategories trouvé, peuplement...');

         // Vide le conteneur
         elementCategories.innerHTML = '';

         // Stocke les références aux contenus de catégories pour l'accordéon
         this.categoryContents = new Map();
        
        // Ajoute chaque catégorie
        sidebarConfig.categories.forEach(category => {
            const categoryDiv = document.createElement('div');
            categoryDiv.className = 'element-category';
            categoryDiv.setAttribute('data-category', category.id);
            
            // Titre de la catégorie
            const categoryHeader = document.createElement('div');
            categoryHeader.className = 'category-header';
            categoryHeader.innerHTML = `
                <span class="category-icon">${category.icon}</span>
                <span class="category-name">${category.name}</span>
                <span class="category-toggle">▼</span>
            `;
            
            // Contenu de la catégorie
            const categoryContent = document.createElement('div');
            categoryContent.className = 'category-content';
            
            // Ajoute chaque élément
             category.elements.forEach(element => {
                 const elementDiv = document.createElement('div');
                 elementDiv.className = 'element-item';
                 elementDiv.setAttribute('data-element-type', element.id);
                 elementDiv.setAttribute('data-template', element.template);
                 elementDiv.draggable = sidebarConfig.sidebar.draggable;

                 elementDiv.innerHTML = `
                     <span class="element-icon">${element.icon}</span>
                     <span class="element-name">${element.name}</span>
                 `;

                 // Ajoute les événements de drag & drop
                 if (sidebarConfig.sidebar.draggable) {
                     elementDiv.addEventListener('dragstart', (e) => {
                         e.dataTransfer.setData('text/plain', JSON.stringify({
                             type: element.id,
                             template: element.template,
                             icon: element.icon,
                             name: element.name
                         }));
                         elementDiv.classList.add('dragging');
                     });

                     elementDiv.addEventListener('dragend', (e) => {
                         elementDiv.classList.remove('dragging');
                     });
                 }

                 categoryContent.appendChild(elementDiv);
             });

             // Stocke la référence au contenu pour l'accordéon
             this.categoryContents.set(category.id, {
                 content: categoryContent,
                 header: categoryHeader
             });
            
            // Toggle de la catégorie avec comportement accordéon
            categoryHeader.addEventListener('click', () => {
                this.toggleCategory(category.id);
            });
            
            categoryDiv.appendChild(categoryHeader);
            categoryDiv.appendChild(categoryContent);
            elementCategories.appendChild(categoryDiv);
            
            // Ouvre la catégorie par défaut après un petit délai pour laisser le temps au DOM de se mettre à jour
            if (category.id === sidebarConfig.sidebar.defaultCategory) {
                setTimeout(() => {
                    this.toggleCategory(category.id);
                }, 100);
            }
        });
        
        console.log(`✅ ${sidebarConfig.categories.length} catégories ajoutées`);
    }

    /**
      * Ferme toutes les catégories
      */
     closeAllCategories() {
         this.categoryContents.forEach((categoryData, categoryId) => {
             const { content, header } = categoryData;
             content.classList.remove('open');
             header.querySelector('.category-toggle').textContent = '▶';
         });
     }

     /**
      * Toggle une catégorie spécifique (comportement accordéon)
      */
     toggleCategory(categoryId) {
         const categoryData = this.categoryContents.get(categoryId);
         if (!categoryData) return;

         const { content, header } = categoryData;
         const isOpen = content.classList.contains('open');

         // Ferme toutes les catégories d'abord
         this.closeAllCategories();

         // Si la catégorie n'était pas ouverte, on l'ouvre
         if (!isOpen) {
             content.classList.add('open');
             header.querySelector('.category-toggle').textContent = '▼';
         }
         // Si elle était ouverte, elle reste fermée (comportement accordéon)
     }

    /**
     * Liaison des événements
     */
    bindEvents() {
        // Bouton toggle principal
        if (this.sidebarToggle) {
            this.sidebarToggle.addEventListener('click', () => {
                this.toggleSidebar();
            });
        }
        
        // Boutons des panneaux
        this.panels.forEach((panel, panelId) => {
            const toggleBtn = panel.element.querySelector('.panel-toggle');
            if (toggleBtn) {
                toggleBtn.addEventListener('click', () => {
                    this.togglePanel(panelId);
                });
            }
        });
        
        // Fermeture par clic extérieur
        document.addEventListener('click', (e) => {
            if (this.sidebar && !this.sidebar.contains(e.target) && 
                this.sidebarToggle && !this.sidebarToggle.contains(e.target)) {
                this.closeSidebar();
            }
        });
        
        console.log('Événements liés');
    }

    /**
     * Traitement principal du module
     */
    async process(data, context = {}) {
        console.log('📋 40-sidebar traite:', data);
        
        // Traite les données selon le type
        if (data.type === 'panel_request') {
            return await this.handlePanelRequest(data, context);
        }
        
        if (data.type === 'sidebar_state') {
            return await this.handleSidebarState(data, context);
        }
        
        if (data.type === 'element_selected') {
            return await this.handleElementSelected(data, context);
        }
        
        if (data.type === 'tool_request') {
            return await this.handleToolRequest(data, context);
        }
        
        // Pass-through par défaut
        return data;
    }

    /**
     * Gère les demandes de panneau
     */
    async handlePanelRequest(data, context) {
        const { panelId, action, content } = data;
        
        switch (action) {
            case 'open':
                return await this.openPanel(panelId);
            case 'close':
                return await this.closePanel(panelId);
            case 'update':
                return await this.updatePanelContent(panelId, content);
            case 'create':
                return await this.createPanel(panelId, content);
            default:
                console.warn(`Action panneau inconnue: ${action}`);
                return data;
        }
    }

    /**
     * Gère l'état de la barre latérale
     */
    async handleSidebarState(data, context) {
        const { state } = data;
        
        if (state === 'toggle') {
            this.toggleSidebar();
        } else if (state === 'open') {
            this.openSidebar();
        } else if (state === 'close') {
            this.closeSidebar();
        }
        
        return {
            type: 'sidebar_state_changed',
            state: this.getSidebarState()
        };
    }

    /**
     * Gère la sélection d'un élément
     */
    async handleElementSelected(data, context) {
        const { elementId, elementType } = data;
        
        // Met à jour le panneau de propriétés
        await this.updatePropertiesPanel(elementId, elementType);
        
        // Ouvre le panneau de propriétés si fermé
        if (this.panels.has('properties')) {
            await this.openPanel('properties');
        }
        
        return {
            ...data,
            propertiesPanelUpdated: true
        };
    }

    /**
     * Gère les demandes d'outils
     */
    async handleToolRequest(data, context) {
        const { toolId, action } = data;
        
        // Trouve l'outil dans la barre latérale
        const toolButton = this.findToolButton(toolId);
        if (!toolButton) {
            console.warn(`Outil non trouvé: ${toolId}`);
            return data;
        }
        
        // Simule le clic sur l'outil
        if (action === 'activate') {
            toolButton.click();
        } else if (action === 'deactivate') {
            toolButton.classList.remove('active');
        }
        
        return {
            ...data,
            toolActivated: action === 'activate'
        };
    }

    /**
     * Ouvre/ferme la barre latérale
     */
    toggleSidebar() {
        if (!this.sidebar) return;
        
        const isOpen = this.sidebar.classList.contains('open');
        
        if (isOpen) {
            this.closeSidebar();
        } else {
            this.openSidebar();
        }
    }

    /**
     * Ouvre la barre latérale
     */
    openSidebar() {
        if (!this.sidebar) return;
        
        this.sidebar.classList.add('open');
        this.sidebar.classList.remove('closed');
        
        console.log('Barre latérale ouverte');
    }

    /**
     * Ferme la barre latérale
     */
    closeSidebar() {
        if (!this.sidebar) return;
        
        this.sidebar.classList.remove('open');
        this.sidebar.classList.add('closed');
        
        // Ferme tous les panneaux
        this.panels.forEach((panel, panelId) => {
            this.closePanel(panelId);
        });
        
        console.log('Barre latérale fermée');
    }

    /**
     * Obtient l'état de la barre latérale
     */
    getSidebarState() {
        return {
            isOpen: this.sidebar?.classList.contains('open') || false,
            activePanel: this.activePanel,
            totalPanels: this.panels.size,
            panels: Array.from(this.panels.keys())
        };
    }

    /**
     * Ouvre un panneau spécifique
     */
    async openPanel(panelId) {
        const panel = this.panels.get(panelId);
        if (!panel) {
            console.warn(`Panneau non trouvé: ${panelId}`);
            return false;
        }
        
        // Ferme les autres panneaux si nécessaire
        if (this.activePanel && this.activePanel !== panelId) {
            this.closePanel(this.activePanel);
        }
        
        // Ouvre le panneau
        panel.element.classList.add('open');
        panel.isOpen = true;
        this.activePanel = panelId;
        
        console.log(`Panneau ouvert: ${panelId}`);
        
        return true;
    }

    /**
     * Ferme un panneau spécifique
     */
    async closePanel(panelId) {
        const panel = this.panels.get(panelId);
        if (!panel) return false;
        
        panel.element.classList.remove('open');
        panel.isOpen = false;
        
        if (this.activePanel === panelId) {
            this.activePanel = null;
        }
        
        console.log(`Panneau fermé: ${panelId}`);
        
        return true;
    }

    /**
     * Met à jour le contenu d'un panneau
     */
    async updatePanelContent(panelId, content) {
        const panel = this.panels.get(panelId);
        if (!panel) return false;
        
        const contentElement = panel.element.querySelector('.panel-content');
        if (contentElement) {
            contentElement.innerHTML = content;
        }
        
        console.log(`Contenu du panneau mis à jour: ${panelId}`);
        
        return true;
    }

    /**
     * Crée un nouveau panneau
     */
    async createPanel(panelId, config) {
        if (this.panels.has(panelId)) {
            console.warn(`Panneau existe déjà: ${panelId}`);
            return false;
        }
        
        const panelElement = document.createElement('div');
        panelElement.className = 'sidebar-panel';
        panelElement.id = panelId;
        panelElement.setAttribute('data-panel', panelId);
        
        panelElement.innerHTML = `
            <div class="panel-header">
                <h3 class="panel-title">${config.title || panelId}</h3>
                <button class="panel-toggle">▼</button>
            </div>
            <div class="panel-content">
                ${config.content || ''}
            </div>
        `;
        
        this.sidebar.appendChild(panelElement);
        
        this.panels.set(panelId, {
            element: panelElement,
            isOpen: false,
            title: config.title || panelId
        });
        
        // Lie les événements
        const toggleBtn = panelElement.querySelector('.panel-toggle');
        if (toggleBtn) {
            toggleBtn.addEventListener('click', () => {
                this.togglePanel(panelId);
            });
        }
        
        console.log(`Panneau créé: ${panelId}`);
        
        return true;
    }

    /**
     * Met à jour le panneau de propriétés
     */
    async updatePropertiesPanel(elementId, elementType) {
        const propertiesPanel = this.panels.get('properties');
        if (!propertiesPanel) return;
        
        const content = this.generatePropertiesContent(elementId, elementType);
        await this.updatePanelContent('properties', content);
    }

    /**
     * Génère le contenu du panneau de propriétés
     */
    generatePropertiesContent(elementId, elementType) {
        return `
            <div class="properties-section">
                <h4>Élément: ${elementId}</h4>
                <p>Type: ${elementType}</p>
                
                <div class="property-group">
                    <label>Texte:</label>
                    <input type="text" class="property-input" data-property="text" 
                           placeholder="Texte de l'élément">
                </div>
                
                <div class="property-group">
                    <label>Couleur:</label>
                    <input type="color" class="property-input" data-property="color">
                </div>
                
                <div class="property-actions">
                    <button class="btn-apply">Appliquer</button>
                    <button class="btn-reset">Réinitialiser</button>
                </div>
            </div>
        `;
    }

    /**
     * Trouve un bouton d'outil
     */
    findToolButton(toolId) {
        return this.sidebar?.querySelector(`[data-tool="${toolId}"]`);
    }

    /**
      * Définit le trigger associé
      */
     setTrigger(trigger) {
         this.trigger = trigger;
         console.log('Trigger associé au SidebarModule');
     }

     /**
      * Obtient le trigger associé
      */
     getTrigger() {
         return this.trigger;
     }

     /**
      * Obtient des statistiques sur la barre latérale
      */
     getStats() {
         return {
             totalPanels: this.panels.size,
             activePanel: this.activePanel,
             isOpen: this.sidebar?.classList.contains('open') || false,
             panels: Array.from(this.panels.entries()).map(([id, panel]) => ({
                 id,
                 title: panel.title,
                 isOpen: panel.isOpen
             }))
         };
     }
}

// ===== TRIGGER CHAIN =====
window.SidebarModule = SidebarModule;

export { SidebarModule };