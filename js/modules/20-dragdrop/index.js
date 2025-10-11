/**
 * INDEX.JS - Module 20-DRAGDROP
 * Point d'entrée pour le module de gestion du drag & drop
 */

import { DragDropModule } from './20-dragdrop.js';

// Classe d'entrée pour le module
class DragDropModuleEntry {
    constructor() {
        this.module = null;
        this.trigger = null;
        this.config = null;
    }

    async initialize() {
        console.log('📋 Initialisation DragDropModuleEntry...');
        
        try {
            // Initialisation du module principal
            this.module = new DragDropModule();
            
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
                id: '20-dragdrop',
                name: 'Drag & Drop Module',
                version: '1.0.0',
                enabled: true
            };
            
            console.log('✅ DragDropModuleEntry initialisé');
            return { success: true };
            
        } catch (error) {
            console.error('❌ Erreur initialisation DragDropModuleEntry:', error);
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
            id: '20-dragdrop',
            initialized: this.module !== null,
            module: this.module ? this.module.getState ? this.module.getState() : { initialized: true } : null,
            config: this.config
        };
    }

    async destroy() {
        console.log('🧹 Destruction DragDropModuleEntry...');
        
        if (this.module && this.module.destroy) {
            await this.module.destroy();
        }
        
        this.module = null;
        this.trigger = null;
        this.config = null;
        
        console.log('✅ DragDropModuleEntry détruit');
        return { success: true };
    }
}

export default DragDropModuleEntry;