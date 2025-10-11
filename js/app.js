/**
 * APP.JS - Point d'Entrée Principal du Pipeline
 * Détecte et charge automatiquement les modules de l'allée JS
 * Gère la chaîne de traitement avec numérotation espacée
 */

console.log('🚀 Chargement de app.js...');

// Test simple d'abord
async function testSimple() {
    console.log('🧪 Test simple en cours...');

    // Test de l'accès au DOM
    console.log('DOM Content Loaded:', document.readyState);
    console.log('Element canvas trouvé:', !!document.getElementById('canvas'));
    console.log('Element elementCategories trouvé:', !!document.getElementById('elementCategories'));

    return { success: true };
}

class AppPipeline {
    constructor() {
        console.log('🏗️ Constructeur AppPipeline appelé');
        this.modules = new Map(); // Map pour ordre garanti
        this.moduleConfigs = new Map();
        this.pipelineOrder = [];
        console.log('⚙️ Démarrage de init()...');
        this.init();
    }

    /**
      * Initialisation : scanne les modules et construit la chaîne
      */
     async init() {
          console.log('🚀 Initialisation AppPipeline...');
          console.log('📋 Étape 1: Scan des modules...');
          await this.scanModules();
          console.log('📦 Étape 2: Chargement des modules...');
          await this.loadModules();
          console.log('⚙️ Étape 3: Initialisation du pipeline...');
          await this.initializePipeline();
          console.log('✅ Pipeline prêt :', this.pipelineOrder);
      }

     /**
      * Méthode initialize() pour compatibilité avec AppManager
      */
     async initialize() {
         console.log('🚀 Méthode initialize() appelée sur AppPipeline');
         return await this.init();
     }

    /**
     * Scanne les dossiers modules dans l'allée JS
     */
    async scanModules() {
        // En environnement Node.js, on scannerait le filesystem
        // Pour le navigateur, on utilise une configuration statique
        // qui sera remplacée par du scan dynamique en production
        
        const moduleRegistry = [
            { id: '10-canvas', path: './modules/10-canvas/', number: 10 },
            { id: '20-dragdrop', path: './modules/20-dragdrop/', number: 20 },
            { id: '30-mermaid', path: './modules/30-mermaid/', number: 30 },
            { id: '40-sidebar', path: './modules/40-sidebar/', number: 40 },
            { id: '50-theme', path: './modules/50-theme/', number: 50 },
            { id: '60-preview', path: './modules/60-preview/', number: 60 },
            { id: '70-export', path: './modules/70-export/', number: 70 },
            { id: '80-helper', path: './modules/80-helper/', number: 80 }
        ];

        for (const moduleInfo of moduleRegistry) {
            this.moduleConfigs.set(moduleInfo.number, moduleInfo);
        }
    }

    /**
     * Charge les modules dans l'ordre numérique
     */
    async loadModules() {
         const sortedNumbers = Array.from(this.moduleConfigs.keys()).sort((a, b) => a - b);
         console.log(`📦 Chargement de ${sortedNumbers.length} modules dans l'ordre:`, sortedNumbers);

         for (const moduleNumber of sortedNumbers) {
             const config = this.moduleConfigs.get(moduleNumber);
             try {
                 console.log(`📦 Chargement module ${config.id} (numéro ${moduleNumber}) depuis ${config.path}...`);

                 // Simulation du chargement dynamique
                 // En production, utiliser import() ou require()
                 const module = await this.loadModule(config);

                 this.modules.set(moduleNumber, module);
                 console.log(`✅ Module ${config.id} chargé avec succès`);

             } catch (error) {
                 console.error(`❌ Erreur chargement module ${config.id}:`, error);
                 console.error('Stack trace:', error.stack);
                 // Continue avec les autres modules en cas d'échec
             }
         }
     }

