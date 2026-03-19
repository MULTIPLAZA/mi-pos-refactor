// ============================================================
// ui.js — Utilidades de UI compartidas
// Ampersand POS
// ============================================================
// Funciones usadas por todos los módulos:
//   - gs()    → formato guaraní
//   - toast() → notificación temporal
//   - goTo()  → navegación entre pantallas
// ============================================================

// Formato de moneda guaraní
export function gs(n) {
  return '₲' + Math.round(n || 0).toLocaleString('es-PY');
}

// Toast notification
let _tt;
export function toast(m) {
  const t = document.getElementById('toast');
  if (!t) return;
  t.textContent = m;
  t.classList.add('show');
  clearTimeout(_tt);
  _tt = setTimeout(() => t.classList.remove('show'), 1800);
}

// Navegación entre pantallas
export function goTo(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  const el = document.getElementById(id);
  if (el) el.classList.add('active');

  // Callbacks post-navegación
  if (id === 'scConfig')        setTimeout(() => window.renderConfigInfo?.(),   50);
  if (id === 'scConfigGeneral') setTimeout(() => window.renderGeneralInfo?.(),  50);
  if (id === 'scDescuentos')    setTimeout(() => window.renderDescList?.(),     50);
  if (id === 'scArticulosList') setTimeout(() => window.renderArtList?.(),      50);
}
