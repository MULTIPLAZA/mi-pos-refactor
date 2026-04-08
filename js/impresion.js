// ── Impresión: tickets, facturas, comandas, térmicas, serial, USB ──
// ══════════════════════════════════════════════════════
// IMPRESIÓN TÉRMICA — POS58 / POS80
// ══════════════════════════════════════════════════════

// Guardar último recibo para reimprimir
let ultimoReciboData = null;

// Obtener tamaño de papel configurado
function getPaperSize(tipo){ return (printers[tipo] && printers[tipo].size) || localStorage.getItem('printerSize_'+tipo) || '58'; }

// CSS base para impresión térmica
function getCSSTermico(size){
  const w  = size==='58' ? '58mm' : '80mm';
  const pw = size==='58' ? '48mm' : '72mm';
  const fs = size==='58' ? '8.5pt': '10pt';
  const ss = size==='58' ? '7pt'  : '8pt';
  const ls = size==='58' ? '11pt' : '13pt';
  return `
    @page { size: ${w} auto !important; margin: 0 !important; }
    @media print {
      html, body { width: ${w} !important; margin: 0 !important; padding: 0 !important; }
    }
    * { margin:0; padding:0; box-sizing:border-box; }
    html { width:${w}; }
    body {
      font-family: Arial, "Helvetica Neue", sans-serif;
      font-size: ${fs};
      width: ${pw};
      max-width: ${pw};
      margin: 0 auto;
      padding: 2mm 0;
      background: #fff;
      color: #000;
    }
    p  { margin:0; padding:0; line-height:1.3; }
    .c { text-align:center; }
    .r { text-align:right; }
    .b { font-weight:bold; }
    .s { font-size:${ss}; }
    .l { font-size:${ls}; font-weight:bold; }
    .hr{ border:none; border-top:1px dashed #000; margin:1mm 0; display:block; }
    /* fila dos columnas: izq flexible, der fijo */
    .row { display:flex; justify-content:space-between; align-items:baseline; }
    .row .l1 { flex:1; padding-right:4px; word-break:break-word; }
    .row .l2 { text-align:right; white-space:nowrap; min-width:0; }
    /* fila de item: nombre arriba, nums abajo */
    .it-nom { font-size:${ss}; font-weight:bold; word-break:break-word; }
    .it-det { display:flex; justify-content:space-between; font-size:${ss}; padding-left:2px; }
    .it-det .qty { white-space:nowrap; }
    .it-det .pu  { flex:1; text-align:center; white-space:nowrap; }
    .it-det .sub { white-space:nowrap; font-weight:bold; }
    .obs { font-size:${ss}; padding-left:8px; color:#333; }
    /* item factura: nombre + datos en dos líneas */
    .if-nom { font-size:${ss}; font-weight:bold; word-break:break-word; }
    .if-det { display:flex; justify-content:space-between; font-size:${ss}; padding-left:2px; }
    .if-det span { white-space:nowrap; }
  `;
}

// Abrir ventana e imprimir
function abrirVentanaImpresion(html, size){
  const mmW = size==='58' ? '58mm' : '80mm';
  const pxW = size==='58' ? 230 : 310;

  // Método 1: Blob URL — funciona en PWA Android, Chrome, cualquier contexto
  try{
    const blob = new Blob([html], {type:'text/html'});
    const url  = URL.createObjectURL(blob);
    const win  = window.open(url, '_blank');
    if(win){
      win.onload = function(){
        setTimeout(function(){
          win.focus();
          win.print();
          setTimeout(function(){ URL.revokeObjectURL(url); }, 3000);
        }, 400);
      };
      // Fallback si onload no dispara (algunos Android)
      setTimeout(function(){
        try{ win.focus(); win.print(); }catch(e){}
        setTimeout(function(){ URL.revokeObjectURL(url); }, 3000);
      }, 1500);
      return;
    }
  }catch(e){ console.warn('[Print] Blob falló:', e.message); }

  // Método 2: iframe visible temporalmente — funciona cuando window.open bloqueado
  try{
    let iframe = document.getElementById('printFrame');
    if(iframe) iframe.remove();
    iframe = document.createElement('iframe');
    iframe.id = 'printFrame';
    iframe.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;border:none;z-index:99999;background:#fff;';
    document.body.appendChild(iframe);
    const doc = iframe.contentWindow.document;
    doc.open(); doc.write(html); doc.close();
    setTimeout(function(){
      try{
        iframe.contentWindow.focus();
        iframe.contentWindow.print();
        setTimeout(function(){ iframe.remove(); }, 3000);
      }catch(e2){
        iframe.remove();
        // Método 3: window.print con CSS @media
        _imprimirConCSSMedia(html, mmW);
      }
    }, 800);
    return;
  }catch(e){ console.warn('[Print] iframe falló:', e.message); }

  // Método 3 directo si todo falla
  _imprimirConCSSMedia(html, mmW);
}

function _imprimirConCSSMedia(html, mmW){
  // Inyectar contenido en página actual con @media print
  const bodyMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  const styleMatch = html.match(/<style[^>]*>([\s\S]*?)<\/style>/i);
  const content = bodyMatch ? bodyMatch[1] : html;
  const ticketCss = styleMatch ? styleMatch[1] : '';
  
  let pd = document.getElementById('_printDiv');
  if(!pd){ pd = document.createElement('div'); pd.id = '_printDiv'; document.body.appendChild(pd); }
  pd.innerHTML = content;
  
  let ps = document.getElementById('_printStyle');
  if(!ps){ ps = document.createElement('style'); ps.id = '_printStyle'; document.head.appendChild(ps); }
  ps.textContent = '@media print{body>*:not(#_printDiv){display:none!important}#_printDiv{display:block!important}@page{size:'+mmW+' auto;margin:0}}@media screen{#_printDiv{display:none}}' + ticketCss;
  
  setTimeout(function(){
    window.print();
    setTimeout(function(){ pd.innerHTML=''; ps.textContent=''; }, 3000);
  }, 300);
}

// Formatear número guaraní sin símbolo (para ticket)
function gn(n){ return Math.round(n||0).toLocaleString('es-PY'); }

// Padding derecho para columnas
function padL(s,n){ s=String(s); return s.length>=n?s.substring(0,n):s+' '.repeat(n-s.length); }
function padR(s,n){ s=String(s); return s.length>=n?s.substring(0,n):' '.repeat(n-s.length)+s; }
function center(s,n){ s=String(s); const p=Math.max(0,n-s.length); const l=Math.floor(p/2); return ' '.repeat(l)+s+' '.repeat(p-l); }

// ── TICKET (no factura) ───────────────────────────────────
// Helper — líneas de forma de pago desglosadas
function lineasPago(data, gn){
  let lineas = '';
  if(data.divPagos && data.divPagos.length >= 2){
    // Pago dividido — mostrar cada método por separado
    data.divPagos.forEach(p => {
      lineas += '<p class="row s"><span class="l1">'+p.metodo.toUpperCase()+':</span><span class="l2">'+gn(p.monto)+'</span></p>';
    });
  } else {
    // Pago simple — o string compuesto viejo (ej: "EFECTIVO + POS")
    const metodo = (data.metodo||'EFECTIVO').toUpperCase();
    if(metodo.includes(' + ')){
      // Dividir string compuesto en partes iguales
      const partes = metodo.split(' + ');
      const montoParte = Math.round(data.total / partes.length);
      partes.forEach((m, i) => {
        const monto = i === partes.length-1 ? data.total - montoParte*(partes.length-1) : montoParte;
        lineas += '<p class="row s"><span class="l1">'+m+':</span><span class="l2">'+gn(monto)+'</span></p>';
      });
    } else {
      lineas += '<p class="row s"><span class="l1">'+metodo+':</span><span class="l2">'+gn(data.total)+'</span></p>';
    }
  }
  return lineas;
}

