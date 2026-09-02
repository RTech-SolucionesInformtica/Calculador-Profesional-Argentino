const TERMICAS_COMERCIALES = [10, 16, 20, 25, 32, 40, 50, 63];
let circuitos = [];

function cambiarApp(app) {
    const vistaCalc = document.getElementById('seccion-calculador');
    const vistaTest = document.getElementById('seccion-test');
    const btnCalc = document.getElementById('btn-calc');
    const btnTest = document.getElementById('btn-test');

    if (app === 'calculador') {
        if (vistaCalc) vistaCalc.classList.remove('d-none');
        if (vistaTest) vistaTest.classList.add('d-none');
        if (btnCalc) btnCalc.classList.add('active');
        if (btnTest) btnTest.classList.remove('active');
    } else {
        if (vistaCalc) vistaCalc.classList.add('d-none');
        if (vistaTest) vistaTest.classList.remove('d-none');
        if (btnCalc) btnCalc.remove('active');
        if (btnTest) btnTest.classList.add('active');
        reiniciarTest();
    }
}

function agregarCircuito() {
    const tipoSelect = document.getElementById('tipo-circuito');
    const ambienteInput = document.getElementById('ambiente');
    const potenciaInput = document.getElementById('potencia-circuito');
    const longitudInput = document.getElementById('longitud-circuito');
    const sistemaSelect = document.getElementById('tipo-sistema'); 
    const cosPhiInput = document.getElementById('cos-phi') || { value: '0.95' };
    const caidaSelect = document.getElementById('caida-max') || { value: '5' };

    const tipo = tipoSelect ? tipoSelect.value : "";
    const ambiente = ambienteInput ? ambienteInput.value.trim() : "";
    const potenciaKW = parseFloat(potenciaInput ? potenciaInput.value : 0);
    const longitud = parseFloat(longitudInput ? longitudInput.value : 0);
    const tipoSistema = sistemaSelect ? sistemaSelect.value : "monofasico";
    const cosPhi = parseFloat(cosPhiInput.value);
    const caidaMaxPermitida = parseFloat(caidaSelect.value);

    if (!tipo || tipo === "" || !ambiente || isNaN(potenciaKW) || potenciaKW <= 0 || isNaN(longitud) || longitud <= 0) {
        alert("❌ Por favor, seleccione un Tipo de Circuito e ingrese una Descripción, Potencia y Longitud válidas (mayores a 0).");
        return;
    }

    let ip = 0;
    let tensionBase = 220;
    let factorDistancia = 2; 
    let polosTermica = "2P"; 

    if (tipoSistema === "monofasico") {
        tensionBase = 220;
        factorDistancia = 2;
        polosTermica = "1P+N / 2P";
        ip = (potenciaKW * 1000) / (tensionBase * cosPhi);
        if (ip > 32) {
            alert("⚠️ Según AEA 771, las líneas monofásicas residenciales de uso general no deben superar los 32A. Se sugiere migrar a un suministro trifásico.");
        }
    } 
    else if (tipoSistema === "bifasico") {
        tensionBase = 380; 
        factorDistancia = 2; 
        polosTermica = "2P";
        ip = (potenciaKW * 1000) / (tensionBase * cosPhi);
    } 
    else if (tipoSistema === "trifasico") {
        tensionBase = 380; 
        factorDistancia = Math.sqrt(3); 
        polosTermica = "3P / 4P";
        ip = (potenciaKW * 1000) / (Math.sqrt(3) * tensionBase * cosPhi);
    }

    const datosCables = [
        { seccion: 1.5, r: 14.8,  iz: 15 },
        { seccion: 2.5, r: 8.91,  iz: 21 },
        { seccion: 4.0, r: 5.57,  iz: 28 },
        { seccion: 6.0, r: 3.71,  iz: 36 },
        { seccion: 10.0, r: 2.21, iz: 50 },
        { seccion: 16.0, r: 1.40, iz: 66 },
        { seccion: 25.0, r: 0.90, iz: 88 }
    ];

    let seccionInicial = (tipo === "IUG" || tipo === "IUE") ? 1.5 : 2.5;
    
    let cableSeleccionado = datosCables.find(c => c.seccion >= seccionInicial && c.iz >= ip);
    if (!cableSeleccionado) {
        cableSeleccionado = datosCables[datosCables.length - 1]; 
    }

    let termicaValida = TERMICAS_COMERCIALES.find(inNominal => inNominal >= ip && inNominal <= cableSeleccionado.iz);
    
    if (!termicaValida) {
        cableSeleccionado = datosCables.find(c => c.seccion >= cableSeleccionado.seccion && c.iz >= ip);
        termicaValida = TERMICAS_COMERCIALES.find(inNominal => inNominal >= ip && inNominal <= cableSeleccionado.iz) || 63;
    }

    let caidaPorcentaje = 100;
    let indiceCableActual = datosCables.findIndex(c => c.seccion === cableSeleccionado.seccion);

    while (indiceCableActual < datosCables.length) {
        let cActual = datosCables[indiceCableActual];
        let longitudKm = longitud / 1000;
        
        let caidaVolts = factorDistancia * longitudKm * ip * (cActual.r * cosPhi);
        caidaPorcentaje = (caidaVolts / tensionBase) * 100;

        if (caidaPorcentaje <= caidaMaxPermitida) {
            cableSeleccionado = cActual;
            break;
        }
        indiceCableActual++;
        if (indiceCableActual === datosCables.length) {
            cableSeleccionado = datosCables[datosCables.length - 1];
            break;
        }
    }

    termicaValida = TERMICAS_COMERCIALES.find(inNominal => inNominal >= ip && inNominal <= cableSeleccionado.iz) || termicaValida;

    circuitos.push({
        tipo, 
        ambiente, 
        potenciaKW,
        ip: ip.toFixed(2),
        seccion: cableSeleccionado.seccion + " mm²",
        termica: `${termicaValida} A (${polosTermica})`,
        caida: caidaPorcentaje.toFixed(2) + "%"
    });

    actualizarTabla();
    limpiarFormulario();
}

