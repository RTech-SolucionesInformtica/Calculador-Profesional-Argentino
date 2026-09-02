const STORAGE_KEY = 'aea_proyectos_v1';
const TENSIONES = { monofasico: 220, bifasico: 380, trifasico: 380 };

// Rangos calibrados bajo estricta normativa de seguridad AEA 771 (canalización empotrada)
// Máximo térmico admisible: 1.5mm² -> 10A / 2.5mm² -> 16A
const CONDUCTORES_AEA = [
  { amperios: 10, mm2: 1.5, disyuntor: 10 },
  { amperios: 16, mm2: 2.5, disyuntor: 16 },
  { amperios: 20, mm2: 4,   disyuntor: 20 },
  { amperios: 25, mm2: 6,   disyuntor: 25 },
  { amperios: 32, mm2: 10,  disyuntor: 32 },
  { amperios: 40, mm2: 16,  disyuntor: 40 },
  { amperios: 50, mm2: 25,  disyuntor: 50 },
  { amperios: 63, mm2: 35,  disyuntor: 63 },
  { amperios: 80, mm2: 50,  disyuntor: 80 },
  { amperios: 100, mm2: 70, disyuntor: 100 }
];
const RHO_COBRE = 0.0175;
let proyectoActual = { tipoSistema: '', potenciaTotal: 0, factorPotencia: 0.95, longitudPrincipal: 20, circuitos: [] };

function calcularCorriente(potenciaKW, sistema, factorPotencia = 0.95) {
  const P = potenciaKW * 1000; const U = TENSIONES[sistema]; const cosφ = factorPotencia;
  let I = (sistema === 'trifasico') ? P / (U * cosφ * Math.sqrt(3)) : P / (U * cosφ);
  return parseFloat(I.toFixed(2));
}

function encontrarConductor(corriente) {
  for (let i = 0; i < CONDUCTORES_AEA.length; i++) {
    if (corriente <= CONDUCTORES_AEA[i].amperios) return { mm2: CONDUCTORES_AEA[i].mm2, disyuntor: CONDUCTORES_AEA[i].disyuntor };
  }
  return { mm2: '>70', disyuntor: '>100' };
}

function calcularCaidaTension(corriente, longitud, mm2, sistema) {
  if (mm2 === '>70') return 0;
  let factor = (sistema === 'trifasico' || sistema === 'bifasico') ? Math.sqrt(3) : 2;
  let caida = (factor * RHO_COBRE * longitud * corriente) / mm2;
  return parseFloat(caida.toFixed(2));
}

function calcularPorcentajeCaida(caidaV, sistema) { return parseFloat(((caidaV / TENSIONES[sistema]) * 100).toFixed(2)); }
function guardarProyecto() { localStorage.setItem(STORAGE_KEY, JSON.stringify(proyectoActual)); }
function cargarProyecto() { const data = localStorage.getItem(STORAGE_KEY); if (data) { proyectoActual = JSON.parse(data); return true; } return false; }

function renderResumenTablero() {
  const panel = document.getElementById('panelTablero');
  const resumen = document.getElementById('resumenTablero');
  if (!panel || !resumen) return;
  if (!proyectoActual.tipoSistema) { panel.style.display = 'none'; return; }
  panel.style.display = 'block';
  const I = calcularCorriente(proyectoActual.potenciaTotal, proyectoActual.tipoSistema, proyectoActual.factorPotencia);
  const cond = encontrarConductor(I);
  const dV = calcularCaidaTension(I, proyectoActual.longitudPrincipal, cond.mm2, proyectoActual.tipoSistema);
  const pct = calcularPorcentajeCaida(dV, proyectoActual.tipoSistema);
  resumen.innerHTML = `
    <div class="stats-grid">
      <div class="stat"><span class="label">Sistema:</span><span class="value">${proyectoActual.tipoSistema.toUpperCase()}</span></div>
      <div class="stat"><span class="label">Potencia:</span><span class="value">${proyectoActual.potenciaTotal} kW</span></div>
      <div class="stat"><span class="label">Corriente I:</span><span class="value">${I} A</span></div>
      <div class="stat"><span class="label">Cable:</span><span class="value">${cond.mm2} mm²</span></div>
      <div class="stat"><span class="label">Térmica:</span><span class="value">${cond.disyuntor} A</span></div>
      <div class="stat"><span class="label">Caída:</span><span class="value">${dV}V (${pct}%)</span></div>
    </div>`;
}