function generarHTMLTicket(data, size){
  const cols = size==='58' ? 32 : 42;
  const sep  = '-'.repeat(cols);
  const neg  = configData.negocio || 'MI NEGOCIO';
  const ruc  = configData.ruc     || '';
  const dir  = configData.direccion || '';
  const tel  = configData.telefono  || '';

  const pad = n=>String(n).padStart(2,'0');
  const d   = data.fecha;
  const fecha = pad(d.getDate())+'/'+pad(d.getMonth()+1)+'/'+d.getFullYear();
  const hora  = pad(d.getHours())+':'+pad(d.getMinutes())+':'+pad(d.getSeconds());

  let lineas = '';

  // Cabecera
  lineas += '<p class="c" style="font-size:14px;font-weight:900;letter-spacing:.5px;">'+neg+'</p>';
  if(ruc)  lineas += '<p class="c s">RUC: '+ruc+'</p>';
  if(dir)  lineas += '<p class="c s">'+dir+'</p>';
  if(tel)  lineas += '<p class="c s">Tel: '+tel+'</p>';
  lineas += '<p class="hr"></p>';

  // Datos ticket
  lineas += '<p class="s">TICKET NRO: '+String(data.nroTicket||0).padStart(6,'0')+'</p>';
  lineas += '<p class="s">FECHA: '+fecha+' - HORA: '+hora+'</p>';
  lineas += '<p class="s">CLIENTE: '+((data.factura && data.factura.nombre)||'SIN NOMBRE')+'</p>';
  if(data.tipoPedido && data.tipoPedido!=='llevar' && data.tipoPedido!=='local'){
    lineas += '<p class="s b">TIPO: '+data.tipoPedido.toUpperCase()+'</p>';
  }
  if(data.mesa) lineas += '<p class="s b">MESA: '+data.mesa+'</p>';
  if(data.obs)  lineas += '<p class="s">OBS: '+data.obs+'</p>';
  lineas += '<p class="hr"></p>';

  // Encabezado columnas
  lineas += '<p class="s b"><span>DESCRIPCIÓN</span></p>';
  lineas += '<p class="s b"><span style="opacity:.6">CANT × P.UNIT</span>'
    +'<span style="float:right;font-weight:bold">SUBTOTAL</span></p>';
  lineas += '<p class="hr"></p>';

  // Items — nombre en línea 1, cant × pu = sub en línea 2
  data.items.forEach(item => {
    const subtot = item.desc>0 ? Math.round(item.price*item.qty*(1-item.desc/100)) : item.price*item.qty;
    lineas += '<p class="it-nom">'+item.name+'</p>';
    lineas += '<p class="it-det">'
      +'<span class="qty">'+item.qty+' × '+gn(item.price)+'</span>'
      +'<span class="pu"></span>'
      +'<span class="sub">'+gn(subtot)+'</span>'
      +'</p>';
    if(item.desc>0) lineas += '<p class="obs">  Desc: '+item.desc+'%</p>';
    if(item.obs)    lineas += '<p class="obs">  '+item.obs+'</p>';
  });
  lineas += '<p class="hr"></p>';

  // Totales
  const subtotal = data.items
    .filter(i=>!i.esDescuento)
    .reduce((s,i)=>s+(i.desc>0?Math.round(i.price*i.qty*(1-i.desc/100)):i.price*i.qty),0);
  const totalDescuentos = data.items
    .filter(i=>i.esDescuento)
    .reduce((s,i)=>s+(i.montoDesc||0),0);
  const hayDescuentos = totalDescuentos>0 || (data.descTicket>0);

  if(hayDescuentos){
    lineas += '<p class="row s"><span class="l1">SUBTOTAL</span><span class="l2">'+gn(subtotal)+'</span></p>';
    if(totalDescuentos>0){
      // Mostrar cada descuento aplicado
      data.items.filter(i=>i.esDescuento).forEach(d=>{
        lineas += '<p class="row s"><span class="l1">(-) '+d.name+'</span><span class="l2">'+gn(d.montoDesc)+'</span></p>';
      });
    }
    if(data.descTicket>0){
      lineas += '<p class="row s"><span class="l1">(-) Desc. ticket '+data.descTicket+'%</span><span class="l2">'+gn(data.descMonto||0)+'</span></p>';
    }
  }
  lineas += '<p class="row b l"><span class="l1">TOTAL:</span><span class="l2">'+gn(data.total)+'</span></p>';
  lineas += '<p class="hr"></p>';

  // Forma de pago
  lineas += '<p class="row s"><span class="l1">FORMA DE PAGO</span><span class="l2">IMPORTE</span></p>';
  lineas += '<p class="hr"></p>';
  lineas += lineasPago(data, gn);
  if(data.efectivo && data.efectivo!=='₲0') lineas += '<p class="row s"><span class="l1">EFECTIVO ENTREGADO:</span><span class="l2">'+data.efectivo+'</span></p>';
  if(data.vuelto) lineas += '<p class="row s"><span class="l1">VUELTO:</span><span class="l2">'+data.vuelto+'</span></p>';
  lineas += '<p class="hr"></p>';

  // Pie
  lineas += '<p class="hr"></p>';
  lineas += '<p class="c s">Comprobante no válido para el IVA</p>';
  if(data.nroOrden) lineas += '<p class="c s">Orden Nro: '+String(data.nroOrden).padStart(4,'0')+'</p>';
  if(configData.pie_recibo) lineas += '<p class="c s">'+configData.pie_recibo+'</p>';
  lineas += '<p class="c s b">*** GRACIAS POR SU PREFERENCIA ***</p>';
  lineas += '<p style="margin:0;line-height:1.8;">&nbsp;</p>';
  lineas += '<p style="margin:0;line-height:1.8;">&nbsp;</p>';
  lineas += '<p style="margin:0;line-height:1.8;">&nbsp;</p>';
  lineas += '<p style="margin:0;line-height:1.8;">&nbsp;</p>';
  lineas += '<p style="margin:0;line-height:1.8;">&nbsp;</p>';
  lineas += '<p style="margin:0;line-height:1.8;">&nbsp;</p>';
  return '<html><head><style>'+getCSSTermico(size)+'</style></head><body>'+lineas+'</body></html>';
}