function actualizarTabla() {
    const tbody = document.getElementById('tabla-circuitos');
    const resumenBox = document.getElementById('resumenBox');
    if (!tbody) return;

    if (circuitos.length === 0) {
        tbody.innerHTML = `<tr id="emptyState"><td colspan="8" class="text-center text-secondary py-4">No hay circuitos agregados. Agrega circuitos para ver el resumen.</td></tr>`;
        if (resumenBox) resumenBox.innerHTML = "";
        return;
    }

    tbody.innerHTML = "";
    let totalPotencia = 0;
    let totalCorriente = 0;

    circuitos.forEach((c, index) => {
        totalPotencia += c.potenciaKW;
        totalCorriente += parseFloat(c.ip);
        tbody.innerHTML += `
            <tr>
                <td><span class="badge bg-warning text-dark">${c.tipo}</span></td>
                <td>${c.ambiente}</td>
                <td>${c.potenciaKW.toFixed(2)} kW</td>
                <td>${c.ip} A</td>
                <td><strong>${c.seccion}</strong></td>
                <td>${c.termica}</td>
                <td class="text-success">${c.caida}</td>
                <td class="no-export"><button class="btn btn-sm btn-outline-danger" onclick="eliminarCircuito(${index})"><i class="fa-solid fa-trash"></i></button></td>
            </tr>
        `;
    });

    if (resumenBox) {
        resumenBox.innerHTML = `
            <div class="row text-center g-2 mt-2">
                <div class="col-6"><div class="p-2" style="background:rgba(255,234,0,0.05); border:1px solid rgba(255,234,0,0.1); border-radius:8px;"><small class="text-secondary d-block">POTENCIA TOTAL</small><strong class="text-warning">${totalPotencia.toFixed(2)} kW</strong></div></div>
                <div class="col-6"><div class="p-2" style="background:rgba(255,234,0,0.05); border:1px solid rgba(255,234,0,0.1); border-radius:8px;"><small class="text-secondary d-block">CORRIENTE TOTAL ACUMULADA</small><strong class="text-warning">${totalCorriente.toFixed(2)} A</strong></div></div>
            </div>
        `;
    }
}

function eliminarCircuito(index) {
    circuitos.splice(index, 1);
    actualizarTabla();
}

