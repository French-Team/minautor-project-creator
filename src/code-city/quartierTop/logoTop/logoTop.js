/**
 * Logo Top — Logo SVG animé
 *
 * Animations SMIL natives (fiables cross-browser) :
 * - Badge "M" accent gradient + effet shimmer (va-et-vient)
 * - Texte "Mermaid Canvas" révélé de gauche à droite (largeur du clip)
 */

export async function initializeLogoTop() {
  const brand = document.querySelector('.brand');
  if (!brand) return;

  brand.innerHTML = `<svg class="brand__svg" style="display:block;height:28px" viewBox="0 0 200 28" fill="none" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="iconBg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="var(--accent)"/>
      <stop offset="1" stop-color="var(--info)"/>
    </linearGradient>
    <linearGradient id="shimmerGrad" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0"    stop-color="#fff" stop-opacity="0"/>
      <stop offset="0.45" stop-color="#fff" stop-opacity="0"/>
      <stop offset="0.5"  stop-color="#fff" stop-opacity="0.45"/>
      <stop offset="0.55" stop-color="#fff" stop-opacity="0"/>
      <stop offset="1"    stop-color="#fff" stop-opacity="0"/>
    </linearGradient>
    <clipPath id="iconClip">
      <rect x="1" y="2" width="26" height="24" rx="6"/>
    </clipPath>
    <clipPath id="textReveal">
      <rect x="0" y="0" height="28">
        <animate attributeName="width" from="0" to="200" dur="3.2s" begin="0.3s" fill="freeze" calcMode="spline" keySplines="0.16 1 0.3 1" keyTimes="0;1"/>
      </rect>
    </clipPath>
  </defs>

  <!-- Badge icône -->
  <rect x="1" y="2" width="26" height="24" rx="6" fill="url(#iconBg)"/>
  <text x="14" y="19" text-anchor="middle" fill="#fff" font-size="13" font-weight="700">M</text>

  <!-- Shimmer clipé au badge -->
  <g clip-path="url(#iconClip)">
    <rect x="-12" y="2" width="50" height="24" fill="url(#shimmerGrad)">
      <animateTransform attributeName="transform" type="translate" values="-144,0; 44,0; -44,0" dur="7s" begin="1.5s" repeatCount="indefinite" calcMode="spline" keySplines="0.4 0 0.6 1;0.6 0 0.4 1" keyTimes="0;0.5;1"/>
    </rect>
  </g>

  <!-- Titre révélé de gauche à droite -->
  <text x="42" y="19" fill="var(--text)" font-size="12" font-weight="600" clip-path="url(#textReveal)">MINAUTOR Project Creator</text>
</svg>`;
}