// ── FACTURA ───────────────────────────────────────────────
function generarHTMLFactura(data, size){
  const cols = size==='58' ? 32 : 42;
  const neg  = configData.negocio   || 'MI NEGOCIO';
  const ruc  = configData.ruc       || '';
  const dir  = configData.direccion || '';
  const tel  = configData.telefono  || '';
  const f    = data.factura || {};
  const tim  = f.timbrado   || '';
  const nroF = f.nro_factura|| '';

  const pad = n=>String(n).padStart(2,'0');
  const d   = data.fecha;
  const fecha = pad(d.getDate())+'/'+pad(d.getMonth()+1)+'/'+d.getFullYear();
  const hora  = pad(d.getHours())+':'+pad(d.getMinutes())+':'+pad(d.getSeconds());

  // Calcular IVA (solo ítems normales, no descuentos)
  let grav10=0, grav5=0, exento=0;
  const subtotalFact = data.items
    .filter(i=>!i.esDescuento)
    .reduce((s,i)=>s+(i.desc>0?Math.round(i.price*i.qty*(1-i.desc/100)):i.price*i.qty),0);
  const totalDescFact = data.items
    .filter(i=>i.esDescuento)
    .reduce((s,i)=>s+(i.montoDesc||0),0);

  data.items.filter(i=>!i.esDescuento).forEach(item=>{
    const sub = item.desc>0 ? Math.round(item.price*item.qty*(1-item.desc/100)) : item.price*item.qty;
    if(item.iva==='10')       grav10  += sub;
    else if(item.iva==='5')   grav5   += sub;
    else                       exento  += sub;
  });
  const iva10  = Math.round(grav10  * 10/110);
  const iva5   = Math.round(grav5   * 5/105);
  const total  = data.total;

  let lineas = '';

  // Cabecera negocio
  lineas += '<p class="c" style="font-size:14px;font-weight:900;letter-spacing:.5px;">'+neg+'</p>';
  if(dir)  lineas += '<p class="c s">'+dir+'</p>';
  if(ruc)  lineas += '<p class="c s">RUC: '+ruc+'</p>';
  if(tel)  lineas += '<p class="c s">Tel: '+tel+'</p>';
  lineas += '<p class="hr"></p>';

  // Timbrado
  const timActivo = getTimbradoActivo();
  lineas += '<p class="s">TIMBRADO Nro: <b>'+tim+'</b></p>';
  // Vigencia del timbrado
  const vigInicio = (timActivo && timActivo.vig_inicio) || (timActivo && timActivo.fecha_desde) || '';
  const vigFin    = (timActivo && timActivo.vig_fin)    || (timActivo && timActivo.fecha_hasta) || '';
  if(vigInicio) lineas += '<p class="s">INICIO: '+(vigInicio.includes('-')?vigInicio.split('-').reverse().join('/'):vigInicio)+'</p>';
  if(vigFin && vigFin!=='2999-12-31') lineas += '<p class="s">VENCIMIENTO: '+(vigFin.includes('-')?vigFin.split('-').reverse().join('/'):vigFin)+'</p>';
  // Punto de expedición
  if(f.sucursal_nro||f.punto_exp) lineas += '<p class="s">SUC: '+(f.sucursal_nro||'001')+' - P.EXP: '+(f.punto_exp||'001')+'</p>';
  lineas += '<p class="hr"></p>';
  lineas += '<p class="c b" style="font-size:11pt;">FACTURA CONTADO</p>';
  lineas += '<p class="c b" style="font-size:11pt;">NRO: '+nroF+'</p>';
  lineas += '<p class="s">Fecha: '+fecha+' - Hora: '+hora+'</p>';
  if(data.tipoPedido && data.tipoPedido!=='llevar') lineas += '<p class="s">Tipo: '+data.tipoPedido.toUpperCase()+'</p>';
  if(data.mesa) lineas += '<p class="s">Mesa: '+data.mesa+'</p>';
  lineas += '<p class="hr"></p>';

  // Encabezado items
  lineas += '<p class="s b">DESCRIPCIÓN &nbsp;&nbsp;&nbsp; CANT × PU &nbsp;&nbsp; IMP &nbsp; IVA</p>';
  lineas += '<p class="hr"></p>';

  // Items — nombre en línea 1, detalle en línea 2
  data.items.filter(i=>!i.esDescuento).forEach(item=>{
    const sub = item.desc>0 ? Math.round(item.price*item.qty*(1-item.desc/100)) : item.price*item.qty;
    const ivaLabel = item.iva==='exento'?'Exnt':(item.iva||'10')+'%';
    lineas += '<p class="if-nom">'+item.name+'</p>';
    lineas += '<p class="if-det">'
      +'<span>'+item.qty+'×'+gn(item.price)+'</span>'
      +'<span>'+gn(sub)+'</span>'
      +'<span>'+ivaLabel+'</span>'
      +'</p>';
    if(item.obs) lineas += '<p class="obs">  '+item.obs+'</p>';
  });
  lineas += '<p class="hr"></p>';

  // Total
  lineas += '<p class="row b l"><span class="l1">TOTAL:</span><span class="l2">'+gn(total)+'</span></p>';
  lineas += '<p class="hr"></p>';

  // Sub totales IVA
  lineas += '<p class="row s"><span class="l1">SUB TOTALES</span><span class="l2">LIQUIDACION</span><span style="margin-left:4px;" class="l2 s">IVA</span></p>';
  lineas += '<p class="hr"></p>';
  if(grav10>0)  lineas += '<p class="row s"><span class="l1">Gravado 10%</span><span class="l2">'+gn(grav10)+'</span><span style="margin-left:4px;" class="l2">'+gn(iva10)+'</span></p>';
  if(grav5>0)   lineas += '<p class="row s"><span class="l1">Gravado 5%</span><span class="l2">'+gn(grav5)+'</span><span style="margin-left:4px;" class="l2">'+gn(iva5)+'</span></p>';
  if(exento>0)  lineas += '<p class="row s"><span class="l1">Exento</span><span class="l2">'+gn(exento)+'</span><span style="margin-left:4px;" class="l2">0</span></p>';
  lineas += '<p class="hr"></p>';

  // Forma de pago
  lineas += '<p class="row s"><span class="l1">FORMA DE PAGO</span><span class="l2">IMPORTE</span></p>';
  lineas += '<p class="hr"></p>';
  lineas += lineasPago(data, gn);
  if(data.efectivo && data.efectivo!=='₲0') lineas += '<p class="row s"><span class="l1">EFECTIVO ENTREGADO:</span><span class="l2">'+data.efectivo+'</span></p>';
  if(data.vuelto) lineas += '<p class="row s"><span class="l1">VUELTO:</span><span class="l2">'+data.vuelto+'</span></p>';
  lineas += '<p class="hr"></p>';

  // Cliente
  lineas += '<p class="s"><b>Cliente:</b> '+(f.nombre||'CONSUMIDOR FINAL')+'</p>';
  lineas += '<p class="s">RUC: '+(f.ruc||'0000000-0')+'</p>';
  if(f.direccion) lineas += '<p class="s">Dir: '+f.direccion+'</p>';
  lineas += '<p class="hr"></p>';

  // Footer
  if(nroF) lineas += '<p class="s">FACTURA NRO: <b>'+nroF+'</b></p>';
  lineas += '<p class="s">ATENDIDO POR: '+(configData.terminal||'admin')+'</p>';
  lineas += '<p class="s">ORIGINAL: CLIENTE</p>';
  lineas += '<p class="s">DUPLICADO: ARCHIVO TRIBUTARIO</p>';
  lineas += '<p class="hr"></p>';
  lineas += '<p class="s">LOS DATOS IMPRESOS REQUIEREN DE CUIDADOS ESPECIALES.</p>';
  if(configData.pie_recibo) lineas += '<p class="c s">'+configData.pie_recibo+'</p>';
  lineas += '<p class="c s b">*** GRACIAS POR SU PREFERENCIA ***</p>';
  lineas += '<p style="margin:0;line-height:1.8;">&nbsp;</p>';
  lineas += '<p style="margin:0;line-height:1.8;">&nbsp;</p>';
  lineas += '<p style="margin:0;line-height:1.8;">&nbsp;</p>';
  lineas += '<p style="margin:0;line-height:1.8;">&nbsp;</p>';
  lineas += '<p style="margin:0;line-height:1.8;">&nbsp;</p>';
  lineas += '<p style="margin:0;line-height:1.8;">&nbsp;</p>';
  return '<html><head><style>'+getCSSTermico(size)+'</style></head><body>'+lineas+'</body></html>';
}