function limpiarFormulario() {
    const tipo = document.getElementById('tipo-circuito');
    const ambiente = document.getElementById('ambiente');
    const potencia = document.getElementById('potencia-circuito');
    const longitud = document.getElementById('longitud-circuito');
    if (tipo) tipo.value = "";
    if (ambiente) ambiente.value = "";
    if (potencia) potencia.value = "0.00";
    if (longitud) longitud.value = "0";
}

function limpiarTodo() {
    if(confirm("¿Deseas vaciar por completo el tablero de circuitos cargados?")) {
        circuitos = [];
        actualizarTabla();
    }
}

function exportarPDF() {
    if (circuitos.length === 0) {
        alert("⚠️ No hay circuitos cargados para exportar.");
        return;
    }
    const elemento = document.getElementById('contenedor-pdf');
    elemento.classList.add('pdf-printing');
    const opciones = {
        margin:       10,
        filename:     'Tablero_Residencial_AEA.pdf',
        image:        { type: 'jpeg', quality: 0.98 },
        html2canvas:  { scale: 2, backgroundColor: '#0a0f1d' },
        jsPDF:        { unit: 'mm', format: 'a4', orientation: 'landscape' }
    };
    html2pdf().set(opciones).from(elemento).save().then(() => {
        elemento.classList.remove('pdf-printing');
    });
}

const preguntasTest = [
    { q: "¿Cuál es la sección mínima de conductor de cobre admitida por AEA para circuitos de Tomacorrientes de Uso General (TUG)?", a: ["1.5 mm²", "2.5 mm²", "4.0 mm²"], correcta: 1 },
    { q: "¿Cuál es la corriente asignada nominal máxima permitida para la protección térmica de un circuito de Iluminación de Uso General (IUG)?", a: ["10 A", "16 A", "20 A"], correcta: 1 },
    { q: "¿Cuál es el número máximo de bocas permitido por la AEA para un mismo circuito de uso general (IUG o TUG)?", a: ["12 bocas", "15 bocas", "20 bocas"], correcta: 1 },
    { q: "¿Qué porcentaje máximo de caída de tensión admite la AEA en circuitos de iluminación para viviendas desde el origen del suministro?", a: ["3%", "5%", "7%"], correcta: 0 },
    { q: "Según la AEA, ¿cuál es el grado de electrificación de una vivienda si su superficie total es de 80 m²?", a: ["Mínimo", "Medio", "Elevado"], correcta: 1 }
];

let preguntaActual = 0;
let puntaje = 0;

function cargarPregunta() {
    const contenedor = document.getElementById('contenedor-quiz');
    const resultado = document.getElementById('resultado-test');
    if (!contenedor || !resultado) return;

    if (preguntaActual < preguntasTest.length) {
        resultado.classList.add('d-none');
        let p = preguntasTest[preguntaActual];
        let opcionesHtml = p.a.map((opcion, index) => `<div class="opcion-test" onclick="evaluarRespuesta(${index})"><i class="fa-solid fa-angle-right text-warning me-2"></i> ${opcion}</div>`).join('');
        contenedor.innerHTML = `<p class="text-secondary small">Pregunta ${preguntaActual + 1} de ${preguntasTest.length}</p><h5 class="mb-4">${p.q}</h5><div class="d-flex flex-column">${opcionesHtml}</div>`;
    } else {
        contenedor.innerHTML = "";
        resultado.classList.remove('d-none');
        const scoreTexto = document.getElementById('score-texto');
        if (scoreTexto) scoreTexto.innerHTML = `Lograste responder correctamente <strong class="text-success">${puntaje}</strong> de <strong class="text-warning">${preguntasTest.length}</strong> preguntas bajo norma AEA 90364.`;
    }
}

function evaluarRespuesta(seleccionada) {
    if (seleccionada === preguntasTest[preguntaActual].correcta) {
        puntaje++;
        alert("¡Correcto! ⚡ Respuesta reglamentaria.");
    } else {
        alert(`Incorrecto ❌. Según reglamento AEA la respuesta correcta es: ${preguntasTest[preguntaActual].a[preguntasTest[preguntaActual].correcta]}`);
    }
    preguntaActual++;
    cargarPregunta();
}

function reiniciarTest() {
    preguntaActual = 0;
    puntaje = 0;
    const r = document.getElementById('resultado-test');
    if (r) r.classList.add('d-none');
    cargarPregunta();
}

document.addEventListener("DOMContentLoaded", () => {
    cargarPregunta();
});