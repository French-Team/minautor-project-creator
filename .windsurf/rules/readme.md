---
trigger: always_on
---

# Mermaid Canvas Generator

Une application web interactive permettant de créer et manipuler des diagrammes Mermaid via une interface de glisser-déposer intuitive.

## Fonctionnalités

### 🎨 Interface Glisser-Déposer
- **Éléments prédéfinis** : Démarrage, processus, décisions, fin, classes, interfaces, états
- **Connexions** : Flèches simples, flèches en pointillés, connexions bidirectionnelles
- **Placement intuitif** : Déposez les éléments directement sur le canvas

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

## Utilisation

### Démarrage Rapide

1. **Ouvrez** `index.html` dans votre navigateur web moderne
2. **Glissez** des éléments depuis la sidebar vers le canvas
3. **Éditez** le texte des éléments en cliquant dessus
4. **Connectez** les éléments en utilisant le mode connexion
5. **Visualisez** le résultat dans l'aperçu

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
├── styles/
│   └── main.css           # Styles de l'interface
├── js/
│   ├── app.js             # Application principale
│   ├── drag-drop.js       # Système de glisser-déposer
│   ├── canvas.js          # Gestion du canvas
│   └── mermaid-generator.js # Génération Mermaid
└── README.md              # Ce fichier
```

## Installation et Configuration

### Prérequis

- Navigateur web moderne (Chrome, Firefox, Safari, Edge)
- Connexion internet (pour le CDN Mermaid)
- Aucune installation requise

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
// Accéder aux gestionnaires
window.dragDropManager    // Gestionnaire drag & drop
window.canvasManager      // Gestionnaire du canvas
window.mermaidGenerator   // Générateur Mermaid
window.mermaidCanvasApp   // Application principale

// Méthodes utiles
window.mermaidGenerator.exportDiagram()     // Exporter
window.mermaidGenerator.importFromCode(code) // Importer du code
window.canvasManager.clearCanvas()         // Effacer le canvas
```

## Personnalisation

### Ajouter de Nouveaux Types d'Éléments

1. **HTML** : Ajoutez un nouvel élément dans la sidebar
2. **CSS** : Définissez le style dans `main.css`
3. **JavaScript** : Ajoutez la logique dans `mermaid-generator.js`

### Modifier les Styles

Les variables CSS dans `main.css` permettent une personnalisation facile :

```css
:root {
    --primary-color: #2563eb;    /* Couleur principale */
    --background-color: #f8fafc; /* Couleur de fond */
    --text-primary: #1e293b;     /* Couleur du texte */
}
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

### Support des Navigateurs

- ✅ Chrome 80+
- ✅ Firefox 75+
- ✅ Safari 13+
- ✅ Edge 80+
- ❌ Internet Explorer (non supporté)

## Contribution

Ce projet est open source. Pour contribuer :

1. Forkez le projet
2. Créez une branche pour votre fonctionnalité
3. Commitez vos changements
4. Poussez vers la branche
5. Ouvrez une Pull Request

## Licence

MIT License - Voir le fichier LICENSE pour plus de détails.

## Remerciements

- [Mermaid.js](https://mermaid-js.github.io/) pour la génération de diagrammes
- Les contributeurs de l'open source pour les icônes et les bibliothèques

---

**Mermaid Canvas Generator** - Créez des diagrammes Mermaid visuellement, sans coder !