// ── COMANDA ───────────────────────────────────────────────
function generarHTMLComanda(data, size){
  const pad = n=>String(n).padStart(2,'0');
  const d   = data.fecha instanceof Date ? data.fecha : new Date(data.fecha);
  const fecha = pad(d.getDate())+'/'+pad(d.getMonth()+1)+'/'+d.getFullYear();
  const hora  = pad(d.getHours())+':'+pad(d.getMinutes());
  const nro   = String(data.nroTicket||0).padStart(4,'0');

  const tipoPedido = (data.tipoPedido||'llevar').toLowerCase();
  const esDelivery = tipoPedido==='delivery';
  const esMesa     = tipoPedido==='local' || tipoPedido==='mesa' || !!data.mesa;
  const tipoLabel  = esDelivery          ? '*** DELIVERY ***'
                   : data.mesa           ? '*** MESA ' + data.mesa.toUpperCase() + ' ***'
                   : esMesa              ? '*** LOCAL ***'
                   :                      '*** PARA LLEVAR ***';

  const w = size==='58' ? 48 : 64; // ancho en chars para word-wrap

  // Función para partir texto largo en múltiples líneas
  function wrapText(txt, maxW, indent) {
    if (!txt) return '';
    indent = indent || '';
    const words = String(txt).split(' ');
    const lines = [];
    let cur = '';
    words.forEach(w => {
      if ((cur + (cur?' ':'') + w).length > maxW) {
        if (cur) lines.push(cur);
        cur = w;
      } else {
        cur = cur ? cur + ' ' + w : w;
      }
    });
    if (cur) lines.push(cur);
    if (!lines.length) return '';
    return lines[0] + (lines.slice(1).map(l => indent + l).join(''));
  }

  let lineas = '';

  // Separador superior
  lineas += '<p class="hr"></p>';

  // Nro orden — tamaño visible pero no exagerado
  lineas += '<p class="c" style="font-size:28px;font-weight:900;letter-spacing:3px;line-height:1.1;margin:2px 0;">'
          + '# ' + nro + '</p>';

  // Hora y fecha
  lineas += '<p class="c b" style="font-size:12px;margin:2px 0;">' + hora + '  ' + fecha + '</p>';
  lineas += '<p class="hr"></p>';

  // Tipo de pedido — muy visible
  lineas += '<p class="c" style="font-size:13px;font-weight:900;border-top:2px solid #000;border-bottom:2px solid #000;padding:3px 0;margin:2px 0;">'
          + tipoLabel + '</p>';

  // Cliente si tiene
  const cliente = (data.factura && data.factura.nombre) || data.cliente || '';
  if(cliente) lineas += '<p class="c b s" style="margin-top:2px;word-break:break-word;">Cliente: '+cliente+'</p>';
  if(data.obs) lineas += '<p class="c b s;word-break:break-word;">OBS: '+data.obs+'</p>';

  lineas += '<p class="hr"></p>';

  // Items — cantidad en grande, nombre en negrita con word-wrap
  data.items.filter(i=>!i.esDescuento).forEach(item=>{
    const maxNom = w - 3;

    if(item._esMitad){
      // Pizza por mitades — formato especial
      lineas += '<p style="margin:3px 0;">'
              + '<span style="font-size:14px;font-weight:900;">' + item.qty + '</span>'
              + '<span style="font-size:11pt;font-weight:800;"> PIZZA MITAD</span>'
              + '</p>';
      lineas += '<p class="s" style="padding-left:16px;font-weight:800;">½ ' + (item._mitad1||'') + '</p>';
      lineas += '<p class="s" style="padding-left:16px;font-weight:800;">½ ' + (item._mitad2||'') + '</p>';
    } else {
      const nombre = wrapText(item.name, maxNom, '   ');
      lineas += '<p style="margin:3px 0;">'
              + '<span style="font-size:14px;font-weight:900;">' + item.qty + '</span>'
              + '<span style="font-size:11pt;font-weight:800;"> ' + nombre + '</span>'
              + '</p>';
    }
    // Modificadores y observaciones
    if(item.obs && !item._esMitad){
      const obsLines = item.obs.split(' · ');
      obsLines.forEach(ob => {
        lineas += '<p class="s" style="padding-left:16px;font-weight:700;">-&gt; '
                + wrapText(ob, maxNom - 2, '  ') + '</p>';
      });
    } else if(item.obs && item._esMitad === undefined && item.obs){
      lineas += '<p class="s" style="padding-left:16px;font-weight:700;">-&gt; '
              + wrapText(item.obs, maxNom - 2, '  ') + '</p>';
    }
  });

  lineas += '<p class="hr"></p>';
  lineas += '<p style="margin:0;line-height:1.8;">&nbsp;</p>';
  lineas += '<p style="margin:0;line-height:1.8;">&nbsp;</p>';
  lineas += '<p style="margin:0;line-height:1.8;">&nbsp;</p>';
  lineas += '<p style="margin:0;line-height:1.8;">&nbsp;</p>';
  lineas += '<p style="margin:0;line-height:1.8;">&nbsp;</p>';
  lineas += '<p style="margin:0;line-height:1.8;">&nbsp;</p>';

  return '<html><head><style>'+getCSSTermico(size)+'</style></head><body>'+lineas+'</body></html>';
}

// ── IMPRIMIR RECIBO (ticket o factura según si tiene timbrado) ──
function imprimirTicketActual(){
  if(!cart || cart.length === 0){ toast('El ticket está vacío'); return; }
  const size = getPaperSize('ticket');
  const ahora = new Date();

  const data = {
    items:     JSON.parse(JSON.stringify(cart)),
    total:     calcTotal(),
    metodo:    '',
    fecha:     ahora,
    nroTicket: currentTicketNro || ticketCounter,
    obs:       '',
    factura:   null,
    descTicket: ticketDescuento || 0,
  };

  // Actualizar ultimoReciboData para que imprimirRecibo() use estos datos
  ultimoReciboData = data;
  const html = generarHTMLTicket(data, size);
  mostrarPreviewRecibo(html, size);
  const titulo = document.getElementById('reciboTitulo');
  if(titulo) titulo.textContent = 'Ticket #' + String(data.nroTicket).padStart(4,'0');
  goTo('scRecibo');
}

function imprimirTicketPendiente(idx){
  const t = pendientes[idx];
  if(!t){ toast('Ticket no encontrado'); return; }
  // Compatibilidad: algunos tickets guardados usan 'items' en vez de 'cart'
  const items = t.cart || t.items || [];
  if(!items.length){ toast('Ticket sin productos'); return; }
  const size = getPaperSize('ticket');
  const data = {
    items:      JSON.parse(JSON.stringify(items)),
    total:      t.total || items.reduce((s,i)=>s+(i.price*i.qty),0),
    metodo:     '',
    fecha:      t.fecha ? new Date(t.fecha) : new Date(),
    nroTicket:  t.nro,
    obs:        t.obs || '',
    factura:    null,
    descTicket: 0,
  };
  // ── CRÍTICO: actualizar ultimoReciboData para que imprimirRecibo()
  // use estos datos y no los de la última venta cobrada
  ultimoReciboData = data;
  const html = generarHTMLTicket(data, size);
  mostrarPreviewRecibo(html, size);
  const titulo = document.getElementById('reciboTitulo');
  if(titulo) titulo.textContent = 'Ticket #'+String(t.nro).padStart(4,'0');
  goTo('scRecibo');
}

// ── IMPRESIÓN DIRECTA ─────────────────────────────────────
// Imprime sin abrir ventana nueva — funciona en PWA y terminales Android
// ── QUICKPRINTER (puente para impresoras internas Android) ─
// Convierte el HTML del ticket a texto plano y lo manda a QuickPrinter
function imprimirConQuickPrinter(html, size){
  const cols = size === '58' ? 32 : 42;
  const sep  = '-'.repeat(cols);

  // Convertir HTML térmico a texto plano compatible con QuickPrinter
  let texto = html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<hr[^>]*>/gi, '\n' + sep + '\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<p[^>]*class="[^"]*row[^"]*"[^>]*>([\s\S]*?)<\/p>/gi, function(m, inner){
      const spans = inner.match(/<span[^>]*>([\s\S]*?)<\/span>/gi) || [];
      const texts = spans.map(s => s.replace(/<[^>]+>/g,'').trim());
      if(texts.length >= 2){
        const left  = texts[0];
        const right = texts.slice(1).join(' ');
        const pad   = Math.max(1, cols - left.length - right.length);
        return left + ' '.repeat(pad) + right + '\n';
      }
      return texts.join(' ') + '\n';
    })
    .replace(/<p[^>]*class="[^"]*c[^"]*"[^>]*>([\s\S]*?)<\/p>/gi, function(m, inner){
      const txt = inner.replace(/<[^>]+>/g,'').trim();
      const pad = Math.max(0, Math.floor((cols - txt.length) / 2));
      return ' '.repeat(pad) + txt + '\n';
    })
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&nbsp;/g,' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  // Agregar corte al final
  texto += '\n\n\n';

  // Probar con el action directo de QuickPrinter
  // Formato documentado en github.com/diegoveloper/quickprinter
  const encoded = encodeURIComponent(texto);

  // Método 1: Intent con action pe.diegoveloper.printing
  const intent = 'intent:#Intent;' +
                 'action=pe.diegoveloper.printing;' +
                 'type=text/plain;' +
                 'S.android.intent.extra.TEXT=' + encoded + ';' +
                 'end';
  try {
    window.location.href = intent;
    return true;
  } catch(e){
    console.warn('[QuickPrinter]', e.message);
    return false;
  }
}

