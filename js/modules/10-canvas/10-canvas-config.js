/**
 * CANVAS-10 CONFIG - Configuration du Module Canvas
 * Définit les paramètres et constantes du module
 */

export const CanvasConfig = {
    // Dimensions et grille
    dimensions: {
        width: 1200,
        height: 800,
        gridSize: 20,
        snapToGrid: true
    },
    
    // Styles des éléments
    styles: {
        element: {
            padding: 10,
            borderRadius: 6,
            borderWidth: 2,
            fontSize: 14,
            fontFamily: 'Arial, sans-serif'
        },
        
        selection: {
            borderColor: '#3b82f6',
            borderWidth: 3,
            handleSize: 8,
            handleColor: '#3b82f6'
        },
        
        grid: {
            color: '#e5e7eb',
            opacity: 0.5,
            majorLineEvery: 5
        }
    },
    
    // Types d'éléments supportés
    elementTypes: {
        rectangle: {
            name: 'Rectangle',
            icon: '⬜',
            defaultColor: '#f3f4f6',
            defaultText: 'Nouveau rectangle'
        },
        
        circle: {
            name: 'Cercle',
            icon: '⭕',
            defaultColor: '#dbeafe',
            defaultText: 'Nouveau cercle'
        },
        
        diamond: {
            name: 'Losange',
            icon: '◆',
            defaultColor: '#fef3c7',
            defaultText: 'Nouveau losange'
        },
        
        hexagon: {
            name: 'Hexagone',
            icon: '⬡',
            defaultColor: '#d1fae5',
            defaultText: 'Nouvel hexagone'
        }
    },
    
    // Comportements
    behaviors: {
        // Drag & drop
        dragThreshold: 5,
        autoScrollMargin: 50,
        autoScrollSpeed: 10,
        
        // Sélection
        multiSelectKey: 'ctrlKey',
        deselectOnEmptyClick: true,
        
        // Édition
        doubleClickDelay: 300,
        inlineEditDelay: 500
    },
    
    // Validation
    validation: {
        minElementSize: { width: 40, height: 20 },
        maxElementSize: { width: 400, height: 200 },
        maxCanvasElements: 100,
        
        // Contraintes de position
        keepInBounds: true,
        minDistance: 10
    },
    
    // Performance
    performance: {
        batchUpdateDelay: 16, // ~60fps
        debounceDelay: 100,
        maxUndoStack: 50,
        lazyRenderThreshold: 50 // Nombre d'éléments avant lazy rendering
    },
    
    // Événements
    events: {
        // Déclencheurs pour le pipeline
        triggers: {
            onElementAdd: 'element_added',
            onElementMove: 'element_moved',
            onElementDelete: 'element_deleted',
            onElementEdit: 'element_edited',
            onElementSelect: 'element_selected',
            onCanvasClear: 'canvas_cleared'
        },
        
        // Hooks pour les autres modules
        hooks: {
            beforeElementAdd: [],
            afterElementAdd: [],
            beforeElementMove: [],
            afterElementMove: []
        }
    },
    
    // API externe
    api: {
        // Méthodes exposées
        exposedMethods: [
            'addElement',
            'moveElement',
            'deleteElement',
            'selectElement',
            'editElement',
            'clearCanvas',
            'getCanvasState'
        ],
        
        // Points d'extension
        extensionPoints: [
            'elementRenderer',
            'selectionRenderer',
            'gridRenderer',
            'eventHandler'
        ]
    }
};

// Configuration par environnement
export const CanvasEnvConfig = {
    development: {
        debug: true,
        logLevel: 'debug',
        performanceMonitoring: true,
        validationStrict: false
    },
    
    production: {
        debug: false,
        logLevel: 'error',
        performanceMonitoring: false,
        validationStrict: true
    }
};

// Helper pour obtenir la configuration actuelle
export function getCanvasConfig(env = 'development') {
    const envConfig = CanvasEnvConfig[env] || CanvasEnvConfig.development;
    
    return {
        ...CanvasConfig,
        env: envConfig
    };
}