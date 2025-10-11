/**
 * TRIGGER THEME-50 : Gestionnaire de déclenchement du module Theme
 * Implémente le pattern Chain of Responsibility pour la gestion des thèmes
 */

class ThemeTrigger {
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
        this.routingTable.set('theme_request', 'handleThemeRequest');
        this.routingTable.set('element_edited', 'handleElementEdited');
        this.routingTable.set('canvas_cleared', 'handleCanvasCleared');
        this.routingTable.set('sidebar_request', 'handleSidebarRequest');
        this.routingTable.set('preview_request', 'handlePreviewRequest');
        
        console.log('🎯 ThemeTrigger-50 configuré');
    }

    /**
     * Traitement des données entrantes
     */
    async processIncoming(data, context = {}) {
        console.log('🎯 ThemeTrigger-50 reçoit:', data);
        
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
        console.log('🎯 ThemeTrigger-50 sortie:', data);
        
        // Ajoute des métadonnées de thème si nécessaire
        if (this.shouldAddThemeMetadata(data)) {
            data.theme = this.module.getCurrentTheme();
            data.themeStats = this.module.getStats();
        }
        
        // Détermine le prochain module
        return await this.determineNextModule(data, context);
    }

    /**
     * Gestion des demandes de thème
     */
    async handleThemeRequest(data, context) {
        console.log('🎯 Traitement demande thème:', data);
        
        const result = await this.module.process(data, context);
        
        return await this.processOutgoing(result, {
            ...context,
            processedBy: 'theme-50',
            action: 'theme_request'
        });
    }

    /**
     * Gestion de l'édition d'élément
     */
    async handleElementEdited(data, context) {
        console.log('🎯 Traitement édition élément:', data);
        
        // Vérifie si l'élément a des préférences de thème
        if (data.data?.theme) {
            const result = await this.module.process(data, context);
            return await this.processOutgoing(result, {
                ...context,
                processedBy: 'theme-50',
                action: 'element_theme_applied'
            });
        }
        
        // Pass-through si pas de thème
        return await this.processOutgoing(data, context);
    }

    /**
     * Gestion de la réinitialisation du canvas
     */
    async handleCanvasCleared(data, context) {
        console.log('🎯 Traitement réinitialisation canvas');
        
        const result = await this.module.process(data, context);
        
        return await this.processOutgoing(result, {
            ...context,
            processedBy: 'theme-50',
            action: 'canvas_theme_reset'
        });
    }

    /**
     * Gestion des demandes de sidebar
     */
    async handleSidebarRequest(data, context) {
        console.log('🎯 Traitement demande sidebar:', data);
        
        // Si la sidebar demande des informations de thème
        if (data.request === 'theme_info') {
            const themeInfo = await this.module.getThemeList();
            return await this.processOutgoing({
                ...data,
                themeInfo: themeInfo
            }, context);
        }
        
        return await this.processOutgoing(data, context);
    }

    /**
     * Gestion des demandes de preview
     */
    async handlePreviewRequest(data, context) {
        console.log('🎯 Traitement demande preview:', data);
        
        // Ajoute des informations de thème pour la preview
        if (data.request === 'theme_styles') {
            return await this.processOutgoing({
                ...data,
                themeStyles: this.module.getCurrentTheme(),
                themeVariables: this.getThemeVariables()
            }, context);
        }
        
        return await this.processOutgoing(data, context);
    }

    /**
     * Pass-through des données non traitées
     */
    async passThrough(data, context) {
        console.log('🎯 Pass-through données:', data.type);
        
        // Ajoute des métadonnées de passage
        return await this.processOutgoing({
            ...data,
            passedThrough: 'theme-50'
        }, context);
    }

    /**
     * Détermine le prochain module dans la chaîne
     */
    async determineNextModule(data, context) {
        console.log('🎯 Détermination prochain module pour:', data.type);
        
        // Logique de routage conditionnel
        const routingRules = [
            {
                condition: data.type === 'theme_created' || data.type === 'theme_deleted',
                target: 'sidebar-40',
                reason: 'Mise à jour de la sidebar après changement de thème'
            },
            {
                condition: data.themeApplied || data.themeReset,
                target: 'preview-60',
                reason: 'Rafraîchissement de la preview après changement de thème'
            },
            {
                condition: data.type === 'element_theme_applied',
                target: 'mermaid-30',
                reason: 'Regénération du code Mermaid après changement de thème d\'élément'
            },
            {
                condition: data.type === 'theme_list',
                target: 'sidebar-40',
                reason: 'Envoi de la liste des thèmes à la sidebar'
            },
            {
                condition: data.type === 'canvas_cleared' && data.themeReset,
                target: 'preview-60',
                reason: 'Rafraîchissement global après réinitialisation'
            }
        ];
        
        // Applique les règles de routage
        for (const rule of routingRules) {
            if (rule.condition) {
                console.log(`🎯 Routage vers ${rule.target}: ${rule.reason}`);
                
                return {
                    ...data,
                    nextModule: rule.target,
                    routingReason: rule.reason,
                    routingSource: 'theme-50'
                };
            }
        }
        
        // Routage par défaut basé sur le type de données
        const defaultRouting = {
            'element_added': 'dragdrop-20',
            'element_moved': 'mermaid-30',
            'element_deleted': 'mermaid-30',
            'element_edited': 'mermaid-30',
            'connection_created': 'mermaid-30',
            'connection_deleted': 'mermaid-30',
            'canvas_cleared': 'sidebar-40'
        };
        
        const nextModule = defaultRouting[data.type];
        if (nextModule) {
            console.log(`🎯 Routage par défaut vers: ${nextModule}`);
            
            return {
                ...data,
                nextModule: nextModule,
                routingReason: 'Routage par défaut',
                routingSource: 'theme-50'
            };
        }
        
        // Fin de chaîne si aucun routage défini
        console.log('🎯 Fin de chaîne atteinte');
        return {
            ...data,
            endOfChain: true,
            lastModule: 'theme-50'
        };
    }

    /**
     * Vérifie si des métadonnées de thème doivent être ajoutées
     */
    shouldAddThemeMetadata(data) {
        const typesWithTheme = [
            'element_added',
            'element_moved',
            'element_edited',
            'canvas_state',
            'sidebar_request',
            'preview_request'
        ];
        
        return typesWithTheme.includes(data.type);
    }

    /**
     * Obtient les variables CSS du thème actuel
     */
    getThemeVariables() {
        const theme = this.module.getCurrentTheme();
        if (!theme.theme) return {};
        
        const rootStyles = getComputedStyle(document.documentElement);
        const variables = {};
        
        // Extrait les variables CSS pertinentes
        const cssVariables = [
            '--color-primary',
            '--color-secondary',
            '--color-background',
            '--color-surface',
            '--color-text',
            '--color-border',
            '--color-accent'
        ];
        
        cssVariables.forEach(variable => {
            const value = rootStyles.getPropertyValue(variable).trim();
            if (value) {
                variables[variable] = value;
            }
        });
        
        return variables;
    }

    /**
     * Gestion des erreurs
     */
    handleError(data, error) {
        console.error('🎯 Erreur ThemeTrigger-50:', error);
        
        return {
            ...data,
            error: true,
            errorType: 'theme_processing_error',
            errorMessage: error.message,
            errorModule: 'theme-50',
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
            currentTheme: this.module.getCurrentTheme()
        };
    }
}

// ===== TRIGGER CHAIN =====
window.ThemeTrigger = ThemeTrigger;

export { ThemeTrigger };