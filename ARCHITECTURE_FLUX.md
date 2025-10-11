# Architecture Flux - Système de Pipeline Modulaire

## Concept Technique

Ce projet suit une architecture de **pipeline modulaire** où le flux de données traverse des modules spécialisés via des interfaces définies. Chaque module est un point de transformation avec des entrées/sorties contrôlées.

## Architecture en Couches

### 🏭 Couche Racine (Point d'Entrée du Pipeline)
- **Rôle**: Orchestration principale et définition des contrats d'interface
- **Fichiers clés**: `index.html`, `js/app.js`
- **Responsabilités**: 
  - Gestion du cycle de vie de l'application
  - Configuration des pipelines principaux
  - Définition des interfaces entre modules
  - Chargement dynamique des modules via AppPipeline

### 🔧 Couche Modules (Ateliers de Transformation)
Les modules sont des unités de transformation avec des responsabilités spécifiques, organisés en dossiers numérotés avec des espaces pour permettre l'insertion future de nouveaux modules :

#### Module `js/modules/10-canvas/` (Module Canvas)
- **10-canvas.js** - Gestion du canvas et des éléments interactifs
- **10-canvas-trigger.js** - Chaîne de responsabilité pour le routage
- **10-canvas-config.js** - Configuration détaillée du module
- **Rôle**: Rendu visuel, gestion des éléments, événements utilisateur
- **Sorties**: Éléments ajoutés, déplacés, supprimés, édités

#### Module `js/modules/20-dragdrop/` (Module Drag & Drop)
- **20-dragdrop.js** - Système de glisser-déposer avancé
- **20-dragdrop-trigger.js** - Chaîne de responsabilité pour le routage
- **20-dragdrop-config.js** - Configuration détaillée du module
- **Rôle**: Gestion des interactions drag & drop, connexions entre éléments
- **Sorties**: Éléments positionnés, connexions créées

#### Module `js/modules/30-mermaid/` (Module Mermaid)
- **30-mermaid.js** - Génération de code Mermaid
- **30-mermaid-trigger.js** - Chaîne de responsabilité pour le routage
- **30-mermaid-config.js** - Configuration détaillée du module
- **Rôle**: Transformation des éléments canvas en code Mermaid
- **Sorties**: Code Mermaid généré, mises à jour du preview

#### Module `js/modules/40-sidebar/` (Module Sidebar)
- **40-sidebar.js** - Interface latérale et panneaux
- **40-sidebar-trigger.js** - Chaîne de responsabilité pour le routage
- **40-sidebar-config.js** - Configuration détaillée du module
- **Rôle**: Gestion de l'interface utilisateur, panneaux de propriétés
- **Sorties**: État des panneaux, propriétés modifiées

#### Module `js/modules/50-theme/` (Module Theme)
- **50-theme.js** - Gestion des thèmes visuels
- **50-theme-trigger.js** - Chaîne de responsabilité
- **50-theme-config.js** - Configuration des thèmes
- **Rôle**: Application et gestion des thèmes (light, dark, blue, green)
- **Sorties**: Thèmes appliqués, préférences sauvegardées

#### Module `js/modules/60-preview/` (Module Preview)
- **60-preview.js** - Aperçu Mermaid et interactions
- **60-preview-trigger.js** - Chaîne de responsabilité
- **60-preview-config.js** - Configuration de l'aperçu
- **Rôle**: Rendu du diagramme Mermaid, zoom, pan, export
- **Sorties**: Diagrammes rendus, interactions utilisateur

#### Module `js/modules/70-export/` (Module Export)
- **70-export.js** - Exportation multi-formats
- **70-export-trigger.js** - Chaîne de responsabilité
- **70-export-config.js** - Configuration des exports
- **Rôle**: Export SVG, PNG, PDF, JSON, Markdown
- **Sorties**: Fichiers exportés, historique des exports

#### Module `js/modules/80-helper/` (Module Helper)
- **80-helper.js** - Utilitaires partagés
- **80-helper-trigger.js** - Chaîne de responsabilité
- **80-helper-config.js** - Configuration des utilitaires
- **80-helper-utils.js** - Fonctions utilitaires avancées
- **80-helper-logger.js** - Système de journalisation
- **index.js** - Point d'entrée du module
- **Rôle**: Fonctions utilitaires, validation, cache, formatage
- **Sorties**: Données validées, formatées, mises en cache

#### Module `styles/` (Chaîne de Rendu Visuel)
- **default.css** - Système de styles et variables thématiques