function imprimirDirecto(html, size){
  const mmW = size === '58' ? '58mm' : '80mm';

  // Intentar QuickPrinter primero (para Vizzion y Android con impresora interna)
  const esAndroid = /android/i.test(navigator.userAgent);
  if(esAndroid){
    // Si el APK expone AndroidPrint, usar ESC/POS directo
    if(typeof window.AndroidPrint !== 'undefined'){
      imprimirAndroidNativo(html, size);
      return;
    }
    // Si no hay AndroidPrint, intentar QuickPrinter
    // Solo si NO estamos dentro de un WebView APK (que rompería la navegación)
    const esWebView = /wv\)/.test(navigator.userAgent) || /; wv\)/.test(navigator.userAgent);
    if(!esWebView){
      imprimirConQuickPrinter(html, size);
      return;
    }
    // Dentro del APK sin AndroidPrint — usar @media print
  }

  // Método 1: Blob URL + ventana nueva (PC / iOS)
  try {
    const fullHtml = html.replace('</style>',
      '@page{size:'+mmW+' auto;margin:0}body{margin:0;padding:0}</style>');
    const blob = new Blob([fullHtml], {type: 'text/html'});
    const url  = URL.createObjectURL(blob);
    const win  = window.open(url, '_blank');
    if(win){
      win.onload = function(){
        setTimeout(function(){
          win.print();
          setTimeout(function(){ URL.revokeObjectURL(url); }, 5000);
        }, 500);
      };
      setTimeout(function(){
        try{ win.print(); }catch(e){}
        setTimeout(function(){ URL.revokeObjectURL(url); }, 5000);
      }, 2000);
      return;
    }
  } catch(e){ console.warn('[Print] Blob falló:', e.message); }

  // Método 2: @media print directo en la página
  const bodyMatch  = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  const styleMatch = html.match(/<style[^>]*>([\s\S]*?)<\/style>/i);
  const content    = bodyMatch  ? bodyMatch[1]  : html;
  const ticketCss  = styleMatch ? styleMatch[1] : '';
  let pd = document.getElementById('_printDiv');
  if(!pd){ pd = document.createElement('div'); pd.id = '_printDiv'; document.body.appendChild(pd); }
  pd.innerHTML = content;
  let ps = document.getElementById('_printStyle');
  if(!ps){ ps = document.createElement('style'); ps.id = '_printStyle'; document.head.appendChild(ps); }
  ps.textContent =
    '@media print{body>*:not(#_printDiv){display:none!important}#_printDiv{display:block!important}' +
    '@page{size:'+mmW+' auto;margin:0}}' +
    '@media screen{#_printDiv{display:none}}' + ticketCss;
  setTimeout(function(){
    window.print();
    setTimeout(function(){ pd.innerHTML=''; ps.textContent=''; }, 5000);
  }, 300);
}

function imprimirRecibo(){
  if(!ultimoReciboData){ toast('Sin datos para imprimir'); return; }

  // BT Print Server tiene prioridad si hay MAC guardada
  const btpsTipo = localStorage.getItem('printerType_ticket');
  const btpsMac  = localStorage.getItem('btps_mac');
  if(btpsTipo === 'btps' || btpsMac){
    BTPrinter.imprimirRecibo(ultimoReciboData);
    return;
  }

  const size = getPaperSize('ticket');
  const esFactura = ultimoReciboData.factura && ultimoReciboData.factura.timbrado;
  const html = esFactura
    ? generarHTMLFactura(ultimoReciboData, size)
    : generarHTMLTicket(ultimoReciboData, size);
  const p = printers['ticket'];
  if(isAndroidAPK() && typeof window.AndroidPrint !== 'undefined'){
    imprimirAndroidNativo(html, size);
  } else if(p && p.type === 'bt' && p.device){
    imprimirBluetooth(p.device, html, size);
  } else {
    // PC/USB — usar el mismo flujo que la primera impresion
    const widthPx = size === '58' ? '200px' : '280px';
    abrirDialogoImpresion(html, widthPx);
  }
}

// ── IMPRIMIR COMANDA ──────────────────────────────────────
function imprimirComanda(data){
  const size = getPaperSize('comanda');
  const html = generarHTMLComanda(data, size);

  const btpsMac  = localStorage.getItem('btps_mac');
  const btpsTipo = localStorage.getItem('printerType_ticket');
  if(btpsMac || btpsTipo === 'btps'){
    const cols = size === '58' ? 32 : 42;
    const sep  = '='.repeat(cols);
    const sep2 = '-'.repeat(cols);
    const n    = '\n';

    const d     = data.fecha ? (data.fecha instanceof Date ? data.fecha : new Date(data.fecha)) : new Date();
    // Formato 24hs para evitar caracteres especiales de AM/PM en impresoras térmicas
    const hora  = String(d.getHours()).padStart(2,'0') + ':' + String(d.getMinutes()).padStart(2,'0');
    const fecha = String(d.getDate()).padStart(2,'0') + '/' + String(d.getMonth()+1).padStart(2,'0') + '/' + d.getFullYear();
    const nro   = String(data.nroTicket||'').padStart(4,'0');

    const tipoPedido = (data.tipoPedido||'llevar').toLowerCase();
    const esDelivery = tipoPedido==='delivery';
    const esMesa     = tipoPedido==='local' || tipoPedido==='mesa' || !!data.mesa;
    const tipoLabel  = esDelivery          ? '*** DELIVERY ***'
                     : data.mesa           ? '*** MESA ' + data.mesa.toUpperCase() + ' ***'
                     : esMesa              ? '*** LOCAL ***'
                     :                      '*** PARA LLEVAR ***';

    // Función para partir texto largo en múltiples líneas
    function wrapLine(txt, maxW, indent) {
      if (!txt) return '';
      const words = String(txt).split(' ');
      const lines = []; let cur = '';
      words.forEach(function(w){
        if((cur+(cur?' ':'')+w).length > maxW){ if(cur) lines.push(cur); cur=w; }
        else { cur = cur ? cur+' '+w : w; }
      });
      if(cur) lines.push(cur);
      return lines[0] + (lines.slice(1).map(function(l){ return n+(indent||'   ')+l; }).join(''));
    }

    let txt = '';
    txt += sep + n;

    // Nro de orden — lo más grande posible
    // Línea de espaciado + nro bien centrado + negrita
    txt += n;
    txt += sep + n;
    txt += '[CENTER]ORDEN NRO[/CENTER]' + n;
    txt += '[CENTER][BOLD]# ' + nro + '[/BOLD][/CENTER]' + n;
    txt += sep + n;
    txt += n;

    // Hora y fecha
    txt += '[CENTER][BOLD]' + hora + '  ' + fecha + '[/BOLD][/CENTER]' + n;
    txt += sep2 + n;

    // Tipo de pedido
    txt += '[CENTER][BOLD]' + tipoLabel + '[/BOLD][/CENTER]' + n;
    txt += sep2 + n;

    // Cliente y obs
    const cliente = (data.factura && data.factura.nombre) || data.cliente || '';
    if(cliente) txt += 'Cliente: ' + cliente + n;
    if(data.obs) txt += '[BOLD]OBS: ' + data.obs + '[/BOLD]' + n;
    if(cliente || data.obs) txt += sep2 + n;

    // Items
    (data.items||[]).forEach(function(item){
      if(item.esDescuento) return;
      const maxNom = cols - 3;
      const nombre = wrapLine(item.name, maxNom, '   ');
      txt += '[BOLD]' + item.qty + ' ' + nombre + '[/BOLD]' + n;
      if(item.obs) txt += '  -> ' + wrapLine(item.obs, cols-5, '     ') + n;
    });

    txt += sep + n;
    txt += '[CUT]';

    BTPrinter.print(txt).then(function(r){
      if(r.status !== 'ok'){
        toast('Error comanda: ' + (r.message||'Error'));
        abrirVentanaImpresion(html, size);
      }
    });
    return;
  }

  abrirVentanaImpresion(html, size);
}