    /**
     * Charge un module dynamiquement avec import()
     * Supporte la nouvelle structure modulaire avec fichiers index.js
     */
    async loadModule(config) {
         try {
             // Construction du chemin vers le fichier index.js du module
             const modulePath = `${config.path}index.js`;
             console.log(`📦 Chargement module ${config.id} depuis: ${modulePath}`);

             // Import dynamique du module
             console.log(`🔄 Import dynamique de ${modulePath}...`);
             const moduleExports = await import(modulePath);
             console.log(`✅ Import réussi pour ${config.id}, exports:`, Object.keys(moduleExports));
            
            // Récupération de la classe d'entrée du module (par défaut ou nommée)
            const ModuleEntry = moduleExports.default || moduleExports[Object.keys(moduleExports)[0]];
            
            if (!ModuleEntry) {
                throw new Error(`Module ${config.id} n'a pas d'export par défaut ou de classe d'entrée`);
            }
            
            // Création d'une instance du module
            const moduleInstance = new ModuleEntry();
            
            // Initialisation du module
            const initResult = await moduleInstance.initialize();
            
            if (!initResult.success) {
                throw new Error(`Échec initialisation module ${config.id}: ${initResult.error}`);
            }
            
            // Retourne l'objet module avec les méthodes standardisées
            return {
                id: config.id,
                number: config.number,
                instance: moduleInstance,
                init: () => Promise.resolve(), // Déjà initialisé
                process: async (data, context = {}) => {
                    console.log(`🔄 Module ${config.id} traite...`);
                    
                    // Obtient le module principal et son trigger
                    const module = moduleInstance.getModule();
                    const trigger = moduleInstance.getTrigger();
                    
                    if (module && module.process) {
                        // Utilise la méthode process du module
                        const result = await module.process(data, context);
                        console.log(`✅ Module ${config.id} terminé`);
                        return result;
                    } else if (trigger && trigger.process) {
                        // Sinon utilise le trigger
                        const result = await trigger.process(data, context);
                        console.log(`✅ Module ${config.id} (via trigger) terminé`);
                        return result;
                    } else {
                        // Pass-through par défaut
                        console.log(`⚠️ Module ${config.id} - pass-through`);
                        return data;
                    }
                },
                getState: () => moduleInstance.getState ? moduleInstance.getState() : { initialized: true },
                destroy: () => moduleInstance.destroy ? moduleInstance.destroy() : Promise.resolve()
            };
            
        } catch (error) {
            console.error(`❌ Erreur chargement module ${config.id}:`, error);
            throw error;
        }
    }

    /**
     * Initialise la chaîne de traitement
     */
    async initializePipeline() {
        this.pipelineOrder = Array.from(this.modules.keys()).sort((a, b) => a - b);
        
        // Initialise chaque module dans l'ordre
        for (const moduleNumber of this.pipelineOrder) {
            const module = this.modules.get(moduleNumber);
            if (module && module.init) {
                await module.init();
            }
        }
    }

