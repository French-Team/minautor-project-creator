/**
 * Zoom Canvas Center - Gestion du zoom et du déplacement du canvas
 */



/**
 * Initialise le système de zoom du canvas
 */
export async function initializeZoomCanvasCenter() {
    console.log('🔍 Initialisation du système de zoom...');

    try {
        // État du zoom
        let zoomState = {
            level: 1,
            min: 0.1,
            max: 3,
            step: 0.1,
            position: { x: 0, y: 0 }
        };

        const canvasContent = document.getElementById('canvas-content');
        if (!canvasContent) {
            throw new Error('Contenu du canvas non trouvé');
        }

        // Configurer les contrôles de zoom
        setupZoomControls(zoomState, canvasContent);

        // Configurer le zoom à la molette
        setupWheelZoom(zoomState, canvasContent);

        // Configurer le déplacement du canvas
        setupCanvasPan(zoomState, canvasContent);

        // Écouter les événements de zoom depuis d'autres composants
        setupZoomEventListeners(zoomState, canvasContent);

        console.log('✅ Système de zoom initialisé');
    } catch (error) {
        console.error('❌ Erreur lors de l\'initialisation du zoom:', error);
        throw error;
    }
}

/**
 * Configure les contrôles de zoom (boutons)
 */
function setupZoomControls(state, canvasContent) {
    const zoomInBtn = document.getElementById('zoom-in');
    const zoomOutBtn = document.getElementById('zoom-out');
    const fitToScreenBtn = document.getElementById('fit-to-screen');
    const zoomLevelDisplay = document.getElementById('zoom-level');

    if (zoomInBtn) {
        zoomInBtn.addEventListener('click', () => {
            zoomIn(state, canvasContent);
            updateZoomDisplay(state, zoomLevelDisplay);
            showZoomAnimation('in');
        });
    }

    if (zoomOutBtn) {
        zoomOutBtn.addEventListener('click', () => {
            zoomOut(state, canvasContent);
            updateZoomDisplay(state, zoomLevelDisplay);
            showZoomAnimation('out');
        });
    }

    if (fitToScreenBtn) {
        fitToScreenBtn.addEventListener('click', () => {
            fitToScreen(state, canvasContent);
            updateZoomDisplay(state, zoomLevelDisplay);
            showZoomAnimation('fit');
        });
    }

    // Mettre à jour l'affichage initial
    updateZoomDisplay(state, zoomLevelDisplay);
}

/**
 * Configure le zoom à la molette de la souris
 */
function setupWheelZoom(state, canvasContent) {
    const canvasArea = document.querySelector('.canvas-area');

    if (canvasArea) {
        canvasArea.addEventListener('wheel', (e) => {
            e.preventDefault();

            const rect = canvasArea.getBoundingClientRect();
            const centerX = (e.clientX - rect.left) / state.level;
            const centerY = (e.clientY - rect.top) / state.level;

            if (e.deltaY < 0) {
                // Zoom avant
                zoomIn(state, canvasContent, centerX, centerY);
            } else {
                // Zoom arrière
                zoomOut(state, canvasContent, centerX, centerY);
            }

            const zoomLevelDisplay = document.getElementById('zoom-level');
            updateZoomDisplay(state, zoomLevelDisplay);
        });
    }
}

/**
 * Configure le déplacement du canvas (pan)
 */
function setupCanvasPan(state, canvasContent) {
    const canvasArea = document.querySelector('.canvas-area');
    let isPanning = false;
    let lastPanPoint = { x: 0, y: 0 };

    if (canvasArea) {
        canvasArea.addEventListener('mousedown', (e) => {
            if (e.button === 1 || (e.button === 0 && e.altKey)) { // Bouton du milieu ou Alt+clic gauche
                isPanning = true;
                lastPanPoint = { x: e.clientX, y: e.clientY };
                canvasArea.style.cursor = 'grabbing';
                e.preventDefault();
            }
        });

        document.addEventListener('mousemove', (e) => {
            if (isPanning) {
                const deltaX = e.clientX - lastPanPoint.x;
                const deltaY = e.clientY - lastPanPoint.y;

                state.position.x += deltaX / state.level;
                state.position.y += deltaY / state.level;

                updateCanvasTransform(state, canvasContent);

                lastPanPoint = { x: e.clientX, y: e.clientY };
            }
        });

        document.addEventListener('mouseup', () => {
            if (isPanning) {
                isPanning = false;
                canvasArea.style.cursor = '';
            }
        });

        // Empêcher la sélection de texte pendant le pan
        canvasArea.addEventListener('selectstart', (e) => {
            if (isPanning) {
                e.preventDefault();
            }
        });
    }
}