function agregarCircuito(event) {
  if (!proyectoActual.tipoSistema) { alert('⚠️ Primero debe configurar el sistema'); return; }
  const tipoCircuito = document.getElementById('tipoCircuito').value;
  const ambiente = document.getElementById('ambiente').value.trim();
  const potenciaCircuito = Number(document.getElementById('potenciaCircuito').value);
  const longitud = Number(document.getElementById('longitud').value);
  const caidaMaxima = Number(document.getElementById('caida').value);
  if (!tipoCircuito || !ambiente || !potenciaCircuito || !longitud) { alert('⚠️ Completa todos los campos'); return; }
  const corriente = calcularCorriente(potenciaCircuito, proyectoActual.tipoSistema, 0.95);
  const cond = encontrarConductor(corriente);
  const caidaV = calcularCaidaTension(corriente, longitud, cond.mm2, proyectoActual.tipoSistema);
  const caidaPorcentaje = calcularPorcentajeCaida(caidaV, proyectoActual.tipoSistema);
  proyectoActual.circuitos.push({ id: Date.now(), tipoCircuito, ambiente, potenciaCircuito, longitud, caidaMaxima, corriente, conductor: cond.mm2, disyuntor: cond.disyuntor, caidaV, caidaPorcentaje, valido: caidaPorcentaje <= caidaMaxima });
  guardarProyecto(); renderTablaCircuitos();
  electricMouse.onMouseClick(event);
  const form = document.getElementById('circuitForm'); if (form) form.reset();
}

function eliminarCircuito(id) {
  if (confirm('¿Eliminar este circuito?')) { proyectoActual.circuitos = proyectoActual.circuitos.filter(c => c.id !== id); guardarProyecto(); renderTablaCircuitos(); }
}

function renderTablaCircuitos() {
  const tbody = document.querySelector('#circuitsTable tbody');
  const emptyState = document.getElementById('emptyState');
  const resumenBox = document.getElementById('resumenCircuitos');
  if (!tbody) return; tbody.innerHTML = '';
  if (proyectoActual.circuitos.length === 0) {
    if (emptyState) emptyState.style.display = 'block';
    if (resumenBox) resumenBox.innerHTML = '<p style="text-align:center;opacity:0.7">Agrega circuitos para ver el resumen</p>';
    return;
  }
  if (emptyState) emptyState.style.display = 'none';
  proyectoActual.circuitos.forEach(c => {
    const tr = document.createElement('tr');
    tr.innerHTML = `<td>${c.tipoCircuito}</td><td>${c.ambiente}</td><td>${c.potenciaCircuito} kW</td><td>${c.corriente} A</td><td><strong>${c.conductor} mm²</strong></td><td>${c.disyuntor} A</td><td class="${c.valido?'valido':'invalido'}">${c.caidaV}V (${c.caidaPorcentaje}%)</td><td><button data-id="${c.id}" class="btn-delete" style="padding:2px 6px; cursor:pointer;">🗑</button></td>`;
    tbody.appendChild(tr);
  });
  renderResumenTotal();
}

