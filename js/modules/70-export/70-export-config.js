/**
 * CONFIGURATION EXPORT-70 : Paramètres du Module Export
 * Configuration complète pour le module d'export
 */

export const EXPORT_CONFIG = {
    // Paramètres généraux
    general: {
        name: 'ExportModule',
        version: '1.0.0',
        description: 'Gestion des exports avancés',
        priority: 70,
        enabled: true
    },
    
    // Formats supportés
    formats: {
        supported: ['svg', 'png', 'pdf', 'json', 'markdown'],
        defaultFormat: 'svg',
        quality: {
            svg: { optimize: true },
            png: { scale: 2, quality: 0.9 },
            pdf: { orientation: 'portrait', format: 'a4' },
            json: { pretty: true },
            markdown: { includeMetadata: true, includeInstructions: true }
        }
    },
    
    // Bibliothèques externes
    libraries: {
        jsPDF: {
            url: 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js',
            fallback: 'https://unpkg.com/jspdf@2.5.1/dist/jspdf.umd.min.js',
            required: ['pdf']
        },
        html2canvas: {
            url: 'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js',
            fallback: 'https://unpkg.com/html2canvas@1.4.1/dist/html2canvas.min.js',
            required: ['png']
        }
    },
    
    // Historique d'export
    history: {
        enabled: true,
        maxSize: 50,
        storageKey: 'export-history',
        includeMetadata: true,
        autoCleanup: true,
        cleanupInterval: 24 * 60 * 60 * 1000 // 24h
    },
    
    // Options d'export par format
    exportOptions: {
        svg: {
            optimize: true,
            includeMetadata: true,
            customStyles: null,
            removeWhitespace: true
        },
        png: {
            scale: 2,
            quality: 0.9,
            backgroundColor: 'white',
            format: 'image/png'
        },
        pdf: {
            orientation: 'portrait',
            format: 'a4',
            unit: 'mm',
            margins: { top: 10, right: 10, bottom: 10, left: 10 }
        },
        json: {
            pretty: true,
            includeMetadata: true,
            version: '1.0',
            type: 'canvas-mermaid-diagram'
        },
        markdown: {
            includeMetadata: true,
            includeInstructions: true,
            title: 'Diagramme Mermaid',
            description: 'Diagramme généré avec Canvas Mermaid Generator'
        }
    },
    
    // Noms de fichiers
    filename: {
        template: 'diagram-{timestamp}.{extension}',
        timestampFormat: 'YYYY-MM-DD-HH-mm-ss',
        prefix: '',
        suffix: '',
        sanitize: true,
        maxLength: 255
    },
    
    // Performance
    performance: {
        maxConcurrentExports: 3,
        timeout: 30000, // 30 secondes
        debounceDelay: 500,
        cacheResults: true,
        cacheTimeout: 5 * 60 * 1000 // 5 minutes
    },
    
    // UI et interactions
    ui: {
        showProgress: true,
        showNotifications: true,
        autoDownload: true,
        confirmOverwrite: true,
        showPreview: true,
        dragDropEnabled: true
    },
    
    // Validation
    validation: {
        maxFileSize: 50 * 1024 * 1024, // 50MB
        allowedExtensions: ['.svg', '.png', '.pdf', '.json', '.md'],
        svgValidation: true,
        jsonSchemaValidation: true
    },
    
    // Sécurité
    security: {
        sanitizeSVG: true,
        removeScripts: true,
        validateContent: true,
        checkFileType: true,
        scanForMalware: false
    },
    
    // Intégrations
    integrations: {
        mermaid: {
            autoUpdate: true,
            includeSource: true,
            preserveLayout: true
        },
        canvas: {
            includeData: true,
            includeConnections: true,
            includeMetadata: true
        },
        theme: {
            applyTheme: true,
            preserveColors: true,
            includeThemeInfo: true
        }
    },
    
    // Événements
    events: {
        onExportStart: 'export:start',
        onExportComplete: 'export:complete',
        onExportError: 'export:error',
        onHistoryUpdate: 'export:history:update',
        onSettingsChange: 'export:settings:change'
    },
    
    // Messages
    messages: {
        exportStart: 'Export en cours...',
        exportComplete: 'Export terminé avec succès',
        exportError: 'Erreur lors de l\'export',
        exportCancelled: 'Export annulé',
        fileTooLarge: 'Fichier trop volumineux',
        invalidFormat: 'Format non supporté',
        noContent: 'Aucun contenu à exporter',
        downloadStarted: 'Téléchargement démarré',
        historyCleared: 'Historique effacé'
    },
    
    // Logging
    logging: {
        enabled: true,
        level: 'info', // debug, info, warn, error
        includeTimestamps: true,
        includeStackTrace: true,
        maxLogSize: 1000
    },
    
    // Raccourcis clavier
    shortcuts: {
        'Ctrl+Shift+E': 'export-dialog',
        'Ctrl+Shift+S': 'export-svg',
        'Ctrl+Shift+P': 'export-png',
        'Ctrl+Shift+D': 'export-pdf',
        'Ctrl+Shift+J': 'export-json',
        'Ctrl+Shift+M': 'export-markdown'
    },
    
    // API et webhooks
    api: {
        enabled: false,
        baseUrl: '',
        endpoints: {
            export: '/api/export',
            history: '/api/export/history',
            settings: '/api/export/settings'
        },
        headers: {
            'Content-Type': 'application/json'
        },
        timeout: 10000
    },
    
    // Fonctions utilitaires
    utils: {
        /**
         * Génère un nom de fichier sécurisé
         */
        generateFilename: (format, options = {}) => {
            const timestamp = new Date().toISOString()
                .replace(/[:.]/g, '-')
                .slice(0, 19);
            
            let filename = options.template || EXPORT_CONFIG.filename.template;
            filename = filename.replace('{timestamp}', timestamp);
            filename = filename.replace('{extension}', format);
            filename = filename.replace('{prefix}', options.prefix || '');
            filename = filename.replace('{suffix}', options.suffix || '');
            
            if (options.sanitize !== false && EXPORT_CONFIG.filename.sanitize) {
                filename = filename.replace(/[^a-zA-Z0-9-_\.]/g, '_');
            }
            
            const maxLength = EXPORT_CONFIG.filename.maxLength;
            if (filename.length > maxLength) {
                const extension = `.${format}`;
                const nameWithoutExt = filename.slice(0, -extension.length);
                const maxNameLength = maxLength - extension.length;
                filename = nameWithoutExt.slice(0, maxNameLength) + extension;
            }
            
            return filename;
        },
        
        /**
         * Valide un format d'export
         */
        validateFormat: (format) => {
            return EXPORT_CONFIG.formats.supported.includes(format.toLowerCase());
        },
        
        /**
         * Obtient les options par défaut pour un format
         */
        getDefaultOptions: (format) => {
            return {
                ...EXPORT_CONFIG.exportOptions[format],
                filename: EXPORT_CONFIG.utils.generateFilename(format)
            };
        },
        
        /**
         * Calcule la taille estimée d'un export
         */
        estimateSize: (format, content) => {
            const baseSize = new Blob([content]).size;
            const multipliers = {
                svg: 1.2,
                png: 8, // Approximation pour une image
                pdf: 3,
                json: 1.1,
                markdown: 1.3
            };
            
            return Math.round(baseSize * (multipliers[format] || 1));
        },
        
        /**
         * Formate la durée d'export
         */
        formatDuration: (duration) => {
            if (duration < 1000) {
                return `${Math.round(duration)}ms`;
            } else if (duration < 60000) {
                return `${(duration / 1000).toFixed(1)}s`;
            } else {
                return `${(duration / 60000).toFixed(1)}min`;
            }
        },
        
        /**
         * Formate la taille d'un fichier
         */
        formatFileSize: (bytes) => {
            if (bytes === 0) return '0 B';
            const k = 1024;
            const sizes = ['B', 'KB', 'MB', 'GB'];
            const i = Math.floor(Math.log(bytes) / Math.log(k));
            return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
        }
    }
};