    /**
     * Traite les données à travers toute la chaîne avec gestion d'erreurs et contexte partagé
     */
    async process(data, context = {}, options = {}) {
        const {
            continueOnError = false,
            maxRetries = 1,
            retryDelay = 100
        } = options;
        
        let result = data;
        const executionContext = {
            ...context,
            pipeline: {
                startTime: new Date().toISOString(),
                modules: this.pipelineOrder.map(num => {
                    const m = this.modules.get(num);
                    return {
                        id: m ? m.id : 'unknown',
                        number: num,
                        status: 'pending'
                    };
                })
            }
        };
        
        const results = {
            success: true,
            data: null,
            errors: [],
            modules: []
        };
        
        for (let i = 0; i < this.pipelineOrder.length; i++) {
            const moduleNumber = this.pipelineOrder[i];
            const module = this.modules.get(moduleNumber);
            if (!module || !module.process) continue;
            
            let retries = 0;
            let moduleSuccess = false;
            
            while (retries < maxRetries && !moduleSuccess) {
                try {
                    console.log(`🚀 Module ${module.id} traite (tentative ${retries + 1})...`);
                    
                    executionContext.pipeline.modules[i].status = 'running';
                    executionContext.pipeline.modules[i].startTime = new Date().toISOString();
                    
                    result = await module.process(result, executionContext);
                    
                    executionContext.pipeline.modules[i].status = 'completed';
                    executionContext.pipeline.modules[i].endTime = new Date().toISOString();
                    
                    console.log(`✅ Module ${module.id} terminé`);
                    
                    results.modules.push({
                        id: module.id,
                        success: true,
                        retries: retries + 1,
                        executionTime: Date.now() - new Date(executionContext.pipeline.modules[i].startTime).getTime()
                    });
                    
                    moduleSuccess = true;
                    
                } catch (error) {
                    retries++;
                    console.error(`❌ Erreur module ${module.id} (tentative ${retries}):`, error);
                    
                    if (retries >= maxRetries) {
                        const moduleError = {
                            moduleId: module.id,
                            error: error.message,
                            retries: retries,
                            timestamp: new Date().toISOString()
                        };
                        
                        results.errors.push(moduleError);
                        executionContext.pipeline.modules[i].status = 'failed';
                        executionContext.pipeline.modules[i].error = moduleError;
                        
                        if (!continueOnError) {
                            results.success = false;
                            results.data = result;
                            throw new Error(`Pipeline arrêté à cause de l'erreur dans le module ${module.id}: ${error.message}`);
                        } else {
                            console.log(`⚠️  Continuation malgré l'erreur dans ${module.id}`);
                            results.modules.push({
                                id: module.id,
                                success: false,
                                error: moduleError,
                                retries: retries
                            });
                        }
                    } else {
                        console.log(`🔄 Nouvelle tentative dans ${retryDelay}ms...`);
                        await new Promise(resolve => setTimeout(resolve, retryDelay));
                    }
                }
            }
        }
        
        executionContext.pipeline.endTime = new Date().toISOString();
        executionContext.pipeline.duration = Date.now() - new Date(executionContext.pipeline.startTime).getTime();
        
        results.data = result;
        results.context = executionContext;
        
        console.log(`📊 Pipeline terminé: ${results.success ? 'Succès' : 'Échec'} (${executionContext.pipeline.duration}ms)`);
        
        return results;
    }

    /**
     * Détermine si une erreur doit arrêter le pipeline
     */
    shouldStopOnError(error) {
        // Logique de décision selon le type d'erreur
        const criticalErrors = ['fatal', 'critical', 'unrecoverable'];
        const stopTypes = ['syntax', 'dependency', 'initialization'];
        
        if (error.severity && criticalErrors.includes(error.severity.toLowerCase())) {
            return true;
        }
        
        if (error.type && stopTypes.includes(error.type.toLowerCase())) {
            return true;
        }
        
        // Erreurs spécifiques aux modules
        if (error.code) {
            const criticalCodes = ['MODULE_NOT_FOUND', 'INIT_FAILED', 'PROCESS_FAILED'];
            if (criticalCodes.includes(error.code)) {
                return true;
            }
        }
        
        return false;
    }

    /**
     * Ajoute un module dynamiquement (hot-plug)
     */
    async addModule(moduleConfig, position = null) {
        const moduleNumber = position || this.findNextAvailableNumber();
        
        console.log(`🔧 Ajout module ${moduleConfig.id} à la position ${moduleNumber}`);
        
        try {
            const module = await this.loadModule({...moduleConfig, number: moduleNumber});
            this.modules.set(moduleNumber, module);
            this.moduleConfigs.set(moduleNumber, {...moduleConfig, number: moduleNumber});
            
            // Reconstruit l'ordre du pipeline
            this.pipelineOrder = Array.from(this.modules.keys()).sort((a, b) => a - b);
            
            console.log(`✅ Module ajouté. Nouvel ordre:`, this.pipelineOrder);
            return moduleNumber;
            
        } catch (error) {
            console.error(`❌ Échec ajout module:`, error);
            throw error;
        }
    }

    /**
     * Trouve le prochain numéro disponible
     */
    findNextAvailableNumber() {
        const existingNumbers = Array.from(this.modules.keys());
        let candidate = 10;
        
        while (existingNumbers.includes(candidate)) {
            candidate += 10;
        }
        
        return candidate;
    }

