/**
 * UTILITAIRES HELPER-80
 * Fonctions utilitaires spécifiques au module HelperModule
 */

/**
 * Classe utilitaire pour les opérations avancées
 */
class HelperUtils {
    constructor(config = {}) {
        this.config = config;
        this.cache = new Map();
        this.timers = new Map();
    }

    /**
     * Génère un UUID v4
     */
    generateUUID() {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
            const r = Math.random() * 16 | 0;
            const v = c === 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });
    }

    /**
     * Génère un ID court et unique
     */
    generateShortId(prefix = 'id') {
        const timestamp = Date.now().toString(36);
        const random = Math.random().toString(36).substr(2, 5);
        return `${prefix}-${timestamp}-${random}`;
    }

    /**
     * Génère un ID séquentiel
     */
    generateSequentialId(prefix = 'seq', start = 1) {
        if (!this.sequentialCounter) {
            this.sequentialCounter = start;
        }
        return `${prefix}-${this.sequentialCounter++}`;
    }

    /**
     * Calcule un hash simple (FNV-1a)
     */
    hashString(str) {
        let hash = 2166136261;
        for (let i = 0; i < str.length; i++) {
            hash ^= str.charCodeAt(i);
            hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
        }
        return hash >>> 0;
    }

    /**
     * Compare deux objets en profondeur
     */
    deepEqual(obj1, obj2) {
        if (obj1 === obj2) return true;
        
        if (obj1 == null || obj2 == null) return false;
        if (typeof obj1 !== typeof obj2) return false;
        
        if (typeof obj1 !== 'object') return false;
        
        const keys1 = Object.keys(obj1);
        const keys2 = Object.keys(obj2);
        
        if (keys1.length !== keys2.length) return false;
        
        for (const key of keys1) {
            if (!keys2.includes(key)) return false;
            if (!this.deepEqual(obj1[key], obj2[key])) return false;
        }
        
        return true;
    }

    /**
     * Clone un objet en profondeur
     */
    deepClone(obj) {
        if (obj === null || typeof obj !== 'object') return obj;
        if (obj instanceof Date) return new Date(obj.getTime());
        if (obj instanceof Array) return obj.map(item => this.deepClone(item));
        if (obj instanceof Object) {
            const cloned = {};
            for (const key in obj) {
                if (obj.hasOwnProperty(key)) {
                    cloned[key] = this.deepClone(obj[key]);
                }
            }
            return cloned;
        }
        return obj;
    }

    /**
     * Fusionne des objets en profondeur
     */
    deepMerge(target, ...sources) {
        if (!sources.length) return target;
        const source = sources.shift();
        
        if (this.isObject(target) && this.isObject(source)) {
            for (const key in source) {
                if (this.isObject(source[key])) {
                    if (!target[key]) Object.assign(target, { [key]: {} });
                    this.deepMerge(target[key], source[key]);
                } else {
                    Object.assign(target, { [key]: source[key] });
                }
            }
        }
        
        return this.deepMerge(target, ...sources);
    }

    /**
     * Vérifie si une valeur est un objet
     */
    isObject(item) {
        return item && typeof item === 'object' && !Array.isArray(item);
    }

    /**
     * Obtient une valeur imbriquée dans un objet
     */
    getNestedValue(obj, path, defaultValue = undefined) {
        const keys = path.split('.');
        let result = obj;
        
        for (const key of keys) {
            if (result == null || typeof result !== 'object') {
                return defaultValue;
            }
            result = result[key];
        }
        
        return result !== undefined ? result : defaultValue;
    }

    /**
     * Définit une valeur imbriquée dans un objet
     */
    setNestedValue(obj, path, value) {
        const keys = path.split('.');
        const lastKey = keys.pop();
        let current = obj;
        
        for (const key of keys) {
            if (current[key] == null || typeof current[key] !== 'object') {
                current[key] = {};
            }
            current = current[key];
        }
        
        current[lastKey] = value;
        return obj;
    }

    /**
     * Groupe un tableau par une clé
     */
    groupBy(array, key) {
        return array.reduce((groups, item) => {
            const group = item[key];
            groups[group] = groups[group] || [];
            groups[group].push(item);
            return groups;
        }, {});
    }

    /**
     * Partitionne un tableau selon un prédicat
     */
    partition(array, predicate) {
        const truthy = [];
        const falsy = [];
        
        for (const item of array) {
            if (predicate(item)) {
                truthy.push(item);
            } else {
                falsy.push(item);
            }
        }
        
        return [truthy, falsy];
    }

    /**
     * Mélange un tableau (Fisher-Yates)
     */
    shuffle(array) {
        const shuffled = [...array];
        for (let i = shuffled.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
        }
        return shuffled;
    }

    /**
     * Échantillonne des éléments d'un tableau
     */
    sample(array, n = 1) {
        const shuffled = this.shuffle(array);
        return shuffled.slice(0, n);
    }

    /**
     * Crée un débounce
     */
    debounce(func, wait, immediate = false) {
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
    }

    /**
     * Crée un throttle
     */
    throttle(func, limit) {
        let inThrottle;
        return function(...args) {
            if (!inThrottle) {
                func.apply(this, args);
                inThrottle = true;
                setTimeout(() => inThrottle = false, limit);
            }
        };
    }

    /**
     * Mesure le temps d'exécution d'une fonction
     */
    measureTime(func, ...args) {
        const start = performance.now();
        const result = func(...args);
        const end = performance.now();
        
        return {
            result,
            executionTime: end - start,
            timestamp: Date.now()
        };
    }

    /**
     * Mesure l'utilisation mémoire (approximation)
     */
    measureMemory(obj) {
        const objectSize = this.estimateObjectSize(obj);
        return {
            size: objectSize,
            unit: 'bytes',
            humanReadable: this.formatBytes(objectSize)
        };
    }

    /**
     * Estime la taille d'un objet en mémoire
     */
    estimateObjectSize(obj) {
        const seen = new WeakSet();
        
        const sizeOf = (obj) => {
            if (obj === null) return 0;
            if (typeof obj !== 'object') return typeof obj === 'string' ? obj.length * 2 : 8;
            
            if (seen.has(obj)) return 0;
            seen.add(obj);
            
            let size = 0;
            for (const key in obj) {
                size += typeof key === 'string' ? key.length * 2 : 8;
                size += sizeOf(obj[key]);
            }
            
            return size;
        };
        
        return sizeOf(obj);
    }

    /**
     * Formate des bytes en unités lisibles
     */
    formatBytes(bytes, decimals = 2) {
        if (bytes === 0) return '0 Bytes';
        
        const k = 1024;
        const dm = decimals < 0 ? 0 : decimals;
        const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
        
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        
        return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
    }

    /**
     * Crée un cache simple avec TTL
     */
    createCache(ttl = 300000) { // 5 minutes par défaut
        const cache = new Map();
        const timers = new Map();
        
        const set = (key, value, customTtl = ttl) => {
            // Supprime l'ancienne entrée si elle existe
            if (cache.has(key)) {
                clearTimeout(timers.get(key));
            }
            
            // Ajoute la nouvelle entrée
            cache.set(key, value);
            
            // Programme la suppression
            const timer = setTimeout(() => {
                cache.delete(key);
                timers.delete(key);
            }, customTtl);
            
            timers.set(key, timer);
        };
        
        const get = (key) => {
            return cache.get(key);
        };
        
        const has = (key) => {
            return cache.has(key);
        };
        
        const clear = () => {
            for (const timer of timers.values()) {
                clearTimeout(timer);
            }
            cache.clear();
            timers.clear();
        };
        
        const size = () => {
            return cache.size;
        };
        
        return { set, get, has, clear, size };
    }

    /**
     * Valide un email
     */
    validateEmail(email) {
        const pattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return pattern.test(email);
    }

    /**
     * Valide une URL
     */
    validateUrl(url) {
        try {
            new URL(url);
            return true;
        } catch {
            return false;
        }
    }

    /**
     * Valide un UUID
     */
    validateUUID(uuid) {
        const pattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        return pattern.test(uuid);
    }

    /**
     * Échappe le HTML
     */
    escapeHtml(text) {
        const map = {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#039;'
        };
        
        return text.replace(/[&<>"']/g, (m) => map[m]);
    }

    /**
     * Supprime les balises HTML
     */
    stripTags(html) {
        return html.replace(/<[^>]*>/g, '');
    }

    /**
     * Convertit en camelCase
     */
    toCamelCase(str) {
        return str.replace(/[-_\s]+(.)?/g, (_, char) => char ? char.toUpperCase() : '');
    }

    /**
     * Convertit en kebab-case
     */
    toKebabCase(str) {
        return str.replace(/([a-z])([A-Z])/g, '$1-$2').replace(/[\s_]+/g, '-').toLowerCase();
    }

    /**
     * Convertit en snake_case
     */
    toSnakeCase(str) {
        return str.replace(/([a-z])([A-Z])/g, '$1_$2').replace(/[\s-]+/g, '_').toLowerCase();
    }

    /**
     * Convertit en PascalCase
     */
    toPascalCase(str) {
        return str.replace(/(?:^|[-_\s]+)(.)?/g, (_, char) => char ? char.toUpperCase() : '');
    }

    /**
     * Convertit en Title Case
     */
    toTitleCase(str) {
        return str.replace(/\w\S*/g, (txt) => 
            txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase()
        );
    }

    /**
     * Crée un slug
     */
    toSlug(str) {
        return str
            .toLowerCase()
            .trim()
            .replace(/[^\w\s-]/g, '')
            .replace(/[\s_-]+/g, '-')
            .replace(/^-+|-+$/g, '');
    }

    /**
     * Tronque une chaîne
     */
    truncate(str, length = 100, suffix = '...') {
        if (str.length <= length) return str;
        return str.substr(0, length) + suffix;
    }

    /**
     * Remplit une chaîne
     */
    pad(str, length, char = ' ', side = 'start') {
        if (str.length >= length) return str;
        
        const padding = char.repeat(length - str.length);
        return side === 'start' ? padding + str : str + padding;
    }

    /**
     * Répète une chaîne
     */
    repeat(str, count) {
        return str.repeat(count);
    }

    /**
     * Inverse une chaîne
     */
    reverse(str) {
        return str.split('').reverse().join('');
    }

    /**
     * Met en majuscule la première lettre
     */
    capitalize(str) {
        return str.charAt(0).toUpperCase() + str.slice(1);
    }

    /**
     * Met en minuscule la première lettre
     */
    uncapitalize(str) {
        return str.charAt(0).toLowerCase() + str.slice(1);
    }

    /**
     * Divise un tableau en morceaux
     */
    chunk(array, size) {
        const chunks = [];
        for (let i = 0; i < array.length; i += size) {
            chunks.push(array.slice(i, i + size));
        }
        return chunks;
    }

    /**
     * Aplatit un tableau
     */
    flatten(array, depth = 1) {
        return depth > 0 ? array.reduce((acc, val) => 
            acc.concat(Array.isArray(val) ? this.flatten(val, depth - 1) : val), []) : array.slice();
    }

    /**
     * Obtient les valeurs uniques d'un tableau
     */
    unique(array) {
        return [...new Set(array)];
    }

    /**
     * Trie un tableau par une clé
     */
    sortBy(array, key) {
        return [...array].sort((a, b) => {
            const aVal = this.getNestedValue(a, key);
            const bVal = this.getNestedValue(b, key);
            return aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
        });
    }

    /**
     * Obtient les propriétés d'un objet
     */
    pick(obj, keys) {
        const result = {};
        for (const key of keys) {
            if (key in obj) {
                result[key] = obj[key];
            }
        }
        return result;
    }

    /**
     * Ignore les propriétés d'un objet
     */
    omit(obj, keys) {
        const result = { ...obj };
        for (const key of keys) {
            delete result[key];
        }
        return result;
    }

    /**
     * Limite une valeur entre un minimum et un maximum
     */
    clamp(value, min, max) {
        return Math.min(Math.max(value, min), max);
    }

    /**
     * Interpolation linéaire
     */
    lerp(start, end, factor) {
        return start + (end - start) * factor;
    }

    /**
     * Mappe une valeur d'une plage à une autre
     */
    map(value, inMin, inMax, outMin, outMax) {
        return (value - inMin) * (outMax - outMin) / (inMax - inMin) + outMin;
    }

    /**
     * Calcule la distance entre deux points
     */
    distance(x1, y1, x2, y2) {
        return Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2));
    }

    /**
     * Calcule l'angle entre deux points
     */
    angle(x1, y1, x2, y2) {
        return Math.atan2(y2 - y1, x2 - x1);
    }

    /**
     * Génère un nombre aléatoire
     */
    random(min = 0, max = 1) {
        return Math.random() * (max - min) + min;
    }

    /**
     * Génère un entier aléatoire
     */
    randomInt(min = 0, max = 1) {
        return Math.floor(this.random(min, max + 1));
    }

    /**
     * Convertit des degrés en radians
     */
    degToRad(degrees) {
        return degrees * (Math.PI / 180);
    }

    /**
     * Convertit des radians en degrés
     */
    radToDeg(radians) {
        return radians * (180 / Math.PI);
    }

    /**
     * Arrondit à n décimales
     */
    round(value, decimals = 0) {
        return Math.round(value * Math.pow(10, decimals)) / Math.pow(10, decimals);
    }

    /**
     * Obtient le signe d'un nombre
     */
    sign(value) {
        return value < 0 ? -1 : value > 0 ? 1 : 0;
    }

    /**
     * Obtient la valeur absolue
     */
    abs(value) {
        return Math.abs(value);
    }

    /**
     * Obtient le minimum d'un tableau
     */
    min(array) {
        return Math.min(...array);
    }

    /**
     * Obtient le maximum d'un tableau
     */
    max(array) {
        return Math.max(...array);
    }

    /**
     * Obtient la somme d'un tableau
     */
    sum(array) {
        return array.reduce((acc, val) => acc + val, 0);
    }

    /**
     * Obtient la moyenne d'un tableau
     */
    average(array) {
        return this.sum(array) / array.length;
    }

    /**
     * Obtient la médiane d'un tableau
     */
    median(array) {
        const sorted = [...array].sort((a, b) => a - b);
        const mid = Math.floor(sorted.length / 2);
        return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
    }

    /**
     * Obtient le mode d'un tableau
     */
    mode(array) {
        const frequency = {};
        let maxFreq = 0;
        let modes = [];
        
        for (const num of array) {
            frequency[num] = (frequency[num] || 0) + 1;
            if (frequency[num] > maxFreq) {
                maxFreq = frequency[num];
                modes = [num];
            } else if (frequency[num] === maxFreq) {
                modes.push(num);
            }
        }
        
        return modes;
    }

    /**
     * Obtient les statistiques d'un tableau
     */
    statistics(array) {
        return {
            min: this.min(array),
            max: this.max(array),
            sum: this.sum(array),
            average: this.average(array),
            median: this.median(array),
            mode: this.mode(array),
            count: array.length
        };
    }

    /**
     * Nettoie les données
     */
    sanitize(data) {
        if (typeof data === 'string') {
            return this.escapeHtml(data);
        }
        
        if (typeof data === 'object' && data !== null) {
            const sanitized = {};
            for (const key in data) {
                if (data.hasOwnProperty(key)) {
                    sanitized[key] = this.sanitize(data[key]);
                }
            }
            return sanitized;
        }
        
        return data;
    }

    /**
     * Valide des données selon un schéma
     */
    validate(data, schema) {
        const errors = [];
        
        for (const field in schema) {
            const rules = schema[field];
            const value = data[field];
            
            if (rules.required && (value === undefined || value === null || value === '')) {
                errors.push(`${field} est requis`);
                continue;
            }
            
            if (value !== undefined && value !== null) {
                if (rules.type && typeof value !== rules.type) {
                    errors.push(`${field} doit être de type ${rules.type}`);
                }
                
                if (rules.pattern && !rules.pattern.test(value)) {
                    errors.push(`${field} ne correspond pas au pattern requis`);
                }
                
                if (rules.minLength && value.length < rules.minLength) {
                    errors.push(`${field} doit avoir au moins ${rules.minLength} caractères`);
                }
                
                if (rules.maxLength && value.length > rules.maxLength) {
                    errors.push(`${field} ne doit pas dépasser ${rules.maxLength} caractères`);
                }
                
                if (rules.min && value < rules.min) {
                    errors.push(`${field} doit être au moins ${rules.min}`);
                }
                
                if (rules.max && value > rules.max) {
                    errors.push(`${field} ne doit pas dépasser ${rules.max}`);
                }
            }
        }
        
        return {
            valid: errors.length === 0,
            errors: errors
        };
    }

    /**
     * Obtient les statistiques des utilitaires
     */
    getStats() {
        return {
            cacheSize: this.cache.size,
            timerCount: this.timers.size,
            methods: Object.getOwnPropertyNames(HelperUtils.prototype).filter(name => 
                name !== 'constructor' && typeof this[name] === 'function'
            ).length
        };
    }
}

