/**
 * TRIGGER PREVIEW-60 : Gestionnaire de déclenchement du module Preview
 * Implémente le pattern Chain of Responsibility pour la gestion de l'aperçu
 */

class PreviewTrigger {
    constructor(module) {
        this.module = module;
        this.routingTable = new Map();
        this.setupRouting();
    }

    /**
     * Configuration du tableau de routage
     */
    setupRouting() {
        // Routes pour les données entrantes
        this.routingTable.set('mermaid_code_updated', 'handleMermaidCodeUpdate');
        this.routingTable.set('render_request', 'handleRenderRequest');
        this.routingTable.set('export_request', 'handleExportRequest');
        this.routingTable.set('zoom_request', 'handleZoomRequest');
        this.routingTable.set('theme_styles', 'handleThemeStyles');
        this.routingTable.set('sidebar_request', 'handleSidebarRequest');
        this.routingTable.set('canvas_cleared', 'handleCanvasCleared');
        
        console.log('🖼️ PreviewTrigger-60 configuré');
    }

    /**
     * Traitement des données entrantes
     */
    async processIncoming(data, context = {}) {
        console.log('🖼️ PreviewTrigger-60 reçoit:', data);
        
        if (!data || !data.type) {
            console.warn('Données invalides reçues');
            return data;
        }
        
        const route = this.routingTable.get(data.type);
        if (route && typeof this[route] === 'function') {
            try {
                return await this[route](data, context);
            } catch (error) {
                console.error(`Erreur traitement ${data.type}:`, error);
                return this.handleError(data, error);
            }
        }
        
        // Pass-through par défaut
        return await this.passThrough(data, context);
    }

    /**
     * Traitement des données sortantes
     */
    async processOutgoing(data, context = {}) {
        console.log('🖼️ PreviewTrigger-60 sortie:', data);
        
        // Ajoute des métadonnées de prévisualisation si nécessaire
        if (this.shouldAddPreviewMetadata(data)) {
            data.previewStats = this.module.getStats();
            data.lastRenderTime = this.module.lastRenderTime;
        }
        
        // Détermine le prochain module
        return await this.determineNextModule(data, context);
    }

    /**
     * Gestion des mises à jour de code Mermaid
     */
    async handleMermaidCodeUpdate(data, context) {
        console.log('🖼️ Traitement mise à jour code Mermaid');
        
        const result = await this.module.process(data, context);
        
        return await this.processOutgoing(result, {
            ...context,
            processedBy: 'preview-60',
            action: 'mermaid_code_updated'
        });
    }

    /**
     * Gestion des demandes de rendu
     */
    async handleRenderRequest(data, context) {
        console.log('🖼️ Traitement demande de rendu');
        
        const result = await this.module.process(data, context);
        
        return await this.processOutgoing(result, {
            ...context,
            processedBy: 'preview-60',
            action: 'render_requested'
        });
    }

    /**
     * Gestion des demandes d'export
     */
    async handleExportRequest(data, context) {
        console.log('🖼️ Traitement demande d\'export');
        
        const result = await this.module.process(data, context);
        
        return await this.processOutgoing(result, {
            ...context,
            processedBy: 'preview-60',
            action: 'export_requested'
        });
    }

    /**
     * Gestion des demandes de zoom
     */
    async handleZoomRequest(data, context) {
        console.log('🖼️ Traitement demande de zoom');
        
        const result = await this.module.process(data, context);
        
        return await this.processOutgoing(result, {
            ...context,
            processedBy: 'preview-60',
            action: 'zoom_requested'
        });
    }

    /**
     * Gestion des styles de thème
     */
    async handleThemeStyles(data, context) {
        console.log('🖼️ Traitement styles de thème');
        
        const result = await this.module.process(data, context);
        
        return await this.processOutgoing(result, {
            ...context,
            processedBy: 'preview-60',
            action: 'theme_styles_applied'
        });
    }

    /**
     * Gestion des demandes de sidebar
     */
    async handleSidebarRequest(data, context) {
        console.log('🖼️ Traitement demande sidebar');
        
        // Si la sidebar demande des informations de prévisualisation
        if (data.request === 'preview_stats') {
            return await this.processOutgoing({
                ...data,
                previewStats: this.module.getStats()
            }, context);
        }
        
        // Si la sidebar demande le code actuel
        if (data.request === 'current_code') {
            return await this.processOutgoing({
                ...data,
                currentCode: this.module.currentMermaidCode
            }, context);
        }
        
        return await this.processOutgoing(data, context);
    }