    /**
     * Retire un module (hot-unplug)
     */
    removeModule(moduleNumber) {
        console.log(`🗑️ Retrait module position ${moduleNumber}`);
        
        this.modules.delete(moduleNumber);
        this.moduleConfigs.delete(moduleNumber);
        this.pipelineOrder = Array.from(this.modules.keys()).sort((a, b) => a - b);
        
        console.log(`✅ Module retiré. Nouvel ordre:`, this.pipelineOrder);
    }

    /**
     * Nettoie les ressources et arrête le pipeline
     */
    async destroy() {
        console.log('🧹 Destruction du pipeline...');
        
        const errors = [];
        
        for (const [number, module] of this.modules) {
            try {
                if (module.destroy && typeof module.destroy === 'function') {
                    console.log(`🧹 Nettoyage module ${module.id}...`);
                    await module.destroy();
                }
            } catch (error) {
                console.error(`❌ Erreur nettoyage module ${module.id}:`, error);
                errors.push({ moduleId: module.id, error: error.message });
            }
        }
        
        // Nettoyage des collections
        this.modules.clear();
        this.loadedModules.clear();
        this.moduleConfigs.clear();
        this.pipelineOrder = [];
        this.isInitialized = false;
        
        console.log('✅ Pipeline détruit');
        
        if (errors.length > 0) {
            console.warn(`⚠️  Erreurs lors du nettoyage:`, errors);
            return { success: false, errors };
        }
        
        return { success: true };
    }

    /**
     * Redémarre le pipeline (recharge tous les modules)
     */
    async restart() {
        console.log('🔄 Redémarrage du pipeline...');
        
        // Sauvegarde de la configuration actuelle
        const currentOrder = [...this.pipelineOrder];
        
        // Destruction complète
        await this.destroy();
        
        // Rechargement
        await this.initialize();
        
        // Restauration de l'ordre
        this.pipelineOrder = currentOrder;
        
        console.log('✅ Pipeline redémarré');
        return this.getState();
    }

    /**
     * Obtient des informations détaillées sur une erreur
     */
    getErrorInfo(error) {
        const info = {
            message: error.message || 'Erreur inconnue',
            type: error.type || 'unknown',
            severity: error.severity || 'medium',
            code: error.code || null,
            module: error.moduleId || null,
            stack: error.stack || null,
            timestamp: error.timestamp || new Date().toISOString(),
            context: error.context || null
        };
        
        // Analyse de la stack trace si disponible
        if (info.stack) {
            const stackLines = info.stack.split('\n');
            if (stackLines.length > 1) {
                info.location = stackLines[1].trim();
            }
        }
        
        return info;
    }

    /**
     * Génère un rapport d'exécution
     */
    generateReport(executionResults = null) {
        const state = this.getState();
        const stats = this.getStats();
        const now = new Date().toISOString();
        
        const report = {
            timestamp: now,
            pipeline: {
                id: this.id,
                status: state.pipeline.status,
                totalModules: stats.total,
                loadedModules: stats.loaded,
                pipelineModules: stats.pipeline,
                executionResults: executionResults
            },
            modules: stats.modules,
            system: {
                userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'Node.js',
                timestamp: now,
                memory: typeof performance !== 'undefined' ? performance.memory : null
            }
        };
        
        return report;
    }

    /**
     * Obtient un module spécifique par son ID ou numéro
     */
    getModule(identifier) {
        if (typeof identifier === 'string') {
            // Recherche par ID
            for (const [number, module] of this.modules) {
                if (module.id === identifier) {
                    return module;
                }
            }
        } else if (typeof identifier === 'number') {
            // Recherche par numéro
            return this.modules.get(identifier);
        }
        
        return null;
    }

    /**
     * Vérifie si un module est chargé et fonctionnel
     */
    isModuleReady(identifier) {
        const module = this.getModule(identifier);
        return module !== null && module.process !== undefined;
    }

