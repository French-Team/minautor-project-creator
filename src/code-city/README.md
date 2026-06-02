# Code City - Architecture

## Vue d'ensemble

Code City est une application modulaire de génération de diagrammes Mermaid organisée selon une architecture en 5 quartiers. Chaque quartier représente une zone fonctionnelle distincte de l'application.

## Architecture des quartiers

### 🏙️ Structure générale

```
┌─────────────────────────────────────────┐
│                QUARTIER TOP             │ ← Menu principal et actions
├─────────────────┬───────────────────────┤
│                 │                       │
│ QUARTIER LEFT   │   QUARTIER CENTER     │ ← Canvas principal
│ (Fonctions      │   (Canvas avec        │
│  Mermaid)       │    grille et zoom)    │
│                 │                       │
├─────────────────┼───────────────────────┤
│                QUARTIER RIGHT           │ ← Panneau latéral (futur)
├─────────────────────────────────────────┤
│              QUARTIER BOTTOM            │ ← Barre d'état
└─────────────────────────────────────────┘
```

### 📋 Quartier Top (`quartierTop/`)
**Responsabilités :** Menu principal et actions globales

- **Logo** (`logoTop/`) : Logo et titre de l'application
- **Actions** (`menuActionsTop/`) :
  - Effacer le canvas
  - Exporter les diagrammes (PNG, SVG, PDF, Code)
  - Aperçu Mermaid
  - Basculement thème clair/sombre

### ⬅️ Quartier Left (`quartierLeft/`)
**Responsabilités :** Fonctionnalités et outils Mermaid

- **Concepts** (`conceptMermaidLeft/`) : Documentation et exemples Mermaid
- **Fonctions** (`fonctionsMermaidLeft/`) :
  - Catégorie 1 : Diagrammes de base (Début/Fin, Processus, Décision, etc.)
  - Catégorie 2 : Structures avancées (Boucles, Modules, etc.)
  - Catégorie 3 : Éléments spéciaux (Styles, Animations, etc.)
  - Drag & Drop vers le canvas

### 🎯 Quartier Center (`quartierCenter/`)
**Responsabilités :** Canvas principal d'édition

- **Structure** (`structureCanvasCenter/`) :
  - Grille interactive avec système de snap-to-grid
  - Zoom et déplacement du canvas
  - Contrôles de navigation
- **Fonctions** (`fonctionsCanvasCenter/`) :
  - Drag & Drop avancé
  - Édition d'éléments (titre, description, priorité)
  - Suppression d'éléments
  - Sélection multiple

### ➡️ Quartier Right (`quartierRight/`)
**Statut :** En construction

Fonctionnalités prévues :
- Analyse des diagrammes
- Recherche avancée
- Historique des modifications
- Paramètres avancés

### ⬇️ Quartier Bottom (`quartierBottom/`)
**Responsabilités :** Informations et statut

- Compteur d'éléments
- Niveau de zoom actuel
- Mode d'édition
- Thème actif
- Messages de statut temporaires

## Fichiers principaux

### Point d'entrée
- `code-city.js` : Initialisation de l'application
- `code-city.css` : Styles principaux

### Utilitaires
- `utils.js` : Fonctions utilitaires et helpers

## Utilisation

### Démarrage
```javascript
import { initializeApp } from './code-city/code-city.js';

document.addEventListener('DOMContentLoaded', async () => {
    await initializeApp();
});
```

### Événements personnalisés

#### Événements émis
- `element:dropped` : Élément déposé sur le canvas
- `element:created` : Nouvel élément créé
- `element:deleted` : Élément supprimé
- `element:modified` : Élément modifié
- `canvas:clear` : Canvas effacé
- `theme:changed` : Thème changé
- `mermaid:generate` : Génération de diagramme demandée

#### Événements écoutés
- `canvas:zoom` : Demande de zoom
- `grid:toggle` : Basculement de la grille

## Fonctionnalités implémentées

### ✅ Complètement fonctionnelles
- Architecture modulaire en 5 quartiers
- Système de thème clair/sombre
- Grille interactive avec snap-to-grid
- Zoom et déplacement du canvas
- Drag & Drop depuis le panneau gauche vers le canvas
- Édition d'éléments (titre, description, priorité)
- Suppression d'éléments avec animations
- Export de diagrammes (PNG, SVG, Code)
- Aperçu Mermaid intégré
- Effacement du canvas
- Barre d'état avec informations en temps réel

### 🚧 En développement
- Génération automatique de diagrammes Mermaid
- Sélection multiple d'éléments
- Historique des modifications
- Import de fichiers

### 🔮 Planifiées
- Fonctionnalités du quartier Right
- Collaboration en temps réel
- Plugins et extensions
- Support de formats avancés

## Structure des fichiers

```
code-city/
├── code-city.js              # Point d'entrée principal
├── code-city.css             # Styles principaux
├── utils.js                  # Utilitaires
├── quartierTop/              # Menu et actions
│   ├── quartierTop.js
│   ├── quartierTop.css
│   ├── logoTop/
│   └── menuActionsTop/
├── quartierLeft/             # Fonctions Mermaid
│   ├── quartierLeft.js
│   ├── quartierLeft.css
│   ├── conceptMermaidLeft/
│   └── fonctionsMermaidLeft/
├── quartierCenter/           # Canvas principal
│   ├── quartierCenter.js
│   ├── quartierCenter.css
│   ├── structureCanvasCenter/
│   └── fonctionsCanvasCenter/
├── quartierRight/            # Panneau droit (futur)
│   ├── quartierRight.js
│   └── quartierRight.css
└── quartierBottom/           # Barre d'état
    ├── quartierBottom.js
    └── quartierBottom.css
```

## Technologies utilisées

- **JavaScript ES6+** : Modules, classes, fonctions fléchées
- **CSS Grid & Flexbox** : Layout responsive
- **CSS Custom Properties** : Gestion des thèmes
- **SVG** : Icônes et éléments graphiques
- **Web APIs** : Drag & Drop, Clipboard, ResizeObserver
- **Mermaid.js** : Génération de diagrammes

## Développement

### Ajout d'un nouveau quartier
1. Créer le dossier du quartier
2. Implémenter le fichier principal `quartier{Nom}.js`
3. Ajouter les styles CSS
4. Importer dans le fichier principal `code-city.js`
5. Ajouter à la fonction `initializeApp()`

### Ajout de nouvelles fonctionnalités
1. Créer un sous-module dans le quartier approprié
2. Suivre la structure existante (JS + CSS)
3. Émettre et écouter les événements personnalisés
4. Mettre à jour la documentation

## Configuration

### Variables CSS personnalisables
```css
:root {
    --bg-primary: #ffffff;
    --bg-secondary: #f8f9fa;
    --text-primary: #333333;
    --text-secondary: #666666;
    --border-color: #e1e5e9;
    --shadow-color: rgba(0, 0, 0, 0.1);
}
```

### Thèmes
- **Clair** : Thème par défaut
- **Sombre** : Activé automatiquement selon les préférences système
- **Personnalisé** : Surcharge possible via CSS

## Performances

- **Optimisations** : Débouncing, virtualisation, animations CSS
- **Responsive** : Adaptation automatique aux différentes tailles d'écran
- **Accessibilité** : Support clavier, screen readers, contrastes

## Support navigateur

- **Chrome** : 88+
- **Firefox** : 85+
- **Safari** : 14+
- **Edge** : 88+

## Licence

Ce projet est développé pour l'apprentissage et la démonstration de l'architecture modulaire en JavaScript.