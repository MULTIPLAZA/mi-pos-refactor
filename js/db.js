// ============================================================
// db.js — Capa de acceso a datos
// Ampersand POS
// ============================================================
//
// PROPÓSITO:
//   El ÚNICO archivo que habla con Supabase y localStorage.
//   Todos los demás módulos importan de acá.
//
// ARQUITECTURA:
//   - localStorage → datos offline (pendientes, turno, config)
//   - Supabase REST → sincronización (fetch directo, sin SDK)
//   - NO usa Firebase. NO usa el SDK de Supabase.
// ============================================================

const SUPA_URL  = 'https://kmreiniqgcvqgdtzvmel.supabase.co';
const SUPA_ANON = 'sb_publishable_j6btNHo1o3tSprmYUJITPw_8AExoxmJT';

// ── FETCH BASE ─────────────────────────────────────────────────

/**
 * Hace un request a Supabase REST.
 * Todos los fetch del sistema pasan por acá.
 *
 * @param {string} endpoint — ej: 'pos_ventas' o 'rpc/get_timbrado_terminal'
 * @param {Object} options  — fetch options (method, body, headers extra)
 * @returns {Promise<any>}  — JSON de respuesta, null si es 204
 */
export async function supaFetch(endpoint, options = {}) {
  const res = await fetch(`${SUPA_URL}/rest/v1/${endpoint}`, {
    ...options,
    headers: {
      'Content-Type':  'application/json',
      'apikey':        SUPA_ANON,
      'Authorization': `Bearer ${SUPA_ANON}`,
      'Prefer':        'return=representation',
      ...(options.headers || {}),
    },
  });

  if (res.status === 204) return null;

  const data = await res.json();
  if (!res.ok) {
    throw new Error(`[Supabase] ${endpoint} → ${res.status}: ${data?.message || res.statusText}`);
  }
  return data;
}

// ── VENTAS ─────────────────────────────────────────────────────

/**
 * Envía una venta confirmada a pos_ventas en Supabase.
 * Llamar desde cobro.js después de confirmar el pago.
 *
 * Campos del objeto venta:
 *   turno_id, terminal, sucursal, ticket_nro,
 *   items: [{id, nombre, qty, precio, obs}],
 *   total, metodo, comprobante, efectivo, vuelto,
 *   descTicket, descMonto, tiene_factura, factura_ruc,
 *   factura_nombre, tipoPedido, mesa, fecha (ISO 8601)
 *
 * @param {Object} venta
 * @returns {Promise<Object>} La venta guardada con su ID
 */
export async function insertarVenta(venta) {
  const data = await supaFetch('pos_ventas', {
    method: 'POST',
    body: JSON.stringify(venta),
  });
  return Array.isArray(data) ? data[0] : data;
}

// ── TURNO ──────────────────────────────────────────────────────

/**
 * Abre un turno de caja en Supabase.
 * @param {Object} turno — {sucursal, terminal, email, monto_inicial, fecha_apertura}
 * @returns {Promise<Object>} Turno creado con su ID
 */
export async function abrirTurnoEnSupabase(turno) {
  const data = await supaFetch('pos_turno', {
    method: 'POST',
    body: JSON.stringify(turno),
  });
  return Array.isArray(data) ? data[0] : data;
}

/**
 * Cierra el turno activo en Supabase.
 * @param {number} turnoId
 * @param {Object} dataCierre — {monto_final, total_ventas, fecha_cierre, estado}
 */
export async function cerrarTurnoEnSupabase(turnoId, dataCierre) {
  await supaFetch(`pos_turno?id=eq.${turnoId}`, {
    method: 'PATCH',
    body: JSON.stringify(dataCierre),
  });
}

// ── CONFIG ─────────────────────────────────────────────────────

/**
 * Descarga la config del negocio desde Supabase y la guarda
 * en localStorage para que funcione offline.
 *
 * @param {string} email — Email del usuario logueado
 * @returns {Promise<Object|null>}
 */
export async function sincronizarConfig(email) {
  try {
    const data = await supaFetch(`pos_config?email=eq.${encodeURIComponent(email)}`);
    const config = Array.isArray(data) ? data[0] : data;
    if (config) {
      Object.entries(config).forEach(([k, v]) => {
        if (v !== null && v !== undefined) {
          localStorage.setItem(k, typeof v === 'object' ? JSON.stringify(v) : String(v));
        }
      });
    }
    return config || null;
  } catch (e) {
    console.error('[db] sincronizarConfig:', e);
    return null;
  }
}

// ── PRODUCTOS Y CATEGORÍAS ─────────────────────────────────────

/**
 * Descarga los productos activos de la sucursal.
 * Devuelve [] si falla — la app sigue con el PRODS del script.
 *
 * @param {string|number} sucursalId
 * @returns {Promise<Array>}
 */
export async function fetchProductos(sucursalId) {
  try {
    return await supaFetch(
      `pos_productos?sucursal_id=eq.${sucursalId}&activo=eq.true&order=nombre.asc`
    ) || [];
  } catch (e) {
    console.error('[db] fetchProductos:', e);
    return [];
  }
}

/**
 * Descarga las categorías de la sucursal.
 * @param {string|number} sucursalId
 * @returns {Promise<Array>}
 */
export async function fetchCategorias(sucursalId) {
  try {
    return await supaFetch(
      `pos_categorias?sucursal_id=eq.${sucursalId}&order=nombre.asc`
    ) || [];
  } catch (e) {
    console.error('[db] fetchCategorias:', e);
    return [];
  }
}

