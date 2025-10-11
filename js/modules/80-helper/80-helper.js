/**
 * MODULE HELPER-80 : Fonctions Utilitaires
 * Fournit des fonctions utilitaires partagées pour tous les modules
 */

class HelperModule {
     constructor() {
         this.isInitialized = false;
         this.utils = {};
         this.cache = new Map();
         this.eventBus = null;

         this.initialize();
     }

    async initialize() {
         console.log('🔧 Initialisation 80-helper...');

         this.setupUtils();
         this.setupEventBus();
         this.setupGlobalHelpers();

         this.isInitialized = true;
         console.log('✅ 80-helper prêt');
     }

    /**
     * Configuration des utilitaires
     */
    setupUtils() {
        this.utils = {
            // Fonctions de validation
            validation: {
                isValidId: (id) => /^[a-zA-Z][a-zA-Z0-9_-]*$/.test(id),
                isValidColor: (color) => /^#[0-9A-F]{6}$/i.test(color) || /^rgb\(|^hsl\(|^rgba\(|^hsla\(/i.test(color),
                isValidNumber: (num) => !isNaN(num) && isFinite(num),
                isValidPosition: (x, y) => this.utils.validation.isValidNumber(x) && this.utils.validation.isValidNumber(y),
                isValidSize: (width, height) => width > 0 && height > 0,
                isValidElementType: (type) => ['rectangle', 'circle', 'diamond', 'parallelogram', 'hexagon'].includes(type),
                isValidConnectionType: (type) => ['arrow', 'line', 'dashed', 'dotted'].includes(type)
            },
            
            // Fonctions de manipulation de chaînes
            string: {
                capitalize: (str) => str.charAt(0).toUpperCase() + str.slice(1),
                camelCase: (str) => str.replace(/[-_](.)/g, (_, char) => char.toUpperCase()),
                kebabCase: (str) => str.replace(/([A-Z])/g, '-$1').toLowerCase().replace(/^-/, ''),
                snakeCase: (str) => str.replace(/([A-Z])/g, '_$1').toLowerCase().replace(/^_/, ''),
                truncate: (str, maxLength = 50, suffix = '...') => 
                    str.length > maxLength ? str.slice(0, maxLength - suffix.length) + suffix : str,
                sanitize: (str) => str.replace(/[<>\"'&]/g, (char) => ({
                    '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#x27;', '&': '&amp;'
                })[char]),
                escapeRegex: (str) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
                generateId: (prefix = 'id') => `${prefix}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                formatBytes: (bytes) => {
                    if (bytes === 0) return '0 B';
                    const k = 1024;
                    const sizes = ['B', 'KB', 'MB', 'GB'];
                    const i = Math.floor(Math.log(bytes) / Math.log(k));
                    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
                },
                formatDuration: (ms) => {
                    if (ms < 1000) return `${Math.round(ms)}ms`;
                    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
                    return `${(ms / 60000).toFixed(1)}min`;
                }
            },
            
            // Fonctions de manipulation de tableaux
            array: {
                unique: (arr) => [...new Set(arr)],
                flatten: (arr) => arr.flat(Infinity),
                chunk: (arr, size) => arr.reduce((chunks, item, i) => {
                    const chunkIndex = Math.floor(i / size);
                    if (!chunks[chunkIndex]) chunks[chunkIndex] = [];
                    chunks[chunkIndex].push(item);
                    return chunks;
                }, []),
                groupBy: (arr, key) => arr.reduce((groups, item) => {
                    const group = item[key];
                    groups[group] = groups[group] || [];
                    groups[group].push(item);
                    return groups;
                }, {}),
                sortBy: (arr, key, order = 'asc') => [...arr].sort((a, b) => {
                    const aVal = key(a);
                    const bVal = key(b);
                    return order === 'asc' ? aVal - bVal : bVal - aVal;
                }),
                shuffle: (arr) => {
                    const shuffled = [...arr];
                    for (let i = shuffled.length - 1; i > 0; i--) {
                        const j = Math.floor(Math.random() * (i + 1));
                        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
                    }
                    return shuffled;
                },
                sample: (arr, n = 1) => {
                    const shuffled = this.utils.array.shuffle(arr);
                    return shuffled.slice(0, n);
                }
            },
            
            // Fonctions de manipulation d'objets
            object: {
                deepClone: (obj) => JSON.parse(JSON.stringify(obj)),
                deepMerge: (target, source) => {
                    const result = { ...target };
                    for (const key in source) {
                        if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
                            result[key] = this.utils.object.deepMerge(result[key] || {}, source[key]);
                        } else {
                            result[key] = source[key];
                        }
                    }
                    return result;
                },
                pick: (obj, keys) => {
                    const result = {};
                    keys.forEach(key => {
                        if (key in obj) result[key] = obj[key];
                    });
                    return result;
                },
                omit: (obj, keys) => {
                    const result = { ...obj };
                    keys.forEach(key => delete result[key]);
                    return result;
                },
                has: (obj, path) => {
                    return path.split('.').reduce((current, key) => current && current[key], obj) !== undefined;
                },
                get: (obj, path, defaultValue) => {
                    return path.split('.').reduce((current, key) => current && current[key], obj) || defaultValue;
                },
                set: (obj, path, value) => {
                    const keys = path.split('.');
                    const lastKey = keys.pop();
                    const target = keys.reduce((current, key) => {
                        if (!current[key] || typeof current[key] !== 'object') {
                            current[key] = {};
                        }
                        return current[key];
                    }, obj);
                    target[lastKey] = value;
                    return obj;
                }
            },
            
            // Fonctions DOM
            dom: {
                createElement: (tag, attributes = {}, children = []) => {
                    const element = document.createElement(tag);
                    Object.entries(attributes).forEach(([key, value]) => {
                        if (key === 'className') {
                            element.className = value;
                        } else if (key === 'style' && typeof value === 'object') {
                            Object.assign(element.style, value);
                        } else {
                            element.setAttribute(key, value);
                        }
                    });
                    children.forEach(child => {
                        if (typeof child === 'string') {
                            element.appendChild(document.createTextNode(child));
                        } else {
                            element.appendChild(child);
                        }
                    });
                    return element;
                },
                
                addClass: (element, className) => {
                    if (element.classList) {
                        element.classList.add(className);
                    } else {
                        element.className += ' ' + className;
                    }
                },
                
                removeClass: (element, className) => {
                    if (element.classList) {
                        element.classList.remove(className);
                    } else {
                        element.className = element.className.replace(new RegExp('\\b' + className + '\\b', 'g'), '');
                    }
                },
                
                hasClass: (element, className) => {
                    if (element.classList) {
                        return element.classList.contains(className);
                    }
                    return new RegExp('\\b' + className + '\\b').test(element.className);
                },
                
                getOffset: (element) => {
                    const rect = element.getBoundingClientRect();
                    return {
                        top: rect.top + window.pageYOffset,
                        left: rect.left + window.pageXOffset,
                        width: rect.width,
                        height: rect.height
                    };
                },
                
                getViewport: () => ({
                    width: Math.max(document.documentElement.clientWidth, window.innerWidth || 0),
                    height: Math.max(document.documentElement.clientHeight, window.innerHeight || 0),
                    scrollTop: window.pageYOffset || document.documentElement.scrollTop,
                    scrollLeft: window.pageXOffset || document.documentElement.scrollLeft
                })
            },
            
            // Fonctions mathématiques
            math: {
                clamp: (value, min, max) => Math.min(Math.max(value, min), max),
                lerp: (start, end, factor) => start + (end - start) * factor,
                distance: (x1, y1, x2, y2) => Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2)),
                angle: (x1, y1, x2, y2) => Math.atan2(y2 - y1, x2 - x1),
                random: (min, max) => Math.random() * (max - min) + min,
                randomInt: (min, max) => Math.floor(Math.random() * (max - min + 1)) + min,
                roundTo: (value, decimals) => Math.round(value * Math.pow(10, decimals)) / Math.pow(10, decimals),
                map: (value, inMin, inMax, outMin, outMax) => 
                    (value - inMin) * (outMax - outMin) / (inMax - inMin) + outMin
            },
            
            // Fonctions de cache
            cache: {
                set: (key, value, ttl = 300000) => {
                    const expires = Date.now() + ttl;
                    this.cache.set(key, { value, expires });
                },
                
                get: (key) => {
                    const item = this.cache.get(key);
                    if (!item) return null;
                    
                    if (Date.now() > item.expires) {
                        this.cache.delete(key);
                        return null;
                    }
                    
                    return item.value;
                },
                
                has: (key) => {
                    return this.cache.has(key) && this.cache.get(key).expires > Date.now();
                },
                
                delete: (key) => {
                    this.cache.delete(key);
                },
                
                clear: () => {
                    this.cache.clear();
                },
                
                size: () => {
                    return this.cache.size;
                }
            },
            
            // Fonctions de debounce et throttle
            debounce: (func, wait, immediate = false) => {
                let timeout;
                return function executedFunction(...args) {
                    const later = () => {
                        timeout = null;
                        if (!immediate) func.apply(this, args);
                    };
                    const callNow = immediate && !timeout;
                    clearTimeout(timeout);
                    timeout = setTimeout(later, wait);
                    if (callNow) func.apply(this, args);
                };
            },
            
            throttle: (func, limit) => {
                let inThrottle;
                return function(...args) {
                    if (!inThrottle) {
                        func.apply(this, args);
                        inThrottle = true;
                        setTimeout(() => inThrottle = false, limit);
                    }
                };
            },
            
            // Fonctions de logging
            logger: {
                debug: (...args) => console.debug('[Helper]', ...args),
                info: (...args) => console.info('[Helper]', ...args),
                warn: (...args) => console.warn('[Helper]', ...args),
                error: (...args) => console.error('[Helper]', ...args),
                group: (label) => console.group(`[Helper] ${label}`),
                groupEnd: () => console.groupEnd(),
                time: (label) => console.time(`[Helper] ${label}`),
                timeEnd: (label) => console.timeEnd(`[Helper] ${label}`)
            }
        };
    }

    /**
     * Configuration du bus d'événements
     */
    setupEventBus() {
        this.eventBus = {
            events: {},
            
            on: (event, callback) => {
                if (!this.eventBus.events[event]) {
                    this.eventBus.events[event] = [];
                }
                this.eventBus.events[event].push(callback);
            },
            
            off: (event, callback) => {
                if (this.eventBus.events[event]) {
                    this.eventBus.events[event] = this.eventBus.events[event].filter(cb => cb !== callback);
                }
            },
            
            emit: (event, data) => {
                if (this.eventBus.events[event]) {
                    this.eventBus.events[event].forEach(callback => {
                        try {
                            callback(data);
                        } catch (error) {
                            console.error(`Error in event handler for ${event}:`, error);
                        }
                    });
                }
            },
            
            once: (event, callback) => {
                const onceCallback = (data) => {
                    callback(data);
                    this.eventBus.off(event, onceCallback);
                };
                this.eventBus.on(event, onceCallback);
            }
        };
    }

    /**
     * Configuration des helpers globaux
     */
    setupGlobalHelpers() {
        // Rend les utilitaires disponibles globalement
        window.HelperUtils = this.utils;
        window.HelperModule = this;
        
        // Alias courts pour les fonctions fréquentes
        window.$ = this.utils.dom;
        window.$$ = this.utils;
    }

    /**
     * Traitement principal du module
     */
    async process(data, context = {}) {
        console.log('🔧 HelperModule traite:', data);
        
        // Traite les données selon le type
        if (data.type === 'util_request') {
            return this.handleUtilRequest(data, context);
        }
        
        if (data.type === 'validation_request') {
            return this.handleValidationRequest(data, context);
        }
        
        if (data.type === 'format_request') {
            return this.handleFormatRequest(data, context);
        }
        
        if (data.type === 'cache_request') {
            return this.handleCacheRequest(data, context);
        }
        
        if (data.type === 'math_request') {
            return this.handleMathRequest(data, context);
        }
        
        if (data.type === 'dom_request') {
            return this.handleDOMRequest(data, context);
        }
        
        // Pass-through par défaut
        return data;
    }

    /**
     * Gère les demandes d'utilitaires
     */
    handleUtilRequest(data, context) {
        const { util, args = [] } = data;
        
        try {
            const result = this.executeUtil(util, args);
            
            return {
                ...data,
                success: true,
                result: result,
                executed: util
            };
            
        } catch (error) {
            return {
                ...data,
                success: false,
                error: error.message,
                executed: util
            };
        }
    }

    /**
     * Gère les demandes de validation
     */
    handleValidationRequest(data, context) {
        const { validation, value, args = [] } = data;
        
        try {
            const validator = this.utils.validation[validation];
            if (!validator) {
                throw new Error(`Validateur ${validation} non trouvé`);
            }
            
            const result = validator(value, ...args);
            
            return {
                ...data,
                success: true,
                valid: result,
                validation: validation
            };
            
        } catch (error) {
            return {
                ...data,
                success: false,
                error: error.message,
                validation: validation
            };
        }
    }

    /**
     * Gère les demandes de formatage
     */
    handleFormatRequest(data, context) {
        const { format, value, options = {} } = data;
        
        try {
            let result;
            
            switch (format) {
                case 'capitalize':
                    result = this.utils.string.capitalize(value);
                    break;
                case 'kebabCase':
                    result = this.utils.string.kebabCase(value);
                    break;
                case 'camelCase':
                    result = this.utils.string.camelCase(value);
                    break;
                case 'snakeCase':
                    result = this.utils.string.snakeCase(value);
                    break;
                case 'truncate':
                    result = this.utils.string.truncate(value, options.maxLength, options.suffix);
                    break;
                case 'sanitize':
                    result = this.utils.string.sanitize(value);
                    break;
                case 'formatBytes':
                    result = this.utils.string.formatBytes(value);
                    break;
                case 'formatDuration':
                    result = this.utils.string.formatDuration(value);
                    break;
                default:
                    throw new Error(`Format ${format} non supporté`);
            }
            
            return {
                ...data,
                success: true,
                result: result,
                format: format
            };
            
        } catch (error) {
            return {
                ...data,
                success: false,
                error: error.message,
                format: format
            };
        }
    }

    /**
     * Gère les demandes de cache
     */
    handleCacheRequest(data, context) {
        const { action, key, value, options = {} } = data;
        
        try {
            let result;
            
            switch (action) {
                case 'set':
                    this.utils.cache.set(key, value, options.ttl);
                    result = true;
                    break;
                case 'get':
                    result = this.utils.cache.get(key);
                    break;
                case 'has':
                    result = this.utils.cache.has(key);
                    break;
                case 'delete':
                    this.utils.cache.delete(key);
                    result = true;
                    break;
                case 'clear':
                    this.utils.cache.clear();
                    result = true;
                    break;
                case 'size':
                    result = this.utils.cache.size();
                    break;
                default:
                    throw new Error(`Action cache ${action} non supportée`);
            }
            
            return {
                ...data,
                success: true,
                result: result,
                action: action
            };
            
        } catch (error) {
            return {
                ...data,
                success: false,
                error: error.message,
                action: action
            };
        }
    }

    /**
     * Gère les demandes mathématiques
     */
    handleMathRequest(data, context) {
        const { operation, values = [] } = data;
        
        try {
            let result;
            
            switch (operation) {
                case 'clamp':
                    result = this.utils.math.clamp(values[0], values[1], values[2]);
                    break;
                case 'lerp':
                    result = this.utils.math.lerp(values[0], values[1], values[2]);
                    break;
                case 'distance':
                    result = this.utils.math.distance(values[0], values[1], values[2], values[3]);
                    break;
                case 'angle':
                    result = this.utils.math.angle(values[0], values[1], values[2], values[3]);
                    break;
                case 'random':
                    result = this.utils.math.random(values[0], values[1]);
                    break;
                case 'randomInt':
                    result = this.utils.math.randomInt(values[0], values[1]);
                    break;
                case 'roundTo':
                    result = this.utils.math.roundTo(values[0], values[1]);
                    break;
                case 'map':
                    result = this.utils.math.map(values[0], values[1], values[2], values[3], values[4]);
                    break;
                default:
                    throw new Error(`Opération math ${operation} non supportée`);
            }
            
            return {
                ...data,
                success: true,
                result: result,
                operation: operation
            };
            
        } catch (error) {
            return {
                ...data,
                success: false,
                error: error.message,
                operation: operation
            };
        }
    }

    /**
     * Gère les demandes DOM
     */
    handleDOMRequest(data, context) {
        const { operation, selector, attributes = {}, children = [] } = data;
        
        try {
            let result;
            
            switch (operation) {
                case 'createElement':
                    result = this.utils.dom.createElement(selector, attributes, children);
                    break;
                case 'addClass':
                    this.utils.dom.addClass(document.querySelector(selector), attributes.className);
                    result = true;
                    break;
                case 'removeClass':
                    this.utils.dom.removeClass(document.querySelector(selector), attributes.className);
                    result = true;
                    break;
                case 'hasClass':
                    result = this.utils.dom.hasClass(document.querySelector(selector), attributes.className);
                    break;
                case 'getOffset':
                    result = this.utils.dom.getOffset(document.querySelector(selector));
                    break;
                case 'getViewport':
                    result = this.utils.dom.getViewport();
                    break;
                default:
                    throw new Error(`Opération DOM ${operation} non supportée`);
            }
            
            return {
                ...data,
                success: true,
                result: result,
                operation: operation
            };
            
        } catch (error) {
            return {
                ...data,
                success: false,
                error: error.message,
                operation: operation
            };
        }
    }

    /**
     * Exécute une fonction utilitaire
     */
    executeUtil(util, args) {
        const parts = util.split('.');
        let current = this.utils;
        
        for (const part of parts) {
            if (current && typeof current === 'object' && part in current) {
                current = current[part];
            } else {
                throw new Error(`Utilitaire ${util} non trouvé`);
            }
        }
        
        if (typeof current !== 'function') {
            throw new Error(`${util} n'est pas une fonction`);
        }
        
        return current.apply(this.utils, args);
    }

