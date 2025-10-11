/**
 * INDEX HELPER-80
 * Point d'entrée du module HelperModule
 * Exporte toutes les composantes du module
 */

import { HelperModule } from './80-helper.js';
import { HelperTrigger } from './80-helper-trigger.js';
import { HelperConfig } from './80-helper-config.js';

// ===== INITIALISATION DU MODULE =====
class HelperModuleEntry {
    constructor() {
        this.module = null;
        this.trigger = null;
        this.config = HelperConfig;
        this.initialized = false;
        
        console.log('🚀 80-helper prêt à être initialisé');
    }

    /**
     * Initialise le module et son trigger
     */
    async initialize(options = {}) {
        try {
            console.log('🔧 Initialisation 80-helper...');
            
            // Fusionne la configuration avec les options
            const mergedConfig = this.mergeConfig(this.config, options);
            
            // Crée le module principal
            this.module = new HelperModule(mergedConfig);
            await this.module.initialize();
            
            // Crée le trigger
            this.trigger = new HelperTrigger();
            this.trigger.setModule(this.module);
            
            // Connecte le module au trigger
            this.module.setTrigger(this.trigger);
            
            this.initialized = true;
            
            console.log('✅ 80-helper initialisé avec succès');
            
            return {
                success: true,
                module: this.module,
                trigger: this.trigger,
                config: mergedConfig
            };
            
        } catch (error) {
            console.error('❌ Erreur initialisation 80-helper:', error);
            
            return {
                success: false,
                error: error.message,
                module: null,
                trigger: null
            };
        }
    }

    /**
     * Obtient le module principal
     */
    getModule() {
        if (!this.initialized) {
            throw new Error('HelperModule-80 non initialisé');
        }
        return this.module;
    }

    /**
     * Obtient le trigger
     */
    getTrigger() {
        if (!this.initialized) {
            throw new Error('HelperModule-80 non initialisé');
        }
        return this.trigger;
    }

    /**
     * Obtient la configuration
     */
    getConfig() {
        return this.config;
    }

    /**
     * Obtient l'état du module
     */
    getState() {
        return {
            initialized: this.initialized,
            module: this.module ? this.module.getState() : null,
            trigger: this.trigger ? this.trigger.getState() : null,
            config: this.config
        };
    }

    /**
     * Arrête proprement le module
     */
    async destroy() {
        try {
            console.log('🛑 Arrêt 80-helper...');
            
            if (this.module) {
                await this.module.destroy();
            }
            
            if (this.trigger) {
                // Nettoyage du trigger
                this.trigger.module = null;
                this.trigger.nextTrigger = null;
            }
            
            this.module = null;
            this.trigger = null;
            this.initialized = false;
            
            console.log('✅ 80-helper arrêté');
            
            return { success: true };
            
        } catch (error) {
            console.error('❌ Erreur arrêt 80-helper:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Fusionne la configuration avec les options
     */
    mergeConfig(baseConfig, options) {
        const merged = { ...baseConfig };
        
        // Fusionne récursivement les objets
        const deepMerge = (target, source) => {
            for (const key in source) {
                if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
                    if (!target[key]) target[key] = {};
                    deepMerge(target[key], source[key]);
                } else {
                    target[key] = source[key];
                }
            }
        };
        
        deepMerge(merged, options);
        return merged;
    }

    /**
     * Crée une instance du module
     */
    static create(options = {}) {
        const instance = new HelperModuleEntry();
        return instance.initialize(options);
    }
}

// ===== EXPORTATIONS =====
export {
    HelperModule,
    HelperTrigger,
    HelperConfig,
    HelperModuleEntry
};

// Export par défaut pour l'utilisation directe
export default HelperModuleEntry;

// ===== UTILISATION DIRECTE =====
/**
 * Utilisation directe du module :
 * 
 * import HelperModule from './modules/helper-80/index.js';
 * 
 * const helper = await HelperModule.create({
 *     cache: { enabled: true },
 *     logging: { level: 'debug' }
 * });
 * 
 * const module = helper.getModule();
 * const trigger = helper.getTrigger();
 */

console.log('📦 80-helper chargé');