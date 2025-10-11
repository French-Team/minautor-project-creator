/**
 * LOGGER 80-HELPER
 * Système de journalisation pour le module HelperModule
 */

class HelperLogger {
    constructor(config = {}) {
        this.config = {
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
            retention: 3600000, // 1 heure
            ...config
        };
        
        this.logs = [];
        this.levels = {
            debug: 0,
            info: 1,
            warn: 2,
            error: 3
        };
        
        this.startCleanupTimer();
    }

    /**
     * Définit le niveau de journalisation
     */
    setLevel(level) {
        if (this.levels.hasOwnProperty(level)) {
            this.config.level = level;
        }
    }

    /**
     * Active/désactive la journalisation
     */
    setEnabled(enabled) {
        this.config.enabled = enabled;
    }

    /**
     * Configure les destinations
     */
    setDestinations(destinations) {
        this.config.destinations = { ...this.config.destinations, ...destinations };
    }

    /**
     * Journalise un message de débogage
     */
    debug(message, data = null, context = {}) {
        this.log('debug', message, data, context);
    }

    /**
     * Journalise un message d'information
     */
    info(message, data = null, context = {}) {
        this.log('info', message, data, context);
    }

    /**
     * Journalise un avertissement
     */
    warn(message, data = null, context = {}) {
        this.log('warn', message, data, context);
    }

    /**
     * Journalise une erreur
     */
    error(message, data = null, context = {}) {
        this.log('error', message, data, context);
    }

    /**
     * Journalise un message
     */
    log(level, message, data = null, context = {}) {
        if (!this.config.enabled) return;
        
        // Vérifie le niveau
        if (this.levels[level] < this.levels[this.config.level]) return;
        
        const entry = this.createLogEntry(level, message, data, context);
        
        // Ajoute à la mémoire
        this.logs.push(entry);
        
        // Limite la taille
        if (this.logs.length > this.config.maxEntries) {
            this.logs.shift();
        }
        
        // Envoie aux destinations
        this.sendToDestinations(entry);
    }

    /**
     * Crée une entrée de journal
     */
    createLogEntry(level, message, data, context) {
        const entry = {
            timestamp: new Date().toISOString(),
            level: level,
            message: message,
            moduleId: '80-helper',
            ...context
        };
        
        if (data !== null) {
            entry.data = this.sanitizeData(data);
        }
        
        return entry;
    }

    /**
     * Envoie aux destinations configurées
     */
    sendToDestinations(entry) {
        if (this.config.destinations.console) {
            this.sendToConsole(entry);
        }
        
        if (this.config.destinations.file) {
            this.sendToFile(entry);
        }
        
        if (this.config.destinations.remote) {
            this.sendToRemote(entry);
        }
    }

    /**
     * Envoie à la console
     */
    sendToConsole(entry) {
        const formatted = this.formatConsoleEntry(entry);
        
        switch (entry.level) {
            case 'debug':
                console.debug(formatted, entry.data || '');
                break;
            case 'info':
                console.info(formatted, entry.data || '');
                break;
            case 'warn':
                console.warn(formatted, entry.data || '');
                break;
            case 'error':
                console.error(formatted, entry.data || '');
                break;
            default:
                console.log(formatted, entry.data || '');
        }
    }

    /**
     * Formate une entrée pour la console
     */
    formatConsoleEntry(entry) {
        const parts = [];
        
        if (this.config.format.timestamp) {
            parts.push(`[${entry.timestamp}]`);
        }
        
        if (this.config.format.moduleId) {
            parts.push(`[${entry.moduleId}]`);
        }
        
        if (this.config.format.level) {
            parts.push(`[${entry.level.toUpperCase()}]`);
        }
        
        if (this.config.format.message) {
            parts.push(entry.message);
        }
        
        return parts.join(' ');
    }

    /**
     * Envoie à un fichier
     */
    sendToFile(entry) {
        // Implémentation simplifiée - dans un vrai système, utiliser File API ou serveur
        if (typeof window !== 'undefined' && window.localStorage) {
            const key = `80-helper-logs-${new Date().toISOString().split('T')[0]}`;
            const existing = JSON.parse(localStorage.getItem(key) || '[]');
            existing.push(entry);
            localStorage.setItem(key, JSON.stringify(existing));
        }
    }

    /**
     * Envoie à une destination distante
     */
    sendToRemote(entry) {
        // Implémentation simplifiée - dans un vrai système, utiliser fetch ou WebSocket
        if (typeof window !== 'undefined' && window.navigator.sendBeacon) {
            const endpoint = '/api/logs';
            const data = new Blob([JSON.stringify(entry)], { type: 'application/json' });
            navigator.sendBeacon(endpoint, data);
        }
    }

