/**
 * MODULE EXPORT-70 : Gestion des Exports
 * Gère les fonctionnalités d'export avancées (PDF, PNG, SVG, etc.)
 */

class ExportModule {
    constructor() {
        this.isInitialized = false;
        this.supportedFormats = ['svg', 'png', 'pdf', 'json', 'markdown'];
        this.exportHistory = [];
        this.maxHistorySize = 50;
        
        this.init();
    }

    async init() {
         console.log('📤 Initialisation 70-export...');

         this.setupExportContainer();
         this.loadExternalLibraries();
         this.setupExportButtons();
         this.loadExportHistory();

         this.isInitialized = true;
         console.log('✅ 70-export prêt');
     }

    /**
     * Configuration du conteneur d'export
     */
    setupExportContainer() {
        const container = document.getElementById('export-container');
        if (!container) {
            console.warn('Conteneur d\'export non trouvé');
            return;
        }
        
        // Configuration des styles
        container.classList.add('export-module-container');
        
        console.log('Conteneur d\'export configuré');
    }

    /**
     * Chargement des bibliothèques externes nécessaires
     */
    async loadExternalLibraries() {
        try {
            // Chargement de jsPDF pour l'export PDF
            if (!window.jspdf) {
                await this.loadScript('https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js');
            }
            
            // Chargement de html2canvas pour l'export PNG
            if (!window.html2canvas) {
                await this.loadScript('https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js');
            }
            
            console.log('Bibliothèques externes chargées');
            
        } catch (error) {
            console.warn('Erreur chargement bibliothèques:', error);
        }
    }

