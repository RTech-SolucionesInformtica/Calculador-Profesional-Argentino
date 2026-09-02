// Tablas y Constantes bajo Normativa Eléctrica AEA Argentina
const TERMICAS_COMERCIALES = [10, 16, 20, 25, 32, 40, 50, 63];
let circuitos = [];

// --- NAVEGACIÓN COMPLETA ENTRE PESTAÑAS (Arreglo de Botones de Test) ---
function cambiarApp(app) {
    const vistaCalc = document.getElementById('seccion-calculador');
    const vistaTest = document.getElementById('seccion-test');
    const btnCalc = document.getElementById('btn-calc');
    const btnTest = document.getElementById('btn-test');

    if (app === 'calculador') {
        vistaCalc.classList.remove('d-none');
        vistaTest.classList.add('d-none');
        btnCalc.classList.add('active');
        btnTest.classList.remove('active');
    } else {
        vistaCalc.classList.add('d-none');
        vistaTest.classList.remove('d-none');
        btnCalc.classList.remove('active');
        btnTest.classList.add('active');
        reiniciarTest();
    }
}

// --- CÁLCULO ELÉCTRICO REGLAMENTARIO AEA ---
function agregarCircuito() {
    const tipo = document.getElementById('tipo-circuito').value;
    const ambiente = document.getElementById('ambiente').value.trim();
    const potenciaKW = parseFloat(document.getElementById('potencia-circuito').value);
    const longitud = parseFloat(document.getElementById('longitud-circuito').value);
    const tipoSistema = document.getElementById('tipo-sistema').value;
    const cosPhi = parseFloat(document.getElementById('cos-phi').value);
    const caidaMaxPermitida = parseFloat(document.getElementById('caida-max').value);

    if (!tipo || !ambiente || isNaN(potenciaKW) || potenciaKW <= 0 || isNaN(longitud) || longitud <= 0) {
        alert("❌ Por favor, ingrese datos válidos en todos los campos (Potencia y Longitud deben ser mayores a 0).");
        return;
    }

    // 1. Corriente de Proyecto (Ip)
    let ip = 0;
    if (tipoSistema === "monofasico") {
        ip = (potenciaKW * 1000) / (220 * cosPhi);
        if (ip > 32) {
            alert("⚠️ Según la AEA, las líneas residenciales monofásicas de uso general no deben superar los 32A. Considere pasar el sistema a Trifásico.");
        }
    } else {
        ip = (potenciaKW * 1000) / (Math.sqrt(3) * 380 * cosPhi);
    }

    // 2. Sección del conductor por norma mínima
    let seccion = (tipo === "IUG" || tipo === "IUE") ? 1.5 : 2.5;

    // Ajuste por capacidad térmica del cable en cañería
    if (ip > 15 && ip <= 21) seccion = Math.max(seccion, 2.5);
    else if (ip > 21 && ip <= 28) seccion = Math.max(seccion, 4);
    else if (ip > 28 && ip <= 36) seccion = Math.max(seccion, 6);
    else if (ip > 36 && ip <= 50) seccion = Math.max(seccion, 10);
    else if (ip > 50) seccion = Math.max(seccion, 16);

    // 3. Elección de la llave térmica (In)
    let termicaValida = TERMICAS_COMERCIALES.find(inNominal => inNominal >= ip) || 10;

    // 4. Caída de tensión por tramos (ΔV)
    const conductividadCobre = 56;
    const tensionBase = (tipoSistema === "monofasico") ? 220 : 380;
    let factorDistancia = (tipoSistema === "monofasico") ? 2 : Math.sqrt(3);
    
    let caidaVolts = (factorDistancia * longitud * ip * cosPhi) / (conductividadCobre * seccion);
    let caidaPorcentaje = (caidaVolts / tensionBase) * 100;

    // Bucle dinámico
    const seccionesDisponibles = [1.5, 2.5, 4, 6, 10, 16, 25];
    let idxSeccion = seccionesDisponibles.indexOf(seccion);

    while (caidaPorcentaje > caidaMaxPermitida && idxSeccion < seccionesDisponibles.length - 1) {
        idxSeccion++;
        seccion = seccionesDisponibles[idxSeccion];
        caidaVolts = (factorDistancia * longitud * ip * cosPhi) / (conductividadCobre * seccion);
        caidaPorcentaje = (caidaVolts / tensionBase) * 100;
    }

    // Inserción en la lista
    circuitos.push({
        tipo, ambiente, potenciaKW,
        ip: ip.toFixed(2),
        seccion: seccion + " mm²",
        termica: termicaValida + " A",
        caida: caidaPorcentaje.toFixed(2) + "%"
    });

    actualizarTabla();
    limpiarFormulario();
}

