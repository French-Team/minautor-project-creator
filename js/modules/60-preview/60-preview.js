/**
 * MODULE PREVIEW-60 : Gestion de l'Aperçu
 * Gère l'affichage et les interactions avec la prévisualisation Mermaid
 */

class PreviewModule {
    constructor() {
        this.previewContainer = null;
        this.codeDisplay = null;
        this.errorDisplay = null;
        this.isInitialized = false;
        this.currentMermaidCode = '';
        this.lastRenderTime = 0;
        this.renderTimeout = null;
        this.zoomLevel = 1;
        this.panPosition = { x: 0, y: 0 };
        this.isPanning = false;
        this.lastPanPoint = { x: 0, y: 0 };
        
        this.init();
    }

    async init() {
         console.log('👁️ Initialisation 60-preview...');

         this.setupPreviewContainer();
         this.setupCodeDisplay();
         this.setupErrorHandling();
         this.setupZoomAndPan();
         this.setupExportButtons();
         this.setupKeyboardShortcuts();

         this.isInitialized = true;
         console.log('✅ 60-preview prêt');
     }

    /**
     * Configuration du conteneur de prévisualisation
     */
    setupPreviewContainer() {
        this.previewContainer = document.getElementById('preview-container');
        if (!this.previewContainer) {
            console.warn('Conteneur de prévisualisation non trouvé');
            return;
        }
        
        // Configuration des styles
        this.previewContainer.classList.add('preview-module-container');
        
        // Configuration des événements
        this.previewContainer.addEventListener('click', (e) => {
            if (e.target === this.previewContainer) {
                this.clearSelection();
            }
        });
        
        // Configuration du redimensionnement
        this.setupResizeObserver();
        
        console.log('Conteneur de prévisualisation configuré');
    }

    /**
     * Configuration de l'affichage du code
     */
    setupCodeDisplay() {
        this.codeDisplay = document.getElementById('mermaid-code');
        if (!this.codeDisplay) {
            console.warn('Zone d\'affichage du code non trouvée');
            return;
        }
        
        // Configuration des événements
        this.codeDisplay.addEventListener('input', () => {
            this.debounceRender();
        });
        
        this.codeDisplay.addEventListener('keydown', (e) => {
            if (e.ctrlKey && e.key === 'Enter') {
                e.preventDefault();
                this.renderCode();
            }
        });
        
        console.log('Affichage du code configuré');
    }

    /**
     * Configuration de la gestion d'erreurs
     */
    setupErrorHandling() {
        this.errorDisplay = document.getElementById('error-display') || this.createErrorDisplay();
        
        // Configuration de Mermaid pour capturer les erreurs
        if (window.mermaid) {
            window.mermaid.parseError = (err, hash) => {
                this.displayError(err);
            };
        }
        
        console.log('Gestion d\'erreurs configurée');
    }

    /**
     * Crée un affichage d'erreur si non existant
     */
    createErrorDisplay() {
        const errorDiv = document.createElement('div');
        errorDiv.id = 'error-display';
        errorDiv.className = 'preview-error-display';
        errorDiv.style.cssText = `
            position: absolute;
            top: 10px;
            left: 10px;
            right: 10px;
            background: #fee;
            border: 1px solid #fcc;
            border-radius: 4px;
            padding: 10px;
            color: #c00;
            font-size: 12px;
            display: none;
            z-index: 1000;
        `;
        
        this.previewContainer.appendChild(errorDiv);
        return errorDiv;
    }

    /**
     * Configuration du zoom et du panoramique
     */
    setupZoomAndPan() {
        if (!this.previewContainer) return;
        
        // Zoom avec la molette
        this.previewContainer.addEventListener('wheel', (e) => {
            e.preventDefault();
            
            const delta = e.deltaY > 0 ? 0.9 : 1.1;
            this.setZoom(this.zoomLevel * delta, e);
        });
        
        // Panoramique avec le clic et glisser
        this.previewContainer.addEventListener('mousedown', (e) => {
            if (e.button === 0 && !e.target.closest('.mermaid')) {
                this.startPan(e);
            }
        });
        
        document.addEventListener('mousemove', (e) => {
            if (this.isPanning) {
                this.updatePan(e);
            }
        });
        
        document.addEventListener('mouseup', () => {
            this.stopPan();
        });
        
        // Boutons de zoom
        this.setupZoomButtons();
        
        console.log('Zoom et panoramique configurés');
    }

