/**
 * CONFIGURATION THEME-50 : Paramètres et constantes du module Theme
 * Définit les paramètres de configuration pour la gestion des thèmes
 */

const ThemeConfig = {
    // Paramètres généraux
    general: {
        defaultTheme: 'light',
        autoDetectSystemTheme: true,
        saveUserPreferences: true,
        themeTransitionDuration: 300, // ms
        maxCustomThemes: 10
    },

    // Configuration des thèmes par défaut
    defaultThemes: {
        light: {
            name: 'Clair',
            description: 'Thème clair avec couleurs vives',
            colors: {
                primary: '#3b82f6',
                secondary: '#6b7280',
                background: '#ffffff',
                surface: '#f9fafb',
                text: '#111827',
                border: '#e5e7eb',
                accent: '#10b981',
                success: '#10b981',
                warning: '#f59e0b',
                error: '#ef4444',
                info: '#3b82f6'
            },
            variables: {
                '--shadow-sm': '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
                '--shadow-md': '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                '--shadow-lg': '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
                '--radius-sm': '0.125rem',
                '--radius-md': '0.375rem',
                '--radius-lg': '0.5rem'
            }
        },
        
        dark: {
            name: 'Sombre',
            description: 'Thème sombre pour une utilisation nocturne',
            colors: {
                primary: '#60a5fa',
                secondary: '#9ca3af',
                background: '#111827',
                surface: '#1f2937',
                text: '#f9fafb',
                border: '#374151',
                accent: '#34d399',
                success: '#34d399',
                warning: '#fbbf24',
                error: '#f87171',
                info: '#60a5fa'
            },
            variables: {
                '--shadow-sm': '0 1px 2px 0 rgba(0, 0, 0, 0.3)',
                '--shadow-md': '0 4px 6px -1px rgba(0, 0, 0, 0.4)',
                '--shadow-lg': '0 10px 15px -3px rgba(0, 0, 0, 0.5)',
                '--radius-sm': '0.125rem',
                '--radius-md': '0.375rem',
                '--radius-lg': '0.5rem'
            }
        },
        
        blue: {
            name: 'Bleu',
            description: 'Thème bleu professionnel',
            colors: {
                primary: '#1e40af',
                secondary: '#3b82f6',
                background: '#eff6ff',
                surface: '#dbeafe',
                text: '#1e3a8a',
                border: '#bfdbfe',
                accent: '#2563eb',
                success: '#16a34a',
                warning: '#ca8a04',
                error: '#dc2626',
                info: '#2563eb'
            }
        },
        
        green: {
            name: 'Vert',
            description: 'Thème vert naturel',
            colors: {
                primary: '#059669',
                secondary: '#10b981',
                background: '#f0fdf4',
                surface: '#dcfce7',
                text: '#14532d',
                border: '#bbf7d0',
                accent: '#16a34a',
                success: '#16a34a',
                warning: '#d97706',
                error: '#dc2626',
                info: '#059669'
            }
        }
    },

    // Configuration des éléments canvas
    canvasElements: {
        defaultStyles: {
            rectangle: {
                backgroundColor: 'var(--color-surface)',
                borderColor: 'var(--color-border)',
                textColor: 'var(--color-text)',
                borderWidth: 2,
                borderRadius: 4,
                padding: 10,
                fontSize: 14,
                fontFamily: 'Arial, sans-serif'
            },
            
            diamond: {
                backgroundColor: 'var(--color-accent)',
                borderColor: 'var(--color-primary)',
                textColor: 'var(--color-text)',
                borderWidth: 2,
                borderRadius: 0,
                padding: 8,
                fontSize: 14,
                fontFamily: 'Arial, sans-serif',
                rotation: 45
            },
            
            circle: {
                backgroundColor: 'var(--color-primary)',
                borderColor: 'var(--color-secondary)',
                textColor: '#ffffff',
                borderWidth: 2,
                borderRadius: '50%',
                padding: 12,
                fontSize: 14,
                fontFamily: 'Arial, sans-serif'
            }
        },
        
        hoverEffects: {
            scale: 1.05,
            shadow: 'var(--shadow-md)',
            transitionDuration: 200,
            cursor: 'pointer'
        },
        
        selectionStyles: {
            borderWidth: 3,
            borderColor: 'var(--color-primary)',
            boxShadow: '0 0 0 2px var(--color-primary)'
        }
    },

    // Configuration des connexions
    connections: {
        defaultStyles: {
            strokeColor: 'var(--color-secondary)',
            strokeWidth: 2,
            strokeDasharray: 'none',
            arrowSize: 8,
            curveTension: 0.5
        },
        
        hoverEffects: {
            strokeWidth: 3,
            strokeColor: 'var(--color-primary)',
            cursor: 'pointer'
        },
        
        selectionStyles: {
            strokeWidth: 4,
            strokeColor: 'var(--color-primary)',
            strokeDasharray: '5,5'
        }
    },

    // Configuration de l'interface utilisateur
    ui: {
        themeToggle: {
            position: 'top-right',
            iconSize: 24,
            tooltip: true,
            showCurrentTheme: true
        },
        
        themeSelector: {
            showPreview: true,
            showDescription: true,
            allowCustomThemes: true,
            maxVisibleThemes: 6
        },
        
        notifications: {
            showThemeChangeNotification: true,
            notificationDuration: 2000,
            position: 'top-right'
        }
    },

    // Configuration du stockage
    storage: {
        preferencesKey: 'theme-preferences',
        customThemesKey: 'custom-themes',
        version: '1.0',
        maxStorageSize: '1MB'
    },

    // Configuration des performances
    performance: {
        enableTransitions: true,
        transitionDuration: 300,
        debounceDelay: 100,
        batchUpdates: true,
        lazyLoading: true
    },

    // Configuration des événements
    events: {
        themeChange: 'theme:change',
        themeCreate: 'theme:create',
        themeDelete: 'theme:delete',
        themeReset: 'theme:reset',
        elementThemeChange: 'element:theme:change',
        preferencesSave: 'preferences:save'
    },

    // Configuration de validation
    validation: {
        themeId: {
            pattern: /^[a-z0-9-]+$/,
            minLength: 3,
            maxLength: 20
        },
        
        color: {
            pattern: /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/,
            allowVariables: true
        },
        
        themeName: {
            minLength: 2,
            maxLength: 50,
            allowSpecialChars: false
        }
    },

    // Configuration des messages
    messages: {
        theme: {
            applied: 'Thème appliqué avec succès',
            created: 'Thème personnalisé créé',
            deleted: 'Thème supprimé',
            error: 'Erreur lors du changement de thème',
            notFound: 'Thème non trouvé',
            invalid: 'Thème invalide'
        },
        
        validation: {
            invalidThemeId: 'ID de thème invalide',
            invalidColor: 'Couleur invalide',
            invalidName: 'Nom de thème invalide',
            themeExists: 'Ce thème existe déjà',
            maxThemesReached: 'Nombre maximum de thèmes atteint'
        }
    },

    // Configuration des intégrations
    integration: {
        mermaid: {
            themeMapping: {
                light: 'default',
                dark: 'dark',
                blue: 'forest',
                green: 'forest'
            },
            
            customThemeSupport: true,
            autoSync: true
        },
        
        canvas: {
            autoApplyElementThemes: true,
            inheritThemeColors: true,
            allowElementSpecificThemes: true
        }
    },

    // Configuration des logs
    logging: {
        enabled: true,
        level: 'info', // debug, info, warn, error
        logThemeChanges: true,
        logErrors: true,
        logPerformance: false
    },

    // Configuration de sécurité
    security: {
        sanitizeCustomThemes: true,
        validateThemeData: true,
        maxCustomThemeSize: '100KB',
        allowedColorFormats: ['hex', 'rgb', 'hsl', 'var']
    },

    // Méthodes utilitaires
    utils: {
        /**
         * Valide un ID de thème
         */
        validateThemeId(themeId) {
            const { pattern, minLength, maxLength } = ThemeConfig.validation.themeId;
            
            if (!themeId || typeof themeId !== 'string') return false;
            if (themeId.length < minLength || themeId.length > maxLength) return false;
            if (!pattern.test(themeId)) return false;
            
            return true;
        },

        /**
         * Valide une couleur
         */
        validateColor(color) {
            const { pattern, allowVariables } = ThemeConfig.validation.color;
            
            if (!color || typeof color !== 'string') return false;
            
            // Autorise les variables CSS
            if (allowVariables && color.startsWith('var(--')) {
                return true;
            }
            
            return pattern.test(color);
        },

        /**
         * Génère un ID unique pour un thème personnalisé
         */
        generateCustomThemeId(name) {
            const baseId = name.toLowerCase()
                .replace(/[^a-z0-9-]/g, '-')
                .replace(/-+/g, '-')
                .replace(/^-|-$/g, '');
            
            return `custom-${baseId}-${Date.now()}`;
        },

        /**
         * Obtient la configuration complète
         */
        getFullConfig() {
            return { ...ThemeConfig };
        },

        /**
         * Obtient une configuration spécifique
         */
        getConfig(section) {
            return ThemeConfig[section] || null;
        }
    }
};

// ===== TRIGGER CHAIN =====
window.ThemeConfig = ThemeConfig;

export { ThemeConfig };