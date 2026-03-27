// ============================================================
// cobro.js — Pantalla de cobro y confirmación de pago
// Ampersand POS
// ============================================================
//
// PROPÓSITO:
//   Maneja todo el flujo de cobro al cliente:
//   - Selección de método de pago (Efectivo, POS, Transferencia)
//   - Teclado numérico para ingresar monto recibido
//   - Cálculo del vuelto en tiempo real
//   - Facturación (RUC, nombre) si el cliente la pide
//   - Confirmación: guarda en localStorage + llama a supaInsertVenta
//   - Muestra el recibo en pantalla (scRecibo)
//
// FLUJO:
//   1. Cajero presiona COBRAR → goCobrar()
//   2. Selecciona método de pago → selPay()
//   3. Ingresa monto recibido con el numpad → npKey()
//   4. Presiona CONFIRMAR → confirmarPago()
//   5. La venta se guarda en localStorage y se envía a Supabase
//   6. Se navega a scRecibo con el comprobante
//
// IDs DE DOM:
//   ctotal        → total a cobrar (grande, en pantalla scCobrar)
//   efecVal       → display del monto ingresado en efectivo
//   vueltoRow     → fila del vuelto
//   vueltoAmt     → monto del vuelto
//   descTicketRow → fila del descuento (visible si hay descuento)
//   descTicketMonto → monto del descuento
//   efecSec       → sección de efectivo (monto + vuelto)
//   compSec       → sección de comprobante (POS/transferencia)
//   compDisplay   → display del número de comprobante
//   factRuc       → campo RUC del cliente
//   factNombre    → campo nombre del cliente
//   npLbl         → etiqueta del teclado numérico
//   npDisp        → display del teclado numérico
//   billetesRow   → botones de billetes rápidos
//   npOverlay     → overlay del teclado numérico
// ============================================================

import { gs, toast, goTo } from './ui.js';
import {
  calcTotal, calcSubtotal, calcDescuentoMonto,
  cart, pendientes, ticketCounter, currentTicketNro,
  tipoPedido, ticketDescuento, mesaActual,
  setCart, setCurrentTicketNro, setTicketDescuento,
  updBtnGuardar, setNpCtx, setNpVal,
  divPagos, divNpIdx,
  npVal, npCtx,
} from './ventas.js';
import { insertarVenta, guardarTicketCounter, guardarPendientes, leerConfigLocal } from './db.js';

// Accesores locales — leen el live binding exportado del módulo (no window.*)
const getNpVal = () => npVal;
const getNpCtx = () => npCtx;

// ── ESTADO DEL COBRO ───────────────────────────────────────────

/** Método de pago seleccionado */
let metodoPago = 'Efectivo';

/** Número de comprobante (POS o transferencia) */
let nroComprobante = '';

// ── IR A COBRAR ────────────────────────────────────────────────

/**
 * Abre la pantalla de cobro con los datos del ticket actual.
 * Resetea el método a Efectivo y limpia el numpad.
 */
export function goCobrar() {
  const total = calcTotal();
  if (!total) { toast('Agregá productos primero'); return; }

  // Resetear estado del cobro
  metodoPago     = 'Efectivo';
  nroComprobante = '';

  // Mostrar el total
  const elTotal = document.getElementById('ctotal');
  if (elTotal) elTotal.textContent = gs(total);

  // Mostrar/ocultar fila de descuento
  const desc     = calcDescuentoMonto();
  const descRow  = document.getElementById('descTicketRow');
  const descMto  = document.getElementById('descTicketMonto');
  if (descRow) descRow.style.display  = desc > 0 ? 'flex' : 'none';
  if (descMto) descMto.textContent    = '−' + gs(desc);

  // Seleccionar Efectivo por defecto
  selPay('Efectivo');

  // Limpiar numpad
  _resetNumpad();

  goTo('scCobrar');
}

// ── MÉTODO DE PAGO ─────────────────────────────────────────────

/**
 * Selecciona el método de pago.
 * Actualiza los botones y muestra/oculta las secciones correspondientes.
 *
 * @param {'Efectivo'|'POS'|'Transferencia'} metodo
 */
