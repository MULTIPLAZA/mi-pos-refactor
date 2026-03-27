// ============================================================
// config.js — Configuración del negocio y turno de caja
// Ampersand POS
// ============================================================
//
// PROPÓSITO:
//   Maneja la pantalla de configuración del negocio y el
//   flujo de apertura/cierre de turno (caja).
//
//   Toda la config viene de localStorage — se sincroniza
//   desde Supabase al iniciar sesión o al sincronizar.
//
// DEPENDE DE:
//   - ui.js → toast(), goTo()
//   - db.js → sincronizarConfig(), abrirTurnoEnSupabase(),
//             cerrarTurnoEnSupabase(), leerConfigLocal(),
//             leerTurnoActivo(), guardarTurnoActivo(),
//             leerTimbradoActivo(), leerTimbrados(),
//             leerDescuentos(), getTimbradoDeSupabase()
//
// CLAVES DE localStorage que usa este módulo:
//   pos_turno_activo → turno abierto actualmente
//   pos_timbrado_activo → timbrado seleccionado
//   lic_negocio, lic_email, pos_sucursal, pos_terminal, etc.
// ============================================================

import { toast, goTo } from './ui.js';
import {
  sincronizarConfig,
  abrirTurnoEnSupabase,
  cerrarTurnoEnSupabase,
  leerConfigLocal,
  leerTurnoActivo,
  guardarTurnoActivo,
  leerTimbradoActivo,
  leerTimbrados,
  leerTimbradosMapa,
  guardarTimbradoActivo,
  leerDescuentos,
  getTimbradoDeSupabase,
} from './db.js';

// ── PANTALLA DE CONFIGURACIÓN ──────────────────────────────────

/**
 * Dibuja los datos actuales en la pantalla de configuración principal.
 * Se llama automáticamente al navegar a scConfig (desde goTo en ui.js).
 */
export function renderConfigInfo() {
  const cfg      = leerConfigLocal();
  const timbrado = leerTimbradoActivo();
  const turno    = leerTurnoActivo();

  // Nombre del negocio
  const negocioEl = document.getElementById('cfgNombreDisplay');
  if (negocioEl) negocioEl.textContent = cfg.negocio || '—';

  // Sucursal y terminal
  const sucEl = document.getElementById('cfgSucursalDisplay');
  if (sucEl) sucEl.textContent = cfg.sucursal + (cfg.terminal ? ' · ' + cfg.terminal : '');

  // Timbrado activo
  const timbEl = document.getElementById('cfgTimbradoDisplay');
  if (timbEl) {
    timbEl.textContent = timbrado
      ? `Timbrado: ${timbrado.nro} · Vence: ${timbrado.vig_fin || '—'}`
      : 'Sin timbrado activo';
  }

  // Estado del turno
  const turnoEl = document.getElementById('cfgTurnoDisplay');
  if (turnoEl) {
    turnoEl.textContent = turno
      ? `Turno abierto desde ${_formatFechaTurno(turno.fecha_apertura)}`
      : 'Caja cerrada';
    turnoEl.style.color = turno ? 'var(--success)' : 'var(--muted)';
  }
}

// ── PANTALLA DE CONFIG GENERAL ─────────────────────────────────

/**
 * Llena los campos de la pantalla de configuración general
 * con los valores actuales de localStorage.
 * Se llama al navegar a scConfigGeneral.
 */
export function renderGeneralInfo() {
  const cfg = leerConfigLocal();
  setVal('cfgNombre',    cfg.negocio);
  setVal('cfgEmail',     cfg.email);
  setVal('cfgSucursal',  cfg.sucursal);
  setVal('cfgTerminal',  cfg.terminal);
  setVal('cfgCiudad',    cfg.ciudad);
}

/**
 * Alias para compatibilidad con el código original.
 * @see renderGeneralInfo
 */
export function loadGeneralConfigInputs() {
  renderGeneralInfo();
}

/**
 * Sincroniza la config del negocio desde Supabase y actualiza
 * localStorage. Muestra un toast con el resultado.
 */
export async function sincronizarConfigNegocio() {
  const email = localStorage.getItem('lic_email') || '';
  if (!email) { toast('No hay email de usuario'); return; }

  try {
    toast('Sincronizando...');
    await sincronizarConfig(email);
    toast('✓ Configuración actualizada');
    renderConfigInfo();
  } catch (e) {
    toast('Error al sincronizar: ' + e.message);
    console.error('[config] sincronizarConfigNegocio:', e);
  }
}

// ── TIMBRADO ────────────────────────────────────────────────────
// El timbrado es el número que autoriza la DNIT para emitir facturas.

/**
 * Carga el timbrado activo para esta terminal.
 * Primero intenta leerlo de localStorage, si no lo tiene
 * lo busca en Supabase.
 *
 * @returns {Object|null} Datos del timbrado, o null
 */
