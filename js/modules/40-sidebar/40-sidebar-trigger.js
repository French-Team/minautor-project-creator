/**
 * TRIGGER SIDEBAR-40 : Chaîne de Responsabilité
 * Gère le routage des demandes d'interface vers/depuis SidebarModule
 */

class SidebarTrigger {
    constructor() {
        this.module = null;
        this.nextTrigger = null;
        this.routingTable = this.initializeRoutingTable();

        console.log('🎛️ 40-sidebar-trigger initialisé');
    }

    initializeRoutingTable() {
        return {
            // Requêtes de panneau
            'panel_request': {
                handler: 'handlePanelRequest',
                next: [null, 'canvas-10', 'helper-80'], // [success, error, default]
                conditions: {
                    'success': (data) => data.success === true,
                    'error': (data) => data.success === false
                }
            },

            // Demandes d'état de la sidebar
            'sidebar_state': {
                handler: 'handleSidebarState',
                next: [null, 'canvas-10', 'helper-80'],
                conditions: {
                    'state_changed': (data) => data.state,
                    'error': (data) => !data.state
                }
            },

            // Sélection d'élément
            'element_selected': {
                handler: 'handleElementSelected',
                next: ['mermaid-30', 'preview-60', null],
                conditions: {
                    'properties_updated': (data) => data.propertiesPanelUpdated === true,
                    'error': (data) => data.error
                }
            },

            // Demandes d'outils
            'tool_request': {
                handler: 'handleToolRequest',
                next: [null, 'canvas-10', 'helper-80'],
                conditions: {
                    'tool_activated': (data) => data.toolActivated === true,
                    'error': (data) => data.error
                }
            },

            // Demandes d'interface utilisateur
            'ui_request': {
                handler: 'handleUIRequest',
                next: ['theme-50', 'helper-80', null],
                conditions: {
                    'ui_updated': (data) => data.uiUpdated === true,
                    'error': (data) => data.error
                }
            }
        };
    }

    /**
     * Configure le module SidebarModule
     */
    setModule(module) {
        this.module = module;
        console.log('Module 40-sidebar connecté au trigger');
    }

    /**
     * Configure le trigger suivant dans la chaîne
     */
    setNextTrigger(trigger) {
        this.nextTrigger = trigger;
        console.log('Next trigger configuré pour 40-sidebar-trigger');
    }

    /**
     * Traite les données entrantes
     */
    async processIncoming(data, context = {}) {
        console.log('🎛️ 40-sidebar-trigger reçoit:', data);

        if (!this.module) {
            console.warn('Module 40-sidebar non initialisé');
            return data;
        }

        // Détermine le type de données et le module suivant
        const route = this.determineNextModule(data, 'incoming');

        if (route.handler && this.module[route.handler]) {
            try {
                const result = await this.module[route.handler](data, context);
                return this.routeToNextModule(result, route.next);
            } catch (error) {
                console.error('Erreur traitement 40-sidebar:', error);
                return this.routeToNextModule({
                    ...data,
                    error: error.message,
                    success: false
                }, route.next);
            }
        }

        // Pass-through si aucun handler
        return this.routeToNextModule(data, route.next);
    }

    /**
     * Traite les données sortantes
     */
    async processOutgoing(data, context = {}) {
        console.log('🎛️ 40-sidebar-trigger traite sortie:', data);

        // Traite les données sortantes selon le type
        if (data.type === 'panel_opened') {
            return this.handlePanelOpened(data, context);
        }

        if (data.type === 'panel_closed') {
            return this.handlePanelClosed(data, context);
        }

        if (data.type === 'element_properties_changed') {
            return this.handleElementPropertiesChanged(data, context);
        }

        if (data.type === 'sidebar_visibility_changed') {
            return this.handleSidebarVisibilityChanged(data, context);
        }

        // Pass-through par défaut
        return data;
    }

    /**
     * Détermine le prochain module
     */
    determineNextModule(data, direction = 'incoming') {
        const dataType = data.type || 'unknown';
        const route = this.routingTable[dataType];

        if (!route) {
            console.log(`Aucune route définie pour ${dataType}, pass-through`);
            return { next: [null, null, null], handler: null };
        }

        // Évalue les conditions
        for (const [condition, evaluator] of Object.entries(route.conditions)) {
            if (evaluator(data)) {
                const conditionIndex = Object.keys(route.conditions).indexOf(condition);
                return {
                    next: route.next,
                    handler: route.handler,
                    condition: condition,
                    nextModule: route.next[conditionIndex] || route.next[2]
                };
            }
        }

        // Condition par défaut
        return {
            next: route.next,
            handler: route.handler,
            nextModule: route.next[2]
        };
    }

    /**
     * Route vers le module suivant
     */
    routeToNextModule(data, nextModules) {
        const nextModule = this.determineNextModule(data).nextModule;

        if (!nextModule) {
            return data; // Fin de chaîne
        }

        // Simule le routage vers le module suivant
        console.log(`Route vers ${nextModule}:`, data);

        // En vrai implémentation, ceci appellerait le module suivant
        return {
            ...data,
            _routedTo: nextModule,
            _from: 'sidebar-40'
        };
    }

    /**
     * Gère l'ouverture d'un panneau
     */
    handlePanelOpened(data, context) {
        console.log('📋 Panneau ouvert:', data);

        // Notifie les modules concernés
        return {
            ...data,
            notifications: [
                { module: 'canvas-10', type: 'panel_opened_notification' },
                { module: 'mermaid-30', type: 'panel_opened_notification' }
            ],
            _next: ['canvas-10', 'mermaid-30']
        };
    }

    /**
     * Gère la fermeture d'un panneau
     */
    handlePanelClosed(data, context) {
        console.log('📋 Panneau fermé:', data);

        // Notifie les modules concernés
        return {
            ...data,
            notifications: [
                { module: 'canvas-10', type: 'panel_closed_notification' }
            ],
            _next: ['canvas-10']
        };
    }

    /**
     * Gère le changement de propriétés d'élément
     */
    handleElementPropertiesChanged(data, context) {
        console.log('📋 Propriétés d\'élément changées:', data);

        // Notifie les modules concernés
        return {
            ...data,
            notifications: [
                { module: 'mermaid-30', type: 'element_properties_updated' },
                { module: 'preview-60', type: 'element_properties_updated' }
            ],
            _next: ['mermaid-30', 'preview-60']
        };
    }

    /**
     * Gère le changement de visibilité de la sidebar
     */
    handleSidebarVisibilityChanged(data, context) {
        console.log('📋 Visibilité de la sidebar changée:', data);

        // Notifie les modules concernés
        return {
            ...data,
            notifications: [
                { module: 'canvas-10', type: 'sidebar_visibility_changed' }
            ],
            _next: ['canvas-10']
        };
    }

    /**
     * Obtient l'état du trigger
     */
    getState() {
        return {
            moduleConnected: !!this.module,
            nextTriggerConnected: !!this.nextTrigger,
            routingTableSize: Object.keys(this.routingTable).length,
            supportedTypes: Object.keys(this.routingTable)
        };
    }
}

// ===== CHAÎNE DE RESPONSABILITÉ =====
window.SidebarTrigger = SidebarTrigger;

export { SidebarTrigger };