// ===== FONCTIONS UTILITAIRES INDÉPENDANTES =====

/**
 * Génère un UUID v4
 */
export function generateUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        const r = Math.random() * 16 | 0;
        const v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}

/**
 * Génère un ID court et unique
 */
export function generateShortId(prefix = 'id') {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substr(2, 5);
    return `${prefix}-${timestamp}-${random}`;
}

/**
 * Calcule un hash simple
 */
export function hashString(str) {
    let hash = 2166136261;
    for (let i = 0; i < str.length; i++) {
        hash ^= str.charCodeAt(i);
        hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
    }
    return hash >>> 0;
}

/**
 * Clone un objet en profondeur
 */
export function deepClone(obj) {
    if (obj === null || typeof obj !== 'object') return obj;
    if (obj instanceof Date) return new Date(obj.getTime());
    if (obj instanceof Array) return obj.map(item => deepClone(item));
    if (obj instanceof Object) {
        const cloned = {};
        for (const key in obj) {
            if (obj.hasOwnProperty(key)) {
                cloned[key] = deepClone(obj[key]);
            }
        }
        return cloned;
    }
    return obj;
}

/**
 * Fusionne des objets en profondeur
 */
export function deepMerge(target, ...sources) {
    if (!sources.length) return target;
    const source = sources.shift();
    
    if (isObject(target) && isObject(source)) {
        for (const key in source) {
            if (isObject(source[key])) {
                if (!target[key]) Object.assign(target, { [key]: {} });
                deepMerge(target[key], source[key]);
            } else {
                Object.assign(target, { [key]: source[key] });
            }
        }
    }
    
    return deepMerge(target, ...sources);
}

