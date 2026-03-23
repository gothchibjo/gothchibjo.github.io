/**
 * map.js — основная логика интерактивной карты
 *
 * Режимы:
 *  • hover  — орнамент проявляется при наведении на округ
 *  • all    — все округа сразу заполнены орнаментами
 *
 * Зависимости: patterns.js (PATTERNS_DEFS, DISTRICTS, COLOR_TO_DISTRICT)
 */

import { PATTERNS_DEFS, DISTRICTS, COLOR_TO_DISTRICT } from './patterns.js';

/* ── Константы анимации ─────────────────────────────── */
const ANIM_DURATION_IN  = 420;   // ms, появление узора
const ANIM_DURATION_OUT = 300;   // ms, исчезновение
const ANIM_ALL_STAGGER  = 60;    // ms, задержка между округами в режиме «все»

/* ── Состояние ──────────────────────────────────────── */
let allPatternsMode  = false;
let currentDistrict  = null;
let animations       = {};       // district → {raf, progress, direction}
let originalFills    = new Map();// element → original fill color

/* ── Инициализация карты ────────────────────────────── */
export function initMap(svgInnerHTML) {
  const mapSvg = document.getElementById('map-svg');

  // 1. Вставить паттерны и содержимое карты
  mapSvg.innerHTML = PATTERNS_DEFS + svgInnerHTML;

  // 2. Найти все элементы-регионы и сохранить оригинальные цвета
  mapSvg.querySelectorAll('[data-d]').forEach(el => {
    const district = el.getAttribute('data-d');
    if (!DISTRICTS[district]) return;
    originalFills.set(el, DISTRICTS[district].color);
    el.style.cursor = 'pointer';
    el.style.transition = 'filter .2s';
  });

  // 3. Навесить события
  attachMapEvents(mapSvg);

  // 4. Построить легенду
  buildLegend();

  // 5. Кнопка переключения режима
  document.getElementById('toggle-all')
    .addEventListener('click', toggleAllPatterns);
}

/* ── События карты ──────────────────────────────────── */
function attachMapEvents(svg) {
  const tooltip = document.getElementById('tooltip');

  svg.addEventListener('mousemove', e => {
    const el = e.target.closest('[data-d]');
    const district = el?.getAttribute('data-d');

    if (district && DISTRICTS[district]) {
      if (!allPatternsMode && district !== currentDistrict) {
        if (currentDistrict) startAnim(currentDistrict, 'out');
        currentDistrict = district;
        startAnim(district, 'in');
      }
      showTooltip(e, district);
      highlightLegend(district);
    } else {
      if (!allPatternsMode && currentDistrict) {
        startAnim(currentDistrict, 'out');
        currentDistrict = null;
      }
      hideTooltip();
      clearLegendHighlight();
    }
  });

  svg.addEventListener('mouseleave', () => {
    if (!allPatternsMode && currentDistrict) {
      startAnim(currentDistrict, 'out');
      currentDistrict = null;
    }
    hideTooltip();
    clearLegendHighlight();
  });

  // Move tooltip with mouse
  document.addEventListener('mousemove', e => {
    if (tooltip.classList.contains('visible')) moveTooltip(e);
  });
}

/* ── Анимация паттернов ─────────────────────────────── */
function startAnim(district, direction) {
  if (animations[district]) {
    cancelAnimationFrame(animations[district].raf);
  }

  const duration = direction === 'in' ? ANIM_DURATION_IN : ANIM_DURATION_OUT;
  const startProgress = animations[district]?.progress ?? (direction === 'in' ? 0 : 1);
  const startTime = performance.now();

  // Prepare: if going in, set fill to pattern immediately (opacity will handle reveal)
  if (direction === 'in') {
    setDistrictFill(district, 'pattern');
  }

  function step(now) {
    const elapsed = now - startTime;
    let t = Math.min(elapsed / duration, 1);
    // ease in-out
    t = t < .5 ? 2*t*t : -1 + (4 - 2*t) * t;

    const progress = direction === 'in'
      ? startProgress + t * (1 - startProgress)
      : startProgress - t * startProgress;

    applyProgress(district, progress);
    animations[district] = { ...animations[district], progress, direction };

    if (elapsed < duration) {
      animations[district].raf = requestAnimationFrame(step);
    } else {
      // Finalize
      if (direction === 'out') {
        setDistrictFill(district, 'color');
        applyProgress(district, 0);
      } else {
        applyProgress(district, 1);
      }
      animations[district] = null;
    }
  }

  animations[district] = { raf: requestAnimationFrame(step), progress: startProgress, direction };
}

function applyProgress(district, progress) {
  document.querySelectorAll(`[data-d="${district}"]`).forEach(el => {
    el.style.opacity = 0.25 + progress * 0.75;
    // brightness shift: slightly brighter when pattern is fully shown
    el.style.filter = progress > 0.5
      ? `brightness(${1 + (progress - 0.5) * 0.1})`
      : '';
  });
}

