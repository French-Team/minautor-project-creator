/**
 * MODULE DRAGDROP-20 : Gestion du Drag & Drop
 * Gère le drag & drop des éléments et les connexions
 */

import { getCanvasConfig } from '../10-canvas/10-canvas-config.js';

class DragDropModule {
    constructor() {
        this.config = getCanvasConfig();
        this.dragState = {
            isDragging: false,
            draggedElement: null,
            startPosition: null,
            currentPosition: null,
            offset: { x: 0, y: 0 }
        };
        
        this.connectionState = {
            isConnecting: false,
            sourceElement: null,
            targetElement: null,
            tempLine: null
        };
        
        this.isInitialized = false;
        this.init();
    }

    async init() {
        console.log('🖱️ Initialisation DragDropModule-20...');
        
        this.setupEventListeners();
        this.setupConnectionSystem();
        
        this.isInitialized = true;
        console.log('✅ DragDropModule-20 prêt');
    }

    /**
     * Configuration des écouteurs d'événements
     */
    setupEventListeners() {
        document.addEventListener('mousedown', this.handleMouseDown.bind(this));
        document.addEventListener('mousemove', this.handleMouseMove.bind(this));
        document.addEventListener('mouseup', this.handleMouseUp.bind(this));
        
        // Support tactile
        document.addEventListener('touchstart', this.handleTouchStart.bind(this));
        document.addEventListener('touchmove', this.handleTouchMove.bind(this));
        document.addEventListener('touchend', this.handleTouchEnd.bind(this));
        
        console.log('Écouteurs d\'événements configurés');
    }

    /**
     * Configuration du système de connexions
     */
    setupConnectionSystem() {
        // Sera implémenté avec la gestion des connexions
        console.log('Système de connexions configuré (placeholder)');
    }

    /**
     * Traitement principal du module
     */
    async process(data, context = {}) {
        console.log('🖱️ DragDropModule traite:', data);
        
        // Traite les données selon le type
        if (data.type === 'element_added') {
            return await this.handleElementAdded(data, context);
        }
        
        if (data.type === 'connection_request') {
            return await this.handleConnectionRequest(data, context);
        }
        
        if (data.type === 'drag_operation') {
            return await this.handleDragOperation(data, context);
        }
        
        // Pass-through par défaut
        return data;
    }

    /**
     * Gère l'ajout d'un nouvel élément
     */
    async handleElementAdded(data, context) {
        const { elementId, element } = data;
        
        // Rend l'élément draggable
        this.makeElementDraggable(elementId);
        
        // Vérifie s'il faut créer des connexions automatiques
        if (context.autoConnect) {
            await this.checkAutoConnections(element);
        }
        
        console.log(`Élément rendu draggable: ${elementId}`);
        
        return {
            ...data,
            draggable: true,
            connections: []
        };
    }

    /**
     * Gère les demandes de connexion
     */
    async handleConnectionRequest(data, context) {
        const { sourceId, targetId, connectionType } = data;
        
        const connection = await this.createConnection(sourceId, targetId, connectionType);
        
        return {
            type: 'connection_created',
            connectionId: connection.id,
            sourceId: sourceId,
            targetId: targetId,
            connectionType: connectionType
        };
    }

    /**
     * Gère les opérations de drag & drop
     */
    async handleDragOperation(data, context) {
        const { operation, elementId, position } = data;
        
        switch (operation) {
            case 'start':
                return await this.startDrag(elementId, position);
            case 'move':
                return await this.updateDrag(position);
            case 'end':
                return await this.endDrag(position);
            default:
                return data;
        }
    }

    /**
     * Rend un élément draggable
     */
    makeElementDraggable(elementId) {
        const element = document.querySelector(`[data-element-id="${elementId}"]`);
        if (!element) return;
        
        element.classList.add('draggable');
        element.setAttribute('data-draggable', 'true');
        
        // Ajoute les handles de connexion si nécessaire
        this.addConnectionHandles(element);
    }

    /**
     * Ajoute des handles de connexion à un élément
     */
    addConnectionHandles(element) {
        const handles = document.createElement('div');
        handles.className = 'connection-handles';
        handles.innerHTML = `
            <div class="handle top" data-position="top"></div>
            <div class="handle right" data-position="right"></div>
            <div class="handle bottom" data-position="bottom"></div>
            <div class="handle left" data-position="left"></div>
        `;
        
        element.appendChild(handles);
        
        // Ajoute les écouteurs pour la création de connexions
        handles.querySelectorAll('.handle').forEach(handle => {
            handle.addEventListener('mousedown', this.handleConnectionStart.bind(this));
        });
    }

