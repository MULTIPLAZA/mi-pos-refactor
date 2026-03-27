// ============================================================
// ui.js — Utilidades de interfaz de usuario
// Ampersand POS
// ============================================================
//
// PROPÓSITO:
//   Funciones pequeñas usadas por TODOS los módulos.
//   Este archivo no importa nada — es la base de todo.
//
// FUNCIONES:
//   gs(n)       → formatea número como precio en guaraníes (₲)
//   toast(m)    → muestra notificación temporal en pantalla
//   goTo(id)    → navega entre pantallas ocultando las demás
//   loadTheme() → carga el tema guardado (claro u oscuro)
//   setTheme(t) → aplica un tema y lo guarda en localStorage
// ============================================================

// ── FORMATO DE MONEDA ──────────────────────────────────────────

/**
 * Formatea un número como precio en guaraníes.
 * Los guaraníes no tienen decimales.
 *
 * Ejemplos:
 *   gs(15000) → "₲15.000"
 *   gs(0)     → "₲0"
 *   gs(null)  → "₲0"
 *
 * @param {number|null} n
 * @returns {string}
 */
export function gs(n) {
  return '₲' + Math.round(n || 0).toLocaleString('es-PY');
}

// ── NOTIFICACIONES TOAST ───────────────────────────────────────
// Un "toast" es el mensaje chico que aparece y desaparece solo.

/** Timer del toast anterior — lo cancelamos si llega uno nuevo */
let _toastTimer;

/**
 * Muestra un mensaje temporal en pantalla por 1.8 segundos.
 * Si llega otro toast antes, reemplaza al anterior.
 *
 * Uso: toast('✓ Guardado') / toast('Error: precio vacío')
 *
 * @param {string} m — Mensaje a mostrar
 */
export function toast(m) {
  const t = document.getElementById('toast');
  if (!t) return;
  t.textContent = m;
  t.classList.add('show');
  clearTimeout(_toastTimer);
  _toastTimer = setTimeout(() => t.classList.remove('show'), 1800);
}

// ── NAVEGACIÓN ENTRE PANTALLAS ─────────────────────────────────
// La app tiene pantallas (<div class="screen">) que se muestran
// de a una por vez usando la clase CSS "active".

/**
 * Navega a la pantalla con el ID dado.
 * Oculta todas las demás, muestra solo la pedida.
 * Si la pantalla necesita cargar datos al mostrarse, los carga.
 *
 * IDs de pantallas del sistema:
 *   scSale          → ventas (pantalla principal del cajero)
 *   scCobrar        → cobro al cliente
 *   scRecibo        → recibo/comprobante después de cobrar
 *   scGuardar       → guardar ticket pendiente
 *   scPendientes    → lista de tickets pendientes
 *   scDividir       → pago dividido
 *   scConfig        → menú de configuración
 *   scConfigGeneral → datos del negocio
 *   scDescuentos    → gestión de descuentos
 *   scArticulosList → lista de artículos (admin)
 *   scArticuloForm  → formulario de artículo
 *   scTurno         → apertura de turno/caja
 *   scCierre        → cierre de turno/caja
 *   scMesas         → mapa de mesas
 *   scClosed        → pantalla de negocio cerrado (sin turno)
 *
 * @param {string} id — ID del elemento HTML de la pantalla destino
 */
export function goTo(id) {
  // Ocultamos TODAS las pantallas
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));

  // Mostramos solo la pedida
  const el = document.getElementById(id);
  if (el) el.classList.add('active');

  // Algunas pantallas necesitan actualizar su contenido al mostrarse.
  // Usamos ?. (optional chaining) para no romper si la función no existe.
  // El setTimeout da 50ms para que el CSS haga la transición primero.
  if (id === 'scConfig')         setTimeout(() => window.renderConfigInfo?.(),    50);
  if (id === 'scConfigGeneral')  setTimeout(() => window.renderGeneralInfo?.(),   50);
  if (id === 'scDescuentos')     setTimeout(() => window.renderDescList?.(),      50);
  if (id === 'scArticulosList')  setTimeout(() => window.renderArtList?.(),       50);
  if (id === 'scPendientes')     setTimeout(() => window.renderPendientes?.(),    50);
  if (id === 'scMesas')          setTimeout(() => window.renderMesas?.(),         50);
}

// ── TEMA CLARO / OSCURO ────────────────────────────────────────

/**
 * Aplica un tema y lo guarda en localStorage.
 * @param {'light'|'dark'} tema
 */
export function setTheme(tema) {
  document.documentElement.setAttribute('data-theme', tema);
  localStorage.setItem('pos_theme', tema);
}

/**
 * Carga el tema guardado por el usuario.
 * Si no hay tema guardado, usa el del sistema operativo.
 * Llamar al iniciar la app.
 */
export function loadTheme() {
  const guardado    = localStorage.getItem('pos_theme');
  const delSistema  = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  setTheme(guardado || delSistema);
}

// ── ANIMACIÓN AL AGREGAR AL CARRITO ───────────────────────────

/**
 * Hace "pulsar" el botón de un producto al agregarlo al carrito.
 * El CSS define la animación con la clase "adding".
 *
 * @param {HTMLElement} tileEl — El botón del producto
 */
export function animAddToCart(tileEl) {
  if (!tileEl) return;
  tileEl.classList.add('adding');
  setTimeout(() => tileEl.classList.remove('adding'), 400);
}

// ── FORMATO DE FECHAS ──────────────────────────────────────────

/**
 * Formatea una fecha para mostrar al usuario.
 * Si es hoy → muestra solo la hora.
 * Si es otro día → muestra "dd/mm hh:mm".
 *
 * @param {string|Date} fecha
 * @returns {string}
 */
export function formatFecha(fecha) {
  const d   = new Date(fecha);
  const hoy = new Date();
  const hora = d.toLocaleTimeString('es-PY', { hour: '2-digit', minute: '2-digit' });
  if (d.toDateString() === hoy.toDateString()) return hora;
  const dia = String(d.getDate()).padStart(2, '0');
  const mes = String(d.getMonth() + 1).padStart(2, '0');
  return `${dia}/${mes} ${hora}`;
}