    /**
     * Obtient des statistiques sur le pipeline
     */
    getStats() {
        const stats = {
            total: this.modules.size,
            loaded: this.loadedModules.size,
            pipeline: this.pipelineOrder.length,
            modules: {}
        };
        
        for (const [number, module] of this.modules) {
            stats.modules[module.id] = {
                number: number,
                inPipeline: this.pipelineOrder.includes(number),
                capabilities: {
                    canProcess: typeof module.process === 'function',
                    canGetState: typeof module.getState === 'function',
                    canDestroy: typeof module.destroy === 'function'
                }
            };
        }
        
        return stats;
    }

    /**
     * Ajoute un module au pipeline (si pas déjà présent)
     */
    addToPipeline(moduleNumber) {
        if (!this.modules.has(moduleNumber)) {
            console.warn(`Module ${moduleNumber} non chargé`);
            return false;
        }
        
        if (!this.pipelineOrder.includes(moduleNumber)) {
            this.pipelineOrder.push(moduleNumber);
            console.log(`✅ Module ${moduleNumber} ajouté au pipeline`);
            return true;
        }
        
        return false;
    }

    /**
     * Retire un module du pipeline
     */
    removeFromPipeline(moduleNumber) {
        const index = this.pipelineOrder.indexOf(moduleNumber);
        if (index > -1) {
            this.pipelineOrder.splice(index, 1);
            console.log(`✅ Module ${moduleNumber} retiré du pipeline`);
            return true;
        }
        
        return false;
    }

    /**
     * Réorganise l'ordre des modules dans le pipeline
     */
    reorderPipeline(newOrder) {
        // Validation
        const validOrder = newOrder.filter(num => this.modules.has(num));
        const invalidModules = newOrder.filter(num => !this.modules.has(num));
        
        if (invalidModules.length > 0) {
            console.warn(`Modules non chargés ignorés: ${invalidModules.join(', ')}`);
        }
        
        if (validOrder.length > 0) {
            this.pipelineOrder = [...validOrder];
            console.log(`✅ Pipeline réorganisé: ${this.pipelineOrder.join(' → ')}`);
            return true;
        }
        
        return false;
    }
}

/**
 * Configuration avancée du pipeline
 */
const defaultConfig = {
    autoStart: true,
    debug: true,
    pipelineOrder: [10, 20, 30, 40, 50, 60, 70, 80], // Ordre complet des modules
    errorHandling: {
        continueOnError: false,
        maxRetries: 1,
        retryDelay: 100
    },
    logging: {
        level: 'info', // debug, info, warn, error
        timestamps: true,
        colors: true
    },
    performance: {
        memoryTracking: true,
        executionTiming: true
    }
};

/**
 * Gestionnaire d'application avancé
 */
class AppManager {
    constructor(config = {}) {
        console.log('🏗️ Constructeur AppManager appelé');
        console.log('Config reçue:', config);

        this.config = { ...defaultConfig, ...config };
        this.pipeline = null;
        this.initialized = false;
        this.startTime = null;

        console.log('Config finale:', this.config);

        // Configuration du logging
        console.log('📝 Configuration du logging...');
        this.setupLogging();
        console.log('✅ AppManager constructeur terminé');
    }
    
    setupLogging() {
        const levels = ['debug', 'info', 'warn', 'error'];
        const currentLevel = levels.indexOf(this.config.logging.level);
        
        this.logger = {
            debug: (...args) => {
                if (currentLevel <= 0) this.log('🔍', 'DEBUG', ...args);
            },
            info: (...args) => {
                if (currentLevel <= 1) this.log('ℹ️', 'INFO', ...args);
            },
            warn: (...args) => {
                if (currentLevel <= 2) this.log('⚠️', 'WARN', ...args);
            },
            error: (...args) => {
                if (currentLevel <= 3) this.log('❌', 'ERROR', ...args);
            }
        };
    }
    
    log(icon, level, ...args) {
        const timestamp = this.config.logging.timestamps ? `[${new Date().toISOString()}]` : '';
        const prefix = this.config.logging.colors ? `${icon} ${level}:` : `${level}:`;
        
        console.log(`${timestamp} ${prefix}`, ...args);
    }
    
