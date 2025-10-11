# Mermaid Canvas Generator

Une application web interactive permettant de créer et manipuler des diagrammes Mermaid via une interface de glisser-déposer intuitive avec une architecture modulaire avancée.

## Fonctionnalités

### 🎨 Interface Glisser-Déposer
- **Éléments prédéfinis** : Démarrage, processus, décisions, fin, classes, interfaces, états
- **Connexions** : Flèches simples, flèches en pointillés, connexions bidirectionnelles
- **Placement intuitif** : Déposez les éléments directement sur le canvas
- **Édition en ligne** : Cliquez sur un élément pour modifier son texte
- **Déplacement fluide** : Glissez les éléments pour les repositionner
- **Sélection multiple** : Support des raccourcis clavier (Ctrl+A, Suppr)
- **Mode connexion** : Créez des liens entre éléments facilement

### ✏️ Édition Interactive
- **Édition en ligne** : Cliquez sur un élément pour modifier son texte
- **Déplacement fluide** : Glissez les éléments pour les repositionner
- **Sélection multiple** : Support des raccourcis clavier (Ctrl+A, Suppr)
- **Mode connexion** : Créez des liens entre éléments facilement

### 📝 Code Mermaid en Temps Réel
- **Génération automatique** : Le code Mermaid est généré en temps réel
- **Vue code optionnelle** : Affichez/masquez le panneau de code
- **Édition bidirectionnelle** : Modifiez le code ou le visuel
- **Export facile** : Téléchargez le code Mermaid généré

### 🎯 Aperçu en Direct
- **Visualisation instantanée** : Voir le diagramme Mermaid en temps réel
- **Support multi-types** : Flowcharts, diagrammes de classes, diagrammes d'états
- **Interface responsive** : S'adapte à différentes tailles d'écran
- **Zoom et Pan** : Navigation fluide dans le diagramme
- **Export SVG/PNG/PDF** : Exportation multi-formats

### 🎨 Gestion des Thèmes
- **Thèmes intégrés** : Light, Dark, Blue, Green
- **Application automatique** : Thèmes appliqués à tous les modules
- **Préférences sauvegardées** : Paramètres persistants
- **Variables CSS** : Système de variables thématiques

### 💾 Exportation Avancée
- **Formats multiples** : SVG, PNG, PDF, JSON, Markdown
- **Export unique** : Téléchargez un diagramme
- **Export en masse** : Traitement par lots
- **Historique des exports** : Suivi des exports récents
- **Bibliothèques externes** : jsPDF, html2canvas intégrés

### 🔧 Utilitaires Avancés
- **Validation** : Validation des données et des entrées
- **Cache intelligent** : Système de cache avec TTL
- **Fonctions mathématiques** : Calculs avancés et géométrie
- **Manipulation DOM** : Fonctions DOM sécurisées
- **Génération d'IDs** : UUIDs, IDs courts, séquentiels
- **Formatage** : Chaînes, objets, tableaux

### 📝 Journalisation
- **Niveaux de log** : Debug, Info, Warn, Error
- **Destinations multiples** : Console, fichier, distant
- **Format personnalisé** : Structure des logs configurable
- **Sanitization** : Protection des données sensibles
- **Export des logs** : JSON, CSV, TXT

## Architecture Modulaire

Le projet utilise une architecture de pipeline modulaire avec des chaînes de responsabilité :

### 🏗️ Structure des Modules
```
js/modules/
├── 10-canvas/          # Gestion du canvas et des éléments
├── 20-dragdrop/        # Système de glisser-déposer
├── 30-mermaid/         # Génération de code Mermaid
├── 40-sidebar/         # Interface utilisateur et panneaux
├── 50-theme/           # Gestion des thèmes visuels
├── 60-preview/         # Aperçu Mermaid et interactions
├── 70-export/          # Exportation multi-formats
└── 80-helper/          # Utilitaires partagés et logging
```