function renderResumenTotal() {
  const resumenBox = document.getElementById('resumenCircuitos'); if (!resumenBox) return;
  const totalP = proyectoActual.circuitos.reduce((sum, c) => sum + c.potenciaCircuito, 0);
  const totalI = proyectoActual.circuitos.reduce((sum, c) => sum + c.corriente, 0);
  const ok = proyectoActual.circuitos.filter(c => c.valido).length; const totalC = proyectoActual.circuitos.length;
  const adv = ok < totalC ? `⚠️ ${totalC - ok} circuito(s) con caída excesiva` : '✓ Todos los circuitos cumplen normativa AEA';
  resumenBox.innerHTML = `
    <div class="stats-grid">
      <div class="stat"><span class="label">Total Circuitos:</span><span class="value">${totalC}</span></div>
      <div class="stat"><span class="label">Potencia total:</span><span class="value">${totalP.toFixed(2)} kW</span></div>
      <div class="stat"><span class="label">Corriente Total:</span><span class="value">${totalI.toFixed(2)} A</span></div>
      <div class="stat" style="grid-column: 1/-1;"><span class="label">${adv}</span></div>
    </div>`;
}

function configurarSistema() {
  const tipo = document.getElementById('tipoSistema').value; const pot = Number(document.getElementById('potenciaTotal').value);
  if (!tipo || !pot) { alert('⚠️ Completa los datos obligatorios'); return; }
  proyectoActual.tipoSistema = tipo; proyectoActual.potenciaTotal = pot;
  proyectoActual.factorPotencia = Number(document.getElementById('factorPotencia').value) || 0.95;
  proyectoActual.longitudPrincipal = Number(document.getElementById('longitudPrincipal').value) || 20;
  guardarProyecto(); renderResumenTablero(); alert('✓ Sistema configurado correctamente');
}

function initApp() {
  cargarProyecto();
  if (proyectoActual.tipoSistema) {
    if (document.getElementById('tipoSistema')) document.getElementById('tipoSistema').value = proyectoActual.tipoSistema;
    if (document.getElementById('potenciaTotal')) document.getElementById('potenciaTotal').value = proyectoActual.potenciaTotal;
    if (document.getElementById('factorPotencia')) document.getElementById('factorPotencia').value = proyectoActual.factorPotencia;
    if (document.getElementById('longitudPrincipal')) document.getElementById('longitudPrincipal').value = proyectoActual.longitudPrincipal;
    renderResumenTablero(); renderTablaCircuitos();
  }
  const btnConfigurar = document.getElementById('btnConfigurar'); if (btnConfigurar) btnConfigurar.addEventListener('click', configurarSistema);
  const circuitForm = document.getElementById('circuitForm'); if (circuitForm) circuitForm.addEventListener('submit', agregarCircuito);
  const btnLimpiarForm = document.getElementById('btnLimpiarForm'); if (btnLimpiarForm) btnLimpiarForm.addEventListener('click', () => { if (circuitForm) circuitForm.reset(); });
  const btnExport = document.getElementById('btnExport'); if (btnExport) btnExport.addEventListener('click', () => window.print());
  const btnLimpiarTodo = document.getElementById('btnLimpiarTodo'); if (btnLimpiarTodo) { btnLimpiarTodo.addEventListener('click', () => { if (confirm('¿Eliminar todo?')) { proyectoActual = { tipoSistema: '', potenciaTotal: 0, factorPotencia: 0.95, longitudPrincipal: 20, circuitos: [] }; localStorage.removeItem(STORAGE_KEY); location.reload(); } }); }
  document.addEventListener('click', (e) => { const b = e.target.closest('.btn-delete'); if (b) eliminarCircuito(Number(b.dataset.id)); });
}

class ElectricMouse {
  constructor() { this.lastTime = 0; this.init(); }
  init() {
    document.addEventListener('mousemove', (e) => { const now = Date.now(); if (now - this.lastTime > 60 && Math.random() > 0.5) { this.crearChispa(e.clientX, e.clientY); this.lastTime = now; } });
    document.addEventListener('click', (e) => this.onMouseClick(e));
  }

  }
}
const electricMouse = new ElectricMouse();