    /**
      * Définit le trigger associé
      */
     setTrigger(trigger) {
         this.trigger = trigger;
         console.log('Trigger associé au HelperModule');
     }

     /**
      * Obtient le trigger associé
      */
     getTrigger() {
         return this.trigger;
     }

     /**
      * Obtient des statistiques
      */
     getStats() {
         return {
             isInitialized: this.isInitialized,
             cacheSize: this.utils.cache.size(),
             utilsCount: this.countUtils(),
             eventListeners: Object.keys(this.eventBus.events).length,
             memoryUsage: this.estimateMemoryUsage()
         };
     }

    /**
     * Compte les fonctions utilitaires
     */
    countUtils() {
        let count = 0;
        const countFunctions = (obj) => {
            Object.values(obj).forEach(value => {
                if (typeof value === 'function') {
                    count++;
                } else if (typeof value === 'object' && value !== null) {
                    countFunctions(value);
                }
            });
        };
        countFunctions(this.utils);
        return count;
    }

    /**
     * Estime l'utilisation mémoire
     */
    estimateMemoryUsage() {
        // Estimation simplifiée
        const cacheSize = this.utils.cache.size();
        const baseSize = 1024; // 1KB de base
        const perItemSize = 100; // 100 bytes par élément de cache
        return baseSize + (cacheSize * perItemSize);
    }
}

// ===== TRIGGER CHAIN =====
window.HelperModule = HelperModule;

export { HelperModule };