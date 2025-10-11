/**
 * INDEX.JS - Module 10-CANVAS
 * Point d'entrée pour le module de gestion du canvas principal
 */

import { CanvasModule } from './10-canvas.js';

// Classe d'entrée pour le module
class CanvasModuleEntry {
    constructor() {
        this.module = null;
        this.trigger = null;
        this.config = null;
    }

    async initialize() {
        console.log('📋 Initialisation CanvasModuleEntry...');
        
        try {
            // Initialisation du module principal
            this.module = new CanvasModule();
            
            // Création du trigger
            this.trigger = {
                process: async (data, context) => {
                    if (this.module && this.module.process) {
                        return await this.module.process(data, context);
                    }
                    return data;
                },
                getState: () => {
                    return this.getState();
                }
            };
            
            // Configuration par défaut
            this.config = {
                id: '10-canvas',
                name: 'Canvas Module',
                version: '1.0.0',
                enabled: true
            };
            
            console.log('✅ CanvasModuleEntry initialisé');
            return { success: true };
            
        } catch (error) {
            console.error('❌ Erreur initialisation CanvasModuleEntry:', error);
            return { success: false, error: error.message };
        }
    }

    getModule() {
        return this.module;
    }

    getTrigger() {
        return this.trigger;
    }

    getConfig() {
        return this.config;
    }

    getState() {
        return {
            id: '10-canvas',
            initialized: this.module !== null,
            module: this.module ? this.module.getState ? this.module.getState() : { initialized: true } : null,
            config: this.config
        };
    }

    async destroy() {
        console.log('🧹 Destruction CanvasModuleEntry...');
        
        if (this.module && this.module.destroy) {
            await this.module.destroy();
        }
        
        this.module = null;
        this.trigger = null;
        this.config = null;
        
        console.log('✅ CanvasModuleEntry détruit');
        return { success: true };
    }
}

export default CanvasModuleEntry;