    /**
     * Configuration des boutons de zoom
     */
    setupZoomButtons() {
        const zoomInBtn = document.getElementById('zoom-in');
        const zoomOutBtn = document.getElementById('zoom-out');
        const resetZoomBtn = document.getElementById('reset-zoom');
        
        if (zoomInBtn) {
            zoomInBtn.addEventListener('click', () => this.setZoom(this.zoomLevel * 1.2));
        }
        
        if (zoomOutBtn) {
            zoomOutBtn.addEventListener('click', () => this.setZoom(this.zoomLevel * 0.8));
        }
        
        if (resetZoomBtn) {
            resetZoomBtn.addEventListener('click', () => this.resetZoom());
        }
    }

    /**
     * Configuration des boutons d'export
     */
    setupExportButtons() {
        const exportSvgBtn = document.getElementById('export-svg');
        const exportPngBtn = document.getElementById('export-png');
        const exportPdfBtn = document.getElementById('export-pdf');
        const copyCodeBtn = document.getElementById('copy-code');
        
        if (exportSvgBtn) {
            exportSvgBtn.addEventListener('click', () => this.exportAsSVG());
        }
        
        if (exportPngBtn) {
            exportPngBtn.addEventListener('click', () => this.exportAsPNG());
        }
        
        if (exportPdfBtn) {
            exportPdfBtn.addEventListener('click', () => this.exportAsPDF());
        }
        
        if (copyCodeBtn) {
            copyCodeBtn.addEventListener('click', () => this.copyCodeToClipboard());
        }
        
        console.log('Boutons d\'export configurés');
    }

    /**
     * Configuration des raccourcis clavier
     */
    setupKeyboardShortcuts() {
        document.addEventListener('keydown', (e) => {
            if (e.ctrlKey || e.metaKey) {
                switch (e.key) {
                    case 'r':
                        e.preventDefault();
                        this.renderCode();
                        break;
                    case 'c':
                        if (e.shiftKey) {
                            e.preventDefault();
                            this.copyCodeToClipboard();
                        }
                        break;
                    case 'e':
                        if (e.shiftKey) {
                            e.preventDefault();
                            this.exportAsSVG();
                        }
                        break;
                }
            }
        });
        
        console.log('Raccourcis clavier configurés');
    }

    /**
     * Configuration de l'observateur de redimensionnement
     */
    setupResizeObserver() {
        if (!window.ResizeObserver) return;
        
        const resizeObserver = new ResizeObserver(() => {
            this.handleResize();
        });
        
        if (this.previewContainer) {
            resizeObserver.observe(this.previewContainer);
        }
        
        console.log('Observateur de redimensionnement configuré');
    }

    /**
     * Traitement principal du module
     */
    async process(data, context = {}) {
        console.log('👁️ 60-preview traite:', data);
        
        // Traite les données selon le type
        if (data.type === 'mermaid_code_updated') {
            return await this.handleMermaidCodeUpdate(data, context);
        }
        
        if (data.type === 'render_request') {
            return await this.handleRenderRequest(data, context);
        }
        
        if (data.type === 'export_request') {
            return await this.handleExportRequest(data, context);
        }
        
        if (data.type === 'zoom_request') {
            return await this.handleZoomRequest(data, context);
        }
        
        if (data.type === 'theme_styles') {
            return await this.handleThemeStyles(data, context);
        }
        
        // Pass-through par défaut
        return data;
    }

    /**
     * Gère la mise à jour du code Mermaid
     */
    async handleMermaidCodeUpdate(data, context) {
        const { code, source } = data;
        
        if (code !== this.currentMermaidCode) {
            this.currentMermaidCode = code;
            
            // Met à jour l'affichage du code
            if (this.codeDisplay) {
                this.codeDisplay.value = code;
            }
            
            // Rendu différé
            this.debounceRender();
            
            return {
                ...data,
                previewUpdated: true,
                renderScheduled: true
            };
        }
        
        return data;
    }

    /**
     * Gère les demandes de rendu
     */
    async handleRenderRequest(data, context) {
        const { immediate = false } = data;
        
        if (immediate) {
            this.renderCode();
        } else {
            this.debounceRender();
        }
        
        return {
            ...data,
            renderRequested: true,
            immediate: immediate
        };
    }

    /**
     * Gère les demandes d'export
     */
    async handleExportRequest(data, context) {
        const { format = 'svg' } = data;
        
        let result = false;
        
        switch (format.toLowerCase()) {
            case 'svg':
                result = await this.exportAsSVG();
                break;
            case 'png':
                result = await this.exportAsPNG();
                break;
            case 'pdf':
                result = await this.exportAsPDF();
                break;
            default:
                console.warn(`Format d\'export non supporté: ${format}`);
        }
        
        return {
            ...data,
            exportRequested: true,
            format: format,
            success: result
        };
    }

