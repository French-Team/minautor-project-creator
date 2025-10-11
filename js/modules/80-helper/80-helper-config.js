/**
 * CONFIGURATION 80-HELPER
 * Configuration complète du module HelperModule
 */

const HelperConfig = {
    // Paramètres généraux
    general: {
        moduleName: 'HelperModule',
        moduleId: '80-helper',
        version: '1.0.0',
        debug: true,
        performanceMonitoring: true
    },

    // Configuration des utilitaires
    utilities: {
        validation: {
            enabled: true,
            patterns: {
                email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
                url: /^https?:\/\/.+/,
                uuid: /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
                elementId: /^[a-zA-Z][a-zA-Z0-9_-]*$/,
                mermaidId: /^[a-zA-Z][a-zA-Z0-9_-]*$/
            },
            rules: {
                minLength: (str, min) => str.length >= min,
                maxLength: (str, max) => str.length <= max,
                required: (value) => value !== null && value !== undefined && value !== '',
                numeric: (value) => !isNaN(parseFloat(value)) && isFinite(value),
                integer: (value) => Number.isInteger(parseInt(value)),
                positive: (value) => parseFloat(value) > 0,
                range: (value, min, max) => parseFloat(value) >= min && parseFloat(value) <= max
            }
        },

        stringManipulation: {
            enabled: true,
            methods: {
                camelCase: true,
                kebabCase: true,
                snakeCase: true,
                pascalCase: true,
                titleCase: true,
                slug: true,
                truncate: true,
                pad: true,
                repeat: true,
                reverse: true,
                capitalize: true,
                uncapitalize: true
            }
        },

        arrayManipulation: {
            enabled: true,
            methods: {
                chunk: true,
                flatten: true,
                unique: true,
                sortBy: true,
                groupBy: true,
                partition: true,
                shuffle: true,
                sample: true,
                take: true,
                drop: true,
                intersection: true,
                difference: true,
                union: true
            }
        },

        objectManipulation: {
            enabled: true,
            methods: {
                deepClone: true,
                deepMerge: true,
                pick: true,
                omit: true,
                flatten: true,
                unflatten: true,
                get: true,
                set: true,
                has: true,
                keys: true,
                values: true,
                entries: true
            }
        },

        domManipulation: {
            enabled: true,
            methods: {
                createElement: true,
                removeElement: true,
                addClass: true,
                removeClass: true,
                toggleClass: true,
                hasClass: true,
                setStyle: true,
                getStyle: true,
                setAttribute: true,
                getAttribute: true,
                querySelector: true,
                querySelectorAll: true,
                addEventListener: true,
                removeEventListener: true
            }
        },

        math: {
            enabled: true,
            methods: {
                clamp: true,
                lerp: true,
                map: true,
                distance: true,
                angle: true,
                random: true,
                randomInt: true,
                degToRad: true,
                radToDeg: true,
                round: true,
                floor: true,
                ceil: true,
                abs: true,
                min: true,
                max: true
            }
        }
    },

    // Configuration du cache
    cache: {
        enabled: true,
        maxSize: 1000,
        ttl: 300000, // 5 minutes
        cleanupInterval: 60000, // 1 minute
        strategies: {
            lru: true,
            lfu: false,
            fifo: false
        },
        namespaces: {
            'validation': { ttl: 300000 },
            'format': { ttl: 600000 },
            'math': { ttl: 1800000 },
            'dom': { ttl: 300000 },
            'string': { ttl: 900000 },
            'array': { ttl: 900000 },
            'object': { ttl: 900000 }
        }
    },

    // Configuration du logging
    logging: {
        enabled: true,
        level: 'info', // debug, info, warn, error
        destinations: {
            console: true,
            file: false,
            remote: false
        },
        format: {
            timestamp: true,
            moduleId: true,
            level: true,
            message: true,
            data: true
        },
        maxEntries: 1000,
        retention: 3600000 // 1 heure
    },

    // Configuration des performances
    performance: {
        monitoring: {
            enabled: true,
            trackExecutionTime: true,
            trackMemoryUsage: true,
            trackCacheHitRate: true
        },
        optimization: {
            debounceDelay: 300,
            throttleDelay: 100,
            batchSize: 50,
            maxConcurrent: 10
        },
        limits: {
            maxStringLength: 10000,
            maxArraySize: 10000,
            maxObjectDepth: 10,
            maxRecursion: 100,
            maxExecutionTime: 5000
        }
    },

    // Configuration des événements
    events: {
        enabled: true,
        topics: [
            'util_executed',
            'validation_completed',
            'format_completed',
            'cache_hit',
            'cache_miss',
            'cache_cleared',
            'math_calculated',
            'dom_manipulated',
            'error_occurred'
        ],
        handlers: {
            'util_executed': (data) => console.log('Utilitaire exécuté:', data),
            'validation_completed': (data) => console.log('Validation complétée:', data),
            'format_completed': (data) => console.log('Formatage complété:', data),
            'cache_hit': (data) => console.log('Cache hit:', data),
            'cache_miss': (data) => console.log('Cache miss:', data),
            'error_occurred': (data) => console.error('Erreur:', data)
        }
    },

    // Configuration des intégrations
    integrations: {
        canvas: {
            enabled: true,
            methods: ['validateElement', 'formatElement']
        },
        mermaid: {
            enabled: true,
            methods: ['validateSyntax', 'formatCode']
        },
        sidebar: {
            enabled: true,
            methods: ['validateInput', 'formatDisplay']
        },
        preview: {
            enabled: true,
            methods: ['validatePreview', 'formatOutput']
        },
        theme: {
            enabled: true,
            methods: ['validateTheme', 'formatTheme']
        }
    },

    // Configuration de sécurité
    security: {
        sanitizeInput: true,
        validateOutput: true,
        maxInputSize: 1000000, // 1MB
        allowedDomains: [],
        blockedPatterns: [
            /<script[^>]*>.*?<\/script>/gi,
            /javascript:/gi,
            /on\w+\s*=/gi
        ],
        escapeHtml: true,
        stripTags: false
    },

    // Configuration des messages
    messages: {
        errors: {
            validation_failed: 'La validation a échoué',
            invalid_input: 'Entrée invalide',
            cache_error: 'Erreur de cache',
            math_error: 'Erreur mathématique',
            dom_error: 'Erreur DOM',
            timeout: 'Délai d\'exécution dépassé',
            memory_limit: 'Limite mémoire atteinte',
            recursion_limit: 'Limite de récursion atteinte'
        },
        success: {
            validation_passed: 'Validation réussie',
            cache_hit: 'Résultat trouvé en cache',
            cache_cleared: 'Cache vidé avec succès',
            operation_completed: 'Opération complétée'
        },
        info: {
            cache_miss: 'Résultat non trouvé en cache',
            processing: 'Traitement en cours',
            optimizing: 'Optimisation en cours'
        }
    },

    // Configuration des raccourcis clavier
    shortcuts: {
        enabled: true,
        bindings: {
            'ctrl+shift+h': 'show_helper_stats',
            'ctrl+shift+c': 'clear_cache',
            'ctrl+shift+v': 'validate_selection',
            'ctrl+shift+f': 'format_selection'
        }
    },

    // Configuration API
    api: {
        enabled: true,
        endpoints: {
            util: '/api/helper/util',
            validate: '/api/helper/validate',
            format: '/api/helper/format',
            cache: '/api/helper/cache',
            math: '/api/helper/math',
            dom: '/api/helper/dom'
        },
        rateLimit: {
            enabled: true,
            maxRequests: 100,
            windowMs: 60000 // 1 minute
        }
    },

    // Méthodes utilitaires
    methods: {
        /**
         * Obtient la configuration pour un utilitaire spécifique
         */
        getUtilityConfig: (utilityType) => {
            return HelperConfig.utilities[utilityType] || null;
        },

        /**
         * Obtient la configuration du cache pour un namespace
         */
        getCacheConfig: (namespace) => {
            return HelperConfig.cache.namespaces[namespace] || {
                ttl: HelperConfig.cache.ttl
            };
        },

        /**
         * Obtient le message approprié
         */
        getMessage: (type, key) => {
            return HelperConfig.messages[type]?.[key] || 'Message non défini';
        },

        /**
         * Obtient la configuration des performances
         */
        getPerformanceConfig: () => {
            return HelperConfig.performance;
        },

        /**
         * Obtient la configuration de sécurité
         */
        getSecurityConfig: () => {
            return HelperConfig.security;
        },

        /**
         * Obtient la configuration complète
         */
        getFullConfig: () => {
            return HelperConfig;
        },

        /**
         * Obtient la configuration minimale
         */
        getMinimalConfig: () => {
            return {
                general: HelperConfig.general,
                cache: HelperConfig.cache,
                performance: HelperConfig.performance.limits,
                security: HelperConfig.security
            };
        }
    }
};

export { HelperConfig };