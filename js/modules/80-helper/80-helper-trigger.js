/**
 * TRIGGER HELPER-80 : Chaîne de Responsabilité
 * Gère le routage des demandes utilitaires vers/depuis HelperModule
 */

class HelperTrigger {
    constructor() {
        this.module = null;
        this.nextTrigger = null;
        this.routingTable = this.initializeRoutingTable();
        
        console.log('🔧 80-helper-trigger initialisé');
    }

    initializeRoutingTable() {
        return {
            // Requêtes utilitaires
            'util_request': {
                handler: 'handleUtilRequest',
                next: [null, 'sidebar-40', 'preview-60'], // [success, error, default]
                conditions: {
                    'success': (data) => data.success === true,
                    'error': (data) => data.success === false
                }
            },
            
            // Requêtes de validation
            'validation_request': {
                handler: 'handleValidationRequest',
                next: [null, 'sidebar-40', 'preview-60'],
                conditions: {
                    'valid': (data) => data.valid === true,
                    'invalid': (data) => data.valid === false,
                    'error': (data) => data.success === false
                }
            },
            
            // Requêtes de formatage
            'format_request': {
                handler: 'handleFormatRequest',
                next: [null, 'sidebar-40', 'preview-60'],
                conditions: {
                    'success': (data) => data.success === true,
                    'error': (data) => data.success === false
                }
            },
            
            // Requêtes de cache
            'cache_request': {
                handler: 'handleCacheRequest',
                next: [null, 'sidebar-40', 'preview-60'],
                conditions: {
                    'hit': (data) => data.result !== null && data.success === true,
                    'miss': (data) => data.result === null && data.success === true,
                    'error': (data) => data.success === false
                }
            },
            
            // Requêtes mathématiques
            'math_request': {
                handler: 'handleMathRequest',
                next: [null, 'sidebar-40', 'preview-60'],
                conditions: {
                    'success': (data) => data.success === true,
                    'error': (data) => data.success === false
                }
            },
            
            // Requêtes DOM
            'dom_request': {
                handler: 'handleDOMRequest',
                next: [null, 'sidebar-40', 'preview-60'],
                conditions: {
                    'success': (data) => data.success === true,
                    'error': (data) => data.success === false
                }
            },
            
            // Requêtes de statistiques
            'helper_stats_request': {
                handler: 'handleHelperStatsRequest',
                next: ['sidebar-40', 'preview-60', null],
                conditions: {
                    'has_stats': (data) => data.stats,
                    'error': (data) => !data.stats
                }
            },
            
            // Nettoyage du cache
            'cache_clear_request': {
                handler: 'handleCacheClearRequest',
                next: [null, 'sidebar-40', 'preview-60'],
                conditions: {
                    'cleared': (data) => data.success === true,
                    'error': (data) => data.success === false
                }
            }
        };
    }

    /**
     * Configure le module HelperModule
     */
    setModule(module) {
        this.module = module;
        console.log('Module 80-helper connecté au trigger');
    }

    /**
     * Configure le trigger suivant dans la chaîne
     */
    setNextTrigger(trigger) {
        this.nextTrigger = trigger;
        console.log('Next trigger configuré pour 80-helper-trigger');
    }

