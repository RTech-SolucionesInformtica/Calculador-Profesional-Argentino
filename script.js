const STORAGE_KEY = 'aea_proyectos_v1';
const TENSIONES = { monofasico: 220, bifasico: 220, trifasico: 380 };
const CONDUCTORES_AEA = [
  { amperios: 10, mm2: 1.5, disyuntor: 10 }, { amperios: 15, mm2: 2.5, disyuntor: 15 },
  { amperios: 20, mm2: 2.5, disyuntor: 20 }, { amperios: 30, mm2: 4, disyuntor: 30 },
  { amperios: 40, mm2: 6, disyuntor: 40 }, { amperios: 50, mm2: 10, disyuntor: 50 },
  { amperios: 63, mm2: 10, disyuntor: 63 }, { amperios: 80, mm2: 16, disyuntor: 80 },
  { amperios: 100, mm2: 25, disyuntor: 100 }, { amperios: 125, mm2: 35, disyuntor: 125 },
  { amperios: 160, mm2: 50, disyuntor: 160 }, { amperios: 200, mm2: 70, disyuntor: 200 }
];
const RHO_COBRE = 0.0175;
let proyectoActual = { tipoSistema: '', potenciaTotal: 0, factorPotencia: 0.95, longitudPrincipal: 20, circuitos: [] };

function calcularCorriente(potenciaKW, sistema, factorPotencia = 0.95) {
  const P = potenciaKW * 1000; const U = TENSIONES[sistema]; const cosφ = factorPotencia;
  let I = sistema === 'trifasico' ? P / (U * cosφ * Math.sqrt(3)) : P / (U * cosφ);
  return parseFloat(I.toFixed(2));
}
function encontrarConductor(corriente) {
  for (let i = 0; i < CONDUCTORES_AEA.length; i++) {
    if (corriente <= CONDUCTORES_AEA[i].amperios) return { mm2: CONDUCTORES_AEA[i].mm2, disyuntor: CONDUCTORES_AEA[i].disyuntor };
  }
  return { mm2: '>70', disyuntor: '>200' };
}
function calcularCaidaTension(corriente, longitud, mm2, sistema) {
  if (mm2 === '>70') return 0;
  let caida = sistema === 'trifasico' ? (Math.sqrt(3) * RHO_COBRE * longitud * corriente) / mm2 : (2 * RHO_COBRE * longitud * corriente) / mm2;
  return parseFloat(caida.toFixed(2));
}
function calcularPorcentajeCaida(caidaV, sistema) { return parseFloat(((caidaV / TENSIONES[sistema]) * 100).toFixed(2)); }
function guardarProyecto() { localStorage.setItem(STORAGE_KEY, JSON.stringify(proyectoActual)); }
function cargarProyecto() { const data = localStorage.getItem(STORAGE_KEY); if (data) { proyectoActual = JSON.parse(data); return true; } return false; }

function renderResumenTablero() {
  const panel = document.getElementById('panelTablero');
  const resumen = document.getElementById('resumenTablero');
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
  document.getElementById('circuitForm').reset();
}

function eliminarCircuito(id) {
  if (confirm('¿Eliminar este circuito?')) { proyectoActual.circuitos = proyectoActual.circuitos.filter(c => c.id !== id); guardarProyecto(); renderTablaCircuitos(); }
}

function renderTablaCircuitos() {
  const tbody = document.querySelector('#circuitsTable tbody');
  const emptyState = document.getElementById('emptyState');
  const resumenBox = document.getElementById('resumenCircuitos');
  tbody.innerHTML = '';
  if (proyectoActual.circuitos.length === 0) { emptyState.style.display = 'block'; resumenBox.innerHTML = '<p style="text-align:center;opacity:0.7">Agrega circuitos para ver el resumen</p>'; return; }
  emptyState.style.display = 'none';
  proyectoActual.circuitos.forEach(c => {
    const tr = document.createElement('tr');
    tr.innerHTML = `<td>${c.tipoCircuito}</td><td>${c.ambiente}</td><td>${c.potenciaCircuito}</td><td>${c.corriente}</td><td><strong>${c.conductor} mm²</strong></td><td>${c.disyuntor} A</td><td class="${c.valido?'valido':'invalido'}">${c.caidaV}V (${c.caidaPorcentaje}%)</td><td><button data-id="${c.id}" class="btn-delete" style="padding:2px 6px; cursor:pointer;">🗑</button></td>`;
    tbody.appendChild(tr);
  });
  renderResumenTotal();
}