    /**
     * Gestion de la réinitialisation du canvas
     */
    async handleCanvasCleared(data, context) {
        console.log('🖼️ Traitement réinitialisation canvas');
        
        // Efface le code et la prévisualisation
        this.module.currentMermaidCode = '';
        
        const result = await this.module.process(data, context);
        
        return await this.processOutgoing(result, {
            ...context,
            processedBy: 'preview-60',
            action: 'preview_cleared'
        });
    }

    /**
     * Pass-through des données non traitées
     */
    async passThrough(data, context) {
        console.log('🖼️ Pass-through données:', data.type);
        
        // Ajoute des métadonnées de passage
        return await this.processOutgoing({
            ...data,
            passedThrough: 'preview-60'
        }, context);
    }

    /**
     * Détermine le prochain module dans la chaîne
     */
    async determineNextModule(data, context) {
        console.log('🖼️ Détermination prochain module pour:', data.type);
        
        // Logique de routage conditionnel
        const routingRules = [
            {
                condition: data.type === 'mermaid_code_updated' && data.renderScheduled,
                target: null, // Fin de chaîne pour permettre le rendu
                reason: 'Rendu en cours'
            },
            {
                condition: data.type === 'render_requested' && data.immediate,
                target: null, // Fin de chaîne pour le rendu immédiat
                reason: 'Rendu immédiat demandé'
            },
            {
                condition: data.exportRequested && data.success,
                target: 'sidebar-40',
                reason: 'Notification d\'export réussi'
            },
            {
                condition: data.zoomRequested,
                target: null, // Fin de chaîne (action locale)
                reason: 'Zoom géré localement'
            },
            {
                condition: data.themeApplied,
                target: null, // Fin de chaîne (styles appliqués)
                reason: 'Styles de thème appliqués localement'
            },
            {
                condition: data.previewCleared,
                target: 'sidebar-40',
                reason: 'Mise à jour de la sidebar après nettoyage'
            }
        ];
        
        // Applique les règles de routage
        for (const rule of routingRules) {
            if (rule.condition) {
                console.log(`🖼️ Routage vers ${rule.target || 'fin de chaîne'}: ${rule.reason}`);
                
                if (rule.target === null) {
                    // Fin de chaîne
                    return {
                        ...data,
                        endOfChain: true,
                        lastModule: 'preview-60',
                        endReason: rule.reason
                    };
                }
                
                return {
                    ...data,
                    nextModule: rule.target,
                    routingReason: rule.reason,
                    routingSource: 'preview-60'
                };
            }
        }
        
        // Routage par défaut basé sur le type de données
        const defaultRouting = {
            'element_added': 'mermaid-30',
            'element_moved': 'mermaid-30',
            'element_deleted': 'mermaid-30',
            'element_edited': 'mermaid-30',
            'connection_created': 'mermaid-30',
            'connection_deleted': 'mermaid-30',
            'canvas_cleared': 'sidebar-40',
            'sidebar_request': 'sidebar-40',
            'theme_request': 'theme-50'
        };
        
        const nextModule = defaultRouting[data.type];
        if (nextModule) {
            console.log(`🖼️ Routage par défaut vers: ${nextModule}`);
            
            return {
                ...data,
                nextModule: nextModule,
                routingReason: 'Routage par défaut',
                routingSource: 'preview-60'
            };
        }
        
        // Fin de chaîne si aucun routage défini
        console.log('🖼️ Fin de chaîne atteinte');
        return {
            ...data,
            endOfChain: true,
            lastModule: 'preview-60'
        };
    }

    /**
     * Vérifie si des métadonnées de prévisualisation doivent être ajoutées
     */
    shouldAddPreviewMetadata(data) {
        const typesWithPreview = [
            'render_requested',
            'export_requested',
            'mermaid_code_updated',
            'sidebar_request',
            'canvas_state'
        ];
        
        return typesWithPreview.includes(data.type);
    }

    /**
     * Gestion des erreurs
     */
    handleError(data, error) {
        console.error('🖼️ Erreur PreviewTrigger-60:', error);
        
        return {
            ...data,
            error: true,
            errorType: 'preview_processing_error',
            errorMessage: error.message,
            errorModule: 'preview-60',
            fallbackData: data
        };
    }

    /**
     * Obtient les statistiques du trigger
     */
    getStats() {
        return {
            routingRules: this.routingTable.size,
            routes: Array.from(this.routingTable.keys()),
            moduleStats: this.module.getStats()
        };
    }
}

// ===== TRIGGER CHAIN =====
window.PreviewTrigger = PreviewTrigger;

export { PreviewTrigger };