### ⚡ Chaînes de Déclencheurs
Chaque module utilise un système de déclencheurs avec routage conditionnel :
- **processIncoming()** : Traite les données entrantes
- **determineNextModule()** : Routage basé sur des conditions
- **routingTable** : Table de routage avec conditions
- **getState()** : État interne et métriques

### 🚀 Système AppPipeline et AppManager

#### AppPipeline - Gestionnaire de Pipeline Avancé
L'AppPipeline est le cœur du système de traitement modulaire avec des fonctionnalités avancées :

```javascript
class AppPipeline {
  // Chargement dynamique avec import()
  async loadModule(config) {
    const moduleExports = await import(`${config.path}index.js`);
    return new ModuleEntry();
  }
  
  // Traitement avec gestion d'erreurs avancée
  async process(data, context = {}, options = {}) {
    const {
      continueOnError = false,    // Continuer malgré les erreurs
      maxRetries = 1,           // Nombre de tentatives
      retryDelay = 100          // Délai entre tentatives
    } = options;
    
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

## Utilisation

### 🚀 Démarrage Rapide

#### Méthode 1 : Fichier de Démarrage (Recommandé)
Double-cliquez simplement sur **`start.bat`** à la racine du projet. Le serveur se lancera automatiquement et ouvrira votre navigateur.

#### Méthode 2 : Commandes NPM
```bash
# Installation des dépendances (optionnel)
npm install

# Démarrage avec Node.js (recommandé)
npm start

# Mode développement avec CORS
npm run dev

# Démarrage avec Python (si Node.js non disponible)
npm run serve
```

#### Méthode 3 : Manuel
1. **Ouvrez** `index.html` dans votre navigateur web moderne
2. **Glissez** des éléments depuis la sidebar vers le canvas
3. **Éditez** le texte des éléments en cliquant dessus
4. **Connectez** les éléments en utilisant le mode connexion
5. **Visualisez** le résultat dans l'aperçu
6. **Exportez** dans le format de votre choix

### Utilisation de l'Application

### Navigation dans le Canvas

- **Zoom** : Utilisez la molette de la souris
- **Déplacement** : Maintenez Ctrl + clic gauche ou bouton du milieu
- **Réinitialiser** : Ctrl + 0 pour revenir à la vue par défaut

### Raccourcis Clavier

| Raccourci | Action |
|-----------|---------|
| `Ctrl + S` | Exporter le diagramme |
| `Ctrl + A` | Sélectionner tous les éléments |
| `Suppr` | Supprimer l'élément sélectionné |
| `Esc` | Sortir du mode connexion |

### Types de Diagrammes Supportés

#### Flowchart (Flux de Processus)
- Démarrage/Fin : Cercles
- Processus : Rectangles
- Décisions : Losanges
- Connexions : Flèches

#### Diagramme de Classes
- Classes : Rectangles avec nom
- Interfaces : Avec notation `<<interface>>`
- Relations : Flèches entre classes

#### Diagramme d'États
- États simples : Cercles
- États composés : Rectangles arrondis
- Transitions : Flèches entre états

## Structure du Projet

```
canvas-mermaid-generator/
├── index.html              # Page principale
├── js/
│   ├── app.js             # Application principale et AppPipeline
│   └── modules/           # Modules de l'architecture
│       ├── 10-canvas/     # Module Canvas
│       ├── 20-dragdrop/   # Module Drag & Drop
│       ├── 30-mermaid/    # Module Mermaid
│       ├── 40-sidebar/    # Module Sidebar
│       ├── 50-theme/      # Module Theme
│       ├── 60-preview/    # Module Preview
│       ├── 70-export/     # Module Export
│       └── 80-helper/     # Module Helper
├── styles/
│   └── main.css          # Styles de l'interface
├── ARCHITECTURE_FLUX.md   # Documentation de l'architecture
└── README.md             # Ce fichier
```

## Installation et Configuration

### Prérequis

- Navigateur web moderne (Chrome, Firefox, Safari, Edge)
- Connexion internet (pour le CDN Mermaid)
- Node.js (optionnel, pour le développement)

### Fichiers de Démarrage Créés

Le projet inclut maintenant plusieurs méthodes de lancement faciles :

#### `start.bat` - Lanceur Windows
- **Usage** : Double-cliquez pour démarrer automatiquement
- **Fonctionnalités** :
  - Détection automatique de Node.js ou Python
  - Démarrage du serveur sur le port 8081
  - Messages d'information en français
  - Gestion d'erreurs avec instructions

#### `package.json` - Configuration NPM
- **Scripts disponibles** :
  - `npm start` : Démarrage avec Node.js (recommandé)
  - `npm run dev` : Mode développement avec CORS
  - `npm run serve` : Démarrage avec Python
- **Installation** : `npm install` (optionnel)

### Installation Traditionnelle

### Utilisation Locale

1. **Téléchargez** ou clonez le projet
2. **Extrayez** les fichiers dans un dossier
3. **Ouvrez** `index.html` dans votre navigateur
4. **Commencez** à créer vos diagrammes !

### Déploiement Web

Le projet peut être déployé sur n'importe quel serveur web statique :

- GitHub Pages
- Netlify
- Vercel
- Serveur Apache/Nginx

## API et Extensibilité

### Événements du Canvas

L'application émet des événements personnalisés que vous pouvez écouter :

```javascript
document.getElementById('canvas').addEventListener('elementAdded', (e) => {
    console.log('Nouvel élément:', e.detail.element);
});
```

Événements disponibles :
- `elementAdded` : Un élément a été ajouté
- `elementMoved` : Un élément a été déplacé
- `elementEdited` : Un élément a été modifié
- `elementDeleted` : Un élément a été supprimé
- `elementConnect` : Connexion entre éléments
- `canvasCleared` : Le canvas a été effacé

### Méthodes Disponibles

```javascript
// Accéder aux gestionnaires via AppPipeline
window.appPipeline.getModule('10-canvas')     // Module Canvas
window.appPipeline.getModule('30-mermaid')   // Module Mermaid
window.appPipeline.getModule('60-preview')   // Module Preview
window.appPipeline.getModule('70-export')     // Module Export
window.appPipeline.getModule('80-helper')     // Module Helper