export function selPay(metodo) {
  metodoPago = metodo;

  // Actualizar botones — el HTML tiene ids payBtnEfectivo, payBtnPOS, payBtnTransferencia
  document.querySelectorAll('.pay-btn').forEach(b => b.classList.remove('sel'));
  const btn = document.getElementById('payBtn' + metodo);
  if (btn) btn.classList.add('sel');

  // Sección efectivo (monto + vuelto) — visible solo en Efectivo
  const efecSec = document.getElementById('efecSec');
  if (efecSec) efecSec.style.display = metodo === 'Efectivo' ? '' : 'none';

  // Billetes rápidos — solo en Efectivo
  const billetes = document.getElementById('billetesRow');
  if (billetes) billetes.classList.toggle('show', metodo === 'Efectivo');

  // Sección comprobante — POS o Transferencia
  const compSec = document.getElementById('compSec');
  if (compSec) compSec.style.display = (metodo === 'POS' || metodo === 'Transferencia') ? '' : 'none';

  // Vuelto solo aplica para efectivo
  const vueltoRow = document.getElementById('vueltoRow');
  if (vueltoRow) vueltoRow.style.display = metodo === 'Efectivo' ? 'flex' : 'none';

  _resetNumpad();
}

// ── TECLADO NUMÉRICO ───────────────────────────────────────────

/** Limpia el numpad */
function _resetNumpad() {
  setNpVal('');
  _actualizarDisplayNumpad();
}

/** Actualiza el display y recalcula el vuelto */
function _actualizarDisplayNumpad() {
  const efecEl = document.getElementById('efecVal');
  if (efecEl) efecEl.textContent = getNpVal() ? gs(parseInt(getNpVal()) || 0) : gs(0);
  _actualizarVuelto();
}

/** Calcula y muestra el vuelto en tiempo real */
function _actualizarVuelto() {
  const vueltoEl = document.getElementById('vueltoAmt');
  if (!vueltoEl || metodoPago !== 'Efectivo') return;

  const recibido = parseInt(getNpVal() || 0) || 0;
  const total    = calcTotal();
  const vuelto   = recibido - total;

  vueltoEl.textContent = vuelto >= 0 ? gs(vuelto) : '—';
  vueltoEl.style.color = vuelto < 0 ? 'var(--danger)' : 'var(--success)';
}

/**
 * Procesa una tecla del teclado numérico.
 *
 * @param {string} key — '0'-'9', '000', '⌫', '✓'
 */
export function npKey(key) {
  const ctx = getNpCtx();
  let val   = getNpVal();

  if (key === '⌫') {
    setNpVal(val.slice(0, -1));

  } else if (key === '✓') {
    _confirmarNumpad(ctx, val);
    return;

  } else {
    // Límite de 10 dígitos para evitar montos absurdos
    if (val.length >= 10) return;
    setNpVal(val + key);
  }

  _actualizarDisplayNumpad();
}

/**
 * Aplica el valor del numpad según el contexto.
 * Contextos posibles:
 *   'efec'    → monto recibido en efectivo
 *   'div'     → monto de un pago dividido
 *   'divComp' → comprobante de un pago dividido
 */
function _confirmarNumpad(ctx, val) {
  const num = parseInt(val) || 0;
  const idx = divNpIdx ?? -1;

  if (ctx === 'div' && idx >= 0 && divPagos[idx]) {
    divPagos[idx].monto = num;
    window.renderDivList?.();
    window.updDivRestante?.();

  } else if (ctx === 'divComp' && idx >= 0 && divPagos[idx]) {
    divPagos[idx].comprobante = val;
    const el = document.getElementById('divCompDisp' + idx);
    if (el) { el.textContent = val || '—'; el.style.color = val ? '#fff' : '#666'; }

  } else if (ctx === 'comp') {
    // Comprobante POS/transferencia
    nroComprobante = val;
    const el = document.getElementById('compDisplay');
    if (el) el.textContent = val || '—';
  }
  // ctx === 'efec' → el valor ya está en npVal (módulo ventas.js), se lee al confirmar pago

  document.getElementById('npOverlay')?.classList.remove('open');
}

/**
 * Abre el numpad para ingresar el monto en efectivo.
 */
export function openNpEfectivo() {
  setNpCtx('efec');
  setNpVal('');
  const lbl  = document.getElementById('npLbl');
  const disp = document.getElementById('npDisp');
  const bill = document.getElementById('billetesRow');
  const ov   = document.getElementById('npOverlay');
  if (lbl)  lbl.textContent  = 'Monto recibido';
  if (disp) disp.textContent = gs(0);
  if (bill) bill.classList.add('show');
  if (ov)   ov.classList.add('open');
}

/**
 * Aplica un billete rápido sumándolo al monto actual.
 * @param {number} monto — Denominación del billete
 */
export function aplicarBillete(monto) {
  const actual = parseInt(getNpVal() || 0) || 0;
  setNpVal(String(actual + monto));
  _actualizarDisplayNumpad();
}

// ── CONFIRMACIÓN DE PAGO ───────────────────────────────────────

/**
 * Confirma y registra la venta.
 *
 * Proceso:
 *   1. Valida monto recibido (si es efectivo)
 *   2. Construye el objeto venta
 *   3. Guarda en localStorage (pos_pendientes + pos_ticket_counter)
 *   4. Llama a insertarVenta() para enviar a Supabase
 *   5. Limpia el carrito
 *   6. Muestra el recibo (scRecibo)
 *
 * @param {Function|null} updUI — Para actualizar la pantalla después
 */