// ── TIMBRADO (RPC) ─────────────────────────────────────────────
// El timbrado autoriza la DNIT para emitir facturas.

/**
 * Obtiene el timbrado activo para la terminal vía RPC.
 * @param {string} terminal
 * @returns {Promise<Object|null>}
 */
export async function getTimbradoDeSupabase(terminal) {
  try {
    const data = await supaFetch('rpc/get_timbrado_terminal', {
      method: 'POST',
      body: JSON.stringify({ p_terminal: terminal }),
    });
    return Array.isArray(data) ? data[0] : data || null;
  } catch (e) {
    console.error('[db] getTimbrado:', e);
    return null;
  }
}

/**
 * Avanza el correlativo de factura en Supabase.
 * Llamar DESPUÉS de emitir cada factura.
 * @param {string} terminal
 * @returns {Promise<number|null>} Nuevo número de factura
 */
export async function avanzarCorrelativo(terminal) {
  try {
    const data = await supaFetch('rpc/avanzar_correlativo', {
      method: 'POST',
      body: JSON.stringify({ p_terminal: terminal }),
    });
    const r = Array.isArray(data) ? data[0] : data;
    return r?.correlativo ?? null;
  } catch (e) {
    console.error('[db] avanzarCorrelativo:', e);
    return null;
  }
}

// ── TICKETS PENDIENTES (localStorage) ─────────────────────────
// Pendiente = ticket guardado sin cobrar. Vive en localStorage.

const KEY_PEND = 'pos_pendientes';
const KEY_CNT  = 'pos_ticket_counter';

/**
 * Lee los tickets pendientes guardados.
 * @returns {Array}
 */
export function leerPendientes() {
  try   { return JSON.parse(localStorage.getItem(KEY_PEND) || '[]'); }
  catch { return []; }
}

/**
 * Guarda la lista completa de pendientes.
 * @param {Array} arr
 */
export function guardarPendientes(arr) {
  try   { localStorage.setItem(KEY_PEND, JSON.stringify(arr)); }
  catch (e) { console.error('[db] guardarPendientes:', e); }
}

/**
 * Lee el número del próximo ticket.
 * @returns {number}
 */
export function leerTicketCounter() {
  return parseInt(localStorage.getItem(KEY_CNT) || '1', 10);
}

/**
 * Guarda el número del próximo ticket.
 * @param {number} n
 */
export function guardarTicketCounter(n) {
  localStorage.setItem(KEY_CNT, String(n));
}

// ── TURNO ACTIVO (localStorage) ────────────────────────────────

const KEY_TURNO = 'pos_turno_activo';

/**
 * Lee el turno activo. null = caja cerrada.
 * @returns {Object|null}
 */
export function leerTurnoActivo() {
  try   { return JSON.parse(localStorage.getItem(KEY_TURNO) || 'null'); }
  catch { return null; }
}

/**
 * Guarda el turno activo. Pasar null para cerrar la caja.
 * @param {Object|null} turno
 */
export function guardarTurnoActivo(turno) {
  if (turno === null) localStorage.removeItem(KEY_TURNO);
  else localStorage.setItem(KEY_TURNO, JSON.stringify(turno));
}

// ── TIMBRADO (localStorage) ────────────────────────────────────

/**
 * Lee el timbrado activo seleccionado para esta terminal.
 * @returns {Object|null}
 */
export function leerTimbradoActivo() {
  try   { return JSON.parse(localStorage.getItem('pos_timbrado_activo') || 'null'); }
  catch { return null; }
}

/**
 * Guarda el timbrado activo (después de avanzar correlativo).
 * @param {Object} t
 */
export function guardarTimbradoActivo(t) {
  localStorage.setItem('pos_timbrado_activo', JSON.stringify(t));
}

/**
 * Lee todos los timbrados disponibles.
 * @returns {Array}
 */
export function leerTimbrados() {
  try   { return JSON.parse(localStorage.getItem('pos_timbrados') || '[]'); }
  catch { return []; }
}

/**
 * Lee el mapa terminal→timbrado.
 * @returns {Object}
 */
export function leerTimbradosMapa() {
  try   { return JSON.parse(localStorage.getItem('pos_timbrados_mapa') || '{}'); }
  catch { return {}; }
}

// ── DESCUENTOS (localStorage) ──────────────────────────────────

/**
 * Lee los descuentos configurados.
 * @returns {Array} [{id, name, tipo, valor}]
 */
export function leerDescuentos() {
  try   { return JSON.parse(localStorage.getItem('pos_descuentos') || '[]'); }
  catch { return []; }
}

// ── CONFIG GENERAL (localStorage) ─────────────────────────────

/**
 * Lee toda la configuración del negocio desde localStorage.
 * Se usa en la pantalla de config y al inicializar la app.
 *
 * @returns {Object}
 */
export function leerConfigLocal() {
  return {
    negocio:      localStorage.getItem('lic_negocio')     || '',
    email:        localStorage.getItem('lic_email')       || '',
    sucursal:     localStorage.getItem('pos_sucursal')    || '',
    sucursalId:   localStorage.getItem('pos_sucursal_id') || '',
    deposito:     localStorage.getItem('pos_deposito')    || '',
    depositoId:   localStorage.getItem('pos_deposito_id') || '',
    terminal:     localStorage.getItem('pos_terminal')    || '',
    moneda:       localStorage.getItem('moneda')          || '₲',
    mostrarRuc:   localStorage.getItem('mostrar_ruc')     === 'true',
    ciudad:       localStorage.getItem('ciudad')          || '',
    emailNegocio: localStorage.getItem('email_negocio')   || '',
  };
}