function actualizarTabla() {
    const tbody = document.getElementById('tabla-circuitos');
    const resumenBox = document.getElementById('resumenBox');
    
    if (circuitos.length === 0) {
        tbody.innerHTML = `<tr id="emptyState"><td colspan="8" class="text-center text-secondary py-4">No hay circuitos agregados. Agrega circuitos para ver el resumen.</td></tr>`;
        resumenBox.innerHTML = "";
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
                <td>${c.potenciaKW} kW</td>
                <td>${c.ip} A</td>
                <td><strong>${c.seccion}</strong></td>
                <td>${c.termica}</td>
                <td class="text-success">${c.caida}</td>
                <td><button class="btn btn-sm btn-outline-danger" onclick="eliminarCircuito(${index})"><i class="fa-solid fa-trash"></i></button></td>
            </tr>
        `;
    });

    resumenBox.innerHTML = `
        <div class="row text-center g-2 mt-2">
            <div class="col-6"><div class="p-2" style="background:rgba(255,234,0,0.05); border:1px solid rgba(255,234,0,0.1); border-radius:8px;"><small class="text-secondary d-block">POTENCIA TOTAL</small><strong class="text-warning">${totalPotencia.toFixed(2)} kW</strong></div></div>
            <div class="col-6"><div class="p-2" style="background:rgba(255,234,0,0.05); border:1px solid rgba(255,234,0,0.1); border-radius:8px;"><small class="text-secondary d-block">CORRIENTE TOTAL</small><strong class="text-warning">${totalCorriente.toFixed(2)} A</strong></div></div>
        </div>
    `;
}

function eliminarCircuito(index) {
    circuitos.splice(index, 1);
    actualizarTabla();
}

function limpiarFormulario() {
    document.getElementById('tipo-circuito').value = "";
    document.getElementById('ambiente').value = "";
    document.getElementById('potencia-circuito').value = "0.00";
    document.getElementById('longitud-circuito').value = "0";
}

function limpiarTodo() {
    if(confirm("¿Deseas vaciar por completo el tablero de circuitos cargados?")) {
        circuitos = [];
        actualizarTabla();
    }
}

// --- APP 2: APLICATIVO DE CUESTIONARIO TEST ---
const preguntasTest = [
    {
        q: "¿Cuál es la sección mínima de conductor de cobre según AEA para circuitos de Tomacorrientes de Uso General (TUG)?",
        a: ["1.5 mm²", "2.5 mm²", "4.0 mm²"],
        correcta: 1
    },
    {
        q: "¿Cuál es el límite máximo de corriente asignada nominal de la protección para un circuito IUG residencial?",
        a: ["10 A", "16 A", "20 A"],
                correcta: 1
    },
    {
        q: "¿Qué porcentaje máximo de caída de tensión admite la AEA en circuitos de iluminación desde el origen hasta el extremo?",
        a: ["3%", "5%", "8%"],
        correcta: 0
    }
];

let preguntaActual = 0;
let puntaje = 0;

function cargarPregunta() {
    const contenedor = document.getElementById('contenedor-quiz');
    const resultado = document.getElementById('resultado-test');
    
    if (preguntaActual < preguntasTest.length) {
        resultado.classList.add('d-none');
        let p = preguntasTest[preguntaActual];
        let opcionesHtml = p.a.map((opcion, index) => 
            `<div class="opcion-test" onclick="evaluarRespuesta(${index})"><i class="fa-solid fa-angle-right text-warning me-2"></i> ${opcion}</div>`
        ).join('');

        contenedor.innerHTML = `
            <p class="text-secondary small">Pregunta ${preguntaActual + 1} de ${preguntasTest.length}</p>
            <h5 class="mb-4">${p.q}</h5>
            <div class="d-flex flex-column">${opcionesHtml}</div>
        `;
    } else {
        contenedor.innerHTML = "";
        resultado.classList.remove('d-none');
        document.getElementById('score-texto').innerHTML = `Lograste responder correctamente <strong class="text-success">${puntaje}</strong> de <strong class="text-warning">${preguntasTest.length}</strong> preguntas de la norma.`;
    }
}

function evaluarRespuesta(seleccionada) {
    if (seleccionada === preguntasTest[preguntaActual].correcta) {
        puntaje++;
        alert("¡Correcto! ⚡ Cumple los criterios reglamentarios.");
    } else {
        const rtaCorrecta = preguntasTest[preguntaActual].a[preguntasTest[preguntaActual].correcta];
        alert(`Incorrecto ❌. Según reglamento AEA la respuesta es: ${rtaCorrecta}`);
    }
    preguntaActual++;
    cargarPregunta();
}

function reiniciarTest() {
    preguntaActual = 0;
    puntaje = 0;
    document.getElementById('resultado-test').classList.add('d-none');
    cargarPregunta();
}
