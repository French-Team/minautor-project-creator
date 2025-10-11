/**
 * CONFIGURATION PREVIEW-60 : Paramètres et constantes du module Preview
 * Définit les paramètres de configuration pour la gestion de l'aperçu
 */

const PreviewConfig = {
    // Paramètres généraux
    general: {
        autoRender: true,
        renderDelay: 300, // ms
        enableZoom: true,
        enablePan: true,
        enableExport: true,
        enableKeyboardShortcuts: true
    },

    // Configuration du rendu
    rendering: {
        engine: 'mermaid',
        theme: 'default',
        startOnLoad: false,
        securityLevel: 'loose',
        maxTextSize: 50000,
        maxEdges: 200,
        timeout: 30000, // 30 secondes
        
        // Options spécifiques Mermaid
        mermaidOptions: {
            flowchart: {
                useMaxWidth: true,
                htmlLabels: true,
                curve: 'basis'
            },
            sequence: {
                diagramMarginX: 50,
                diagramMarginY: 10,
                actorMargin: 50,
                width: 150,
                height: 65,
                boxMargin: 10,
                boxTextMargin: 5,
                noteMargin: 10,
                messageMargin: 35
            },
            gantt: {
                titleTopMargin: 25,
                barHeight: 20,
                gridLineStartPadding: 35,
                fontSize: 11,
                fontFamily: 'Arial'
            }
        }
    },

    // Configuration du zoom
    zoom: {
        minLevel: 0.1,
        maxLevel: 5.0,
        step: 0.1,
        defaultLevel: 1.0,
        wheelSensitivity: 0.1,
        smooth: true,
        transitionDuration: 200,
        
        // Niveaux prédéfinis
        presets: [
            { name: '25%', level: 0.25 },
            { name: '50%', level: 0.5 },
            { name: '75%', level: 0.75 },
            { name: '100%', level: 1.0 },
            { name: '125%', level: 1.25 },
            { name: '150%', level: 1.5 },
            { name: '200%', level: 2.0 }
        ]
    },

    // Configuration du panoramique
    pan: {
        enabled: true,
        cursor: 'grab',
        grabbingCursor: 'grabbing',
        smooth: true,
        transitionDuration: 150,
        maxPanDistance: 5000,
        
        // Options de limitation
        limitToBounds: true,
        boundsPadding: 50
    },

    // Configuration de l'affichage du code
    codeDisplay: {
        showLineNumbers: true,
        syntaxHighlighting: true,
        autoResize: true,
        minHeight: 100,
        maxHeight: 500,
        fontSize: 14,
        fontFamily: 'Monaco, Menlo, "Ubuntu Mono", monospace',
        tabSize: 2,
        wordWrap: true,
        
        // Options d'édition
        readOnly: false,
        enableAutoComplete: false,
        enableValidation: true
    },

    // Configuration des erreurs
    errorHandling: {
        showErrors: true,
        autoHideErrors: false,
        errorDisplayDuration: 5000,
        maxErrorLength: 500,
        
        // Styles d'erreur
        errorStyles: {
            backgroundColor: '#fee',
            borderColor: '#fcc',
            textColor: '#c00',
            icon: '⚠️',
            position: 'top',
            animation: 'fadeIn'
        }
    },

    // Configuration de l'export
    export: {
        formats: ['svg', 'png', 'pdf'],
        defaultFormat: 'svg',
        
        // Options SVG
        svg: {
            includeMetadata: true,
            optimize: true,
            prettyPrint: false
        },
        
        // Options PNG
        png: {
            scale: 2,
            backgroundColor: 'white',
            quality: 0.9
        },
        
        // Options PDF
        pdf: {
            orientation: 'portrait',
            format: 'a4',
            margin: 20,
            compress: true
        }
    },

    // Configuration des interactions
    interactions: {
        enableElementSelection: true,
        enableElementHighlighting: true,
        enableTooltips: true,
        enableContextMenu: false,
        
        // Styles de sélection
        selection: {
            borderColor: '#3b82f6',
            borderWidth: 2,
            backgroundColor: 'rgba(59, 130, 246, 0.1)',
            animation: 'pulse'
        },
        
        // Styles de survol
        hover: {
            borderColor: '#60a5fa',
            borderWidth: 1,
            backgroundColor: 'rgba(96, 165, 250, 0.05)',
            cursor: 'pointer'
        }
    },

    // Configuration des raccourcis clavier
    keyboardShortcuts: {
        enabled: true,
        shortcuts: [
            { key: 'Ctrl+Enter', action: 'render', description: 'Rendre le diagramme' },
            { key: 'Ctrl+Shift+C', action: 'copyCode', description: 'Copier le code' },
            { key: 'Ctrl+Shift+E', action: 'exportSVG', description: 'Exporter en SVG' },
            { key: 'Ctrl+Shift+P', action: 'exportPNG', description: 'Exporter en PNG' },
            { key: 'Ctrl+0', action: 'resetZoom', description: 'Réinitialiser le zoom' },
            { key: 'Ctrl++', action: 'zoomIn', description: 'Zoom avant' },
            { key: 'Ctrl+-', action: 'zoomOut', description: 'Zoom arrière' }
        ]
    },

    // Configuration des performances
    performance: {
        enableDebouncing: true,
        debounceDelay: 300,
        enableThrottling: false,
        throttleDelay: 100,
        
        // Optimisations
        lazyRendering: true,
        virtualScrolling: false,
        progressiveEnhancement: true,
        
        // Limites
        maxElements: 1000,
        maxConnections: 500,
        maxTextLength: 10000
    },

    // Configuration des événements
    events: {
        renderStart: 'preview:render:start',
        renderComplete: 'preview:render:complete',
        renderError: 'preview:render:error',
        zoomChange: 'preview:zoom:change',
        panChange: 'preview:pan:change',
        exportComplete: 'preview:export:complete',
        elementClick: 'preview:element:click',
        codeChange: 'preview:code:change'
    },

    // Configuration de l'interface utilisateur
    ui: {
        container: {
            className: 'preview-module-container',
            minWidth: 300,
            minHeight: 200,
            backgroundColor: 'var(--color-background)',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-md)'
        },
        
        toolbar: {
            enabled: true,
            position: 'top',
            buttons: ['zoom', 'export', 'settings'],
            autoHide: false
        },
        
        statusBar: {
            enabled: true,
            showZoomLevel: true,
            showRenderTime: true,
            showErrorCount: true
        }
    },

    // Configuration des messages
    messages: {
        render: {
            start: 'Rendu en cours...',
            complete: 'Rendu terminé',
            error: 'Erreur lors du rendu',
            timeout: 'Le rendu a pris trop de temps',
            tooLarge: 'Le diagramme est trop grand pour être rendu'
        },
        
        export: {
            start: 'Export en cours...',
            complete: 'Export terminé',
            error: 'Erreur lors de l\'export',
            unsupportedFormat: 'Format d\'export non supporté'
        },
        
        zoom: {
            minReached: 'Zoom minimum atteint',
            maxReached: 'Zoom maximum atteint',
            reset: 'Zoom réinitialisé'
        },
        
        copy: {
            success: 'Code copié dans le presse-papiers',
            error: 'Erreur lors de la copie'
        }
    },

    // Configuration de validation
    validation: {
        mermaidCode: {
            requiredPatterns: ['graph', 'flowchart', 'sequenceDiagram', 'gantt'],
            maxLength: 50000,
            minLength: 10,
            forbiddenPatterns: ['<script', 'javascript:', 'eval(']
        },
        
        export: {
            maxFileSize: '10MB',
            allowedFormats: ['svg', 'png', 'pdf'],
            maxDimensions: { width: 10000, height: 10000 }
        }
    },

    // Configuration de sécurité
    security: {
        enableSanitization: true,
        allowedTags: ['svg', 'g', 'path', 'rect', 'circle', 'text', 'tspan'],
        allowedAttributes: ['d', 'x', 'y', 'width', 'height', 'fill', 'stroke', 'style'],
        
        // Protection contre les attaques
        maxInputLength: 100000,
        enableCSP: false,
        sandboxMode: false
    },

    // Configuration des intégrations
    integration: {
        mermaid: {
            autoInit: true,
            version: 'latest',
            cdnUrl: 'https://cdn.jsdelivr.net/npm/mermaid@latest/dist/mermaid.min.js',
            fallbackUrl: '/js/lib/mermaid.min.js'
        },
        
        theme: {
            autoSync: true,
            inheritColors: true,
            allowThemeOverride: true
        },
        
        canvas: {
            autoUpdate: true,
            bidirectionalSync: true,
            updateDelay: 500
        }
    },

    // Configuration des logs
    logging: {
        enabled: true,
        level: 'info', // debug, info, warn, error
        logRenderTimes: true,
        logErrors: true,
        logUserActions: false,
        
        // Performance
        maxLogEntries: 1000,
        enableLogRotation: true
    },

    // Méthodes utilitaires
    utils: {
        /**
         * Obtient la configuration complète
         */
        getFullConfig() {
            return { ...PreviewConfig };
        },

        /**
         * Obtient une configuration spécifique
         */
        getConfig(section) {
            return PreviewConfig[section] || null;
        },

        /**
         * Valide un format d'export
         */
        validateExportFormat(format) {
            return PreviewConfig.export.formats.includes(format.toLowerCase());
        },

        /**
         * Obtient les raccourcis clavier
         */
        getKeyboardShortcuts() {
            return PreviewConfig.keyboardShortcuts.shortcuts;
        },

        /**
         * Obtient les niveaux de zoom prédéfinis
         */
        getZoomPresets() {
            return PreviewConfig.zoom.presets;
        },

        /**
         * Formate le temps de rendu
         */
        formatRenderTime(time) {
            if (time < 1000) {
                return `${time.toFixed(0)}ms`;
            }
            return `${(time / 1000).toFixed(2)}s`;
        }
    }
};

// ===== TRIGGER CHAIN =====
window.PreviewConfig = PreviewConfig;

export { PreviewConfig };