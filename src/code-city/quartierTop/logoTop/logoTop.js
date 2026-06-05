/**
 * Logo Top — Bannière SVG animée "Premium Ultra"
 *
 * Une bannière étendue, immersive et ultra-animée pour le top bar.
 * Animations SMIL natives pour fluidité et fiabilité cross-browser.
 *
 * Effets visuels intégrés :
 * - Badge "M" : gradient animé, halo pulsant multi-couches, anneaux concentriques, shimmer
 * - Texte principal "MINAUTOR" : reveal progressif avec curseur clignotant
 * - Sous-titre "Project Creator" : effet machine à écrire lettre par lettre
 * - Fond : flux de données ambiants (lignes lumineuses)
 * - 12 particules scintillantes à des rythmes différents
 * - 3 "nœuds" orbitales qui gravitent autour du badge
 * - 4 satellites lumineux qui voyagent le long de la bannière
 * - Pulse final avec double anneau d'onde
 */

export async function initializeLogoTop() {
  const brand = document.querySelector('.brand');
  if (!brand) return;

  brand.innerHTML = `<svg class="brand__svg" style="display:block;height:48px" viewBox="0 0 600 48" fill="none" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <!-- Gradients principaux -->
    <linearGradient id="iconBg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="var(--accent)">
        <animate attributeName="stop-color" values="var(--accent);var(--info);var(--accent)" dur="6s" repeatCount="indefinite"/>
      </stop>
      <stop offset="1" stop-color="var(--info)">
        <animate attributeName="stop-color" values="var(--info);var(--accent);var(--info)" dur="6s" repeatCount="indefinite"/>
      </stop>
    </linearGradient>

    <linearGradient id="textGrad" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="var(--text)"/>
      <stop offset="1" stop-color="var(--accent)"/>
    </linearGradient>

    <linearGradient id="streamGrad" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0"   stop-color="var(--accent)" stop-opacity="0"/>
      <stop offset="0.5" stop-color="var(--accent)" stop-opacity="0.9"/>
      <stop offset="1"   stop-color="var(--info)" stop-opacity="0"/>
    </linearGradient>

    <linearGradient id="streamGrad2" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0"   stop-color="var(--info)" stop-opacity="0"/>
      <stop offset="0.5" stop-color="var(--info)" stop-opacity="0.7"/>
      <stop offset="1"   stop-color="var(--accent)" stop-opacity="0"/>
    </linearGradient>

    <radialGradient id="haloGrad" cx="0.5" cy="0.5" r="0.5">
      <stop offset="0" stop-color="var(--accent)" stop-opacity="0.7"/>
      <stop offset="1" stop-color="var(--accent)" stop-opacity="0"/>
    </radialGradient>

    <radialGradient id="nodeGrad" cx="0.5" cy="0.5" r="0.5">
      <stop offset="0" stop-color="var(--accent)"/>
      <stop offset="1" stop-color="var(--info)"/>
    </radialGradient>

    <linearGradient id="shimmerGrad" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0"    stop-color="#fff" stop-opacity="0"/>
      <stop offset="0.45" stop-color="#fff" stop-opacity="0"/>
      <stop offset="0.5"  stop-color="#fff" stop-opacity="0.6"/>
      <stop offset="0.55" stop-color="#fff" stop-opacity="0"/>
      <stop offset="1"    stop-color="#fff" stop-opacity="0"/>
    </linearGradient>

    <!-- Filtres et masques -->
    <clipPath id="iconClip">
      <rect x="4" y="8" width="32" height="32" rx="8"/>
    </clipPath>

    <clipPath id="titleReveal">
      <rect x="0" y="0" width="0" height="48">
        <animate attributeName="width" from="0" to="220" dur="1.8s" begin="0.3s" fill="freeze" calcMode="spline" keySplines="0.16 1 0.3 1" keyTimes="0;1"/>
      </rect>
    </clipPath>

    <!-- Curseur clignotant pour effet de saisie -->
    <rect id="cursor" x="0" y="0" width="0" height="48">
      <animate attributeName="x" from="52" to="170" dur="1.6s" begin="0.3s" fill="freeze" calcMode="spline" keySplines="0.16 1 0.3 1" keyTimes="0;1"/>
    </rect>

    <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
      <feGaussianBlur stdDeviation="2" result="coloredBlur"/>
      <feMerge>
        <feMergeNode in="coloredBlur"/>
        <feMergeNode in="SourceGraphic"/>
      </feMerge>
    </filter>

    <filter id="softGlow" x="-50%" y="-50%" width="200%" height="200%">
      <feGaussianBlur stdDeviation="1.5" result="coloredBlur"/>
      <feMerge>
        <feMergeNode in="coloredBlur"/>
        <feMergeNode in="SourceGraphic"/>
      </feMerge>
    </filter>
  </defs>

  <!-- Anneaux concentriques pulsants derrière le badge -->
  <circle cx="20" cy="24" r="14" fill="none" stroke="var(--accent)" stroke-width="0.5" opacity="0.5">
    <animate attributeName="r" values="14;32;14" dur="3s" repeatCount="indefinite" calcMode="spline" keySplines="0.4 0 0.6 1;0.4 0 0.6 1" keyTimes="0;0.5;1"/>
    <animate attributeName="opacity" values="0.6;0;0.6" dur="3s" repeatCount="indefinite" calcMode="spline" keySplines="0.4 0 0.6 1;0.4 0 0.6 1" keyTimes="0;0.5;1"/>
  </circle>
  <circle cx="20" cy="24" r="14" fill="none" stroke="var(--info)" stroke-width="0.5" opacity="0.5">
    <animate attributeName="r" values="14;32;14" dur="3s" begin="1s" repeatCount="indefinite" calcMode="spline" keySplines="0.4 0 0.6 1;0.4 0 0.6 1" keyTimes="0;0.5;1"/>
    <animate attributeName="opacity" values="0.6;0;0.6" dur="3s" begin="1s" repeatCount="indefinite" calcMode="spline" keySplines="0.4 0 0.6 1;0.4 0 0.6 1" keyTimes="0;0.5;1"/>
  </circle>

  <!-- Halo pulsant derrière le badge -->
  <circle cx="20" cy="24" r="22" fill="url(#haloGrad)" opacity="0.8">
    <animate attributeName="r" values="20;28;20" dur="3.5s" repeatCount="indefinite" calcMode="spline" keySplines="0.4 0 0.6 1;0.4 0 0.6 1" keyTimes="0;0.5;1"/>
    <animate attributeName="opacity" values="0.8;0.3;0.8" dur="3.5s" repeatCount="indefinite" calcMode="spline" keySplines="0.4 0 0.6 1;0.4 0 0.6 1" keyTimes="0;0.5;1"/>
  </circle>

  <!-- 3 nœuds orbitaux autour du badge -->
  <g>
    <circle cx="20" cy="24" r="0" fill="url(#nodeGrad)">
      <animate attributeName="cx" values="20;48;20;-8;20" dur="6s" repeatCount="indefinite" calcMode="spline" keySplines="0.4 0 0.6 1;0.4 0 0.6 1;0.4 0 0.6 1" keyTimes="0;0.33;0.66;1"/>
      <animate attributeName="cy" values="6;24;42;24;6" dur="6s" repeatCount="indefinite" calcMode="spline" keySplines="0.4 0 0.6 1;0.4 0 0.6 1;0.4 0 0.6 1" keyTimes="0;0.33;0.66;1"/>
      <animate attributeName="r" values="0;2.2;0;2.2;0" dur="6s" repeatCount="indefinite"/>
    </circle>
    <circle cx="20" cy="24" r="0" fill="url(#nodeGrad)">
      <animate attributeName="cx" values="20;-8;20;48;20" dur="8s" begin="1s" repeatCount="indefinite" calcMode="spline" keySplines="0.4 0 0.6 1;0.4 0 0.6 1;0.4 0 0.6 1" keyTimes="0;0.33;0.66;1"/>
      <animate attributeName="cy" values="6;24;42;24;6" dur="8s" begin="1s" repeatCount="indefinite" calcMode="spline" keySplines="0.4 0 0.6 1;0.4 0 0.6 1;0.4 0 0.6 1" keyTimes="0;0.33;0.66;1"/>
      <animate attributeName="r" values="0;1.8;0;1.8;0" dur="8s" begin="1s" repeatCount="indefinite"/>
    </circle>
    <circle cx="20" cy="24" r="0" fill="url(#nodeGrad)">
      <animate attributeName="cx" values="20;48;20;-8;20" dur="7s" begin="2s" repeatCount="indefinite" calcMode="spline" keySplines="0.4 0 0.6 1;0.4 0 0.6 1;0.4 0 0.6 1" keyTimes="0;0.33;0.66;1"/>
      <animate attributeName="cy" values="42;24;6;24;42" dur="7s" begin="2s" repeatCount="indefinite" calcMode="spline" keySplines="0.4 0 0.6 1;0.4 0 0.6 1;0.4 0 0.6 1" keyTimes="0;0.33;0.66;1"/>
      <animate attributeName="r" values="0;1.5;0;1.5;0" dur="7s" begin="2s" repeatCount="indefinite"/>
    </circle>
  </g>

  <!-- 12 particules scintillantes -->
  <g>
    <circle cx="100" cy="12" r="1.2" fill="var(--accent)">
      <animate attributeName="opacity" values="0;1;0" dur="2.2s" begin="0s" repeatCount="indefinite"/>
      <animate attributeName="r" values="0.8;1.6;0.8" dur="2.2s" begin="0s" repeatCount="indefinite"/>
    </circle>
    <circle cx="180" cy="38" r="1" fill="var(--info)">
      <animate attributeName="opacity" values="0;1;0" dur="2.6s" begin="0.4s" repeatCount="indefinite"/>
      <animate attributeName="r" values="0.7;1.4;0.7" dur="2.6s" begin="0.4s" repeatCount="indefinite"/>
    </circle>
    <circle cx="260" cy="10" r="1.4" fill="var(--accent)">
      <animate attributeName="opacity" values="0;1;0" dur="3s" begin="0.8s" repeatCount="indefinite"/>
      <animate attributeName="r" values="0.9;1.8;0.9" dur="3s" begin="0.8s" repeatCount="indefinite"/>
    </circle>
    <circle cx="340" cy="40" r="1.1" fill="var(--info)">
      <animate attributeName="opacity" values="0;1;0" dur="2.4s" begin="1.2s" repeatCount="indefinite"/>
      <animate attributeName="r" values="0.7;1.5;0.7" dur="2.4s" begin="1.2s" repeatCount="indefinite"/>
    </circle>
    <circle cx="420" cy="14" r="1.3" fill="var(--accent)">
      <animate attributeName="opacity" values="0;1;0" dur="2.8s" begin="1.6s" repeatCount="indefinite"/>
      <animate attributeName="r" values="0.8;1.7;0.8" dur="2.8s" begin="1.6s" repeatCount="indefinite"/>
    </circle>
    <circle cx="500" cy="36" r="1" fill="var(--info)">
      <animate attributeName="opacity" values="0;1;0" dur="2.3s" begin="2s" repeatCount="indefinite"/>
      <animate attributeName="r" values="0.7;1.4;0.7" dur="2.3s" begin="2s" repeatCount="indefinite"/>
    </circle>
    <circle cx="560" cy="18" r="1.2" fill="var(--accent)">
      <animate attributeName="opacity" values="0;1;0" dur="2.7s" begin="2.4s" repeatCount="indefinite"/>
      <animate attributeName="r" values="0.8;1.6;0.8" dur="2.7s" begin="2.4s" repeatCount="indefinite"/>
    </circle>
    <circle cx="130" cy="32" r="0.9" fill="var(--info)">
      <animate attributeName="opacity" values="0;1;0" dur="2.5s" begin="0.6s" repeatCount="indefinite"/>
    </circle>
    <circle cx="220" cy="42" r="0.8" fill="var(--accent)">
      <animate attributeName="opacity" values="0;1;0" dur="3.2s" begin="1s" repeatCount="indefinite"/>
    </circle>
    <circle cx="310" cy="8" r="1" fill="var(--info)">
      <animate attributeName="opacity" values="0;1;0" dur="2.4s" begin="1.4s" repeatCount="indefinite"/>
    </circle>
    <circle cx="390" cy="42" r="0.9" fill="var(--accent)">
      <animate attributeName="opacity" values="0;1;0" dur="2.9s" begin="1.8s" repeatCount="indefinite"/>
    </circle>
    <circle cx="470" cy="8" r="1.1" fill="var(--info)">
      <animate attributeName="opacity" values="0;1;0" dur="2.6s" begin="2.2s" repeatCount="indefinite"/>
    </circle>
  </g>

  <!-- 2 Lignes lumineuses (data streams) -->
  <rect x="0" y="2" width="180" height="0.8" fill="url(#streamGrad)">
    <animateTransform attributeName="transform" type="translate" values="0,0; 600,0; 0,0" dur="7s" repeatCount="indefinite" calcMode="linear"/>
  </rect>
  <rect x="0" y="45" width="180" height="1" fill="url(#streamGrad2)">
    <animateTransform attributeName="transform" type="translate" values="0,0; 600,0; 0,0" dur="9s" repeatCount="indefinite" calcMode="linear"/>
  </rect>

  <!-- 4 Satellites lumineux qui voyagent le long de la bannière -->
  <g>
    <circle cx="0" cy="24" r="2" fill="var(--accent)" filter="url(#softGlow)">
      <animate attributeName="cx" values="50;580" dur="5s" repeatCount="indefinite" calcMode="linear"/>
      <animate attributeName="cy" values="24;18;24;30;24" dur="5s" repeatCount="indefinite" calcMode="spline" keySplines="0.4 0 0.6 1;0.4 0 0.6 1;0.4 0 0.6 1" keyTimes="0;0.33;0.66;1"/>
      <animate attributeName="opacity" values="0;1;1;0" dur="5s" repeatCount="indefinite" keyTimes="0;0.1;0.9;1"/>
    </circle>
    <circle cx="0" cy="24" r="1.5" fill="var(--info)" filter="url(#softGlow)">
      <animate attributeName="cx" values="50;580" dur="6s" begin="1.5s" repeatCount="indefinite" calcMode="linear"/>
      <animate attributeName="cy" values="30;24;18;24;30" dur="6s" begin="1.5s" repeatCount="indefinite" calcMode="spline" keySplines="0.4 0 0.6 1;0.4 0 0.6 1;0.4 0 0.6 1" keyTimes="0;0.33;0.66;1"/>
      <animate attributeName="opacity" values="0;1;1;0" dur="6s" begin="1.5s" repeatCount="indefinite" keyTimes="0;0.1;0.9;1"/>
    </circle>
    <circle cx="0" cy="24" r="1.2" fill="var(--accent)" filter="url(#softGlow)">
      <animate attributeName="cx" values="50;580" dur="7s" begin="3s" repeatCount="indefinite" calcMode="linear"/>
      <animate attributeName="cy" values="20;30;20;24;20" dur="7s" begin="3s" repeatCount="indefinite" calcMode="spline" keySplines="0.4 0 0.6 1;0.4 0 0.6 1;0.4 0 0.6 1" keyTimes="0;0.33;0.66;1"/>
      <animate attributeName="opacity" values="0;1;1;0" dur="7s" begin="3s" repeatCount="indefinite" keyTimes="0;0.1;0.9;1"/>
    </circle>
    <circle cx="0" cy="24" r="1.4" fill="var(--info)" filter="url(#softGlow)">
      <animate attributeName="cx" values="50;580" dur="8s" begin="4.5s" repeatCount="indefinite" calcMode="linear"/>
      <animate attributeName="cy" values="28;20;28;24;28" dur="8s" begin="4.5s" repeatCount="indefinite" calcMode="spline" keySplines="0.4 0 0.6 1;0.4 0 0.6 1;0.4 0 0.6 1" keyTimes="0;0.33;0.66;1"/>
      <animate attributeName="opacity" values="0;1;1;0" dur="8s" begin="4.5s" repeatCount="indefinite" keyTimes="0;0.1;0.9;1"/>
    </circle>
  </g>

  <!-- Badge icône "M" avec bordure -->
  <rect x="4" y="8" width="32" height="32" rx="8" fill="url(#iconBg)" filter="url(#glow)"/>
  <rect x="4" y="8" width="32" height="32" rx="8" fill="none" stroke="var(--accent)" stroke-width="0.5" opacity="0.5"/>
  <text x="20" y="30" text-anchor="middle" fill="#fff" font-size="18" font-weight="800" font-family="system-ui, -apple-system, sans-serif">M</text>

  <!-- Shimmer clipé au badge -->
  <g clip-path="url(#iconClip)">
    <rect x="-15" y="8" width="55" height="32" fill="url(#shimmerGrad)">
      <animateTransform attributeName="transform" type="translate" values="-200,0; 55,0; -55,0" dur="6s" begin="2s" repeatCount="indefinite" calcMode="spline" keySplines="0.4 0 0.6 1;0.6 0 0.4 1" keyTimes="0;0.5;1"/>
    </rect>
  </g>

  <!-- Titre principal "MINAUTOR" révélé -->
  <text x="52" y="26" fill="url(#textGrad)" font-size="18" font-weight="800" font-family="system-ui, -apple-system, sans-serif" letter-spacing="2" clip-path="url(#titleReveal)">MINAUTOR</text>

  <!-- Sous-titre "Project Creator" avec effet "ghost" mot par mot -->
  <g clip-path="url(#titleReveal)">
    <!-- Mot 1 : PROJECT (apparaît, disparaît, flash rapide) -->
    <text x="52" y="40" fill="var(--accent)" font-size="10" font-weight="700" font-family="system-ui, -apple-system, sans-serif" letter-spacing="3">
      PROJECT
      <animate attributeName="opacity" values="0;0.9;0;0;0.7;0;0;0.8;0" dur="11s" begin="2.5s" repeatCount="indefinite" keyTimes="0;0.1;0.22;0.4;0.52;0.65;0.78;0.88;1"/>
    </text>
    <!-- Mot 2 : CREATOR (apparaît en décalé, double flash) -->
    <text x="115" y="40" fill="var(--info)" font-size="10" font-weight="700" font-family="system-ui, -apple-system, sans-serif" letter-spacing="3">
      CREATOR
      <animate attributeName="opacity" values="0;0;0.8;0;0.5;0;0;0.9;0" dur="11s" begin="2.5s" repeatCount="indefinite" keyTimes="0;0.05;0.18;0.32;0.45;0.6;0.72;0.85;1"/>
    </text>
  </g>

  <!-- Accent visuel final : point lumineux pulsant à droite -->
  <circle cx="585" cy="24" r="3" fill="var(--accent)">
    <animate attributeName="opacity" values="0.4;1;0.4" dur="1.8s" repeatCount="indefinite"/>
    <animate attributeName="r" values="2.5;3.5;2.5" dur="1.8s" repeatCount="indefinite"/>
  </circle>
  <circle cx="585" cy="24" r="6" fill="var(--accent)" opacity="0.2">
    <animate attributeName="r" values="4;14;4" dur="2.4s" repeatCount="indefinite"/>
    <animate attributeName="opacity" values="0.4;0;0.4" dur="2.4s" repeatCount="indefinite"/>
  </circle>
  <circle cx="585" cy="24" r="6" fill="var(--info)" opacity="0.2">
    <animate attributeName="r" values="4;14;4" dur="2.4s" begin="1.2s" repeatCount="indefinite"/>
    <animate attributeName="opacity" values="0.4;0;0.4" dur="2.4s" begin="1.2s" repeatCount="indefinite"/>
  </circle>
</svg>`;
}
