/**
 * INDEX.JS - Module 40-SIDEBAR
 * Point d'entrée pour le module de gestion de la barre latérale
 */

import { SidebarModule } from './40-sidebar.js';
import { SidebarTrigger } from './40-sidebar-trigger.js';
import { sidebarConfig } from './40-sidebar-config.js';

// Classe d'entrée pour le module
class SidebarModuleEntry {
    constructor() {
        this.module = null;
        this.trigger = null;
        this.config = sidebarConfig;
    }

    async initialize() {
        console.log('📋 Initialisation 40-sidebar Entry...');

        try {
            // Initialisation du module principal
            this.module = new SidebarModule();

            // Création du trigger avec routage avancé
            this.trigger = new SidebarTrigger();
            this.trigger.setModule(this.module);

            // Connecte le module au trigger
            this.module.setTrigger(this.trigger);

            console.log('✅ 40-sidebar Entry initialisé');
            return { success: true };

        } catch (error) {
            console.error('❌ Erreur initialisation 40-sidebar Entry:', error);
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
            id: '40-sidebar',
            initialized: this.module !== null,
            module: this.module ? this.module.getState() : null,
            config: this.config
        };
    }

    async destroy() {
        console.log('🧹 Destruction SidebarModuleEntry...');
        
        if (this.module && this.module.destroy) {
            await this.module.destroy();
        }
        
        this.module = null;
        this.trigger = null;
        this.config = null;
        
        console.log('✅ SidebarModuleEntry détruit');
        return { success: true };
    }
}

export {
    SidebarModule,
    SidebarTrigger,
    sidebarConfig
};

export default SidebarModuleEntry;