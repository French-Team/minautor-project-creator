/**
 * Export Mermaid — Téléchargement du diagramme
 *
 * - exportCode : texte brut (.mmd)
 * - exportSvg  : SVG via mermaid.render()
 * - exportPng  : PNG via canvas + drawImage du SVG
 *
 * Chaque fonction déclenche le téléchargement via une <a> éphémère.
 */

import mermaid from 'mermaid';
import { buildMermaidCode } from './build.js';

const DEFAULT_FILENAME = 'diagram';

function timestamp() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 0);
}

function ensureGraph(graph) {
  if (!graph || (graph.nodes?.length ?? 0) === 0) {
    throw new Error('Diagramme vide — rien à exporter');
  }
  return graph;
}

/* --------------------------------------------------------------------------
 * Code
 * -------------------------------------------------------------------------- */

export function exportCode(graph, filename = DEFAULT_FILENAME) {
  ensureGraph(graph);
  const code = buildMermaidCode(graph);
  const blob = new Blob([code], { type: 'text/plain;charset=utf-8' });
  downloadBlob(blob, `${filename}-${timestamp()}.mmd`);
  return { format: 'code', bytes: blob.size };
}

/* --------------------------------------------------------------------------
 * SVG
 * -------------------------------------------------------------------------- */

export async function exportSvg(graph, filename = DEFAULT_FILENAME) {
  ensureGraph(graph);
  const code = buildMermaidCode(graph);
  const id = `mermaid-export-${Date.now()}`;
  const { svg } = await mermaid.render(id, code);
  const blob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' });
  downloadBlob(blob, `${filename}-${timestamp()}.svg`);
  return { format: 'svg', bytes: blob.size };
}

/* --------------------------------------------------------------------------
 * PNG
 * -------------------------------------------------------------------------- */

/**
 * Rend le SVG en PNG via un <canvas>. Le scale permet d'exporter en
 * meilleure résolution (2 = Retina, 3 = impression).
 */
export async function exportPng(graph, filename = DEFAULT_FILENAME, scale = 2) {
  ensureGraph(graph);
  const code = buildMermaidCode(graph);
  const id = `mermaid-export-${Date.now()}`;
  const { svg } = await mermaid.render(id, code);

  const { width, height } = parseSvgDimensions(svg);
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(width * scale);
  canvas.height = Math.round(height * scale);
  const ctx = canvas.getContext('2d');
  // Fond blanc par défaut (sinon PNG transparent sur fond sombre)
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const svgBlob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' });
  const svgUrl = URL.createObjectURL(svgBlob);
  try {
    await new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve();
      };
      img.onerror = () => reject(new Error('Impossible de charger le SVG pour la conversion PNG'));
      img.src = svgUrl;
    });
  } finally {
    URL.revokeObjectURL(svgUrl);
  }

  const blob = await new Promise((resolve, reject) => {
    canvas.toBlob((b) => {
      if (b) resolve(b);
      else reject(new Error('Conversion PNG échouée'));
    }, 'image/png');
  });

  downloadBlob(blob, `${filename}-${timestamp()}.png`);
  return { format: 'png', bytes: blob.size, width: canvas.width, height: canvas.height };
}

/**
 * Extrait les dimensions du SVG depuis son viewBox ou width/height.
 */
function parseSvgDimensions(svgString) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(svgString, 'image/svg+xml');
  const svgEl = doc.documentElement;
  let width = parseFloat(svgEl.getAttribute('width')) || 0;
  let height = parseFloat(svgEl.getAttribute('height')) || 0;

  if (!width || !height) {
    const viewBox = (svgEl.getAttribute('viewBox') || '').split(/\s+/).map(Number);
    if (viewBox.length === 4) {
      width = width || viewBox[2];
      height = height || viewBox[3];
    }
  }

  if (!width || !height) {
    width = 800;
    height = 600;
  }

  return { width, height };
}