#### Module `auto_correction/` (Système de Feedback)
- **scripts/** - Processeurs d'analyse et correction automatique
- **errors_log/** - Base de données d'erreurs structurées
- **knowledge_base.md** - Système de connaissances accumulées

## Principes de Pipeline

### 🔄 Flux de Données
```
Entrée → Validation → Transformation → Sortie → Pipeline Suivant
```

### 🚀 Système AppPipeline et AppManager

#### AppPipeline - Gestionnaire de Pipeline Avancé
L'AppPipeline est le cœur du système de traitement modulaire avec des fonctionnalités avancées :

```javascript
class AppPipeline {
  constructor(config) {
    this.modules = new Map();           // Modules chargés
    this.moduleRegistry = [...];        // Configuration des modules
    this.loadedModules = new Set();     // Modules chargés avec succès
    this.pipelineOrder = [];          // Ordre d'exécution
  }
  
  // Chargement dynamique avec import()
  async loadModule(config) {
    const moduleExports = await import(`${config.path}index.js`);
    const moduleInstance = new ModuleEntry();
    return moduleInstance;
  }
  
  // Traitement avec gestion d'erreurs avancée
  async process(data, context = {}, options = {}) {
    const {
      continueOnError = false,    // Continuer malgré les erreurs
      maxRetries = 1,           // Nombre de tentatives
      retryDelay = 100          // Délai entre tentatives
    } = options;
    
    // Traitement avec suivi détaillé
    return {
      success: true/false,
      data: resultData,
      errors: [...],
      modules: [...],
      context: executionContext
    };
  }
}
```

#### AppManager - Gestionnaire d'Application
L'AppManager fournit une interface de haut niveau pour gérer l'application :

```javascript
class AppManager {
  constructor(config = {}) {
    this.config = { ...defaultConfig, ...config };
    this.pipeline = null;
    this.logger = new Logger();
  }
  
  // Cycle de vie complet
  async initialize() { /* ... */ }
  async start(data = {}) { /* ... */ }
  async stop() { /* ... */ }
  async restart() { /* ... */ }
  
  // Gestion d'état
  getState() { /* ... */ }
  getStats() { /* ... */ }
  generateReport() { /* ... */ }
}
```

#### Configuration Avancée
```javascript
const defaultConfig = {
  autoStart: true,
  debug: true,
  pipelineOrder: [10, 20, 30, 40, 50, 60, 70, 80],
  errorHandling: {
    continueOnError: false,
    maxRetries: 1,
    retryDelay: 100
  },
  logging: {
    level: 'info',      // debug, info, warn, error
    timestamps: true,
    colors: true
  },
  performance: {
    memoryTracking: true,
    executionTiming: true
  }
};
```

### ⚡ Interfaces de Module
Chaque module expose via son trigger :
- **process(data, context)** - Transformation des données
- **determineNextModule(data)** - Routage conditionnel
- **routingTable** - Table de routage avec conditions
- **getState()** - État interne et métriques

### 🔍 Contrats d'Interface
```javascript
// Exemple de contrat entre modules via triggers
const routingTable = {
  'element_added': {
    handler: 'handleElementAdded',
    next: ['mermaid-30', 'sidebar-40', null], // [success, error, default]
    conditions: {
      'success': (data) => data.success === true,
      'error': (data) => data.success === false
    }
  }
};
```

## 🚂 Système de Chaînes de Déclencheurs

### Chaîne de Déclenchement (Trigger Chain)
Les modules de déclenchement constituent des points d'entrée conditionnels avec routage intelligent :

```javascript
// Structure d'un trigger complet
class ModuleTrigger {
  constructor() {
    this.module = null;
    this.nextTrigger = null;
    this.routingTable = this.initializeRoutingTable();
  }
  
  processIncoming(data, context) {
    // Traite les données entrantes
    const route = this.determineNextModule(data);
    return this.routeToNextModule(result, route.next);
  }
  
  determineNextModule(data, direction = 'incoming') {
    // Logique de routage conditionnelle
    for (const [condition, evaluator] of Object.entries(route.conditions)) {
      if (evaluator(data)) {
        return { nextModule: route.next[conditionIndex] };
      }
    }
  }
}
```

### 🚄 Échangeurs Conditionnels (Conditional Switches)
Comme des aiguillages de train, les conditions déterminent le chemin du pipeline :

```javascript
// Table de routage avec conditions multiples
const routingTable = {
  'element_added': {
    handler: 'handleElementAdded',
    next: ['mermaid-30', 'sidebar-40', 'canvas-10'],
    conditions: {
      'valid_element': (data) => data.element && data.element.valid,
      'invalid_element': (data) => data.element && !data.element.valid,
      'error': (data) => data.error
    }
  },
  'theme_changed': {
    handler: 'handleThemeChanged',
    next: ['preview-60', 'sidebar-40', 'canvas-10'],
    conditions: {
      'success': (data) => data.success === true,
      'error': (data) => data.success === false
    }
  }
};
```

### Chaînage Multi-Modules
Le système AppPipeline gère le chaînage automatique :

```javascript
class AppPipeline {
  constructor() {
    this.modules = new Map();
    this.moduleOrder = [];
  }
  
