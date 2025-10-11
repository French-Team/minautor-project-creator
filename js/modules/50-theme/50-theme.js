/**
 * MODULE THEME-50 : Gestion des Thèmes
 * Gère le thème visuel et les préférences utilisateur
 */

class ThemeModule {
    constructor() {
        this.currentTheme = 'light';
        this.themes = new Map();
        this.customThemes = new Map();
        this.isInitialized = false;
        
        this.init();
    }

    async init() {
         console.log('🎨 Initialisation 50-theme...');

         this.setupThemes();
         this.loadUserPreferences();
         this.applyTheme(this.currentTheme);
         this.setupThemeToggle();

         this.isInitialized = true;
         console.log('✅ 50-theme prêt');
     }

    /**
     * Configuration des thèmes disponibles
     */
    setupThemes() {
        // Thèmes par défaut
        this.themes.set('light', {
            name: 'Clair',
            colors: {
                primary: '#3b82f6',
                secondary: '#6b7280',
                background: '#ffffff',
                surface: '#f9fafb',
                text: '#111827',
                border: '#e5e7eb',
                accent: '#10b981'
            },
            variables: {
                '--shadow-sm': '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
                '--shadow-md': '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                '--shadow-lg': '0 10px 15px -3px rgba(0, 0, 0, 0.1)'
            }
        });
        
        this.themes.set('dark', {
            name: 'Sombre',
            colors: {
                primary: '#60a5fa',
                secondary: '#9ca3af',
                background: '#111827',
                surface: '#1f2937',
                text: '#f9fafb',
                border: '#374151',
                accent: '#34d399'
            },
            variables: {
                '--shadow-sm': '0 1px 2px 0 rgba(0, 0, 0, 0.3)',
                '--shadow-md': '0 4px 6px -1px rgba(0, 0, 0, 0.4)',
                '--shadow-lg': '0 10px 15px -3px rgba(0, 0, 0, 0.5)'
            }
        });
        
        this.themes.set('blue', {
            name: 'Bleu',
            colors: {
                primary: '#1e40af',
                secondary: '#3b82f6',
                background: '#eff6ff',
                surface: '#dbeafe',
                text: '#1e3a8a',
                border: '#bfdbfe',
                accent: '#2563eb'
            }
        });
        
        this.themes.set('green', {
            name: 'Vert',
            colors: {
                primary: '#059669',
                secondary: '#10b981',
                background: '#f0fdf4',
                surface: '#dcfce7',
                text: '#14532d',
                border: '#bbf7d0',
                accent: '#16a34a'
            }
        });
        
        console.log(`Thèmes configurés: ${this.themes.size}`);
    }