export async function confirmarPago(updUI) {
  const total    = calcTotal();
  const recibido = parseInt(getNpVal() || 0) || 0;

  // Validar monto para efectivo
  if (metodoPago === 'Efectivo' && recibido < total) {
    toast('El monto recibido es insuficiente');
    return;
  }

  const vuelto = metodoPago === 'Efectivo' ? recibido - total : 0;

  // Leer datos de factura si aplica
  const factRuc    = document.getElementById('factRuc')?.value.trim()    || '';
  const factNombre = document.getElementById('factNombre')?.value.trim() || '';
  const tieneFactura = !!(factRuc && factNombre);

  // Leer config local para datos de turno y terminal
  const cfg      = leerConfigLocal();
  const turnoStr = localStorage.getItem('pos_turno_activo') || 'null';
  let turnoId    = null;
  try { turnoId = JSON.parse(turnoStr)?.id ?? null; } catch {}

  // Número de ticket
  const nroTicket = currentTicketNro !== null ? currentTicketNro : ticketCounter;

  // Construir objeto venta
  const venta = {
    turno_id:       turnoId,
    terminal:       cfg.terminal,
    sucursal:       cfg.sucursal,
    ticket_nro:     nroTicket,
    items:          cart.map(i => ({
      id:     i.id,
      nombre: i.name,
      qty:    i.qty,
      precio: i.price,
      obs:    i.obs || '',
    })),
    total,
    metodo:         metodoPago,
    comprobante:    nroComprobante || '',
    efectivo:       recibido,
    vuelto,
    descTicket:     ticketDescuento,
    descMonto:      calcDescuentoMonto(),
    tiene_factura:  tieneFactura,
    factura_ruc:    factRuc,
    factura_nombre: factNombre,
    tipoPedido:     tipoPedido,
    mesa:           mesaActual?.nombre || '',
    fecha:          new Date().toISOString(),
  };

  // Si era un ticket pendiente, quitarlo de la lista
  if (currentTicketNro !== null) {
    const idx = pendientes.findIndex(t => t.nro === currentTicketNro);
    if (idx >= 0) pendientes.splice(idx, 1);
  }

  // Incrementar contador de tickets
  const nuevoCounter = currentTicketNro !== null ? ticketCounter : ticketCounter + 1;
  guardarTicketCounter(nuevoCounter);
  localStorage.setItem('pos_ticket_counter', String(nuevoCounter));
  localStorage.setItem('pos_pendientes', JSON.stringify(pendientes));

  // Limpiar carrito
  setCart([]);
  setCurrentTicketNro(null);
  setTicketDescuento(0);
  if (updUI) updUI();
  if (typeof window.updBtnGuardar === 'function') window.updBtnGuardar();

  // Enviar a Supabase en background — no bloquear el flujo del cajero
  insertarVenta(venta).catch(e => console.error('[cobro] insertarVenta:', e));

  // Mostrar recibo
  _mostrarRecibo(venta, recibido, vuelto);
}

/** Muestra el recibo en la pantalla scRecibo */
function _mostrarRecibo(venta, recibido, vuelto) {
  const cfg  = leerConfigLocal();

  // Llenar campos del recibo
  _setRec('reciboTitulo',   cfg.negocio || 'Recibo');
  _setRec('reciboNro',      '#' + String(venta.ticket_nro).padStart(4, '0'));
  _setRec('reciboFecha',    _formatFechaRecibo(venta.fecha));
  _setRec('reciboTotal',    gs(venta.total));
  _setRec('reciboMetodo',   venta.metodo);
  _setRec('reciboEfectivo', venta.metodo === 'Efectivo' ? gs(recibido) : '');
  _setRec('reciboVuelto',   venta.metodo === 'Efectivo' ? gs(vuelto) : '');

  // Items
  const itemsEl = document.getElementById('reciboItems');
  if (itemsEl) {
    itemsEl.innerHTML = venta.items.map(i => `
      <div class="recibo-item">
        <span>${i.qty}× ${i.nombre}${i.obs ? ' (' + i.obs + ')' : ''}</span>
        <span>${gs(i.precio * i.qty)}</span>
      </div>
    `).join('');
  }

  goTo('scRecibo');
}

function _setRec(id, val) {
  const el = document.getElementById(id);
  if (el) el.textContent = val;
}

function _formatFechaRecibo(iso) {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString('es-PY') + ' ' + d.toLocaleTimeString('es-PY', { hour: '2-digit', minute: '2-digit' });
  } catch { return ''; }
}