    /**
     * Gère le début d'une connexion
     */
    handleConnectionStart(e) {
        e.preventDefault();
        e.stopPropagation();
        
        const handle = e.target;
        const element = handle.closest('[data-element-id]');
        const elementId = element.getAttribute('data-element-id');
        const position = handle.getAttribute('data-position');
        
        this.connectionState = {
            isConnecting: true,
            sourceElement: elementId,
            sourcePosition: position,
            startPoint: { x: e.clientX, y: e.clientY }
        };
        
        console.log(`Connexion démarrée depuis ${elementId} (${position})`);
    }

    /**
     * Gère le début d'un drag
     */
    async startDrag(elementId, startPosition) {
        const element = this.findElement(elementId);
        if (!element) return;
        
        this.dragState = {
            isDragging: true,
            draggedElement: elementId,
            startPosition: startPosition,
            currentPosition: startPosition,
            offset: this.calculateOffset(element, startPosition)
        };
        
        // Ajoute la classe de drag
        element.classList.add('dragging');
        
        console.log(`Drag démarré: ${elementId}`);
        
        return {
            type: 'drag_started',
            elementId: elementId,
            startPosition: startPosition
        };
    }

    /**
     * Met à jour la position pendant le drag
     */
    async updateDrag(currentPosition) {
        if (!this.dragState.isDragging) return;
        
        const newPosition = {
            x: currentPosition.x - this.dragState.offset.x,
            y: currentPosition.y - this.dragState.offset.y
        };
        
        // Applique le snap à la grille si activé
        const finalPosition = this.config.behaviors.snapToGrid 
            ? this.snapToGrid(newPosition)
            : newPosition;
        
        this.dragState.currentPosition = finalPosition;
        
        // Met à jour l'élément visuellement
        await this.updateElementPosition(
            this.dragState.draggedElement, 
            finalPosition
        );
        
        return {
            type: 'drag_updated',
            elementId: this.dragState.draggedElement,
            position: finalPosition
        };
    }

    /**
     * Termine le drag
     */
    async endDrag(finalPosition) {
        if (!this.dragState.isDragging) return;
        
        const elementId = this.dragState.draggedElement;
        const element = this.findElement(elementId);
        
        if (element) {
            element.classList.remove('dragging');
        }
        
        this.dragState = {
            isDragging: false,
            draggedElement: null,
            startPosition: null,
            currentPosition: null,
            offset: { x: 0, y: 0 }
        };
        
        console.log(`Drag terminé: ${elementId}`);
        
        return {
            type: 'drag_ended',
            elementId: elementId,
            finalPosition: finalPosition
        };
    }

    /**
     * Trouve un élément par ID
     */
    findElement(elementId) {
        return document.querySelector(`[data-element-id="${elementId}"]`);
    }

    /**
     * Calcule l'offset entre la souris et l'élément
     */
    calculateOffset(element, position) {
        const rect = element.getBoundingClientRect();
        return {
            x: position.x - rect.left,
            y: position.y - rect.top
        };
    }

    /**
     * Applique le snap à la grille
     */
    snapToGrid(position) {
        const gridSize = this.config.dimensions.gridSize;
        return {
            x: Math.round(position.x / gridSize) * gridSize,
            y: Math.round(position.y / gridSize) * gridSize
        };
    }

    /**
     * Met à jour la position d'un élément
     */
    async updateElementPosition(elementId, position) {
        // Cette méthode sera implémentée avec le système de rendu
        console.log(`Position mise à jour: ${elementId} ->`, position);
    }

    /**
     * Crée une connexion entre deux éléments
     */
    async createConnection(sourceId, targetId, connectionType) {
        const connectionId = `conn-${Date.now()}`;
        
        const connection = {
            id: connectionId,
            sourceId: sourceId,
            targetId: targetId,
            type: connectionType || 'default',
            created: Date.now()
        };
        
        console.log(`Connexion créée: ${connectionId}`);
        
        return connection;
    }

    /**
     * Vérifie les connexions automatiques
     */
    async checkAutoConnections(element) {
        // Logique pour détecter et créer des connexions automatiques
        console.log('Vérification connexions auto pour:', element);
        return [];
    }

    /**
     * Gestionnaires d'événements souris
     */
    handleMouseDown(e) {
        // Implémentation du drag & drop souris
    }

    handleMouseMove(e) {
        // Implémentation du mouvement souris
    }

    handleMouseUp(e) {
        // Implémentation de la fin du drag souris
    }

    /**
     * Gestionnaires d'événements tactiles
     */
    handleTouchStart(e) {
        // Conversion touch -> mouse
    }

    handleTouchMove(e) {
        // Conversion touch -> mouse
    }

    handleTouchEnd(e) {
        // Conversion touch -> mouse
    }
}

// ===== TRIGGER CHAIN =====
window.DragDropModule = DragDropModule;

export { DragDropModule };