    /**
     * Charge les préférences utilisateur
     */
    loadUserPreferences() {
        try {
            const saved = localStorage.getItem('theme-preferences');
            if (saved) {
                const prefs = JSON.parse(saved);
                this.currentTheme = prefs.theme || 'light';
                
                // Charge les thèmes personnalisés
                if (prefs.customThemes) {
                    prefs.customThemes.forEach(theme => {
                        this.customThemes.set(theme.id, theme);
                    });
                }
            }
        } catch (error) {
            console.warn('Erreur chargement préférences:', error);
        }
        
        // Détecte la préférence système
        if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
            this.currentTheme = 'dark';
        }
    }

    /**
     * Applique un thème
     */
    applyTheme(themeId) {
        const theme = this.themes.get(themeId) || this.customThemes.get(themeId);
        if (!theme) {
            console.warn(`Thème non trouvé: ${themeId}`);
            return false;
        }
        
        // Applique les couleurs
        Object.entries(theme.colors).forEach(([key, value]) => {
            document.documentElement.style.setProperty(`--color-${key}`, value);
        });
        
        // Applique les variables CSS
        if (theme.variables) {
            Object.entries(theme.variables).forEach(([key, value]) => {
                document.documentElement.style.setProperty(key, value);
            });
        }
        
        // Met à jour la classe du body
        document.body.classList.remove('theme-light', 'theme-dark', 'theme-blue', 'theme-green');
        document.body.classList.add(`theme-${themeId}`);
        
        this.currentTheme = themeId;
        
        // Sauvegarde la préférence
        this.savePreferences();
        
        console.log(`Thème appliqué: ${themeId}`);
        
        return true;
    }

    /**
     * Configuration du bouton de basculement de thème
     */
    setupThemeToggle() {
        const toggleButton = document.getElementById('themeToggle');
        if (!toggleButton) return;
        
        toggleButton.addEventListener('click', () => {
            this.cycleTheme();
        });
        
        // Met à jour l'icône
        this.updateThemeIcon(toggleButton);
        
        console.log('Bouton de thème configuré');
    }

    /**
     * Change de thème cycliquement
     */
    cycleTheme() {
        const themeIds = Array.from(this.themes.keys());
        const currentIndex = themeIds.indexOf(this.currentTheme);
        const nextIndex = (currentIndex + 1) % themeIds.length;
        const nextTheme = themeIds[nextIndex];
        
        this.applyTheme(nextTheme);
        
        // Met à jour l'icône du bouton
        const toggleButton = document.getElementById('themeToggle');
        if (toggleButton) {
            this.updateThemeIcon(toggleButton);
        }
    }

    /**
     * Met à jour l'icône du bouton de thème
     */
    updateThemeIcon(button) {
        const icons = {
            light: '☀️',
            dark: '🌙',
            blue: '💙',
            green: '💚'
        };
        
        button.textContent = icons[this.currentTheme] || '🎨';
        button.setAttribute('title', `Thème: ${this.getThemeName(this.currentTheme)}`);
    }

    /**
     * Traitement principal du module
     */
    async process(data, context = {}) {
        console.log('🎨 50-theme traite:', data);
        
        // Traite les données selon le type
        if (data.type === 'theme_request') {
            return await this.handleThemeRequest(data, context);
        }
        
        if (data.type === 'element_edited' && data.data?.theme) {
            return await this.handleElementThemeChange(data, context);
        }
        
        if (data.type === 'canvas_cleared') {
            return await this.handleCanvasReset(data, context);
        }
        
        // Pass-through par défaut
        return data;
    }

    /**
     * Gère les demandes de thème
     */
    async handleThemeRequest(data, context) {
        const { action, themeId, themeData } = data;
        
        switch (action) {
            case 'apply':
                return await this.applyTheme(themeId);
            case 'create':
                return await this.createCustomTheme(themeId, themeData);
            case 'delete':
                return await this.deleteCustomTheme(themeId);
            case 'list':
                return await this.getThemeList();
            default:
                console.warn(`Action thème inconnue: ${action}`);
                return data;
        }
    }

    /**
     * Gère le changement de thème d'un élément
     */
    async handleElementThemeChange(data, context) {
        const { elementId, data: elementData } = data;
        
        // Applique le thème spécifique à l'élément
        if (elementData.theme) {
            this.applyElementTheme(elementId, elementData.theme);
        }
        
        return {
            ...data,
            themeApplied: true
        };
    }

    /**
     * Gère la réinitialisation du canvas
     */
    async handleCanvasReset(data, context) {
        // Réapplique le thème actuel pour réinitialiser les styles
        this.applyTheme(this.currentTheme);
        
        return {
            ...data,
            themeReset: true
        };
    }

    /**
     * Crée un thème personnalisé
     */
    async createCustomTheme(themeId, themeData) {
        const theme = {
            id: themeId,
            name: themeData.name || themeId,
            colors: themeData.colors || {},
            variables: themeData.variables || {},
            custom: true,
            created: Date.now()
        };
        
        this.customThemes.set(themeId, theme);
        this.savePreferences();
        
        console.log(`Thème personnalisé créé: ${themeId}`);
        
        return {
            type: 'theme_created',
            themeId: themeId,
            theme: theme
        };
    }

    /**
     * Supprime un thème personnalisé
     */
    async deleteCustomTheme(themeId) {
        if (!this.customThemes.has(themeId)) {
            console.warn(`Thème personnalisé non trouvé: ${themeId}`);
            return false;
        }
        
        this.customThemes.delete(themeId);
        this.savePreferences();
        
        console.log(`Thème personnalisé supprimé: ${themeId}`);
        
        return true;
    }

    /**
     * Obtient la liste des thèmes
     */
    async getThemeList() {
        return {
            type: 'theme_list',
            themes: Array.from(this.themes.entries()).map(([id, theme]) => ({
                id,
                name: theme.name,
                custom: false
            })),
            customThemes: Array.from(this.customThemes.entries()).map(([id, theme]) => ({
                id,
                name: theme.name,
                custom: true
            })),
            currentTheme: this.currentTheme
        };
    }

    /**
     * Applique un thème à un élément spécifique
     */
    applyElementTheme(elementId, themeData) {
        const element = document.querySelector(`[data-element-id="${elementId}"]`);
        if (!element) return;
        
        // Applique les styles spécifiques
        if (themeData.backgroundColor) {
            element.style.backgroundColor = themeData.backgroundColor;
        }
        
        if (themeData.textColor) {
            element.style.color = themeData.textColor;
        }
        
        if (themeData.borderColor) {
            element.style.borderColor = themeData.borderColor;
        }
        
        console.log(`Thème appliqué à l'élément: ${elementId}`);
    }

    /**
     * Sauvegarde les préférences
     */
    savePreferences() {
        try {
            const preferences = {
                theme: this.currentTheme,
                customThemes: Array.from(this.customThemes.values())
            };
            
            localStorage.setItem('theme-preferences', JSON.stringify(preferences));
        } catch (error) {
            console.warn('Erreur sauvegarde préférences:', error);
        }
    }

    /**
     * Obtient le nom d'un thème
     */
    getThemeName(themeId) {
        const theme = this.themes.get(themeId) || this.customThemes.get(themeId);
        return theme ? theme.name : themeId;
    }

    /**
     * Obtient le thème actuel
     */
    getCurrentTheme() {
        return {
            id: this.currentTheme,
            name: this.getThemeName(this.currentTheme),
            theme: this.themes.get(this.currentTheme) || this.customThemes.get(this.currentTheme)
        };
    }

    /**
     * Obtient des statistiques
     */
    getStats() {
        return {
            currentTheme: this.currentTheme,
            totalThemes: this.themes.size + this.customThemes.size,
            builtInThemes: this.themes.size,
            customThemes: this.customThemes.size,
            themes: Array.from(this.themes.keys()),
            customThemeIds: Array.from(this.customThemes.keys())
        };
    }
}

// ===== TRIGGER CHAIN =====
window.ThemeModule = ThemeModule;

export { ThemeModule };