    /**
     * Chargement d'un script externe
     */
    loadScript(src) {
        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = src;
            script.onload = resolve;
            script.onerror = reject;
            document.head.appendChild(script);
        });
    }

    /**
     * Configuration des boutons d'export
     */
    setupExportButtons() {
        const buttons = [
            { id: 'export-svg-btn', format: 'svg', handler: () => this.exportAsSVG() },
            { id: 'export-png-btn', format: 'png', handler: () => this.exportAsPNG() },
            { id: 'export-pdf-btn', format: 'pdf', handler: () => this.exportAsPDF() },
            { id: 'export-json-btn', format: 'json', handler: () => this.exportAsJSON() },
            { id: 'export-md-btn', format: 'markdown', handler: () => this.exportAsMarkdown() }
        ];
        
        buttons.forEach(button => {
            const element = document.getElementById(button.id);
            if (element) {
                element.addEventListener('click', button.handler);
            }
        });
        
        console.log('Boutons d\'export configurés');
    }

    /**
     * Chargement de l'historique d'export
     */
    loadExportHistory() {
        try {
            const saved = localStorage.getItem('export-history');
            if (saved) {
                this.exportHistory = JSON.parse(saved);
            }
        } catch (error) {
            console.warn('Erreur chargement historique:', error);
        }
    }

    /**
     * Sauvegarde de l'historique d'export
     */
    saveExportHistory() {
        try {
            localStorage.setItem('export-history', JSON.stringify(this.exportHistory));
        } catch (error) {
            console.warn('Erreur sauvegarde historique:', error);
        }
    }

    /**
     * Ajoute une entrée à l'historique
     */
    addToHistory(format, filename, success, metadata = {}) {
        const entry = {
            id: Date.now(),
            timestamp: new Date().toISOString(),
            format: format,
            filename: filename,
            success: success,
            metadata: metadata
        };
        
        this.exportHistory.unshift(entry);
        
        // Limiter la taille de l'historique
        if (this.exportHistory.length > this.maxHistorySize) {
            this.exportHistory = this.exportHistory.slice(0, this.maxHistorySize);
        }
        
        this.saveExportHistory();
    }

    /**
     * Traitement principal du module
     */
    async process(data, context = {}) {
        console.log('📤 70-export traite:', data);
        
        // Traite les données selon le type
        if (data.type === 'export_request') {
            return await this.handleExportRequest(data, context);
        }
        
        if (data.type === 'bulk_export_request') {
            return await this.handleBulkExportRequest(data, context);
        }
        
        if (data.type === 'export_history_request') {
            return await this.handleExportHistoryRequest(data, context);
        }
        
        if (data.type === 'export_settings_request') {
            return await this.handleExportSettingsRequest(data, context);
        }
        
        // Pass-through par défaut
        return data;
    }

    /**
     * Gère les demandes d'export
     */
    async handleExportRequest(data, context) {
        const { format, content, options = {} } = data;
        
        let result = null;
        let success = false;
        let filename = '';
        
        try {
            switch (format.toLowerCase()) {
                case 'svg':
                    result = await this.exportAsSVG(content, options);
                    filename = `diagram-${Date.now()}.svg`;
                    success = true;
                    break;
                    
                case 'png':
                    result = await this.exportAsPNG(content, options);
                    filename = `diagram-${Date.now()}.png`;
                    success = true;
                    break;
                    
                case 'pdf':
                    result = await this.exportAsPDF(content, options);
                    filename = `diagram-${Date.now()}.pdf`;
                    success = true;
                    break;
                    
                case 'json':
                    result = await this.exportAsJSON(content, options);
                    filename = `diagram-${Date.now()}.json`;
                    success = true;
                    break;
                    
                case 'markdown':
                    result = await this.exportAsMarkdown(content, options);
                    filename = `diagram-${Date.now()}.md`;
                    success = true;
                    break;
                    
                default:
                    throw new Error(`Format d'export non supporté: ${format}`);
            }
            
            this.addToHistory(format, filename, success, {
                size: result?.size || 0,
                duration: result?.duration || 0
            });
            
        } catch (error) {
            console.error('Erreur export:', error);
            success = false;
            filename = '';
            result = { error: error.message };
        }
        
        return {
            ...data,
            success: success,
            filename: filename,
            result: result
        };
    }

    /**
     * Gère les demandes d'export en masse
     */
    async handleBulkExportRequest(data, context) {
        const { formats, content, options = {} } = data;
        
        const results = [];
        
        for (const format of formats) {
            try {
                const result = await this.process({
                    type: 'export_request',
                    format: format,
                    content: content,
                    options: options
                }, context);
                
                results.push(result);
                
            } catch (error) {
                results.push({
                    format: format,
                    success: false,
                    error: error.message
                });
            }
        }
        
        return {
            ...data,
            type: 'bulk_export_complete',
            results: results,
            total: results.length,
            successful: results.filter(r => r.success).length
        };
    }

    /**
     * Gère les demandes d'historique d'export
     */
    async handleExportHistoryRequest(data, context) {
        const { limit = 20, format = 'json' } = data;
        
        const history = this.exportHistory.slice(0, limit);
        
        return {
            ...data,
            type: 'export_history_response',
            history: history,
            total: this.exportHistory.length,
            format: format
        };
    }

    /**
     * Gère les demandes de paramètres d'export
     */
    async handleExportSettingsRequest(data, context) {
        const { action } = data;
        
        switch (action) {
            case 'get':
                return {
                    ...data,
                    type: 'export_settings_response',
                    supportedFormats: this.supportedFormats,
                    maxHistorySize: this.maxHistorySize
                };
                
            case 'clear_history':
                this.exportHistory = [];
                this.saveExportHistory();
                return {
                    ...data,
                    type: 'export_settings_response',
                    action: 'history_cleared'
                };
                
            default:
                return data;
        }
    }

    /**
     * Export en SVG
     */
    async exportAsSVG(content = null, options = {}) {
        const startTime = performance.now();
        
        try {
            // Obtient le contenu SVG si non fourni
            let svgContent = content;
            if (!svgContent) {
                const svgElement = document.querySelector('.mermaid svg');
                if (!svgElement) {
                    throw new Error('Aucun élément SVG trouvé');
                }
                svgContent = new XMLSerializer().serializeToString(svgElement);
            }
            
            // Applique les options
            const finalContent = this.applySVGOptions(svgContent, options);
            
            // Crée le blob et télécharge
            const blob = new Blob([finalContent], { type: 'image/svg+xml' });
            const url = URL.createObjectURL(blob);
            
            const filename = options.filename || `diagram-${Date.now()}.svg`;
            await this.downloadFile(url, filename);
            
            URL.revokeObjectURL(url);
            
            const duration = performance.now() - startTime;
            
            console.log(`Export SVG effectué en ${duration.toFixed(2)}ms`);
            
            return {
                success: true,
                size: blob.size,
                duration: duration,
                filename: filename
            };
            
        } catch (error) {
            throw new Error(`Erreur export SVG: ${error.message}`);
        }
    }

    /**
     * Applique les options SVG
     */
    applySVGOptions(svgContent, options) {
        let modifiedContent = svgContent;
        
        // Ajoute les métadonnées si demandé
        if (options.includeMetadata) {
            const metadata = this.generateSVGMetadata();
            modifiedContent = modifiedContent.replace('<svg', `<svg ${metadata}`);
        }
        
        // Optimise si demandé
        if (options.optimize) {
            modifiedContent = this.optimizeSVG(modifiedContent);
        }
        
        // Applique un style personnalisé si demandé
        if (options.customStyles) {
            modifiedContent = this.applySVGStyles(modifiedContent, options.customStyles);
        }
        
        return modifiedContent;
    }

    /**
     * Génère les métadonnées SVG
     */
    generateSVGMetadata() {
        return `
            data-created-by="Canvas Mermaid Generator"
            data-created-date="${new Date().toISOString()}"
            data-version="1.0"
        `;
    }

    /**
     * Optimise le contenu SVG
     */
    optimizeSVG(svgContent) {
        // Supprime les espaces blancs inutiles
        return svgContent
            .replace(/\s+/g, ' ')
            .replace(/> </g, '><')
            .trim();
    }

    /**
     * Applique des styles SVG personnalisés
     */
    applySVGStyles(svgContent, styles) {
        // Implémentation simplifiée - peut être étendue
        return svgContent;
    }

    /**
     * Export en PNG
     */
    async exportAsPNG(content = null, options = {}) {
        const startTime = performance.now();
        
        try {
            // Obtient l'élément canvas ou SVG
            let sourceElement = content;
            if (!sourceElement) {
                sourceElement = document.querySelector('.mermaid svg') || 
                               document.querySelector('#preview-container .mermaid');
            }
            
            if (!sourceElement) {
                throw new Error('Aucun élément source trouvé pour l\'export PNG');
            }
            
            // Utilise html2canvas ou conversion SVG
            let canvas;
            if (sourceElement.tagName === 'svg') {
                canvas = await this.svgToCanvas(sourceElement, options);
            } else {
                canvas = await window.html2canvas(sourceElement, {
                    backgroundColor: options.backgroundColor || 'white',
                    scale: options.scale || 2,
                    ...options
                });
            }
            
            // Convertit en blob et télécharge
            const blob = await new Promise(resolve => {
                canvas.toBlob(resolve, 'image/png', options.quality || 0.9);
            });
            
            const url = URL.createObjectURL(blob);
            const filename = options.filename || `diagram-${Date.now()}.png`;
            await this.downloadFile(url, filename);
            
            URL.revokeObjectURL(url);
            
            const duration = performance.now() - startTime;
            
            console.log(`Export PNG effectué en ${duration.toFixed(2)}ms`);
            
            return {
                success: true,
                size: blob.size,
                duration: duration,
                filename: filename,
                dimensions: {
                    width: canvas.width,
                    height: canvas.height
                }
            };
            
        } catch (error) {
            throw new Error(`Erreur export PNG: ${error.message}`);
        }
    }

    /**
     * Convertit SVG en Canvas
     */
    async svgToCanvas(svgElement, options = {}) {
        return new Promise((resolve, reject) => {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            const img = new Image();
            
            const svgData = new XMLSerializer().serializeToString(svgElement);
            const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
            const url = URL.createObjectURL(svgBlob);
            
            img.onload = () => {
                const scale = options.scale || 2;
                canvas.width = img.width * scale;
                canvas.height = img.height * scale;
                
                ctx.scale(scale, scale);
                ctx.drawImage(img, 0, 0);
                
                URL.revokeObjectURL(url);
                resolve(canvas);
            };
            
            img.onerror = (error) => {
                URL.revokeObjectURL(url);
                reject(error);
            };
            
            img.src = url;
        });
    }

    /**
     * Export en PDF
     */
    async exportAsPDF(content = null, options = {}) {
        const startTime = performance.now();
        
        try {
            if (!window.jspdf) {
                throw new Error('jsPDF non disponible');
            }
            
            // Obtient le contenu SVG
            let svgContent = content;
            if (!svgContent) {
                const svgElement = document.querySelector('.mermaid svg');
                if (!svgElement) {
                    throw new Error('Aucun élément SVG trouvé');
                }
                svgContent = new XMLSerializer().serializeToString(svgElement);
            }
            
            // Crée le PDF
            const { jsPDF } = window.jspdf;
            const pdf = new jsPDF({
                orientation: options.orientation || 'portrait',
                format: options.format || 'a4',
                unit: 'mm'
            });
            
            // Convertit SVG en PDF
            await this.addSVGToPDF(pdf, svgContent, options);
            
            // Sauvegarde le PDF
            const filename = options.filename || `diagram-${Date.now()}.pdf`;
            pdf.save(filename);
            
            const duration = performance.now() - startTime;
            
            console.log(`Export PDF effectué en ${duration.toFixed(2)}ms`);
            
            return {
                success: true,
                size: 0, // jsPDF ne fournit pas la taille
                duration: duration,
                filename: filename
            };
            
        } catch (error) {
            throw new Error(`Erreur export PDF: ${error.message}`);
        }
    }

    /**
     * Ajoute SVG au PDF
     */
    async addSVGToPDF(pdf, svgContent, options = {}) {
        // Conversion simplifiée - peut être améliorée
        const canvas = await this.svgToCanvas(this.createSVGElement(svgContent), {
            scale: 3,
            backgroundColor: 'white'
        });
        
        const imgData = canvas.toDataURL('image/png');
        const imgWidth = 210; // A4 width in mm
        const pageHeight = 297; // A4 height in mm
        const imgHeight = (canvas.height * imgWidth) / canvas.width;
        
        let heightLeft = imgHeight;
        let position = 0;
        
        pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
        heightLeft -= pageHeight;
        
        while (heightLeft >= 0) {
            position = heightLeft - imgHeight;
            pdf.addPage();
            pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
            heightLeft -= pageHeight;
        }
    }

    /**
     * Crée un élément SVG temporaire
     */
    createSVGElement(svgContent) {
        const div = document.createElement('div');
        div.innerHTML = svgContent;
        return div.querySelector('svg');
    }

    /**
     * Export en JSON
     */
    async exportAsJSON(content = null, options = {}) {
        const startTime = performance.now();
        
        try {
            // Obtient les données du canvas
            let data = content;
            if (!data) {
                const canvasModule = window.canvasModule || window.CanvasModule;
                if (canvasModule && canvasModule.getCanvasData) {
                    data = canvasModule.getCanvasData();
                } else {
                    // Données par défaut
                    data = {
                        elements: [],
                        connections: [],
                        metadata: {
                            created: new Date().toISOString(),
                            version: '1.0'
                        }
                    };
                }
            }
            
            // Formate les données
            const jsonData = {
                type: 'canvas-mermaid-diagram',
                version: '1.0',
                created: new Date().toISOString(),
                data: data,
                mermaidCode: this.getCurrentMermaidCode(),
                metadata: {
                    ...options.metadata,
                    exportFormat: 'json',
                    exportDate: new Date().toISOString()
                }
            };
            
            // Crée le blob et télécharge
            const jsonString = JSON.stringify(jsonData, null, options.pretty ? 2 : 0);
            const blob = new Blob([jsonString], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            
            const filename = options.filename || `diagram-${Date.now()}.json`;
            await this.downloadFile(url, filename);
            
            URL.revokeObjectURL(url);
            
            const duration = performance.now() - startTime;
            
            console.log(`Export JSON effectué en ${duration.toFixed(2)}ms`);
            
            return {
                success: true,
                size: blob.size,
                duration: duration,
                filename: filename
            };
            
        } catch (error) {
            throw new Error(`Erreur export JSON: ${error.message}`);
        }
    }

    /**
     * Export en Markdown
     */
    async exportAsMarkdown(content = null, options = {}) {
        const startTime = performance.now();
        
        try {
            // Obtient le code Mermaid
            const mermaidCode = content || this.getCurrentMermaidCode();
            
            if (!mermaidCode) {
                throw new Error('Aucun code Mermaid disponible');
            }
            
            // Génère le contenu Markdown
            const markdownContent = this.generateMarkdownContent(mermaidCode, options);
            
            // Crée le blob et télécharge
            const blob = new Blob([markdownContent], { type: 'text/markdown' });
            const url = URL.createObjectURL(blob);
            
            const filename = options.filename || `diagram-${Date.now()}.md`;
            await this.downloadFile(url, filename);
            
            URL.revokeObjectURL(url);
            
            const duration = performance.now() - startTime;
            
            console.log(`Export Markdown effectué en ${duration.toFixed(2)}ms`);
            
            return {
                success: true,
                size: blob.size,
                duration: duration,
                filename: filename
            };
            
        } catch (error) {
            throw new Error(`Erreur export Markdown: ${error.message}`);
        }
    }

    /**
     * Génère le contenu Markdown
     */
    generateMarkdownContent(mermaidCode, options = {}) {
        const title = options.title || 'Diagramme Mermaid';
        const description = options.description || 'Diagramme généré avec Canvas Mermaid Generator';
        const includeMetadata = options.includeMetadata !== false;
        
        let content = `# ${title}\n\n`;
        
        if (description) {
            content += `${description}\n\n`;
        }
        
        if (includeMetadata) {
            content += `## Métadonnées\n\n`;
            content += `- **Date de création**: ${new Date().toLocaleString()}\n`;
            content += `- **Généré par**: Canvas Mermaid Generator\n`;
            content += `- **Version**: 1.0\n\n`;
        }
        
        content += `## Diagramme\n\n`;
        content += '```mermaid\n';
        content += mermaidCode;
        content += '\n```\n';
        
        if (options.includeInstructions) {
            content += `\n## Instructions\n\n`;
            content += `Pour visualiser ce diagramme:\n`;
            content += `1. Copiez le code Mermaid ci-dessus\n`;
            content += `2. Rendez-vous sur [Mermaid Live Editor](https://mermaid.live)\n`;
            content += `3. Collez le code pour voir le diagramme\n`;
        }
        
        return content;
    }

    /**
     * Obtient le code Mermaid actuel
     */
    getCurrentMermaidCode() {
        const codeElement = document.getElementById('mermaid-code');
        return codeElement ? codeElement.value : '';
    }

    /**
     * Télécharge un fichier
     */
    async downloadFile(url, filename) {
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        link.style.display = 'none';
        
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }

    /**
     * Obtient des statistiques
     */
    getStats() {
        const successfulExports = this.exportHistory.filter(e => e.success);
        
        return {
            isInitialized: this.isInitialized,
            supportedFormats: this.supportedFormats,
            exportHistory: {
                total: this.exportHistory.length,
                successful: successfulExports.length,
                failed: this.exportHistory.length - successfulExports.length,
                lastExport: this.exportHistory[0] || null
            },
            formats: this.getFormatStats()
        };
    }

    /**
     * Obtient les statistiques par format
     */
    getFormatStats() {
        const stats = {};
        
        this.supportedFormats.forEach(format => {
            const exports = this.exportHistory.filter(e => e.format === format);
            const successful = exports.filter(e => e.success);
            
            stats[format] = {
                total: exports.length,
                successful: successful.length,
                successRate: exports.length > 0 ? (successful.length / exports.length * 100).toFixed(1) : 0,
                averageSize: successful.length > 0 ? 
                    (successful.reduce((sum, e) => sum + (e.metadata?.size || 0), 0) / successful.length).toFixed(0) : 0
            };
        });
        
        return stats;
    }
}

// ===== TRIGGER CHAIN =====
window.ExportModule = ExportModule;

export { ExportModule };