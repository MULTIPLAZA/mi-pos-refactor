// ============================================================
// articulos.js — Catálogo de productos
// Ampersand POS
// ============================================================
//
// PROPÓSITO:
//   Maneja el catálogo de productos (PRODS) y su visualización.
//
// ARQUITECTURA REAL:
//   - PRODS es un array en MEMORIA, no viene de ninguna base de
//     datos en tiempo real. Se carga al iniciar la app desde
//     Supabase (fetchProductos) y queda en memoria.
//   - Los productos que vienen de Supabase tienen esta estructura:
//     {id, prodId, name, price, cat, iva, color, colorPropio,
//      precioVariable, costo, codigo, mitad, inventario,
//      comanda, itemLibre, activo, imagen}
//
// DEPENDE DE:
//   - ui.js → toast(), goTo()
//   - db.js → fetchProductos(), fetchCategorias()
//
// IDs DE DOM QUE USA:
//   pgrid      → grilla de productos (pantalla de ventas)
//   catPillBar → pastillas de categorías
// ============================================================

import { toast, goTo } from './ui.js';
import { fetchProductos, fetchCategorias } from './db.js';

// ── ESTADO ─────────────────────────────────────────────────────

/** Lista de productos en memoria. Se carga al iniciar. */
let PRODS = [];

/** Lista de categorías únicas derivadas de PRODS */
let CATS = [];

/** Texto de búsqueda activo */
let _searchQuery = '';

// ── INICIALIZACIÓN ─────────────────────────────────────────────

/**
 * Carga los productos desde Supabase y los deja en memoria.
 * Si falla, PRODS queda vacío (la app sigue funcionando).
 *
 * Llamar una vez al iniciar sesión o al sincronizar el catálogo.
 *
 * @param {string|number} sucursalId — ID de la sucursal activa
 * @returns {Promise<Array>} Los productos cargados
 */
export async function cargarProductos(sucursalId) {
  try {
    const prods = await fetchProductos(sucursalId);
    if (prods && prods.length) {
      PRODS = prods;
      // Derivar categorías únicas de los productos activos
      const cats = [...new Set(PRODS.filter(p => p.activo !== false).map(p => p.cat).filter(Boolean))];
      CATS = cats.sort();
    }
    return PRODS;
  } catch (e) {
    console.error('[articulos] cargarProductos:', e);
    return PRODS; // Devolver los que haya en memoria
  }
}

/**
 * Carga los productos directamente desde un array externo.
 * Se usa cuando el index.html tiene PRODS hardcodeado.
 *
 * @param {Array} prodsExternos — El array PRODS del script original
 */
export function setProdsDesdeScript(prodsExternos) {
  PRODS = prodsExternos || [];
  const cats = [...new Set(PRODS.filter(p => p.activo !== false).map(p => p.cat).filter(Boolean))];
  CATS = cats.sort();
}

/**
 * Devuelve la lista completa de productos en memoria.
 * Otros módulos (ventas.js) llaman esto para buscar por ID.
 * @returns {Array}
 */
export function getProds() { return PRODS; }

/**
 * Devuelve las categorías disponibles.
 * @returns {Array<string>}
 */
export function getCats() { return CATS; }

// ── GRILLA DE PRODUCTOS ────────────────────────────────────────

/**
 * Dibuja los botones de productos en la grilla de ventas.
 * Filtra por categoría activa y por texto de búsqueda si hay.
 *
 * El onclick de cada botón llama a addCart() que está en window.
 * Esto es necesario porque el onclick es un string en innerHTML
 * y necesita acceder a funciones globales.
 *
 * @param {string}   catActual        — Categoría seleccionada
 * @param {Function} onClickProducto  — Se llama al tocar un producto
 *                                      (se expone a window en index.html)
 */
export function renderP(catActual, onClickProducto) {
  const grid = document.getElementById('pgrid');
  if (!grid) return;

  // Asegurar que onClickProducto esté en window para el onclick del HTML
  if (onClickProducto) window._onTileClick = onClickProducto;

  const filtrados = filterP(catActual);

  if (!filtrados.length) {
    grid.innerHTML = `<div class="empty-cat">No hay artículos en esta categoría</div>`;
    return;
  }

  grid.innerHTML = filtrados.map(p => {
    const color = getProductColor(p);
    const precio = p.precioVariable
      ? 'Precio libre'
      : '₲' + (p.price || 0).toLocaleString('es-PY');
    return `
      <button class="prod-tile" id="tile_${p.id}"
              onclick="window._onTileClick && window._onTileClick(${p.id}, this)"
              style="background:${color};">
        <span class="tile-name">${p.name}</span>
        <span class="tile-price">${precio}</span>
      </button>`;
  }).join('');
}

/**
 * Filtra los productos según la categoría y el texto de búsqueda.
 *
 * @param {string} catActual — 'Todos' muestra todo
 * @returns {Array}
 */
export function filterP(catActual) {
  return PRODS.filter(p => {
    // Solo productos activos (o sin campo activo = legacy)
    if (p.activo === false) return false;
    // No mostrar ítems internos de descuento
    if (p.cat === 'Descuentos') return false;

    const matchCat = catActual === 'Todos' || !catActual || p.cat === catActual;
    const matchSearch = !_searchQuery ||
      p.name.toLowerCase().includes(_searchQuery.toLowerCase()) ||
      (p.codigo || '').includes(_searchQuery);
    return matchCat && matchSearch;
  });
}

// ── PASTILLAS DE CATEGORÍAS ────────────────────────────────────

