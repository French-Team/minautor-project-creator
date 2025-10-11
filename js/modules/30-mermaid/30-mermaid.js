/**
 * MODULE MERMAID-30 : Génération et Rendu Mermaid
 * Génère le code Mermaid et gère l'aperçu
 */

class MermaidModule {
    constructor() {
        this.mermaidCode = '';
        this.diagramType = 'flowchart';
        this.elementCounter = 0;
        this.connections = new Map();
        this.isInitialized = false;
        
        this.init();
    }

    async init() {
         console.log('📊 Initialisation 30-mermaid...');

         await this.setupMermaid();
         this.setupPreview();
         this.setupCodePanel();

         this.isInitialized = true;
         console.log('✅ 30-mermaid prêt');
     }

    /**
     * Configuration de Mermaid.js
     */
    async setupMermaid() {
        // Configuration Mermaid
        if (window.mermaid) {
            window.mermaid.initialize({
                startOnLoad: false,
                theme: 'default',
                securityLevel: 'loose',
                flowchart: {
                    useMaxWidth: true,
                    htmlLabels: true,
                    curve: 'basis'
                }
            });
        }
        
        console.log('Mermaid configuré');
    }

    /**
     * Configuration du panneau d'aperçu
     */
    setupPreview() {
        this.previewContainer = document.getElementById('previewContainer');
        this.previewElement = document.getElementById('mermaidPreview');
        
        console.log('Panneau d\'aperçu configuré');
    }

    /**
     * Configuration du panneau de code
     */
    setupCodePanel() {
        this.codeTextarea = document.getElementById('mermaidCode');
        this.codePanel = document.getElementById('codePanel');
        
        if (this.codeTextarea) {
            this.codeTextarea.addEventListener('input', this.debounce(() => {
                this.updateFromCode();
            }, 500));
        }
        
        console.log('Panneau de code configuré');
    }

    /**
     * Traitement principal du module
     */
    async process(data, context = {}) {
        console.log('📊 30-mermaid traite:', data);
        
        // Traite les données selon le type
        if (data.type === 'element_added') {
            return await this.handleElementAdded(data, context);
        }
        
        if (data.type === 'element_moved') {
            return await this.handleElementMoved(data, context);
        }
        
        if (data.type === 'element_deleted') {
            return await this.handleElementDeleted(data, context);
        }
        
        if (data.type === 'element_edited') {
            return await this.handleElementEdited(data, context);
        }
        
        if (data.type === 'canvas_cleared') {
            return await this.handleCanvasCleared(data, context);
        }
        
        // Pass-through par défaut
        return data;
    }

    /**
     * Gère l'ajout d'un élément
     */
    async handleElementAdded(data, context) {
        const { elementId, element } = data;
        
        // Génère le code Mermaid pour le nouvel élément
        const elementCode = this.generateElementCode(element);
        
        // Met à jour le code global
        this.updateMermaidCode();
        
        // Met à jour l'aperçu
        await this.updatePreview();
        
        console.log(`Élément ajouté au code Mermaid: ${elementId}`);
        
        return {
            ...data,
            mermaidCode: this.mermaidCode,
            elementCode: elementCode
        };
    }

    /**
     * Gère le déplacement d'un élément
     */
    async handleElementMoved(data, context) {
        // Mermaid ne gère pas les positions absolues
        // mais on peut mettre à jour l'ordre des éléments
        
        this.updateMermaidCode();
        await this.updatePreview();
        
        return {
            ...data,
            mermaidCode: this.mermaidCode
        };
    }

    /**
     * Gère la suppression d'un élément
     */
    async handleElementDeleted(data, context) {
        const { elementId } = data;
        
        // Supprime les connexions liées
        this.removeElementConnections(elementId);
        
        // Met à jour le code
        this.updateMermaidCode();
        await this.updatePreview();
        
        return {
            ...data,
            mermaidCode: this.mermaidCode
        };
    }

    /**
     * Gère l'édition d'un élément
     */
    async handleElementEdited(data, context) {
        const { elementId, data: elementData } = data;
        
        // Met à jour le code avec les nouvelles données
        this.updateMermaidCode();
        await this.updatePreview();
        
        return {
            ...data,
            mermaidCode: this.mermaidCode
        };
    }

    /**
     * Gère le nettoyage du canvas
     */
    async handleCanvasCleared(data, context) {
        this.mermaidCode = '';
        this.elementCounter = 0;
        this.connections.clear();
        
        await this.updatePreview();
        
        return {
            ...data,
            mermaidCode: this.mermaidCode
        };
    }