function renderTabletTicket(){
  const tl = document.getElementById('tabTlist');
  const empty = document.getElementById('tabEmpty');
  if(!tl) return;
  if(!cart.length){
    if(empty) empty.style.display='flex';
    // remove items but keep empty div
    Array.from(tl.children).forEach(c=>{ if(c.id!=='tabEmpty') c.remove(); });
    return;
  }
  if(empty) empty.style.display='none';
  // rebuild
  Array.from(tl.children).forEach(c=>{ if(c.id!=='tabEmpty') c.remove(); });
  cart.forEach(i=>{
    const div = document.createElement('div');
    div.className='tab-titem';
    if(i.esDelivery){
      // ítem delivery: sin controles de qty, solo quitar
      div.style.cssText='border-left:3px solid var(--orange);background:rgba(255,152,0,.06)';
      div.innerHTML=
        '<div style="width:7px;height:7px;border-radius:50%;background:var(--orange);flex-shrink:0"></div>'+
        '<div class="tab-tiname" style="color:var(--orange)">'+i.name+'</div>'+
        '<div class="tab-tictrl">'+
          '<button class="tab-qbtn" onclick="quitarItemDelivery();setTipoPedido(&apos;local&apos;)" title="Quitar delivery" style="background:var(--orange);color:#fff">✕</button>'+
        '</div>'+
        '<div class="tab-tiprice" style="color:var(--orange);font-weight:800">'+gs(i.price)+'</div>';
    } else {
      div.innerHTML=
        '<div style="width:7px;height:7px;border-radius:50%;background:'+i.color+';flex-shrink:0"></div>'+
        '<div class="tab-tiname">'+i.name+(i.obs?'<div class="tab-tiobs">'+i.obs+'</div>':'')+'</div>'+
        '<div class="tab-tictrl">'+
          '<button class="tab-qbtn" onclick="chgQty('+i.lineId+',-1)">−</button>'+
          '<span class="tab-qnum">'+i.qty+'</span>'+
          '<button class="tab-qbtn" onclick="chgQty('+i.lineId+',1)">+</button>'+
        '</div>'+
        '<div class="tab-tiprice">'+gs(i.price*i.qty)+'</div>';
    }
    tl.appendChild(div);
  });
}

// ── Serial / USB Print Server ──
// ── FUNCIÓN: imprimirSerial (Web Serial API — USB térmicas) ─────────────────
async function imprimirSerial(port, htmlContent, size){
  var ESC=0x1B, GS=0x1D;
  var CMD = {
    init:       [ESC,0x40],
    left:       [ESC,0x61,0x00],
    center:     [ESC,0x61,0x01],
    boldOn:     [ESC,0x45,0x01],
    boldOff:    [ESC,0x45,0x00],
    dblWideOn:  [ESC,0x21,0x20],
    dblWideOff: [ESC,0x21,0x00],
    smallOn:    [ESC,0x21,0x01],
    smallOff:   [ESC,0x21,0x00],
    cut:        [GS,0x56,0x41,0x10],
    feed:       [ESC,0x64,0x03],
  };
  var cols = size==='58' ? 32 : 42;

  function enc(str){
    var out=[];
    for(var i=0;i<str.length;i++){
      var c=str.charCodeAt(i);
      if(c<128)                       out.push(c);
      else if(c===0xC1||c===0xE1)     out.push(0xC1);
      else if(c===0xC9||c===0xE9)     out.push(0xC9);
      else if(c===0xCD||c===0xED)     out.push(0xCD);
      else if(c===0xD3||c===0xF3)     out.push(0xD3);
      else if(c===0xDA||c===0xFA)     out.push(0xDA);
      else if(c===0xD1||c===0xF1)     out.push(0xD1);
      else out.push(0x3F);
    }
    return out;
  }
  function line(str){ return enc(str).concat([0x0A]); }
  function sep(){ return line('-'.repeat(cols)); }
  function rline(l,r){
    var ls=String(l), rs=String(r);
    var sp=Math.max(1,cols-ls.length-rs.length);
    return line(ls+' '.repeat(sp)+rs);
  }

  var tmp=document.createElement('div');
  var htmlParsear=htmlContent;
  var bm=htmlContent.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  if(bm) htmlParsear=bm[1];
  tmp.innerHTML=htmlParsear;

  var parrafos=Array.from(tmp.querySelectorAll('p'));
  var bytes=[ESC,0x40, ESC,0x74,0x02]; // init + latin-1

  parrafos.forEach(function(p){
    var cls=p.className||'';
    var text=(p.innerText||p.textContent||'').trim();
    if(!text && !cls.includes('hr')) return;
    if(cls.includes('hr')){ bytes=bytes.concat(sep()); return; }

    var isCenter=cls.includes('c');
    var isBold=cls.includes('b');
    var isLarge=cls.includes('l');
    var isSmall=cls.includes('s')&&!cls.includes('s b')&&!cls.includes('c s');

    if(isCenter) bytes=bytes.concat(CMD.center); else bytes=bytes.concat(CMD.left);
    if(isLarge)  bytes=bytes.concat(CMD.dblWideOn,CMD.boldOn);
    else if(isBold) bytes=bytes.concat(CMD.boldOn);
    if(isSmall) bytes=bytes.concat(CMD.smallOn);

    if(cls.includes('row')){
      var spans=p.querySelectorAll('span');
      if(spans.length>=2){
        var l=(spans[0].innerText||spans[0].textContent||'').trim();
        var r=(spans[spans.length-1].innerText||spans[spans.length-1].textContent||'').trim();
        bytes=bytes.concat(CMD.left);
        if(isBold||isLarge) bytes=bytes.concat(CMD.boldOn);
        if(isLarge) bytes=bytes.concat(CMD.dblWideOn);
        bytes=bytes.concat(rline(l,r));
        bytes=bytes.concat(CMD.boldOff,CMD.dblWideOff,CMD.smallOff);
        return;
      }
    }
    if(cls.includes('it-det')||cls.includes('if-det')){
      var spans=p.querySelectorAll('span');
      if(spans.length>=2){
        bytes=bytes.concat(CMD.left,CMD.smallOn);
        var parts=Array.from(spans).map(function(s){return (s.innerText||s.textContent||'').trim();});
        if(parts.length===3){ bytes=bytes.concat(rline('  '+parts[0],parts[2])); }
        else { bytes=bytes.concat(line('  '+parts.join('  '))); }
        bytes=bytes.concat(CMD.smallOff);
        return;
      }
    }
    if(cls.includes('it-nom')||cls.includes('if-nom')){
      bytes=bytes.concat(CMD.left,CMD.boldOn,line(text),CMD.boldOff);
      return;
    }
    bytes=bytes.concat(line(text),CMD.boldOff,CMD.dblWideOff,CMD.smallOff);
  });
  bytes=bytes.concat(CMD.feed,CMD.cut);

  try {
    await port.open({ baudRate: 9600 });
    var writer=port.writable.getWriter();
    await writer.write(new Uint8Array(bytes));
    writer.releaseLock();
    await port.close();
    toast('\u2713 Impreso por USB');
  } catch(e) {
    // Puerto ya abierto — intentar directo
    try {
      var writer=port.writable.getWriter();
      await writer.write(new Uint8Array(bytes));
      writer.releaseLock();
      toast('\u2713 Impreso por USB');
    } catch(e2){
      toast('Error USB: '+e2.message);
    }
  }
}