// Configuration du trigger
export const EXPORT_TRIGGER_CONFIG = {
    name: 'ExportTrigger',
    version: '1.0.0',
    priority: 70,
    
    // Routes de traitement
    routes: {
        incoming: {
            'export_request': { priority: 1, timeout: 30000 },
            'bulk_export_request': { priority: 1, timeout: 60000 },
            'export_history_request': { priority: 2, timeout: 5000 },
            'export_settings_request': { priority: 2, timeout: 5000 },
            'canvas_updated': { priority: 3, timeout: 1000 },
            'export_stats_request': { priority: 2, timeout: 5000 }
        },
        outgoing: {
            'export_complete': { priority: 1 },
            'export_failed': { priority: 1 },
            'bulk_export_complete': { priority: 1 },
            'history_updated': { priority: 2 },
            'export_stats_response': { priority: 2 }
        }
    },
    
    // Modules suivants par défaut
    nextModules: {
        success: ['sidebar-40', 'preview-60'],
        error: ['sidebar-40', 'preview-60'],
        default: null
    },
    
    // Configuration des notifications
    notifications: {
        enabled: true,
        duration: 3000,
        position: 'top-right',
        maxConcurrent: 3
    }
};

export default { EXPORT_CONFIG, EXPORT_TRIGGER_CONFIG };