/**
 * Configure les écouteurs d'événements de zoom
 */
function setupZoomEventListeners(state, canvasContent) {
    // Écouter les événements personnalisés de zoom
    document.addEventListener('canvas:zoom', (e) => {
        const { direction, centerX, centerY } = e.detail;

        if (direction === 'in') {
            zoomIn(state, canvasContent, centerX, centerY);
        } else if (direction === 'out') {
            zoomOut(state, canvasContent, centerX, centerY);
        } else if (direction === 'reset') {
            state.level = 1;
            state.position = { x: 0, y: 0 };
            updateCanvasTransform(state, canvasContent);
        }

        const zoomLevelDisplay = document.getElementById('zoom-level');
        updateZoomDisplay(state, zoomLevelDisplay);
    });

    // Écouter le redimensionnement de la fenêtre
    window.addEventListener('resize', () => {
        const zoomLevelDisplay = document.getElementById('zoom-level');
        updateZoomDisplay(state, zoomLevelDisplay);
    });
}

/**
 * Effectue un zoom avant
 */
function zoomIn(state, canvasContent, centerX, centerY) {
    if (state.level < state.max) {
        const oldLevel = state.level;
        state.level = Math.min(state.max, state.level + state.step);

        // Ajuster la position pour zoomer vers le centre
        if (centerX !== undefined && centerY !== undefined) {
            const scaleChange = state.level / oldLevel;
            state.position.x = centerX - (centerX - state.position.x) * scaleChange;
            state.position.y = centerY - (centerY - state.position.y) * scaleChange;
        }

        updateCanvasTransform(state, canvasContent);
    }
}

/**
 * Effectue un zoom arrière
 */
function zoomOut(state, canvasContent, centerX, centerY) {
    if (state.level > state.min) {
        const oldLevel = state.level;
        state.level = Math.max(state.min, state.level - state.step);

        // Ajuster la position pour zoomer vers le centre
        if (centerX !== undefined && centerY !== undefined) {
            const scaleChange = state.level / oldLevel;
            state.position.x = centerX - (centerX - state.position.x) * scaleChange;
            state.position.y = centerY - (centerY - state.position.y) * scaleChange;
        }

        updateCanvasTransform(state, canvasContent);
    }
}

/**
 * Ajuste le zoom pour s'adapter à l'écran
 */
function fitToScreen(state, canvasContent) {
    const canvasArea = document.querySelector('.canvas-area');
    if (canvasArea) {
        const rect = canvasArea.getBoundingClientRect();
        const contentRect = canvasContent.getBoundingClientRect();

        if (contentRect.width > 0 && contentRect.height > 0) {
            const scaleX = (rect.width * 0.8) / contentRect.width;
            const scaleY = (rect.height * 0.8) / contentRect.height;
            const newLevel = Math.min(scaleX, scaleY, 1);

            state.level = Math.max(state.min, Math.min(state.max, newLevel));
            state.position.x = 0;
            state.position.y = 0;

            updateCanvasTransform(state, canvasContent);
        }
    }
}

/**
 * Met à jour la transformation du canvas
 */
function updateCanvasTransform(state, canvasContent) {
    const transform = `scale(${state.level}) translate(${state.position.x}px, ${state.position.y}px)`;
    canvasContent.style.transform = transform;
    canvasContent.style.transformOrigin = '0 0';

    // Mettre à jour l'attribut data-zoom-level pour les styles CSS
    const gridSVG = document.querySelector('.canvas-grid-svg');
    if (gridSVG) {
        gridSVG.setAttribute('data-zoom-level', state.level.toFixed(1));
    }
}

/**
 * Met à jour l'affichage du niveau de zoom
 */
function updateZoomDisplay(state, display) {
    if (display) {
        const percentage = Math.round(state.level * 100);
        display.textContent = `${percentage}%`;

        // Animation de changement
        display.style.transform = 'scale(1.1)';
        setTimeout(() => {
            display.style.transform = '';
        }, 200);
    }
}

/**
 * Affiche une animation de zoom
 */
function showZoomAnimation(type) {
    const canvasArea = document.querySelector('.canvas-area');
    if (canvasArea) {
        canvasArea.classList.add(`zoom-${type}`);

        setTimeout(() => {
            canvasArea.classList.remove(`zoom-${type}`);
        }, 300);
    }
}