    async initialize() {
        try {
            console.log('🚀 Début de initialize() AppManager');
            this.logger.info('Initialisation de l\'application...');
            this.startTime = performance.now();

            console.log('🏗️ Création du AppPipeline...');
            this.pipeline = new AppPipeline(this.config);
            console.log('Pipeline créé:', !!this.pipeline);

            console.log('⚙️ Initialisation du pipeline...');
            await this.pipeline.initialize();

            this.initialized = true;
            const initTime = performance.now() - this.startTime;

            this.logger.info(`✅ Application initialisée en ${initTime.toFixed(2)}ms`);
            console.log('✅ initialize() AppManager terminé avec succès');
            return { success: true, initTime };

        } catch (error) {
            console.error('❌ Erreur dans initialize() AppManager:', error);
            this.logger.error('❌ Échec de l\'initialisation:', error);
            return { success: false, error };
        }
    }
    
    async start(data = {}) {
        if (!this.initialized) {
            const initResult = await this.initialize();
            if (!initResult.success) return initResult;
        }
        
        try {
            this.logger.info('🚀 Démarrage du pipeline...');
            const startTime = performance.now();
            
            const result = await this.pipeline.process(data, {}, this.config.errorHandling);
            
            const executionTime = performance.now() - startTime;
            this.logger.info(`✅ Pipeline terminé en ${executionTime.toFixed(2)}ms`);
            
            return { ...result, executionTime };
            
        } catch (error) {
            this.logger.error('❌ Échec de l\'exécution:', error);
            return { success: false, error };
        }
    }
    
    getState() {
        if (!this.pipeline) {
            return { status: 'not_initialized', initialized: false };
        }
        
        return {
            status: this.initialized ? 'ready' : 'initializing',
            initialized: this.initialized,
            config: this.config,
            pipeline: this.pipeline.getState(),
            stats: this.pipeline.getStats(),
            uptime: this.startTime ? performance.now() - this.startTime : 0
        };
    }
    
    async stop() {
        this.logger.info('🛑 Arrêt de l\'application...');
        
        if (this.pipeline) {
            const result = await this.pipeline.destroy();
            this.pipeline = null;
            this.initialized = false;
            
            this.logger.info('✅ Application arrêtée');
            return result;
        }
        
        return { success: true };
    }
}

// ===== INITIALISATION =====
let appPipeline = null;
let appManager = null;

/**
 * Point d'entrée global amélioré
 */
async function initializeApp(config = {}) {
    console.log('🎯 Fonction initializeApp appelée');

    if (appManager) {
        console.warn('AppManager déjà initialisé');
        return appManager;
    }

    // Test simple d'abord
    console.log('🧪 Exécution du test simple...');
    const testResult = await testSimple();
    console.log('Test simple résultat:', testResult);

    console.log('🏗️ Création du AppManager...');
    appManager = new AppManager(config);
    appPipeline = appManager.pipeline;

    console.log('⚙️ Initialisation du AppManager...');
    const initResult = await appManager.initialize();
    console.log('Résultat initialisation:', initResult);

    // Expose globalement pour debugging
    window.appManager = appManager;
    window.appPipeline = appPipeline;

    console.log('✅ initializeApp terminé');
    return appManager;
}

/**
 * Traitement rapide via le pipeline
 */
async function processThroughPipeline(data, context = {}) {
    if (!appManager) {
        throw new Error('AppManager non initialisé. Appeler initializeApp() d\'abord.');
    }
    
    return await appManager.start(data);
}

// ===== EXPORT =====
export { initializeApp, processThroughPipeline, AppPipeline, AppManager, appManager, defaultConfig };

// ===== EXPOSITION GLOBALE POUR HTML =====
if (typeof window !== 'undefined') {
    window.initializeApp = initializeApp;
    window.processThroughPipeline = processThroughPipeline;
    window.AppPipeline = AppPipeline;
    window.AppManager = AppManager;
    window.appManager = appManager;
    window.defaultConfig = defaultConfig;
    
    console.log('🌍 Fonctions exposées globalement:', Object.keys(window).filter(key => key.includes('App') || key.includes('initialize')));
}