  async loadModule(modulePath, moduleId) {
    // Chargement dynamique des modules
    const module = await import(modulePath);
    this.modules.set(moduleId, module);
    this.sortModulesById();
  }
  
  async processData(data, startModule = null) {
    // Traversée automatique du pipeline
    let currentModule = startModule || this.getFirstModule();
    let result = data;
    
    while (currentModule) {
      result = await currentModule.process(result);
      currentModule = this.getNextModule(currentModule);
    }
    
    return result;
  }
}
```

## Système de Pipeline

### 📊 Pipeline Principal
1. **Initialisation** - Chargement dynamique des modules via AppPipeline
2. **Event Processing** - Capture et traitement des événements utilisateur via triggers
3. **Data Transformation** - Transformation des données via chaînes de responsabilité
4. **Render Pipeline** - Génération et affichage des diagrammes via modules spécialisés
5. **Error Handling** - Capture et traitement des erreurs via gestionnaires dédiés

### 🎯 Points de Contrôle Technique
- **Type Safety**: Validation des types à chaque transition via helper-80
- **Error Boundaries**: Isolation des erreurs par module avec gestionnaires spécifiques
- **State Management**: Gestion d'état décentralisée via états de module
- **Performance Monitoring**: Métriques de performance par pipeline avec logging
- **Module Spacing**: Numérotation avec espaces (10, 20, 30...) pour insertion future

## Patterns d'Implementation

### 🏗️ Pattern Factory (AppPipeline)
```javascript
// Création et gestion des modules via AppPipeline
class AppPipeline {
  createModule(moduleId, config) {
    const modulePath = `./modules/${moduleId}/index.js`;
    return this.loadModule(modulePath, moduleId);
  }
  
  async initializeModules() {
    const modules = [
      'canvas-10', 'dragdrop-20', 'mermaid-30',
      'sidebar-40', 'theme-50', 'preview-60', 
      'export-70', 'helper-80'
    ];
    
    for (const moduleId of modules) {
      await this.loadModule(`./modules/${moduleId}/index.js`, moduleId);
    }
  }
}
```

### 🔄 Pattern Observer (Event Bus)
```javascript
// Communication inter-modules via événements et triggers
class ModuleTrigger {
  async processOutgoing(data, context) {
    // Notifie les modules concernés
    return {
      ...data,
      notifications: [
        { module: 'sidebar-40', type: 'operation_complete' },
        { module: 'preview-60', type: 'update_required' }
      ]
    };
  }
}
```

### 🔧 Pattern Strategy (Routing Strategies)
```javascript
// Stratégies de routage interchangeables
const routingStrategies = {
  sequential: SequentialRoutingStrategy,
  conditional: ConditionalRoutingStrategy,
  parallel: ParallelRoutingStrategy,
  errorFirst: ErrorFirstRoutingStrategy
};
```

### ⚡ Pattern Chain of Responsibility avec Déclencheurs
```javascript
// Chaîne de déclencheurs complète avec conditions
class ModuleTrigger {
  constructor() {
    this.module = null;
    this.nextTrigger = null;
    this.routingTable = this.initializeRoutingTable();
  }
  
  initializeRoutingTable() {
    return {
      'element_added': {
        handler: 'handleElementAdded',
        next: ['mermaid-30', 'sidebar-40', 'canvas-10'],
        conditions: {
          'success': (data) => data.success === true,
          'error': (data) => data.success === false
        }
      }
    };
  }
  
  async processIncoming(data, context) {
    const route = this.determineNextModule(data);
    
    if (route.handler && this.module) {
      const result = await this.module.process(data, context);
      return this.routeToNextModule(result, route.next);
    }
    
    return this.routeToNextModule(data, route.next);
  }
}

