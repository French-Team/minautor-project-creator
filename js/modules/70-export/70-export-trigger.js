/**
 * TRIGGER EXPORT-70 : Chaîne de Responsabilité
 * Gère le routage des données vers/depuis ExportModule
 */

class ExportTrigger {
    constructor() {
        this.module = null;
        this.nextTrigger = null;
        this.routingTable = this.initializeRoutingTable();
        
        console.log('📤 ExportTrigger-70 initialisé');
    }

    initializeRoutingTable() {
        return {
            // Requêtes d'export
            'export_request': {
                handler: 'handleExportRequest',
                next: ['preview-60', 'sidebar-40', null], // [success, error, default]
                conditions: {
                    'success': (data) => data.success === true,
                    'error': (data) => data.success === false
                }
            },
            
            // Requêtes d'export en masse
            'bulk_export_request': {
                handler: 'handleBulkExportRequest',
                next: ['preview-60', 'sidebar-40', null],
                conditions: {
                    'success': (data) => data.successful > 0,
                    'error': (data) => data.successful === 0
                }
            },
            
            // Requêtes d'historique
            'export_history_request': {
                handler: 'handleExportHistoryRequest',
                next: ['sidebar-40', 'preview-60', null],
                conditions: {
                    'has_history': (data) => data.history && data.history.length > 0,
                    'no_history': (data) => !data.history || data.history.length === 0
                }
            },
            
            // Requêtes de paramètres
            'export_settings_request': {
                handler: 'handleExportSettingsRequest',
                next: ['sidebar-40', 'preview-60', null],
                conditions: {
                    'settings_loaded': (data) => data.supportedFormats,
                    'error': (data) => !data.supportedFormats
                }
            },
            
            // Mises à jour depuis d'autres modules
            'canvas_updated': {
                handler: 'handleCanvasUpdate',
                next: [null, 'sidebar-40', 'preview-60'], // Local processing
                conditions: {
                    'auto_export': (data) => data.autoExport === true,
                    'preview_update': (data) => data.updatePreview === true
                }
            },
            
            // Requêtes de statistiques
            'export_stats_request': {
                handler: 'handleExportStatsRequest',
                next: ['sidebar-40', 'preview-60', null],
                conditions: {
                    'has_stats': (data) => data.stats,
                    'error': (data) => !data.stats
                }
            }
        };
    }

    /**
     * Configure le module ExportModule
     */
    setModule(module) {
        this.module = module;
        console.log('Module ExportModule connecté au trigger');
    }

    /**
     * Configure le trigger suivant dans la chaîne
     */
    setNextTrigger(trigger) {
        this.nextTrigger = trigger;
        console.log('Next trigger configuré pour ExportTrigger');
    }

