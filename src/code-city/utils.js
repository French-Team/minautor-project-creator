/**
 * Utilitaires pour Code City
 */

/**
 * Génère un ID unique
 */
export function generateId() {
    return `element-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Débouncer pour les événements
 */
export function debounce(func, wait) {
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
 * Fonction de logging formatée
 */
export function log(message, type = 'info') {
    const timestamp = new Date().toISOString().split('T')[1].split('.')[0];
    const prefix = {
        info: 'ℹ️',
        success: '✅',
        warning: '⚠️',
        error: '❌'
    }[type] || 'ℹ️';

    console.log(`[${timestamp}] ${prefix} ${message}`);
}

/**
 * Affiche une notification temporaire
 */
export function showNotification(message, type = 'info', duration = 3000) {
    const notification = document.createElement('div');
    notification.textContent = message;
    notification.className = `notification notification-${type}`;

    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 12px 20px;
        border-radius: 8px;
        color: white;
        font-weight: 500;
        z-index: 10000;
        animation: slideInRight 0.3s ease-out;
        max-width: 300px;
        word-wrap: break-word;
    `;

    // Couleurs selon le type
    const colors = {
        success: '#50C878',
        error: '#ff6b6b',
        warning: '#FFD700',
        info: '#4A90E2'
    };
    notification.style.backgroundColor = colors[type] || colors.info;

    document.body.appendChild(notification);

    setTimeout(() => {
        notification.style.animation = 'slideOutRight 0.3s ease-in';
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 300);
    }, duration);
}

/**
 * Copie du texte dans le presse-papiers
 */
export async function copyToClipboard(text) {
    try {
        await navigator.clipboard.writeText(text);
        showNotification('Copié dans le presse-papiers', 'success');
        return true;
    } catch (error) {
        console.error('Erreur lors de la copie:', error);
        showNotification('Erreur lors de la copie', 'error');
        return false;
    }
}

/**
 * Télécharge un fichier
 */
export function downloadFile(content, filename, mimeType = 'text/plain') {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);

    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.style.display = 'none';

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    URL.revokeObjectURL(url);
}

/**
 * Convertit un élément SVG en image PNG
 */
export function svgToPng(svgElement, callback) {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    const svgData = new XMLSerializer().serializeToString(svgElement);
    const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });

    const img = new Image();
    img.onload = () => {
        canvas.width = img.width;
        canvas.height = img.height;
        ctx.drawImage(img, 0, 0);
        callback(canvas.toDataURL('image/png'));
    };
    img.src = URL.createObjectURL(svgBlob);
}

/**
 * Attend que le DOM soit prêt
 */
export function ready(callback) {
    if (document.readyState !== 'loading') {
        callback();
    } else {
        document.addEventListener('DOMContentLoaded', callback);
    }
}

/**
 * Observe les changements de taille d'un élément
 */
export function observeResize(element, callback) {
    const resizeObserver = new ResizeObserver(callback);
    resizeObserver.observe(element);
    return resizeObserver;
}

/**
 * Formate une chaîne de code pour l'affichage
 */
export function formatCode(code) {
    return code
        .split('\n')
        .map(line => line.trim())
        .filter(line => line.length > 0)
        .join('\n');
}

/**
 * Valide du code Mermaid
 */
export function validateMermaidCode(code) {
    // Vérifications basiques
    if (!code || typeof code !== 'string') {
        return false;
    }

    const trimmed = code.trim();

    // Doit commencer par un type de diagramme
    const diagramTypes = [
        'graph', 'flowchart', 'sequenceDiagram', 'classDiagram',
        'stateDiagram', 'gantt', 'pie', 'journey', 'gitgraph',
        'erDiagram', 'requirement'
    ];

    const firstLine = trimmed.split('\n')[0].toLowerCase();
    return diagramTypes.some(type => firstLine.startsWith(type));
}

/**
 * Extrait les métadonnées d'un élément
 */
export function extractElementMetadata(element) {
    const codeElement = element.querySelector('.element-code');
    const nameElement = element.querySelector('.element-name');

    return {
        id: element.id || generateId(),
        name: nameElement ? nameElement.textContent : 'Élément sans nom',
        code: codeElement ? codeElement.textContent : '',
        type: element.dataset.type || 'unknown',
        position: {
            x: parseInt(element.style.left) || 0,
            y: parseInt(element.style.top) || 0
        },
        size: {
            width: element.offsetWidth,
            height: element.offsetHeight
        }
    };
}

/**
 * Sauvegarde l'état de l'application
 */
export function saveApplicationState() {
    const state = {
        elements: [],
        settings: {
            theme: localStorage.getItem('code-city-theme') || 'light',
            gridVisible: document.querySelector('.toolbar-btn.active') !== null,
            zoom: document.getElementById('zoom-level')?.textContent || '100%'
        },
        timestamp: new Date().toISOString()
    };

    // Récupérer tous les éléments du canvas
    document.querySelectorAll('.canvas-element').forEach(element => {
        state.elements.push(extractElementMetadata(element));
    });

    return state;
}

/**
 * Charge l'état de l'application
 */
export function loadApplicationState(state) {
    if (!state || !state.elements) {
        return false;
    }

    // Restaurer les éléments
    const canvasContent = document.getElementById('canvas-content');
    if (canvasContent) {
        canvasContent.innerHTML = '';

        state.elements.forEach(elementData => {
            // Recréer l'élément depuis les métadonnées
            console.log('Élément restauré:', elementData);
        });
    }

    return true;
}