// Utilisation dans chaque module
export { ModuleTrigger };
```

### 🎯 Pattern Adapter (Module Integration)
```javascript
// Adaptation entre modules avec interfaces différentes
class ModuleAdapter {
  adaptDataForModule(data, targetModule) {
    switch(targetModule) {
      case 'mermaid-30':
        return this.adaptForMermaid(data);
      case 'preview-60':
        return this.adaptForPreview(data);
      default:
        return data;
    }
  }
}
```

## Flux de Données Détaillé

### 🎨 Ajout d'un Élément
```
Canvas-10 → DragDrop-20 → Mermaid-30 → Preview-60 → Sidebar-40
```

### 🔄 Déplacement d'un Élément
```
Canvas-10 → Mermaid-30 → Preview-60
```

### 🎨 Changement de Thème
```
Theme-50 → Preview-60 → Sidebar-40 → Canvas-10
```

### 💾 Exportation
```
Export-70 → Helper-80 → Sidebar-40
```

### 🔧 Opération Utilitaire
```
Helper-80 → [Module Destinataire] → Sidebar-40
```

## Architecture de Fichiers

```
js/
├── app.js                           # AppPipeline - Orchestration principale
└── modules/
    ├── canvas-10/                   # Module Canvas (base 10)
    │   ├── canvas-10.js            # Module principal
    │   ├── canvas-10-trigger.js    # Chaîne de responsabilité
    │   ├── canvas-10-config.js     # Configuration
    │   └── index.js                # Point d'entrée (optionnel)
    ├── dragdrop-20/                 # Module Drag & Drop (base 20)
    │   └── dragdrop-20.js          # Module principal
    ├── mermaid-30/                  # Module Mermaid (base 30)
    │   ├── mermaid-30.js           # Module principal
    │   ├── mermaid-30-trigger.js   # Chaîne de responsabilité
    │   └── mermaid-30-config.js    # Configuration
    ├── sidebar-40/                  # Module Sidebar (base 40)
    │   └── sidebar-40.js           # Module principal
    ├── theme-50/                    # Module Theme (base 50)
    │   ├── theme-50.js             # Module principal
    │   ├── theme-50-trigger.js     # Chaîne de responsabilité
    │   └── theme-50-config.js      # Configuration
    ├── preview-60/                  # Module Preview (base 60)
    │   ├── preview-60.js           # Module principal
    │   ├── preview-60-trigger.js   # Chaîne de responsabilité
    │   └── preview-60-config.js    # Configuration
    ├── export-70/                     # Module Export (base 70)
    │   ├── export-70.js            # Module principal
    │   ├── export-70-trigger.js    # Chaîne de responsabilité
    │   └── export-70-config.js     # Configuration
    └── helper-80/                   # Module Helper (base 80)
        ├── helper-80.js              # Module principal
        ├── helper-80-trigger.js      # Chaîne de responsabilité
        ├── helper-80-config.js       # Configuration
        ├── helper-80-utils.js        # Utilitaires avancés
        ├── helper-80-logger.js       # Système de journalisation
        └── index.js                  # Point d'entrée principal
```

## Avantages de l'Architecture

1. **Modularité**: Chaque module est indépendant et testable
2. **Extensibilité**: Numérotation avec espaces pour insertion future
3. **Maintenabilité**: Séparation claire des responsabilités
4. **Réutilisabilité**: Modules réutilisables dans d'autres projets
5. **Débogage**: Chaînes de responsabilité traçables
6. **Performance**: Pipeline optimisé avec caching et batching
7. **Sécurité**: Validation et sanitization via helper-80
8. **Monitoring**: Logging complet et métriques de performance

### 🔧 Gestion d'Erreurs
- **Validation d'Entrée** : Chaque module valide ses données d'entrée
- **Erreurs de Transformation** : Gestion des erreurs lors du traitement
- **Erreurs de Pipeline** : Gestion des erreurs dans l'ordre d'exécution
- **Arrêt sur Erreur** : Option pour arrêter ou continuer sur erreur

#### Système de Gestion d'Erreurs Avancé
```javascript
class ErrorHandler {
  shouldStopOnError(error, config) {
    const { severity, type, code, moduleId } = error;
    
    // Arrêt sur erreurs critiques
    if (severity === 'critical') return true;
    
    // Arrêt sur erreurs spécifiques
    if (type === 'syntax' || type === 'dependency') return true;
    
    // Arrêt sur erreurs de module
    if (code === 'MODULE_NOT_FOUND') return true;
    
    // Continuer selon la configuration
    return config.continueOnError === false;
  }
  
  getErrorInfo(error) {
    return {
      type: error.type || 'unknown',
      severity: this.determineSeverity(error),
      module: error.moduleId,
      message: error.message,
      stack: error.stack,
      timestamp: new Date().toISOString(),
      context: error.context
    };
  }
}
```

### 📊 Rapports et Analyse
- **Rapports d'Exécution** : Génération de rapports détaillés après chaque exécution
- **Statistiques** : Collecte de métriques sur les performances et les erreurs
- **Analyse de Tendances** : Identification des patterns d'erreurs récurrents
- **Logs Détaillés** : Système de journalisation avec niveaux de verbosité

#### Exemple de Rapport
```javascript
const report = {
  timestamp: '2024-01-15T10:30:00Z',
  duration: 1250, // ms
  success: true,
  modules: {
    total: 8,
    loaded: 8,
    processed: 8,
    errors: 0
  },
  errors: [],
  performance: {
    memory: { used: 45.2, peak: 52.1 }, // MB
    timing: {
      '10-canvas': 150,
      '20-dragdrop': 85,
      '80-helper': 45
    }
  }
};
```