    /**
     * Traite les données entrantes
     */
    async processIncoming(data, context = {}) {
        console.log('🔧 80-helper-trigger reçoit:', data);
        
        if (!this.module) {
            console.warn('HelperModule non initialisé');
            return data;
        }
        
        // Détermine le type de données et le module suivant
        const route = this.determineNextModule(data, 'incoming');
        
        if (route.handler) {
            try {
                const result = await this.module.process(data, context);
                return this.routeToNextModule(result, route.next);
            } catch (error) {
                console.error('Erreur traitement HelperModule:', error);
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
        console.log('🔧 80-helper-trigger traite sortie:', data);
        
        // Traite les données sortantes selon le type
        if (data.type === 'util_complete') {
            return this.handleUtilComplete(data, context);
        }
        
        if (data.type === 'validation_complete') {
            return this.handleValidationComplete(data, context);
        }
        
        if (data.type === 'format_complete') {
            return this.handleFormatComplete(data, context);
        }
        
        if (data.type === 'cache_operation_complete') {
            return this.handleCacheOperationComplete(data, context);
        }
        
        if (data.type === 'math_complete') {
            return this.handleMathComplete(data, context);
        }
        
        if (data.type === 'dom_complete') {
            return this.handleDOMComplete(data, context);
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
            _from: 'helper-80'
        };
    }

    /**
     * Gère la complétion d'utilitaire
     */
    handleUtilComplete(data, context) {
        console.log('✅ Utilitaire exécuté:', data);
        
        // Notifie les modules concernés
        return {
            ...data,
            notifications: [
                { module: 'sidebar-40', type: 'util_result', result: data.result }
            ],
            _next: ['sidebar-40', 'preview-60']
        };
    }

    /**
     * Gère la complétion de validation
     */
    handleValidationComplete(data, context) {
        console.log('✅ Validation complétée:', data);
        
        // Notifie les modules concernés
        return {
            ...data,
            notifications: [
                { module: 'sidebar-40', type: 'validation_result', valid: data.valid }
            ],
            _next: ['sidebar-40', 'preview-60']
        };
    }

    /**
     * Gère la complétion de formatage
     */
    handleFormatComplete(data, context) {
        console.log('✅ Formatage complété:', data);
        
        // Notifie les modules concernés
        return {
            ...data,
            notifications: [
                { module: 'sidebar-40', type: 'format_result', result: data.result }
            ],
            _next: ['sidebar-40', 'preview-60']
        };
    }

    /**
     * Gère la complétion d'opération cache
     */
    handleCacheOperationComplete(data, context) {
        console.log('✅ Opération cache complétée:', data);
        
        // Notifie les modules concernés
        return {
            ...data,
            notifications: [
                { module: 'sidebar-40', type: 'cache_result', result: data.result }
            ],
            _next: ['sidebar-40', 'preview-60']
        };
    }

    /**
     * Gère la complétion mathématique
     */
    handleMathComplete(data, context) {
        console.log('✅ Calcul mathématique complété:', data);
        
        // Notifie les modules concernés
        return {
            ...data,
            notifications: [
                { module: 'sidebar-40', type: 'math_result', result: data.result }
            ],
            _next: ['sidebar-40', 'preview-60']
        };
    }

    /**
     * Gère la complétion DOM
     */
    handleDOMComplete(data, context) {
        console.log('✅ Opération DOM complétée:', data);
        
        // Notifie les modules concernés
        return {
            ...data,
            notifications: [
                { module: 'sidebar-40', type: 'dom_result', result: data.result }
            ],
            _next: ['sidebar-40', 'preview-60']
        };
    }

    /**
     * Gère les requêtes d'utilitaires
     */
    async handleUtilRequest(data, context) {
        console.log('🔧 Traitement requête utilitaire');
        
        try {
            const result = await this.module.handleUtilRequest(data, context);
            
            if (result.success) {
                return this.handleUtilComplete(result, context);
            } else {
                return {
                    ...result,
                    type: 'util_failed'
                };
            }
            
        } catch (error) {
            console.error('Erreur traitement utilitaire:', error);
            return {
                ...data,
                type: 'util_failed',
                error: error.message,
                success: false
            };
        }
    }

    /**
     * Gère les requêtes de validation
     */
    async handleValidationRequest(data, context) {
        console.log('🔍 Traitement requête validation');
        
        try {
            const result = await this.module.handleValidationRequest(data, context);
            
            if (result.success) {
                return this.handleValidationComplete(result, context);
            } else {
                return {
                    ...result,
                    type: 'validation_failed'
                };
            }
            
        } catch (error) {
            console.error('Erreur validation:', error);
            return {
                ...data,
                type: 'validation_failed',
                error: error.message,
                success: false
            };
        }
    }

    /**
     * Gère les requêtes de formatage
     */
    async handleFormatRequest(data, context) {
        console.log('📝 Traitement requête formatage');
        
        try {
            const result = await this.module.handleFormatRequest(data, context);
            
            if (result.success) {
                return this.handleFormatComplete(result, context);
            } else {
                return {
                    ...result,
                    type: 'format_failed'
                };
            }
            
        } catch (error) {
            console.error('Erreur formatage:', error);
            return {
                ...data,
                type: 'format_failed',
                error: error.message,
                success: false
            };
        }
    }

    /**
     * Gère les requêtes de cache
     */
    async handleCacheRequest(data, context) {
        console.log('💾 Traitement requête cache');
        
        try {
            const result = await this.module.handleCacheRequest(data, context);
            
            if (result.success) {
                return this.handleCacheOperationComplete(result, context);
            } else {
                return {
                    ...result,
                    type: 'cache_operation_failed'
                };
            }
            
        } catch (error) {
            console.error('Erreur cache:', error);
            return {
                ...data,
                type: 'cache_operation_failed',
                error: error.message,
                success: false
            };
        }
    }

    /**
     * Gère les requêtes mathématiques
     */
    async handleMathRequest(data, context) {
        console.log('🧮 Traitement requête mathématique');
        
        try {
            const result = await this.module.handleMathRequest(data, context);
            
            if (result.success) {
                return this.handleMathComplete(result, context);
            } else {
                return {
                    ...result,
                    type: 'math_failed'
                };
            }
            
        } catch (error) {
            console.error('Erreur mathématique:', error);
            return {
                ...data,
                type: 'math_failed',
                error: error.message,
                success: false
            };
        }
    }

    /**
     * Gère les requêtes DOM
     */
    async handleDOMRequest(data, context) {
        console.log('🌐 Traitement requête DOM');
        
        try {
            const result = await this.module.handleDOMRequest(data, context);
            
            if (result.success) {
                return this.handleDOMComplete(result, context);
            } else {
                return {
                    ...result,
                    type: 'dom_failed'
                };
            }
            
        } catch (error) {
            console.error('Erreur DOM:', error);
            return {
                ...data,
                type: 'dom_failed',
                error: error.message,
                success: false
            };
        }
    }

    /**
     * Gère les requêtes de statistiques
     */
    async handleHelperStatsRequest(data, context) {
        console.log('📊 Traitement requête statistiques helper');
        
        try {
            const stats = this.module.getStats();
            
            return {
                ...data,
                type: 'helper_stats_response',
                stats: stats,
                success: true
            };
            
        } catch (error) {
            console.error('Erreur statistiques helper:', error);
            return {
                ...data,
                error: error.message,
                success: false
            };
        }
    }

    /**
     * Gère les requêtes de nettoyage de cache
     */
    async handleCacheClearRequest(data, context) {
        console.log('🗑️ Traitement requête nettoyage cache');
        
        try {
            const result = await this.module.handleCacheRequest({
                ...data,
                action: 'clear'
            }, context);
            
            if (result.success) {
                return {
                    ...result,
                    type: 'cache_cleared',
                    notifications: [
                        { module: 'sidebar-40', type: 'cache_cleared_notification' }
                    ]
                };
            } else {
                return {
                    ...result,
                    type: 'cache_clear_failed'
                };
            }
            
        } catch (error) {
            console.error('Erreur nettoyage cache:', error);
            return {
                ...data,
                type: 'cache_clear_failed',
                error: error.message,
                success: false
            };
        }
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
window.HelperTrigger = HelperTrigger;

export { HelperTrigger };