    /**
     * Génère le code pour un élément
     */
    generateElementCode(element) {
        const { type, data, id } = element;
        const label = data.text || `Élément ${id}`;
        
        switch (type) {
            case 'rectangle':
                return `${id}["${label}"]`;
            case 'circle':
                return `${id}(("${label}"))`;
            case 'diamond':
                return `${id}{"${label}"}`;
            case 'hexagon':
                return `${id}{{"${label}"}}`;
            default:
                return `${id}["${label}"]`;
        }
    }

    /**
     * Met à jour le code Mermaid complet
     */
    updateMermaidCode() {
        // Collecte tous les éléments du canvas
        const elements = this.collectCanvasElements();
        const connections = this.collectConnections();
        
        // Génère le code
        this.mermaidCode = this.generateFlowchartCode(elements, connections);
        
        // Met à jour le textarea
        if (this.codeTextarea) {
            this.codeTextarea.value = this.mermaidCode;
        }
        
        console.log('Code Mermaid mis à jour');
    }

    /**
     * Collecte les éléments du canvas
     */
    collectCanvasElements() {
        // Sera implémenté avec la communication inter-modules
        return [];
    }

    /**
     * Collecte les connexions
     */
    collectConnections() {
        return Array.from(this.connections.values());
    }

    /**
     * Génère le code Flowchart
     */
    generateFlowchartCode(elements, connections) {
        let code = 'flowchart TD\n';
        
        // Ajoute les éléments
        elements.forEach(element => {
            code += `    ${this.generateElementCode(element)}\n`;
        });
        
        // Ajoute les connexions
        connections.forEach(connection => {
            const { sourceId, targetId, type } = connection;
            const arrow = this.getConnectionArrow(type);
            code += `    ${sourceId} ${arrow} ${targetId}\n`;
        });
        
        return code.trim();
    }

    /**
     * Obtient la flèche pour un type de connexion
     */
    getConnectionArrow(type) {
        const arrows = {
            default: '-->',
            dashed: '--->',
            dotted: '-.->',
            thick: '==>',
            bidirectional: '<-->',
            reverse: '<--'
        };
        
        return arrows[type] || arrows.default;
    }

    /**
     * Met à jour l'aperçu
     */
    async updatePreview() {
        if (!this.previewElement || !this.mermaidCode) return;
        
        try {
            // Efface l'aperçu précédent
            this.previewElement.innerHTML = '';
            
            // Rend le diagramme
            const { svg } = await window.mermaid.render(
                'mermaid-preview', 
                this.mermaidCode
            );
            
            this.previewElement.innerHTML = svg;
            
            // Affiche le conteneur si caché
            if (this.previewContainer) {
                this.previewContainer.classList.add('active');
            }
            
            console.log('Aperçu mis à jour');
            
        } catch (error) {
            console.error('Erreur rendu Mermaid:', error);
            this.showError(error);
        }
    }

    /**
     * Met à jour depuis le code
     */
    async updateFromCode() {
        const code = this.codeTextarea?.value?.trim();
        if (!code) return;
        
        this.mermaidCode = code;
        await this.updatePreview();
        
        // Notifie les autres modules du changement
        return {
            type: 'code_updated',
            code: this.mermaidCode
        };
    }

    /**
     * Supprime les connexions d'un élément
     */
    removeElementConnections(elementId) {
        this.connections.forEach((connection, id) => {
            if (connection.sourceId === elementId || connection.targetId === elementId) {
                this.connections.delete(id);
            }
        });
    }

    /**
     * Affiche une erreur
     */
    showError(error) {
        if (this.previewElement) {
            this.previewElement.innerHTML = `
                <div class="mermaid-error">
                    <h3>Erreur de rendu</h3>
                    <p>${error.message}</p>
                    <pre>${error.stack}</pre>
                </div>
            `;
        }
    }

    /**
     * Utility: debounce
     */
    debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }

    /**
     * Exporte le diagramme
     */
    async exportDiagram() {
        if (!this.mermaidCode) {
            console.warn('Aucun code à exporter');
            return;
        }
        
        // Crée un blob avec le code
        const blob = new Blob([this.mermaidCode], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        
        // Crée un lien de téléchargement
        const a = document.createElement('a');
        a.href = url;
        a.download = `diagram-${Date.now()}.mmd`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        
        URL.revokeObjectURL(url);
        
        console.log('Diagramme exporté');
    }

    /**
     * Importe depuis du code
     */
    async importFromCode(code) {
        this.mermaidCode = code;
        
        if (this.codeTextarea) {
            this.codeTextarea.value = code;
        }
        
        await this.updatePreview();
        
        // Notifie les autres modules
        return {
            type: 'code_imported',
            code: code
        };
    }
}

// ===== TRIGGER CHAIN =====
window.MermaidModule = MermaidModule;

export { MermaidModule };