function setDistrictFill(district, mode) {
  document.querySelectorAll(`[data-d="${district}"]`).forEach(el => {
    if (mode === 'pattern') {
      el.style.fill = `url(#PP-${district})`;
    } else {
      el.style.fill = '';   // revert to inline style from SVG
      el.style.opacity = '';
      el.style.filter = '';
    }
  });
}

/* ── Режим «все орнаменты» ─────────────────────────── */
function toggleAllPatterns() {
  allPatternsMode = !allPatternsMode;

  const btn = document.getElementById('toggle-all');
  const switchEl = document.getElementById('mode-checkbox');

  btn.classList.toggle('active', allPatternsMode);
  if (switchEl) switchEl.checked = allPatternsMode;

  btn.querySelector('.btn-label').textContent = allPatternsMode
    ? 'Режим: все орнаменты'
    : 'Показать все орнаменты';

  if (allPatternsMode) {
    // Cancel any running hover animations
    if (currentDistrict) {
      startAnim(currentDistrict, 'out');
      currentDistrict = null;
    }
    // Animate all districts in with stagger
    Object.keys(DISTRICTS).forEach((district, i) => {
      setTimeout(() => {
        setDistrictFill(district, 'pattern');
        startAnim(district, 'in');
      }, i * ANIM_ALL_STAGGER);
    });
  } else {
    // Animate all districts out
    Object.keys(DISTRICTS).forEach((district, i) => {
      setTimeout(() => {
        startAnim(district, 'out');
      }, i * (ANIM_ALL_STAGGER / 2));
    });
  }
}

/* ── Tooltip ────────────────────────────────────────── */
function showTooltip(e, district) {
  const d = DISTRICTS[district];
  const tip = document.getElementById('tooltip');
  document.getElementById('tt-district').textContent  = d.name;
  document.getElementById('tt-people').textContent    = d.people;
  document.getElementById('tt-ornament').textContent  = d.ornament;
  tip.style.borderLeftColor = d.color;
  tip.classList.add('visible');
  moveTooltip(e);
}

function hideTooltip() {
  document.getElementById('tooltip').classList.remove('visible');
}

function moveTooltip(e) {
  const tip = document.getElementById('tooltip');
  const pad = 18;
  const w   = tip.offsetWidth  || 230;
  const h   = tip.offsetHeight || 90;
  let x = e.clientX + pad;
  let y = e.clientY - pad;
  if (x + w > window.innerWidth  - 10) x = e.clientX - w - pad;
  if (y + h > window.innerHeight - 10) y = e.clientY - h - pad;
  tip.style.left = x + 'px';
  tip.style.top  = y + 'px';
}

/* ── Legend ─────────────────────────────────────────── */
function buildLegend() {
  const container = document.getElementById('legend');
  if (!container) return;

  Object.entries(DISTRICTS).forEach(([id, d]) => {
    const item = document.createElement('div');
    item.className = 'legend-item';
    item.dataset.district = id;

    // Swatch: small SVG preview of pattern
    const swatchId = `ls-${id}`;
    item.innerHTML = `
      <div class="legend-swatch" title="${d.ornament}">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 18 18">
          <defs>
            <pattern id="${swatchId}" patternUnits="userSpaceOnUse" width="18" height="18">
            </pattern>
          </defs>
          <rect width="18" height="18" fill="${d.color}"/>
        </svg>
      </div>
      <span>${d.name.replace(' ФО', ' ФО')}</span>`;

    // After inserting, clone pattern and use it in swatch
    container.appendChild(item);

    // Replace swatch fill with pattern reference
    const origPat = document.getElementById(`PP-${id}`);
    if (origPat) {
      const clone = origPat.cloneNode(true);
      clone.id = swatchId;
      // Adjust scale for small swatch
      clone.setAttribute('width', '18');
      clone.setAttribute('height', '18');
      clone.removeAttribute('patternTransform');
      const svgDefs = item.querySelector('defs');
      svgDefs.innerHTML = '';
      svgDefs.appendChild(clone);
      item.querySelector('rect').setAttribute('fill', `url(#${swatchId})`);
    }

    // Events
    item.addEventListener('mouseenter', () => {
      if (!allPatternsMode) {
        if (currentDistrict && currentDistrict !== id) startAnim(currentDistrict, 'out');
        currentDistrict = id;
        startAnim(id, 'in');
      }
      highlightLegend(id);
    });

    item.addEventListener('mouseleave', () => {
      if (!allPatternsMode && currentDistrict === id) {
        startAnim(id, 'out');
        currentDistrict = null;
      }
      clearLegendHighlight();
    });
  });
}

function highlightLegend(district) {
  document.querySelectorAll('.legend-item').forEach(li => {
    li.classList.toggle('highlighted', li.dataset.district === district);
  });
}

function clearLegendHighlight() {
  document.querySelectorAll('.legend-item').forEach(li => li.classList.remove('highlighted'));
}

/* ── Public API (для вызова из HTML) ─────────────────── */
export { toggleAllPatterns };