    /**
     * Traite les données entrantes
     */
    async processIncoming(data, context = {}) {
        console.log('📥 ExportTrigger reçoit:', data);
        
        if (!this.module) {
            console.warn('ExportModule non initialisé');
            return data;
        }
        
        // Détermine le type de données et le module suivant
        const route = this.determineNextModule(data, 'incoming');
        
        if (route.handler) {
            try {
                const result = await this.module.process(data, context);
                return this.routeToNextModule(result, route.next);
            } catch (error) {
                console.error('Erreur traitement ExportModule:', error);
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
        console.log('📤 ExportTrigger traite sortie:', data);
        
        // Traite les données sortantes selon le type
        if (data.type === 'export_complete') {
            return this.handleExportComplete(data, context);
        }
        
        if (data.type === 'export_failed') {
            return this.handleExportFailed(data, context);
        }
        
        if (data.type === 'bulk_export_complete') {
            return this.handleBulkExportComplete(data, context);
        }
        
        if (data.type === 'history_updated') {
            return this.handleHistoryUpdated(data, context);
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
            _from: 'export-70'
        };
    }

    /**
     * Gère l'export réussi
     */
    handleExportComplete(data, context) {
        console.log('✅ Export réussi:', data);
        
        // Notifie les modules concernés
        return {
            ...data,
            notifications: [
                { module: 'sidebar-40', type: 'show_notification', message: `Export ${data.format} réussi` },
                { module: 'preview-60', type: 'highlight_success' }
            ],
            _next: ['sidebar-40', 'preview-60']
        };
    }

    /**
     * Gère l'échec d'export
     */
    handleExportFailed(data, context) {
        console.log('❌ Export échoué:', data);
        
        // Notifie les modules concernés
        return {
            ...data,
            notifications: [
                { module: 'sidebar-40', type: 'show_error', message: `Erreur export ${data.format}: ${data.error}` },
                { module: 'preview-60', type: 'highlight_error' }
            ],
            _next: ['sidebar-40', 'preview-60']
        };
    }

    /**
     * Gère l'export en masse
     */
    handleBulkExportComplete(data, context) {
        console.log('📦 Export en masse terminé:', data);
        
        const message = `Export en masse terminé: ${data.successful}/${data.total} réussis`;
        
        return {
            ...data,
            notifications: [
                { module: 'sidebar-40', type: 'show_notification', message: message },
                { module: 'preview-60', type: 'show_bulk_results', results: data.results }
            ],
            _next: ['sidebar-40', 'preview-60']
        };
    }

    /**
     * Gère la mise à jour de l'historique
     */
    handleHistoryUpdated(data, context) {
        console.log('📊 Historique mis à jour');
        
        return {
            ...data,
            notifications: [
                { module: 'sidebar-40', type: 'refresh_history_panel' }
            ],
            _next: ['sidebar-40']
        };
    }

    /**
     * Gère les requêtes d'export
     */
    async handleExportRequest(data, context) {
        console.log('📤 Traitement requête export');
        
        try {
            const result = await this.module.handleExportRequest(data, context);
            
            if (result.success) {
                return this.handleExportComplete(result, context);
            } else {
                return this.handleExportFailed(result, context);
            }
            
        } catch (error) {
            console.error('Erreur traitement export:', error);
            return this.handleExportFailed({
                ...data,
                error: error.message
            }, context);
        }
    }

    /**
     * Gère les requêtes d'export en masse
     */
    async handleBulkExportRequest(data, context) {
        console.log('📦 Traitement export en masse');
        
        try {
            const result = await this.module.handleBulkExportRequest(data, context);
            return this.handleBulkExportComplete(result, context);
            
        } catch (error) {
            console.error('Erreur export en masse:', error);
            return {
                ...data,
                error: error.message,
                successful: 0,
                results: []
            };
        }
    }

    /**
     * Gère les requêtes d'historique
     */
    async handleExportHistoryRequest(data, context) {
        console.log('📊 Traitement requête historique');
        
        try {
            return await this.module.handleExportHistoryRequest(data, context);
            
        } catch (error) {
            console.error('Erreur historique:', error);
            return {
                ...data,
                error: error.message,
                history: []
            };
        }
    }

    /**
     * Gère les requêtes de paramètres
     */
    async handleExportSettingsRequest(data, context) {
        console.log('⚙️ Traitement requête paramètres');
        
        try {
            return await this.module.handleExportSettingsRequest(data, context);
            
        } catch (error) {
            console.error('Erreur paramètres:', error);
            return {
                ...data,
                error: error.message
            };
        }
    }

    /**
     * Gère les mises à jour du canvas
     */
    handleCanvasUpdate(data, context) {
        console.log('🎨 Mise à jour canvas détectée');
        
        // Détermine si un auto-export est nécessaire
        if (data.autoExport) {
            return {
                ...data,
                type: 'auto_export_triggered',
                _next: ['export-70']
            };
        }
        
        return data;
    }

    /**
     * Gère les requêtes de statistiques
     */
    async handleExportStatsRequest(data, context) {
        console.log('📈 Traitement requête statistiques');
        
        try {
            const stats = this.module.getStats();
            
            return {
                ...data,
                type: 'export_stats_response',
                stats: stats,
                success: true
            };
            
        } catch (error) {
            console.error('Erreur statistiques:', error);
            return {
                ...data,
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
window.ExportTrigger = ExportTrigger;

export { ExportTrigger };