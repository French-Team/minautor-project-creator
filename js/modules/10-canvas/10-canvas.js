/**
 * MODULE CANVAS-10 : Gestion du Canvas Principal
 * Point d'entrée du module de gestion du canvas
 */

class CanvasModule {
    constructor() {
        this.canvas = null;
        this.context = null;
        this.elements = new Map();
        this.selectedElements = new Set();
        this.isInitialized = false;
        
        this.init();
    }

    /**
     * Initialisation du module canvas
     */
    async init() {
        console.log('📋 Initialisation CanvasModule-10...');
        
        this.setupCanvas();
        this.bindEvents();
        this.setupGrid();
        
        this.isInitialized = true;
        console.log('✅ CanvasModule-10 prêt');
    }

    /**
     * Configuration du canvas DOM
     */
    setupCanvas() {
        this.canvas = document.getElementById('canvas');
        if (!this.canvas) {
            console.error('Canvas DOM non trouvé');
            return;
        }
        
        this.context = {
            canvas: this.canvas,
            elements: this.elements,
            selectedElements: this.selectedElements
        };
        
        console.log('Canvas DOM configuré');
    }

    /**
     * Liaison des événements
     */
    bindEvents() {
        if (!this.canvas) return;
        
        // Clic pour désélectionner
        this.canvas.addEventListener('click', (e) => {
            if (e.target === this.canvas) {
                this.deselectAll();
            }
        });
        
        console.log('Événements canvas liés');
    }

    /**
     * Configuration de la grille
     */
    setupGrid() {
        // Sera implémenté avec le système de grille
        console.log('Grille configurée (placeholder)');
    }

    /**
     * Traitement principal du module
     */
    async process(data, context = {}) {
        console.log('📋 CanvasModule traite:', data);
        
        // Traite les données selon le type
        if (data.type === 'canvas_operation') {
            return await this.handleCanvasOperation(data, context);
        }
        
        if (data.type === 'element_operation') {
            return await this.handleElementOperation(data, context);
        }
        
        // Pass-through par défaut
        return data;
    }

    /**
     * Gère les opérations sur le canvas
     */
    async handleCanvasOperation(data, context) {
        const { operation, params } = data;
        
        switch (operation) {
            case 'clear':
                return await this.clearCanvas();
            case 'get_state':
                return await this.getCanvasState();
            case 'select_all':
                return await this.selectAll();
            default:
                console.warn(`Opération canvas inconnue: ${operation}`);
                return data;
        }
    }

    /**
     * Gère les opérations sur les éléments
     */
    async handleElementOperation(data, context) {
        const { operation, elementId, params } = data;
        
        switch (operation) {
            case 'add':
                return await this.addElement(params);
            case 'move':
                return await this.moveElement(elementId, params);
            case 'delete':
                return await this.deleteElement(elementId);
            case 'select':
                return await this.selectElement(elementId);
            case 'edit':
                return await this.editElement(elementId, params);
            default:
                console.warn(`Opération élément inconnue: ${operation}`);
                return data;
        }
    }

    /**
     * Ajoute un élément au canvas
     */
    async addElement(params) {
        const elementId = this.generateElementId();
        const element = {
            id: elementId,
            type: params.type,
            position: params.position || { x: 100, y: 100 },
            data: params.data || {},
            created: Date.now()
        };
        
        this.elements.set(elementId, element);
        
        console.log(`Élément ajouté: ${elementId}`);
        
        return {
            type: 'element_added',
            elementId: elementId,
            element: element
        };
    }

    /**
     * Déplace un élément
     */
    async moveElement(elementId, params) {
        const element = this.elements.get(elementId);
        if (!element) {
            console.warn(`Élément non trouvé: ${elementId}`);
            return { type: 'error', message: 'Élément non trouvé' };
        }
        
        element.position = params.position;
        element.modified = Date.now();
        
        console.log(`Élément déplacé: ${elementId}`);
        
        return {
            type: 'element_moved',
            elementId: elementId,
            position: params.position
        };
    }

    /**
     * Supprime un élément
     */
    async deleteElement(elementId) {
        if (this.elements.has(elementId)) {
            this.elements.delete(elementId);
            this.selectedElements.delete(elementId);
            
            console.log(`Élément supprimé: ${elementId}`);
            
            return {
                type: 'element_deleted',
                elementId: elementId
            };
        }
        
        return { type: 'error', message: 'Élément non trouvé' };
    }

    /**
     * Sélectionne un élément
     */
    async selectElement(elementId) {
        this.selectedElements.add(elementId);
        
        console.log(`Élément sélectionné: ${elementId}`);
        
        return {
            type: 'element_selected',
            elementId: elementId
        };
    }

    /**
     * Édite un élément
     */
    async editElement(elementId, params) {
        const element = this.elements.get(elementId);
        if (!element) {
            return { type: 'error', message: 'Élément non trouvé' };
        }
        
        Object.assign(element.data, params.data);
        element.modified = Date.now();
        
        console.log(`Élément édité: ${elementId}`);
        
        return {
            type: 'element_edited',
            elementId: elementId,
            data: element.data
        };
    }

    /**
     * Efface tout le canvas
     */
    async clearCanvas() {
        this.elements.clear();
        this.selectedElements.clear();
        
        console.log('Canvas effacé');
        
        return {
            type: 'canvas_cleared'
        };
    }

    /**
     * Obtient l'état du canvas
     */
    async getCanvasState() {
        return {
            type: 'canvas_state',
            elements: Array.from(this.elements.values()),
            selectedElements: Array.from(this.selectedElements),
            totalElements: this.elements.size
        };
    }

    /**
     * Sélectionne tous les éléments
     */
    async selectAll() {
        this.selectedElements.clear();
        this.elements.forEach((element, id) => {
            this.selectedElements.add(id);
        });
        
        return {
            type: 'all_selected',
            count: this.selectedElements.size
        };
    }

    /**
     * Désélectionne tous les éléments
     */
    deselectAll() {
        this.selectedElements.clear();
        console.log('Tous les éléments désélectionnés');
    }

    /**
     * Génère un ID unique pour les éléments
     */
    generateElementId() {
        return `element-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    }

    /**
     * Obtient le contexte du module
     */
    getContext() {
        return this.context;
    }
}

// ===== TRIGGER CHAIN =====
// Ce trigger permet au module d'être appelé depuis d'autres modules
window.CanvasModule = CanvasModule;

export { CanvasModule };