    /**
     * Sanitize les données sensibles
     */
    sanitizeData(data) {
        if (typeof data === 'string') {
            // Supprime les données sensibles
            return data.replace(/password|token|secret|key/gi, '[REDACTED]');
        }
        
        if (typeof data === 'object' && data !== null) {
            const sanitized = {};
            for (const key in data) {
                if (data.hasOwnProperty(key)) {
                    if (this.isSensitiveKey(key)) {
                        sanitized[key] = '[REDACTED]';
                    } else {
                        sanitized[key] = this.sanitizeData(data[key]);
                    }
                }
            }
            return sanitized;
        }
        
        return data;
    }

    /**
     * Vérifie si une clé est sensible
     */
    isSensitiveKey(key) {
        const sensitivePatterns = [
            'password', 'token', 'secret', 'key', 'auth', 'credential',
            'private', 'api_key', 'apikey', 'access_token', 'refresh_token'
        ];
        
        const lowerKey = key.toLowerCase();
        return sensitivePatterns.some(pattern => lowerKey.includes(pattern));
    }

    /**
     * Obtient les logs récents
     */
    getRecentLogs(level = null, limit = 100) {
        let logs = [...this.logs];
        
        if (level) {
            logs = logs.filter(log => log.level === level);
        }
        
        return logs.slice(-limit);
    }

    /**
     * Obtient les logs par niveau
     */
    getLogsByLevel(level) {
        return this.logs.filter(log => log.level === level);
    }

    /**
     * Obtient les statistiques de journalisation
     */
    getStats() {
        const stats = {
            total: this.logs.length,
            byLevel: {},
            byHour: {},
            recent: this.logs.slice(-10).map(log => ({
                timestamp: log.timestamp,
                level: log.level,
                message: log.message
            }))
        };
        
        // Compte par niveau
        for (const log of this.logs) {
            stats.byLevel[log.level] = (stats.byLevel[log.level] || 0) + 1;
        }
        
        // Compte par heure
        for (const log of this.logs) {
            const hour = log.timestamp.split('T')[1].split(':')[0];
            const key = `hour-${hour}`;
            stats.byHour[key] = (stats.byHour[key] || 0) + 1;
        }
        
        return stats;
    }

    /**
     * Efface les logs
     */
    clear() {
        this.logs = [];
        this.info('Logs effacés');
    }

    /**
     * Exporte les logs
     */
    exportLogs(format = 'json') {
        const data = {
            exportDate: new Date().toISOString(),
            config: this.config,
            logs: this.logs
        };
        
        switch (format) {
            case 'json':
                return JSON.stringify(data, null, 2);
            case 'csv':
                return this.exportAsCSV();
            case 'txt':
                return this.exportAsTXT();
            default:
                return JSON.stringify(data);
        }
    }

    /**
     * Exporte en CSV
     */
    exportAsCSV() {
        const headers = ['timestamp', 'level', 'moduleId', 'message', 'data'];
        const rows = this.logs.map(log => [
            log.timestamp,
            log.level,
            log.moduleId,
            `"${log.message.replace(/"/g, '""')}"`,
            log.data ? `"${JSON.stringify(log.data).replace(/"/g, '""')}"` : ''
        ]);
        
        return [headers.join(','), ...rows.map(row => row.join(','))].join('\n');
    }

    /**
     * Exporte en TXT
     */
    exportAsTXT() {
        return this.logs.map(log => {
            let entry = `[${log.timestamp}] [${log.level}] [${log.moduleId}] ${log.message}`;
            if (log.data) {
                entry += `\n  Données: ${JSON.stringify(log.data, null, 2)}`;
            }
            return entry;
        }).join('\n');
    }

    /**
     * Démarre le timer de nettoyage
     */
    startCleanupTimer() {
        if (this.cleanupTimer) {
            clearInterval(this.cleanupTimer);
        }
        
        this.cleanupTimer = setInterval(() => {
            this.cleanup();
        }, this.config.retention / 2);
    }

    /**
     * Nettoie les anciens logs
     */
    cleanup() {
        const cutoff = new Date(Date.now() - this.config.retention);
        const initialLength = this.logs.length;
        
        this.logs = this.logs.filter(log => {
            const logDate = new Date(log.timestamp);
            return logDate >= cutoff;
        });
        
        const removed = initialLength - this.logs.length;
        if (removed > 0) {
            this.debug(`Nettoyage: ${removed} anciens logs supprimés`);
        }
    }

    /**
     * Arrête le logger
     */
    destroy() {
        if (this.cleanupTimer) {
            clearInterval(this.cleanupTimer);
            this.cleanupTimer = null;
        }
        
        this.info('Logger arrêté');
    }

    /**
     * Obtient l'état du logger
     */
    getState() {
        return {
            enabled: this.config.enabled,
            level: this.config.level,
            logCount: this.logs.length,
            destinations: this.config.destinations,
            maxEntries: this.config.maxEntries,
            retention: this.config.retention
        };
    }
}

// ===== NIVEAUX DE JOURNALISATION =====
const LOG_LEVELS = {
    DEBUG: 'debug',
    INFO: 'info',
    WARN: 'warn',
    ERROR: 'error'
};

// ===== EXPORTATIONS =====
export { HelperLogger, LOG_LEVELS };
export default HelperLogger;