// Méthodes utiles
window.appPipeline.processData(data, startModule) // Traiter des données
window.appPipeline.getModuleState(moduleId)     // Obtenir l'état d'un module

// Utiliser AppManager pour une gestion complète
const appManager = new AppManager({
  debug: true,
  errorHandling: { continueOnError: true }
});

await appManager.initialize();
await appManager.start({ data: myData });
const report = appManager.generateReport();
```

## Personnalisation

### Ajouter de Nouveaux Types d'Éléments

1. **HTML** : Ajoutez un nouvel élément dans la sidebar
2. **CSS** : Définissez le style dans `main.css`
3. **JavaScript** : Ajoutez la logique dans le module approprié

### Modifier les Styles

Les variables CSS dans `main.css` permettent une personnalisation facile :

```css
:root {
    --primary-color: #2563eb;    /* Couleur principale */
    --background-color: #f8fafc; /* Couleur de fond */
    --text-primary: #1e293b;     /* Couleur du texte */
}
```

### Créer un Nouveau Module

1. **Créer le dossier** : `js/modules/XX-mon-module/` (XX = numéro d'ordre)
2. **Implémenter le module** : `XX-mon-module.js`
3. **Créer le trigger** : `XX-mon-module-trigger.js`
4. **Ajouter la configuration** : `XX-mon-module-config.js`
5. **Créer l'index** : `index.js`
6. **Enregistrer dans AppPipeline** : Mettre à jour `js/app.js`

#### Exemple de Structure de Module
```
js/modules/90-mon-module/
├── 90-mon-module.js           # Logique principale
├── 90-mon-module-trigger.js   # Gestionnaire de déclencheurs
├── 90-mon-module-config.js    # Configuration
└── index.js                   # Point d'entrée
```

#### Exemple d'index.js
```javascript
import { MonModule } from './90-mon-module.js';
import { MonModuleTrigger } from './90-mon-module-trigger.js';
import { MonModuleConfig } from './90-mon-module-config.js';

