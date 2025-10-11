/**
 * CANVAS-10 TRIGGER - Chaîne de Responsabilité
 * Route les données vers/depuis le module Canvas-10
 * Système de switches conditionnels
 */

import { CanvasModule } from './10-canvas.js';

class CanvasTrigger {
    constructor() {
        this.module = null;
        this.routingTable = {
            // Routes entrantes vers le module
            incoming: {
                'canvas_operation': this.handleIncomingCanvasOp,
                'element_operation': this.handleIncomingElementOp,
                'get_canvas_state': this.handleGetState,
                'clear_canvas': this.handleClearCanvas
            },
            
            // Routes sortantes du module
            outgoing: {
                'element_added': this.routeToNextModule,
                'element_moved': this.routeToNextModule,
                'element_deleted': this.routeToNextModule,
                'element_edited': this.routeToNextModule,
                'canvas_cleared': this.routeToNextModule
            }
        };
        
        this.init();
    }

    async init() {
        this.module = new CanvasModule();
        console.log('🎯 CanvasTrigger initialisé');
    }

    /**
     * Point d'entrée principal du trigger
     */
    async process(data, context = {}) {
        console.log('🎯 CanvasTrigger reçoit:', data);
        
        // Détermine la route basée sur le type de données
        const route = this.determineRoute(data);
        
        if (route) {
            return await route.call(this, data, context);
        }
        
        // Pass-through si aucune route trouvée
        console.log('🎯 Aucune route, pass-through');
        return data;
    }

    /**
     * Détermine la route appropriée
     */
    determineRoute(data) {
        const { type } = data;
        
        // Routes entrantes
        if (type.includes('operation')) {
            return this.routingTable.incoming[type];
        }
        
        // Routes sortantes (après traitement module)
        if (this.routingTable.outgoing[type]) {
            return this.routingTable.outgoing[type];
        }
        
        return null;
    }

    /**
     * Gère les opérations canvas entrantes
     */
    async handleIncomingCanvasOp(data, context) {
        const result = await this.module.process(data, context);
        return await this.routeResult(result, context);
    }

    /**
     * Gère les opérations élément entrantes
     */
    async handleIncomingElementOp(data, context) {
        const result = await this.module.process(data, context);
        return await this.routeResult(result, context);
    }

    /**
     * Gère la demande d'état du canvas
     */
    async handleGetState(data, context) {
        const canvasState = await this.module.getCanvasState();
        return {
            ...data,
            canvasState: canvasState
        };
    }

    /**
     * Gère le nettoyage du canvas
     */
    async handleClearCanvas(data, context) {
        const result = await this.module.process({
            type: 'canvas_operation',
            operation: 'clear'
        }, context);
        
        return await this.routeResult(result, context);
    }

    /**
     * Route le résultat vers le prochain module
     */
    async routeResult(result, context) {
        console.log('🎯 CanvasTrigger route vers suivant:', result);
        
        // Ajoute des métadonnées de routing
        result.metadata = {
            ...result.metadata,
            source: 'canvas-10',
            timestamp: Date.now(),
            nextModule: this.determineNextModule(result)
        };
        
        return result;
    }

    /**
     * Route vers le module suivant
     */
    async routeToNextModule(data, context) {
        const nextModule = this.determineNextModule(data);
        
        if (nextModule) {
            console.log(`🎯 Routage vers ${nextModule}`);
            
            // Envoie vers le pipeline principal
            if (window.appPipeline) {
                return await window.appPipeline.process(data, {
                    ...context,
                    targetModule: nextModule
                });
            }
        }
        
        return data;
    }

    /**
     * Détermine le prochain module basé sur le type de données
     */
    determineNextModule(data) {
        const { type } = data;
        
        // Table de routage conditionnelle
        const routingRules = {
            'element_added': 'dragdrop-20',      // Vérifier les connexions
            'element_moved': 'mermaid-30',       // Mettre à jour le code
            'element_deleted': 'mermaid-30',     // Mettre à jour le code
            'element_edited': 'mermaid-30',      // Mettre à jour le code
            'canvas_cleared': 'mermaid-30'         // Réinitialiser le code
        };
        
        return routingRules[type] || null;
    }

    /**
     * Switch conditionnel - agit comme un aiguillage ferroviaire
     */
    conditionalSwitch(data, conditions) {
        const { type, element } = data;
        
        // Exemple de conditions
        if (conditions.requireConnectionCheck && type === 'element_added') {
            return 'dragdrop-20';
        }
        
        if (conditions.requireCodeUpdate && type.includes('element_')) {
            return 'mermaid-30';
        }
        
        if (conditions.requireThemeUpdate && element?.type === 'theme') {
            return 'theme-50';
        }
        
        return null; // Pas de switch nécessaire
    }
}

// ===== TRIGGER CHAIN EXPORT =====
// Ce trigger est automatiquement appelé par le pipeline
export { CanvasTrigger };

// Instanciation automatique pour le pipeline
window.CanvasTrigger = CanvasTrigger;