async function imprimirBluetooth(device, htmlContent, size){
  const ESC=0x1B, GS=0x1D;
  // Comandos ESC/POS
  const CMD = {
    init:       [ESC,0x40],
    left:       [ESC,0x61,0x00],
    center:     [ESC,0x61,0x01],
    right:      [ESC,0x61,0x02],
    boldOn:     [ESC,0x45,0x01],
    boldOff:    [ESC,0x45,0x00],
    dblWideOn:  [ESC,0x21,0x20],  // doble ancho
    dblWideOff: [ESC,0x21,0x00],
    dblHOn:     [ESC,0x21,0x10],  // doble alto
    dblHOff:    [ESC,0x21,0x00],
    smallOn:    [ESC,0x21,0x01],  // fuente pequeña
    smallOff:   [ESC,0x21,0x00],
    cut:        [GS,0x56,0x41,0x10],
    feed:       [ESC,0x64,0x03],  // 3 líneas avance
    lf:         [0x0A],
  };

  const cols = size==='58' ? 32 : 42;

  function enc(str){
    // Codificación ISO-8859-1 para caracteres latinos
    const out=[];
    for(let i=0;i<str.length;i++){
      const c=str.charCodeAt(i);
      if(c<128) out.push(c);
      else if(c===0xC1||c===0xE1) out.push(0xC1);  // Á á
      else if(c===0xC9||c===0xE9) out.push(0xC9);  // É é
      else if(c===0xCD||c===0xED) out.push(0xCD);  // Í í
      else if(c===0xD3||c===0xF3) out.push(0xD3);  // Ó ó
      else if(c===0xDA||c===0xFA) out.push(0xDA);  // Ú ú
      else if(c===0xD1||c===0xF1) out.push(0xD1);  // Ñ ñ
      else out.push(0x3F);  // ?
    }
    return out;
  }

  function line(str){ return [...enc(str), 0x0A]; }
  function sep(){ return line('-'.repeat(cols)); }
  function cline(str){ // centrar
    const s=String(str); const p=Math.max(0,cols-s.length);
    return line(' '.repeat(Math.floor(p/2))+s);
  }
  function rline(l,r){ // izq + der alineados
    const ls=String(l), rs=String(r);
    const space=Math.max(1, cols-ls.length-rs.length);
    return line(ls+' '.repeat(space)+rs);
  }
  function pad2r(s,n){ s=String(s); return s.length>=n?s.substring(0,n):' '.repeat(n-s.length)+s; }
  function pad2l(s,n){ s=String(s); return s.length>=n?s.substring(0,n-1)+'…':s+' '.repeat(n-s.length); }

  // Parsear el HTML para extraer los datos del ticket
  // IMPORTANTE: extraer solo el <body> antes de asignar a innerHTML
  // Si se asigna un HTML completo a innerHTML de un div, el browser descarta los <p>
  // y solo imprime el encabezado (el problema de "solo sale la cabecera")
  const tmp = document.createElement('div');
  let htmlParaParsear = htmlContent;
  const bodyMatch = htmlContent.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  if(bodyMatch) htmlParaParsear = bodyMatch[1];
  tmp.innerHTML = htmlParaParsear;

  // Función para extraer texto de un selector
  function txt(sel){ const el=tmp.querySelector(sel); return el?(el.innerText||el.textContent||'').trim():''; }

  // Extraer párrafos en orden
  const parrafos = Array.from(tmp.querySelectorAll('p'));

  // Construir bytes ESC/POS parseando las clases del HTML
  let bytes=[...CMD.init, ESC,0x74,0x02]; // init + página latin-1

  parrafos.forEach(function(p){
    const cls=p.className||'';
    const text=(p.innerText||p.textContent||'').trim();
    if(!text && !cls.includes('hr')) return;

    if(cls.includes('hr')){
      bytes.push(...sep());
      return;
    }

    const isCenter=cls.includes('c');
    const isBold=cls.includes('b');
    const isLarge=cls.includes('l');
    const isSmall=cls.includes('s')&&!cls.includes('s b')&&!cls.includes('c s');

    if(isCenter) bytes.push(...CMD.center); else bytes.push(...CMD.left);
    if(isLarge)  bytes.push(...CMD.dblWideOn, ...CMD.boldOn);
    else if(isBold) bytes.push(...CMD.boldOn);
    if(isSmall)  bytes.push(...CMD.smallOn);

    // Fila con dos columnas (clase row)
    if(cls.includes('row')){
      const spans=p.querySelectorAll('span');
      if(spans.length>=2){
        const l=(spans[0].innerText||spans[0].textContent||'').trim();
        const r=(spans[spans.length-1].innerText||spans[spans.length-1].textContent||'').trim();
        bytes.push(...CMD.left);
        if(isBold||isLarge) bytes.push(...CMD.boldOn);
        if(isLarge) bytes.push(...CMD.dblWideOn);
        bytes.push(...rline(l,r));
        bytes.push(...CMD.boldOff,...CMD.dblWideOff,...CMD.smallOff);
        return;
      }
    }

    // Item detail (it-det / if-det)
    if(cls.includes('it-det')||cls.includes('if-det')){
      const spans=p.querySelectorAll('span');
      if(spans.length>=2){
        bytes.push(...CMD.left,...CMD.smallOn);
        const parts=Array.from(spans).map(s=>(s.innerText||s.textContent||'').trim());
        if(parts.length===3){
          // cant×pu  [espacio]  subtotal
          const l=parts[0], r=parts[2];
          bytes.push(...rline('  '+l, r));
        } else {
          bytes.push(...line('  '+parts.join('  ')));
        }
        bytes.push(...CMD.smallOff);
        return;
      }
    }

    // Nombre de item (it-nom / if-nom)
    if(cls.includes('it-nom')||cls.includes('if-nom')){
      bytes.push(...CMD.left,...CMD.boldOn);
      bytes.push(...line(text));
      bytes.push(...CMD.boldOff);
      return;
    }

    // Texto normal
    bytes.push(...line(text));
    bytes.push(...CMD.boldOff,...CMD.dblWideOff,...CMD.smallOff);
  });

  bytes.push(...CMD.feed,...CMD.cut);

  try{
    // Reconectar si se desconectó
    let server;
    if(device.gatt.connected){
      server=device.gatt;
    } else {
      server=await device.gatt.connect();
    }

    // Intentar servicios conocidos de impresoras BT
    let char=null;
    const SERVICES=[
      {svc:'000018f0-0000-1000-8000-00805f9b34fb', chr:'00002af1-0000-1000-8000-00805f9b34fb'},
      {svc:'e7810a71-73ae-499d-8c15-faa9aef0c3f2', chr:'bef8d6c9-9c21-4c9e-b632-bd58c1009f9f'},
      {svc:'49535343-fe7d-4ae5-8fa9-9fafd205e455', chr:'49535343-8841-43f4-a8d4-ecbe34729bb3'},
    ];
    let lastErr='';
    for(const s of SERVICES){
      try{
        const svc=await server.getPrimaryService(s.svc);
        char=await svc.getCharacteristic(s.chr);
        console.log('[BT] Servicio:', s.svc);
        break;
      }catch(e){ lastErr=e.message; }
    }

    // Fallback: escanear todos los servicios disponibles
    if(!char){
      try{
        const svcs=await server.getPrimaryServices();
        console.log('[BT] Servicios:', svcs.map(s=>s.uuid));
        for(const svc of svcs){
          const chars=await svc.getCharacteristics();
          for(const c of chars){
            if(c.properties.write||c.properties.writeWithoutResponse){
              char=c;
              console.log('[BT] Char:', c.uuid);
              break;
            }
          }
          if(char) break;
        }
      }catch(e2){ console.warn('[BT] Scan error:', e2.message); }
    }

    if(!char) throw new Error('Impresora no soportada. '+lastErr);

    const data = new Uint8Array(bytes);

    // Negociar MTU real del dispositivo (máximo transferible por paquete)
    // Las impresoras BT baratas suelen tener MTU de 20-100 bytes
    // Usamos chunks pequeños para máxima compatibilidad
    let chunkSize = 100; // conservador por defecto
    try {
      // Algunos dispositivos exponen su MTU vía el servidor GATT
      if(server.device && server.device.gatt) {
        // Intentar un chunk de prueba pequeño para detectar el límite
        chunkSize = 100;
      }
    } catch(e) { /* ignorar */ }

    // Enviar con delay adaptativo según tamaño total
    // Tickets largos necesitan más tiempo entre chunks
    const delayMs = data.length > 1000 ? 60 : 40;

    console.log(`[BT] Enviando ${data.length} bytes en chunks de ${chunkSize} con ${delayMs}ms delay`);

    for(let i = 0; i < data.length; i += chunkSize){
      const chunk = data.slice(i, i + chunkSize);
      let enviado = false;

      // Intentar writeWithoutResponse primero (más rápido y sin ACK overhead)
      if(char.properties.writeWithoutResponse){
        try{
          await char.writeValueWithoutResponse(chunk);
          enviado = true;
        }catch(e){ /* fallback a writeValue */ }
      }

      // Fallback a writeValue (con ACK — más lento pero más confiable)
      if(!enviado){
        try{
          await char.writeValue(chunk);
          enviado = true;
        }catch(e){
          throw new Error('Error enviando datos: '+e.message);
        }
      }

      // Delay entre chunks — crítico para que el buffer de la impresora no se llene
      await new Promise(r => setTimeout(r, delayMs));

      // Cada 10 chunks, pausa extra para que la impresora procese
      if(((i / chunkSize) + 1) % 10 === 0){
        await new Promise(r => setTimeout(r, 100));
      }
    }

    // Pausa final antes de confirmar — dar tiempo al último chunk
    await new Promise(r => setTimeout(r, 300));
    toast('✓ Impreso por Bluetooth');
  }catch(e){
    console.error('[BT]', e.message);
    toast('Error BT: '+e.message);
    imprimirTicketConf(htmlContent,'ticket');
  }
}