/**
 * Dibuja las pastillas de categorías arriba de la grilla.
 * "Todos" siempre aparece primera.
 *
 * @param {string}   catActual — Categoría activa (para marcarla)
 * @param {Function} onPickCat — Se llama al tocar una pastilla
 */
export function renderCatPills(catActual, onPickCat) {
  const container = document.getElementById('catPillBar');
  if (!container) return;

  // Asegurar que onPickCat esté en window
  if (onPickCat) window._pickCat = onPickCat;

  const todas = ['Todos', ...CATS];
  container.innerHTML = todas.map(cat => `
    <button class="cat-pill ${cat === catActual ? 'sel' : ''}"
            onclick="window._pickCat && window._pickCat('${cat}')">
      ${cat}
    </button>
  `).join('');
}

// ── BÚSQUEDA ───────────────────────────────────────────────────

/**
 * Muestra u oculta la barra de búsqueda.
 */
export function toggleSearch() {
  const bar   = document.getElementById('searchBar');
  const input = document.getElementById('searchInput');
  if (!bar) return;
  const abierto = bar.classList.toggle('open');
  if (abierto) {
    _searchQuery = '';
    if (input) { input.value = ''; input.focus(); }
  }
}

/**
 * Actualiza la búsqueda y redibuja la grilla.
 *
 * @param {string}   q              — Texto buscado
 * @param {string}   catActual
 * @param {Function} onClickProducto
 */
export function onSearch(q, catActual, onClickProducto) {
  _searchQuery = q;
  renderP(catActual, onClickProducto);
}

// ── COLOR DE PRODUCTOS ─────────────────────────────────────────

/** Paleta de colores por defecto para categorías sin color propio */
const COLORES_DEFAULT = [
  '#1976d2', '#388e3c', '#f57c00', '#7b1fa2',
  '#c62828', '#00838f', '#558b2f', '#4527a0',
  '#e65100', '#0277bd', '#2e7d32', '#ad1457',
];

/**
 * Devuelve el color de un producto.
 * Usa el color propio si tiene, o asigna uno según la categoría.
 *
 * @param {Object} prod
 * @returns {string} Color hex
 */
export function getProductColor(prod) {
  if (prod.colorPropio && prod.color) return prod.color;
  const idx = CATS.indexOf(prod.cat);
  return COLORES_DEFAULT[Math.max(0, idx) % COLORES_DEFAULT.length];
}

// ── ABM DE ARTÍCULOS (pantalla de admin) ──────────────────────

/**
 * Dibuja la lista de artículos en la pantalla de administración.
 *
 * @param {string} catFiltro — Filtrar por categoría ('' = todas)
 */
export function renderArtList(catFiltro = '') {
  const list = document.getElementById('artList');
  if (!list) return;

  const filtrados = catFiltro ? PRODS.filter(p => p.cat === catFiltro) : PRODS;

  if (!filtrados.length) {
    list.innerHTML = `<div class="empty-list">No hay artículos todavía</div>`;
    return;
  }

  list.innerHTML = filtrados.map(p => `
    <div class="art-item">
      <div class="art-color-dot" style="background:${getProductColor(p)}"></div>
      <div class="art-info">
        <div class="art-name">${p.name}</div>
        <div class="art-meta">
          ${p.cat || 'Sin categoría'} ·
          ${p.precioVariable ? 'Precio libre' : '₲' + (p.price || 0).toLocaleString('es-PY')} ·
          IVA ${p.iva || '10'}%
          ${p.activo === false ? ' · <span style="color:var(--danger)">Inactivo</span>' : ''}
        </div>
      </div>
      <button class="art-edit-btn" onclick="abrirEditarArticulo(${p.id})">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
             stroke="currentColor" stroke-width="2">
          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
        </svg>
      </button>
    </div>
  `).join('');
}

/**
 * Abre el formulario para crear un artículo nuevo.
 */
export function abrirNuevoArticulo() {
  limpiarFormArticulo();
  const titulo = document.getElementById('artFormTitulo');
  const idEl   = document.getElementById('artIdEditar');
  if (titulo) titulo.textContent = 'Nuevo artículo';
  if (idEl)   idEl.value = '';
  goTo('scArticuloForm');
}

/**
 * Abre el formulario para editar un artículo existente.
 * @param {number|string} artId
 */
export function abrirEditarArticulo(artId) {
  const art = PRODS.find(p => p.id == artId);
  if (!art) { toast('Artículo no encontrado'); return; }

  limpiarFormArticulo();
  const titulo = document.getElementById('artFormTitulo');
  const idEl   = document.getElementById('artIdEditar');
  if (titulo) titulo.textContent = 'Editar artículo';
  if (idEl)   idEl.value = artId;

  setVal('artFormNombre', art.name || '');
  setVal('artFormPrecio', art.price || '');
  setVal('artFormCat',    art.cat   || '');
  setVal('artFormIva',    art.iva   || '10');
  setVal('artFormCodigo', art.codigo || '');

  const pv = document.getElementById('artFormPrecioVariable');
  if (pv) pv.checked = !!art.precioVariable;

  goTo('scArticuloForm');
}

/** Limpia todos los campos del formulario de artículo */
function limpiarFormArticulo() {
  ['artFormNombre', 'artFormPrecio', 'artFormCat', 'artFormCodigo'].forEach(id => setVal(id, ''));
  const pv = document.getElementById('artFormPrecioVariable');
  if (pv) pv.checked = false;
}

/** Helper para setear valor en un input por ID */
function setVal(id, val) {
  const el = document.getElementById(id);
  if (el) el.value = val;
}