export async function cargarTimbradoSesion() {
  // Primero intentar desde el mapa local (más rápido)
  const terminal = localStorage.getItem('pos_terminal') || '';
  const mapa     = leerTimbradosMapa();
  const email    = localStorage.getItem('lic_email') || '';

  if (mapa[terminal]) {
    guardarTimbradoActivo(mapa[terminal]);
    return mapa[terminal];
  }

  // Si no está en el mapa, consultar Supabase
  if (terminal) {
    const t = await getTimbradoDeSupabase(terminal);
    if (t) { guardarTimbradoActivo(t); return t; }
  }

  // Fallback: usar el primero de la lista
  const timbrados = leerTimbrados();
  if (timbrados.length) {
    guardarTimbradoActivo(timbrados[0]);
    return timbrados[0];
  }

  return null;
}

/**
 * Lee el timbrado activo de localStorage.
 * @returns {Object|null}
 */
export function getTimbradoActivo() {
  return leerTimbradoActivo();
}

// ── APERTURA DE TURNO ──────────────────────────────────────────
// El turno registra cuándo se abre y cierra la caja.

/**
 * Navega a la pantalla de apertura de turno.
 */
export function doOpenShift() {
  goTo('scTurno');
}

/**
 * Registra la apertura del turno en Supabase y en localStorage.
 * Se llama cuando el cajero confirma el monto de apertura.
 *
 * @param {number} montoInicial — Monto de efectivo en la caja al abrir
 */
export async function abrirTurno(montoInicial) {
  const cfg = leerConfigLocal();

  if (!cfg.email) { toast('Iniciá sesión primero'); return; }

  const payload = {
    sucursal:       cfg.sucursal,
    terminal:       cfg.terminal,
    email:          cfg.email,
    monto_inicial:  montoInicial || 0,
    fecha_apertura: new Date().toISOString(),
    estado:         'abierto',
  };

  try {
    const turno = await abrirTurnoEnSupabase(payload);
    guardarTurnoActivo(turno);
    toast('✓ Turno abierto');
    goTo('scSale');
  } catch (e) {
    toast('Error al abrir turno: ' + e.message);
    console.error('[config] abrirTurno:', e);
  }
}

/**
 * Alias para compatibilidad con el código original.
 * Lee el monto del input en pantalla y llama a abrirTurno().
 */
export async function supaInsertTurno() {
  const inp   = document.getElementById('montoApertura');
  const monto = parseInt((inp || {}).value || 0) || 0;
  await abrirTurno(monto);
}

// ── CIERRE DE TURNO ────────────────────────────────────────────

/**
 * Registra el cierre del turno activo.
 *
 * @param {number} montoFinal   — Efectivo contado al cerrar
 * @param {number} totalVentas  — Total de ventas del turno
 */
export async function cerrarTurno(montoFinal, totalVentas) {
  const turno = leerTurnoActivo();
  if (!turno) { toast('No hay turno activo'); return; }

  const diferencia = montoFinal - ((turno.monto_inicial || 0) + (totalVentas || 0));

  try {
    await cerrarTurnoEnSupabase(turno.id, {
      monto_final:  montoFinal,
      total_ventas: totalVentas || 0,
      diferencia,
      fecha_cierre: new Date().toISOString(),
      estado:       'cerrado',
    });
    guardarTurnoActivo(null); // Borrar el turno de localStorage
    toast('✓ Turno cerrado');
    goTo('scClosed');         // Pantalla de "caja cerrada"
  } catch (e) {
    toast('Error al cerrar turno: ' + e.message);
    console.error('[config] cerrarTurno:', e);
  }
}

/**
 * Devuelve el turno activo desde localStorage.
 * @returns {Object|null}
 */
export function getTurnoActivo() {
  return leerTurnoActivo();
}

// ── DESCUENTOS ─────────────────────────────────────────────────

/**
 * Dibuja la lista de descuentos en la pantalla scDescuentos.
 * Se llama automáticamente al navegar (desde goTo en ui.js).
 */
export function renderDescList() {
  const list = document.getElementById('descList');
  if (!list) return;

  const descuentos = leerDescuentos();

  if (!descuentos.length) {
    list.innerHTML = `<div class="empty-list">No hay descuentos configurados</div>`;
    return;
  }

  list.innerHTML = descuentos.map(d => `
    <div class="desc-item">
      <div class="desc-info">
        <div class="desc-nombre">${d.name}</div>
        <div class="desc-valor">
          ${d.tipo === 'porcentaje' ? d.valor + '%' : '₲' + (d.valor || 0).toLocaleString('es-PY')}
        </div>
      </div>
    </div>
  `).join('');
}

// ── PRESUPUESTOS ───────────────────────────────────────────────

/**
 * Indica si los presupuestos están habilitados para este negocio.
 * @returns {boolean}
 */
export function presupuestosHabilitados() {
  return localStorage.getItem('pos_presupuestos') === 'true';
}

// ── UTILIDADES ─────────────────────────────────────────────────

function setVal(id, val) {
  const el = document.getElementById(id);
  if (el) el.value = val || '';
}

function _formatFechaTurno(iso) {
  if (!iso) return '—';
  try {
    const d = new Date(iso);
    return d.toLocaleDateString('es-PY') + ' ' + d.toLocaleTimeString('es-PY', { hour: '2-digit', minute: '2-digit' });
  } catch { return iso; }
}