export {
  MonModule,
  MonModuleTrigger,
  MonModuleConfig
};
```

## Dépannage

### Problèmes Courants

**Le glisser-déposer ne fonctionne pas**
- Vérifiez que JavaScript est activé
- Utilisez un navigateur moderne
- Réessayez après avoir rafraîchi la page

**L'aperçu ne s'affiche pas**
- Vérifiez votre connexion internet (CDN Mermaid)
- Vérifiez que le code Mermaid est valide
- Réessayez avec un diagramme plus simple

**Les éléments ne se connectent pas**
- Activez le mode connexion (bouton 🔗)
- Cliquez sur l'élément source puis la cible
- Utilisez ESC pour annuler le mode connexion

**Les exports ne fonctionnent pas**
- Vérifiez que les bibliothèques externes sont chargées
- Essayez un format différent
- Vérifiez l'espace disque disponible

### Support des Navigateurs

- ✅ Chrome 80+
- ✅ Firefox 75+
- ✅ Safari 13+
- ✅ Edge 80+
- ❌ Internet Explorer (non supporté)

## Performance et Optimisation

### Optimisations Implémentées
- **Debouncing** : Sur les rendus fréquents
- **Cache** : Système de cache intelligent avec TTL
- **Lazy Loading** : Chargement différé des modules
- **Batch Processing** : Traitement par lots pour les exports
- **Memory Management** : Nettoyage automatique de la mémoire

### Métriques de Performance
- **Temps de traitement** : Mesuré par module
- **Utilisation mémoire** : Surveillée via helper-80
- **Taux d'erreur** : Suivi par module
- **Throughput** : Nombre d'opérations par seconde

### Rapports et Analyse Avancée
L'AppManager fournit des rapports détaillés sur l'exécution :

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

#### Gestion d'Erreurs Avancée
- **Validation d'entrée** : Validation stricte des données
- **Gestion d'exceptions** : Try-catch avec retry automatique
- **Logs détaillés** : Niveaux de verbosité configurables
- **Rapports d'erreur** : Informations contextuelles complètes
- **Recovery automatique** : Reprise sur erreur selon la configuration

## Sécurité

### Mesures de Sécurité
- **Sanitization** : Toutes les entrées utilisateur sont nettoyées
- **Validation** : Validation stricte des données
- **XSS Protection** : Protection contre les attaques XSS
- **CSP Headers** : Support des Content Security Policies

### Gestion des Données
- **Pas de stockage distant** : Toutes les données restent locales
- **Pas de traçage** : Aucun traçage utilisateur
- **Export sécurisé** : Les exports sont générés localement

## Contribution

Ce projet est open source. Pour contribuer :

1. Forkez le projet
2. Créez une branche pour votre fonctionnalité (`git checkout -b feature/AmazingFeature`)
3. Commitez vos changements (`git commit -m 'Add some AmazingFeature'`)
4. Poussez vers la branche (`git push origin feature/AmazingFeature`)
5. Ouvrez une Pull Request

### Conventions de Code
- **ES6+** : Utilisation des dernières fonctionnalités JavaScript
- **Modules** : Architecture modulaire avec imports/exports
- **Documentation** : Commentaires JSDoc pour les fonctions publiques
- **Tests** : Tests unitaires pour les nouvelles fonctionnalités

## Licence

Ce projet est sous licence MIT. Voir le fichier LICENSE pour plus de détails.

## Remerciements

- [Mermaid.js](https://mermaid-js.github.io/) pour la génération de diagrammes
- [jsPDF](https://parallax.github.io/jsPDF/) pour l'export PDF
- [html2canvas](https://html2canvas.hertzen.com/) pour l'export d'images
- Communauté open source pour l'inspiration et le support