    /**
     * Gère les demandes de zoom
     */
    async handleZoomRequest(data, context) {
        const { action, value } = data;
        
        switch (action) {
            case 'set':
                this.setZoom(value);
                break;
            case 'in':
                this.setZoom(this.zoomLevel * 1.2);
                break;
            case 'out':
                this.setZoom(this.zoomLevel * 0.8);
                break;
            case 'reset':
                this.resetZoom();
                break;
            default:
                console.warn(`Action de zoom inconnue: ${action}`);
        }
        
        return {
            ...data,
            zoomRequested: true,
            action: action,
            zoomLevel: this.zoomLevel
        };
    }

    /**
     * Gère les styles de thème
     */
    async handleThemeStyles(data, context) {
        const { themeStyles, themeVariables } = data;
        
        if (themeVariables) {
            this.applyThemeVariables(themeVariables);
        }
        
        return {
            ...data,
            themeApplied: true
        };
    }

    /**
     * Rendu du code Mermaid avec debouncing
     */
    debounceRender() {
        if (this.renderTimeout) {
            clearTimeout(this.renderTimeout);
        }
        
        this.renderTimeout = setTimeout(() => {
            this.renderCode();
        }, 300);
    }

    /**
     * Rendu du code Mermaid
     */
    async renderCode() {
        if (!this.currentMermaidCode || !this.previewContainer) {
            return;
        }
        
        const startTime = performance.now();
        
        try {
            this.hideError();
            
            // Efface le contenu précédent
            const existingSvg = this.previewContainer.querySelector('.mermaid svg');
            if (existingSvg) {
                existingSvg.remove();
            }
            
            // Rendu Mermaid
            const renderDiv = document.createElement('div');
            renderDiv.className = 'mermaid';
            renderDiv.style.cssText = `
                transform: scale(${this.zoomLevel}) translate(${this.panPosition.x}px, ${this.panPosition.y}px);
                transform-origin: center center;
                transition: transform 0.2s ease;
            `;
            renderDiv.textContent = this.currentMermaidCode;
            
            this.previewContainer.appendChild(renderDiv);
            
            await window.mermaid.run({
                nodes: [renderDiv]
            });
            
            const renderTime = performance.now() - startTime;
            this.lastRenderTime = renderTime;
            
            console.log(`Rendu Mermaid effectué en ${renderTime.toFixed(2)}ms`);
            
            // Ajoute des interactions
            this.addSvgInteractions(renderDiv);
            
        } catch (error) {
            console.error('Erreur de rendu Mermaid:', error);
            this.displayError(error.message);
        }
    }

    /**
     * Ajoute des interactions au SVG
     */
    addSvgInteractions(container) {
        const svg = container.querySelector('svg');
        if (!svg) return;
        
        // Rend les éléments cliquables
        const elements = svg.querySelectorAll('[id]');
        elements.forEach(element => {
            element.style.cursor = 'pointer';
            element.addEventListener('click', (e) => {
                e.stopPropagation();
                this.handleElementClick(element.id);
            });
        });
    }

    /**
     * Gère le clic sur un élément
     */
    handleElementClick(elementId) {
        console.log(`Élément cliqué: ${elementId}`);
        
        // Émet un événement pour les autres modules
        window.dispatchEvent(new CustomEvent('preview:element-clicked', {
            detail: { elementId }
        }));
    }

    /**
     * Définit le niveau de zoom
     */
    setZoom(level, event = null) {
        const newLevel = Math.max(0.1, Math.min(5, level));
        
        if (newLevel !== this.zoomLevel) {
            this.zoomLevel = newLevel;
            this.updateTransform();
            
            console.log(`Zoom défini à: ${this.zoomLevel}x`);
        }
    }

    /**
     * Réinitialise le zoom et le panoramique
     */
    resetZoom() {
        this.zoomLevel = 1;
        this.panPosition = { x: 0, y: 0 };
        this.updateTransform();
        
        console.log('Zoom réinitialisé');
    }

    /**
     * Démarre le panoramique
     */
    startPan(event) {
        this.isPanning = true;
        this.lastPanPoint = { x: event.clientX, y: event.clientY };
        
        this.previewContainer.style.cursor = 'grabbing';
    }

    /**
     * Met à jour le panoramique
     */
    updatePan(event) {
        if (!this.isPanning) return;
        
        const deltaX = event.clientX - this.lastPanPoint.x;
        const deltaY = event.clientY - this.lastPanPoint.y;
        
        this.panPosition.x += deltaX / this.zoomLevel;
        this.panPosition.y += deltaY / this.zoomLevel;
        
        this.lastPanPoint = { x: event.clientX, y: event.clientY };
        
        this.updateTransform();
    }