async function supaLoadProductos(){
  if(USAR_DEMO) return;
  const email = localStorage.getItem(SK.email);
  if(!email) return;
  try {
    const data = await supaGet('pos_productos',
      'licencia_email=eq.'+encodeURIComponent(email)+'&order=nombre.asc&select=*'
    );
    if(!data || !data.length) return;

    // Construir array temporal — NO tocar PRODS hasta tener todo listo
    const itemLibre = PRODS.find(p=>p.itemLibre);
    const newProds  = [];
    if(itemLibre) newProds.push(itemLibre);

    data.forEach(p => {
      newProds.push({
        id:             p.id,
        prodId:         p.id,
        name:           p.nombre,
        price:          p.precio || 0,
        precioVariable: p.precio_variable || false,
        costo:          p.costo || 0,
        codigo:         p.codigo || '',
        cat:            p.categoria || 'Sin categoría',
        iva:            p.iva || '10',
        color:          p.color || '#546e7a',
        colorPropio:    p.color_propio || false,
        mitad:          p.mitad || false,
        inventario:     p.inventario || false,
        comanda:        p.comanda || false,
        itemLibre:      false,
        activo:         p.activo !== false && p.activo !== 0,
        imagen:         p.imagen || null, // null/undefined/true = active
      });
    });

    // Solo reemplazar PRODS si todo salió bien
    PRODS.length = 0;
    newProds.forEach(p => PRODS.push(p));

    // Actualizar contadores
    const maxId = Math.max(...PRODS.filter(p=>!p.itemLibre).map(p=>p.id), 0);
    nextProdId  = maxId + 1;
    console.log('[Supabase] Productos cargados:', PRODS.length-1);
    // Reset category to Todos after load to avoid stale filter
    curCat = 'Todos los artículos';
    const catLblEl = document.getElementById('catLbl');
    if(catLblEl) catLblEl.textContent = 'Todos los artículos';
    renderCatPills();
    filterP();
    // Cargar descuentos en background
    try { await cargarDescuentosConfig(); } catch(ed){ console.warn('[Desc]', ed.message); }

    // Cachear imágenes en IndexedDB para uso offline
    if(db){
      const prodsConImg = newProds.filter(p => p.imagen && p.imagen.startsWith('http'));
      for(const p of prodsConImg){
        try {
          const cached = await db.config.get('img_cache_'+p.imagen);
          if(!cached){
            // Descargar y cachear como base64
            const r = await fetch(p.imagen);
            if(r.ok){
              const blob = await r.blob();
              const b64  = await new Promise(res => {
                const fr = new FileReader();
                fr.onload = () => res(fr.result);
                fr.readAsDataURL(blob);
              });
              await db.config.put({ clave:'img_cache_'+p.imagen, valor: b64 });
            }
          }
        } catch(ei){}
      }
      if(prodsConImg.length) console.log('[Imagen] Cache offline:', prodsConImg.length, 'imágenes');
    }

    // Persistir en IndexedDB para uso offline
    if(db){
      try {
        const rows = data.map(p => ({
          id:              p.id,
          nombre:          p.nombre,
          precio:          p.precio || 0,
          precio_variable: p.precio_variable || false,
          costo:           p.costo || 0,
          codigo:          p.codigo || '',
          categoria:       p.categoria || 'Sin categoría',
          iva:             p.iva || '10',
          color:           p.color || '#546e7a',
          color_propio:    p.color_propio || false,
          mitad:           p.mitad || false,
          inventario:      p.inventario || false,
          comanda:         p.comanda || false,
          item_libre:      false,
          activo:          p.activo !== false && p.activo !== 0,
          imagen:          p.imagen || null,
          updatedAt:       new Date().toISOString(),
        }));
        await db.productos.bulkPut(rows);
        console.log('[DB] Productos cacheados offline:', rows.length);
      } catch(ed){ console.warn('[DB] Cache productos:', ed.message); }
    }
  } catch(e){
    if(!(e.message && e.message.includes('Failed to fetch')))
      console.warn('[Supabase] Productos:', e.message);
    // PRODS queda intacto — no se limpió
  }
}

async function supaLoadCategorias(){
  if(USAR_DEMO) return;
  const email = localStorage.getItem(SK.email);
  if(!email) return;
  try {
    const data = await supaGet('pos_categorias',
      'licencia_email=eq.'+encodeURIComponent(email)+'&order=nombre.asc&select=*'
    );
    if(!data || !data.length) return;
    // Build temp array first — safe pattern
    const newCats = data.map(c => ({ id:c.id, nombre:c.nombre, color:c.color||'#546e7a' }));
    CATEGORIAS.length = 0;
    newCats.forEach(c => CATEGORIAS.push(c));
    const maxId = Math.max(...CATEGORIAS.map(c=>c.id), 0);
    nextCatId = maxId + 1;
    console.log('[Supabase] Categorías cargadas:', CATEGORIAS.length);

    // Persistir en IndexedDB para uso offline
    if(db){
      try {
        const rows = data.map(c => ({
          id:        c.id,
          nombre:    c.nombre,
          color:     c.color || '#546e7a',
          updatedAt: new Date().toISOString(),
        }));
        await db.categorias.bulkPut(rows);
        console.log('[DB] Categorías cacheadas offline:', rows.length);
      } catch(ed){ console.warn('[DB] Cache categorías:', ed.message); }
    }
  } catch(e){
    if(!e.message.includes('Failed to fetch'))
      console.warn('[Supabase] Categorías:', e.message);
  }
}

// supaGet viene de js/config.js

async function supaUpsertProducto(prod){
  if(USAR_DEMO) return;
  const email = localStorage.getItem(SK.email);
  if(!email || prod.itemLibre) return;
  try {
    const row = {
      id:              prod.id,
      nombre:          prod.name,
      precio:          prod.price || 0,
      precio_variable: prod.precioVariable || false,
      costo:           prod.costo || 0,
      codigo:          prod.codigo || '',
      categoria:       prod.cat || 'Sin categoría',
      iva:             prod.iva || '10',
      color:           prod.color || '#546e7a',
      color_propio:    prod.colorPropio || false,
      mitad:           prod.mitad || false,
      inventario:      prod.inventario || false,
      comanda:         prod.comanda || false,
      activo:          true,
      licencia_email:  email,
      terminal:        localStorage.getItem('pos_terminal') || 'Principal',
      updated_at:      new Date().toISOString(),
      imagen:          prod.imagen !== undefined ? (prod.imagen || null) : undefined,
    };
    // Limpiar undefined para no enviar campos no deseados
    if(row.imagen === undefined) delete row.imagen;
    await supaPost('pos_productos', row, 'id', true);
    console.log('[Supabase] Producto guardado:', prod.name);
  } catch(e){ console.warn('[Supabase] Error guardando producto:', e.message); }
}

async function supaDeleteProducto(id){
  if(USAR_DEMO) return;
  const email = localStorage.getItem(SK.email);
  if(!email) return;
  try {
    await supaPatch('pos_productos',
      'id=eq.'+id+'&licencia_email=eq.'+encodeURIComponent(email),
      { activo: false }, true);
    console.log('[Supabase] Producto desactivado ID:', id);
  } catch(e){ console.warn('[Supabase] Error:', e.message); }
}

async function supaUpsertCategoria(cat){
  if(USAR_DEMO) return;
  const email = localStorage.getItem(SK.email);
  if(!email) return;
  try {
    const row = {
      id:             cat.id,
      nombre:         cat.nombre,
      color:          cat.color,
      licencia_email: email,
      updated_at:     new Date().toISOString(),
    };
    await supaPost('pos_categorias', row, 'id', true);
    console.log('[Supabase] Categoría guardada:', cat.nombre);
  } catch(e){ console.warn('[Supabase] Error guardando categoría:', e.message); }
}

