/**
 * Grille Canvas Center - Gestion de la grille du canvas
 */



/**
 * Initialise la grille du canvas
 */
export async function initializeGrilleCanvasCenter() {
    console.log('📐 Initialisation de la grille du canvas...');

    try {
        const gridContainer = document.getElementById('canvas-grid');
        if (!gridContainer) {
            throw new Error('Conteneur de grille non trouvé');
        }

        // État de la grille
        let gridState = {
            visible: true,
            size: 20,
            color: '#e1e5e9',
            opacity: 0.3,
            snapToGrid: true
        };

        // Créer la grille
        createGrid(gridContainer, gridState);

        // Configurer les contrôles de la grille
        setupGridControls(gridState, gridContainer);

        // Écouter les événements de basculement de grille
        setupGridToggleListener(gridState, gridContainer);

        console.log('✅ Grille du canvas initialisée');
    } catch (error) {
        console.error('❌ Erreur lors de l\'initialisation de la grille:', error);
        throw error;
    }
}

/**
 * Crée la grille SVG
 */
function createGrid(container, state) {
    const canvasArea = document.querySelector('.canvas-area');
    if (!canvasArea) return;

    const rect = canvasArea.getBoundingClientRect();
    const width = rect.width || 800;
    const height = rect.height || 600;

    // Créer le SVG de la grille
    const gridSVG = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    gridSVG.setAttribute('class', 'canvas-grid-svg');
    gridSVG.style.top = '0';
    gridSVG.style.left = '0';
    gridSVG.style.width = '100%';
    gridSVG.style.height = '100%';
    gridSVG.style.pointerEvents = 'none';
    gridSVG.style.zIndex = '1';

    // Créer le pattern de la grille
    const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
    const pattern = document.createElementNS('http://www.w3.org/2000/svg', 'pattern');
    pattern.setAttribute('id', 'grid-pattern');
    pattern.setAttribute('width', state.size);
    pattern.setAttribute('height', state.size);
    pattern.setAttribute('patternUnits', 'userSpaceOnUse');

    const line1 = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    line1.setAttribute('x1', '0');
    line1.setAttribute('y1', '0');
    line1.setAttribute('x2', '0');
    line1.setAttribute('y2', state.size);
    line1.setAttribute('stroke', state.color);
    line1.setAttribute('stroke-width', '0.5');
    line1.setAttribute('opacity', state.opacity);

    const line2 = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    line2.setAttribute('x1', '0');
    line2.setAttribute('y1', '0');
    line2.setAttribute('x2', state.size);
    line2.setAttribute('y2', '0');
    line2.setAttribute('stroke', state.color);
    line2.setAttribute('stroke-width', '0.5');
    line2.setAttribute('opacity', state.opacity);

    pattern.appendChild(line1);
    pattern.appendChild(line2);
    defs.appendChild(pattern);

    // Créer le rectangle avec le pattern
    const rectElement = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    rectElement.setAttribute('width', '100%');
    rectElement.setAttribute('height', '100%');
    rectElement.setAttribute('fill', 'url(#grid-pattern)');

    gridSVG.appendChild(defs);
    gridSVG.appendChild(rectElement);

    // Ajouter ou remplacer la grille existante
    const existingGrid = container.querySelector('.canvas-grid-svg');
    if (existingGrid) {
        container.replaceChild(gridSVG, existingGrid);
    } else {
        container.appendChild(gridSVG);
    }

    // Appliquer la visibilité
    gridSVG.style.opacity = state.visible ? '1' : '0';
}

/**
 * Configure les contrôles de la grille
 */
function setupGridControls(state, gridContainer) {
    const gridToggleBtn = document.getElementById('grid-toggle');
    if (gridToggleBtn) {
        // Mettre à jour l'état du bouton selon la visibilité
        updateGridToggleButton(gridToggleBtn, state.visible);

        gridToggleBtn.addEventListener('click', () => {
            state.visible = !state.visible;
            updateGridVisibility(gridContainer, state.visible);
            updateGridToggleButton(gridToggleBtn, state.visible);

            // Animation du bouton
            gridToggleBtn.style.transform = 'scale(0.9)';
            setTimeout(() => {
                gridToggleBtn.style.transform = '';
            }, 150);
        });
    }
}

/**
 * Met à jour la visibilité de la grille
 */
function updateGridVisibility(container, visible) {
    const gridSVG = container.querySelector('.canvas-grid-svg');
    if (gridSVG) {
        gridSVG.style.opacity = visible ? '1' : '0';
        gridSVG.style.transition = 'opacity 0.3s ease';
    }
}

/**
 * Met à jour l'apparence du bouton de basculement
 */
function updateGridToggleButton(button, visible) {
    const svg = button.querySelector('svg');

    if (visible) {
        button.classList.add('active');
        button.title = 'Masquer la grille';
        svg.style.color = '#667eea';
    } else {
        button.classList.remove('active');
        button.title = 'Afficher la grille';
        svg.style.color = '';
    }
}

/**
 * Configure l'écouteur de basculement de grille
 */
function setupGridToggleListener(state, gridContainer) {
    // Écouter l'événement personnalisé depuis le quartier top
    document.addEventListener('grid:toggle', () => {
        state.visible = !state.visible;
        updateGridVisibility(gridContainer, state.visible);

        const gridToggleBtn = document.getElementById('grid-toggle');
        if (gridToggleBtn) {
            updateGridToggleButton(gridToggleBtn, state.visible);
        }
    });

    // Écouter le redimensionnement du canvas
    const canvasArea = document.querySelector('.canvas-area');
    if (canvasArea) {
        const resizeObserver = new ResizeObserver(() => {
            createGrid(gridContainer, state);
        });

        resizeObserver.observe(canvasArea);
    }
}

/**
 * Fonction utilitaire pour l'alignement à la grille
 */
export function snapToGrid(x, y, gridSize = 20) {
    return {
        x: Math.round(x / gridSize) * gridSize,
        y: Math.round(y / gridSize) * gridSize
    };
}

/**
 * Active/désactive l'alignement à la grille
 */
export function toggleSnapToGrid() {
    const gridToggleBtn = document.getElementById('grid-toggle');
    if (gridToggleBtn) {
        const active = gridToggleBtn.classList.contains('active');
        return active;
    }
    return false;
}