    /**
     * Arrête le panoramique
     */
    stopPan() {
        this.isPanning = false;
        
        if (this.previewContainer) {
            this.previewContainer.style.cursor = 'default';
        }
    }

    /**
     * Met à jour la transformation
     */
    updateTransform() {
        const mermaidDiv = this.previewContainer?.querySelector('.mermaid');
        if (mermaidDiv) {
            mermaidDiv.style.transform = `scale(${this.zoomLevel}) translate(${this.panPosition.x}px, ${this.panPosition.y}px)`;
        }
    }

    /**
     * Affiche une erreur
     */
    displayError(message) {
        if (!this.errorDisplay) return;
        
        this.errorDisplay.textContent = message;
        this.errorDisplay.style.display = 'block';
        
        console.error('Erreur Preview:', message);
    }

    /**
     * Cache l'erreur
     */
    hideError() {
        if (this.errorDisplay) {
            this.errorDisplay.style.display = 'none';
        }
    }

    /**
     * Efface la sélection
     */
    clearSelection() {
        const svg = this.previewContainer?.querySelector('.mermaid svg');
        if (svg) {
            // Retire la sélection visuelle
            const selected = svg.querySelectorAll('.selected');
            selected.forEach(el => el.classList.remove('selected'));
        }
    }

    /**
     * Gère le redimensionnement
     */
    handleResize() {
        this.debounceRender();
    }

    /**
     * Applique les variables de thème
     */
    applyThemeVariables(variables) {
        Object.entries(variables).forEach(([key, value]) => {
            if (this.previewContainer) {
                this.previewContainer.style.setProperty(key, value);
            }
        });
    }

    /**
     * Exporte en SVG
     */
    async exportAsSVG() {
        const svg = this.previewContainer?.querySelector('.mermaid svg');
        if (!svg) {
            console.warn('Aucun SVG à exporter');
            return false;
        }
        
        try {
            const svgData = new XMLSerializer().serializeToString(svg);
            const blob = new Blob([svgData], { type: 'image/svg+xml' });
            const url = URL.createObjectURL(blob);
            
            const link = document.createElement('a');
            link.href = url;
            link.download = `mermaid-diagram-${Date.now()}.svg`;
            link.click();
            
            URL.revokeObjectURL(url);
            
            console.log('Export SVG effectué');
            return true;
            
        } catch (error) {
            console.error('Erreur export SVG:', error);
            return false;
        }
    }

    /**
     * Exporte en PNG
     */
    async exportAsPNG() {
        const svg = this.previewContainer?.querySelector('.mermaid svg');
        if (!svg) {
            console.warn('Aucun SVG à exporter');
            return false;
        }
        
        try {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            const img = new Image();
            
            const svgData = new XMLSerializer().serializeToString(svg);
            const blob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
            const url = URL.createObjectURL(blob);
            
            return new Promise((resolve) => {
                img.onload = () => {
                    canvas.width = img.width;
                    canvas.height = img.height;
                    ctx.drawImage(img, 0, 0);
                    
                    canvas.toBlob((blob) => {
                        const pngUrl = URL.createObjectURL(blob);
                        const link = document.createElement('a');
                        link.href = pngUrl;
                        link.download = `mermaid-diagram-${Date.now()}.png`;
                        link.click();
                        
                        URL.revokeObjectURL(url);
                        URL.revokeObjectURL(pngUrl);
                        
                        console.log('Export PNG effectué');
                        resolve(true);
                    });
                };
                
                img.src = url;
            });
            
        } catch (error) {
            console.error('Erreur export PNG:', error);
            return false;
        }
    }

    /**
     * Exporte en PDF
     */
    async exportAsPDF() {
        console.warn('Export PDF non implémenté');
        return false;
    }

    /**
     * Copie le code dans le presse-papiers
     */
    async copyCodeToClipboard() {
        if (!this.currentMermaidCode) {
            console.warn('Aucun code à copier');
            return false;
        }
        
        try {
            await navigator.clipboard.writeText(this.currentMermaidCode);
            console.log('Code copié dans le presse-papiers');
            return true;
            
        } catch (error) {
            console.error('Erreur copie dans le presse-papiers:', error);
            return false;
        }
    }

    /**
     * Obtient des statistiques
     */
    getStats() {
        return {
            isInitialized: this.isInitialized,
            hasCode: !!this.currentMermaidCode,
            codeLength: this.currentMermaidCode.length,
            lastRenderTime: this.lastRenderTime,
            zoomLevel: this.zoomLevel,
            panPosition: this.panPosition,
            isPanning: this.isPanning
        };
    }
}

// ===== TRIGGER CHAIN =====
window.PreviewModule = PreviewModule;

export { PreviewModule };