/**
 * Vérifie si une valeur est un objet
 */
function isObject(item) {
    return item && typeof item === 'object' && !Array.isArray(item);
}

/**
 * Crée un débounce
 */
export function debounce(func, wait, immediate = false) {
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
}

/**
 * Crée un throttle
 */
export function throttle(func, limit) {
    let inThrottle;
    return function(...args) {
        if (!inThrottle) {
            func.apply(this, args);
            inThrottle = true;
            setTimeout(() => inThrottle = false, limit);
        }
    };
}

/**
 * Mesure le temps d'exécution
 */
export function measureTime(func, ...args) {
    const start = performance.now();
    const result = func(...args);
    const end = performance.now();
    
    return {
        result,
        executionTime: end - start,
        timestamp: Date.now()
    };
}

/**
 * Formate des bytes
 */
export function formatBytes(bytes, decimals = 2) {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

/**
 * Convertit en camelCase
 */
export function toCamelCase(str) {
    return str.replace(/[-_\s]+(.)?/g, (_, char) => char ? char.toUpperCase() : '');
}

/**
 * Convertit en kebab-case
 */
export function toKebabCase(str) {
    return str.replace(/([a-z])([A-Z])/g, '$1-$2').replace(/[\s_]+/g, '-').toLowerCase();
}

/**
 * Convertit en snake_case
 */
export function toSnakeCase(str) {
    return str.replace(/([a-z])([A-Z])/g, '$1_$2').replace(/[\s-]+/g, '_').toLowerCase();
}

/**
 * Crée un slug
 */
export function toSlug(str) {
    return str
        .toLowerCase()
        .trim()
        .replace(/[^\w\s-]/g, '')
        .replace(/[\s_-]+/g, '-')
        .replace(/^-+|-+$/g, '');
}

/**
 * Tronque une chaîne
 */
export function truncate(str, length = 100, suffix = '...') {
    if (str.length <= length) return str;
    return str.substr(0, length) + suffix;
}

/**
 * Échappe le HTML
 */
export function escapeHtml(text) {
    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    };
    
    return text.replace(/[&<>"']/g, (m) => map[m]);
}

/**
 * Valide un email
 */
export function validateEmail(email) {
    const pattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return pattern.test(email);
}

/**
 * Valide une URL
 */
export function validateUrl(url) {
    try {
        new URL(url);
        return true;
    } catch {
        return false;
    }
}

/**
 * Obtient un timestamp unique
 */
export function getTimestamp() {
    return Date.now();
}

/**
 * Obtient une date formatée
 */
export function formatDate(date = new Date(), format = 'YYYY-MM-DD HH:mm:ss') {
    const d = new Date(date);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    const seconds = String(d.getSeconds()).padStart(2, '0');
    
    return format
        .replace('YYYY', year)
        .replace('MM', month)
        .replace('DD', day)
        .replace('HH', hours)
        .replace('mm', minutes)
        .replace('ss', seconds);
}

// ===== EXPORTATIONS =====
export { HelperUtils };
export default HelperUtils;