function renderResumenTotal() {
  const resumenBox = document.getElementById('resumenCircuitos');
  const totalP = proyectoActual.circuitos.reduce((sum, c) => sum + c.potenciaCircuito, 0);
  const totalI = proyectoActual.circuitos.reduce((sum, c) => sum + c.corriente, 0);
  const ok = proyectoActual.circuitos.filter(c => c.valido).length;
  const totalC = proyectoActual.circuitos.length;
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
  const tipo = document.getElementById('tipoSistema').value;
  const pot = Number(document.getElementById('potenciaTotal').value);
  if (!tipo || !pot) { alert('⚠️ Completa los datos obligatorios'); return; }
  proyectoActual.tipoSistema = tipo; proyectoActual.potenciaTotal = pot;
  proyectoActual.factorPotencia = Number(document.getElementById('factorPotencia').value);
  proyectoActual.longitudPrincipal = Number(document.getElementById('longitudPrincipal').value) || 20;
  guardarProyecto(); renderResumenTablero(); alert('✓ Sistema configurado correctamente');
}

function initApp() {
  cargarProyecto();
  if (proyectoActual.tipoSistema) {
    document.getElementById('tipoSistema').value = proyectoActual.tipoSistema;
    document.getElementById('potenciaTotal').value = proyectoActual.potenciaTotal;
    document.getElementById('factorPotencia').value = proyectoActual.factorPotencia;
    document.getElementById('longitudPrincipal').value = proyectoActual.longitudPrincipal;
    renderResumenTablero(); renderTablaCircuitos();
  }
  document.getElementById('btnConfigurar').addEventListener('click', configurarSistema);
  document.getElementById('circuitForm').addEventListener('submit', agregarCircuito);
  document.getElementById('btnLimpiarForm').addEventListener('click', () => document.getElementById('circuitForm').reset());
  document.getElementById('btnExport').addEventListener('click', () => window.print());
  document.getElementById('btnLimpiarTodo').addEventListener('click', () => { if(confirm('¿Eliminar todo?')){ proyectoActual={tipoSistema:'',potenciaTotal:0,factorPotencia:0.95,longitudPrincipal:20,circuitos:[]}; localStorage.removeItem(STORAGE_KEY); location.reload(); } });
  document.addEventListener('click', (e) => { const b = e.target.closest('.btn-delete'); if(b) eliminarCircuito(Number(b.dataset.id)); });
}

class ElectricMouse {
  constructor() { this.lastTime = 0; this.init(); }
  init() { document.addEventListener('mousemove', (e) => { const now = Date.now(); if(now - this.lastTime > 40 && Math.random() > 0.4) { this.crearChispa(e.clientX, e.clientY); this.lastTime = now; } }); document.addEventListener('click', (e) => this.onMouseClick(e)); }
  onMouseClick(e) { for(let i=0; i<10; i++) this.crearChispa(e.clientX, e.clientY); }
  crearChispa(x, y) {
    const s = document.createElement('div'); s.className = 'spark'; s.style.width = (Math.random()*16+6)+'px'; s.style.height = (Math.random()*2+1)+'px'; s.style.left = x+'px'; s.style.top = y+'px';
    const a = Math.random()*Math.PI*2; const d = Math.random()*90+40; const deg = (a*180)/Math.PI;
    s.style.setProperty('--tx', (Math.cos(a)*d)+'px'); s.style.setProperty('--ty', (Math.sin(a)*d)+'px'); s.style.setProperty('--rot', deg+'deg'); s.style.transform = `rotate(${deg}deg)`;
    document.body.appendChild(s); setTimeout(() => s.remove(), 400);
  }
}
const electricMouse = new ElectricMouse();

