const { text } = require('express');
const database = require('../db');
const paymentService = require('../payment-service');
const pdfParse = require('pdf-parse')
const Tesseract = require('tesseract.js')
const jsQR = require('jsqr');
const JimpModule = require('jimp');
const Jimp = JimpModule.Jimp || JimpModule.default || JimpModule;
const scoringService = require('../../scoring/scoringService');
const { WebpayPlus } = require('transbank-sdk');
const { Environment } = require('transbank-sdk').Options;
//const axios = require('axios');
//const cheerio = require('cheerio');

// Helper para errores internos
const sendServerError = (res, err) => {
  console.error(err);
  res.status(500).json({ error: 'internal_error' });
};


// =====================================
// Loan Applications
// =====================================

// GET /loan_applications?user_id=...&id=...&status=...&simulation_id=...
const getLoanApplications = (req, res) => {
  const { user_id, id, status, simulation_id } = req.query;
  let sql = 'SELECT * FROM loan_applications';
  const params = [];
  const conditions = [];

  if (id) {
    conditions.push('id = ?');
    params.push(id);
  }

  if (user_id) {
    conditions.push('user_id = ?');
    params.push(user_id);
  }

  if (status) {
    const statusArray = Array.isArray(status) ? status : status.split(',');
    if (statusArray.length > 1) {
      conditions.push('status IN (?)');
      params.push(statusArray); 
    } else {
      conditions.push('status = ?');
      params.push(statusArray[0]);
    }
  }

  if (simulation_id) {
    conditions.push('simulation_id = ?');
    params.push(simulation_id);
  }

  if (conditions.length > 0) {
    sql += ' WHERE ' + conditions.join(' AND ');
  }

  sql += ' ORDER BY created_at DESC';

  database.query(sql, params, (err, results) => {
    if (err) return sendServerError(res, err);
    
    // Si se busca por ID específico, devolver el objeto único o 404
    if (id) {
      if (!results || results.length === 0) {
        return res.status(404).json({ error: 'not_found', message: 'No se encontró la aplicación con ese ID' });
      }
      return res.json(results[0]);
    }
    
    res.json(results);
  });
};

// POST /loan_applications
const createLoanApplication = (req, res) => {
  if (!req.body || Object.keys(req.body).length === 0) {
    return res.status(400).json({ error: 'invalid_json', message: 'Se esperaba un JSON con los datos de la aplicación' });
  }

  const { user_id, amount, months, monthly_payment } = req.body;

  if (!user_id || amount === undefined || months === undefined || monthly_payment === undefined) {
    return res.status(422).json({ 
      error: 'missing_fields', 
      message: 'Se requieren los campos: user_id, amount, months, monthly_payment' 
    });
  }

  // Nota: el `status` que envíe el cliente se ignora; lo decide el backend
  // (filtros duros + modelo de scoring) más abajo.
  const { simulation_id, employment_status, monthly_income, notes } = req.body;

  // Datos extra para el scoring (el frontend los manda desde el OCR / formulario).
  // deuda_relativa y num_creditos hoy no se capturan -> llegan null -> el
  // scoringService los imputa con la mediana del entrenamiento.
  const { deuda_cmf, edad, deuda_relativa, num_creditos } = req.body;

  // Cascada de decisión: filtros duros -> modelo logístico -> decisión final.
  const { status: finalStatus, score, scoring_decision } = scoringService.decide({
    monthly_income, monthly_payment, edad, deuda_cmf, deuda_relativa, num_creditos,
  });

  const sql = `INSERT INTO loan_applications
    (user_id, simulation_id, amount, months, monthly_payment, status, employment_status, monthly_income, notes, score, scoring_decision)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;

  database.query(
    sql,
    [user_id, simulation_id || null, amount, months, monthly_payment, finalStatus, employment_status || null, monthly_income || null, notes || null, score, scoring_decision],
    (err, result) => {
      if (err) return sendServerError(res, err);
      res.status(201).json({
        message: "Solicitud de Prestamo creada correctamente",
        status: finalStatus,
        score,
        scoring_decision,
      });
    }
  );
};

// PUT /loan_applications/:id
const updateLoanApplication = (req, res) => {
  const { id } = req.params;
  if (!req.body || Object.keys(req.body).length === 0) {
    return res.status(400).json({ error: 'invalid_json', message: 'Se esperaba un JSON con los campos a actualizar' });
  }

  const fields = [];
  const values = [];
  Object.entries(req.body).forEach(([key, value]) => {
    fields.push(`${key} = ?`);
    values.push(value);
  });

  if (fields.length === 0) return res.status(400).json({ error: 'missing_fields', message: 'No se enviaron campos a actualizar' });

  values.push(id);
  const sql = `UPDATE loan_applications SET ${fields.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`;

  database.query(sql, values, (err, result) => {
    if (err) return sendServerError(res, err);
    if (result.affectedRows === 0) return res.status(404).json({ error: 'not_found', message: 'No se encontró la aplicación con ese ID' });
    res.json({ message: "Solicitud de Prestamo actualizada correctamente" });
  });
};

// DELETE /loan_applications/:id
const deleteLoanApplication = (req, res) => {
  const { id } = req.params;
  const sql = 'DELETE FROM loan_applications WHERE id = ?';
  database.query(sql, [id], (err, result) => {
    if (err) return sendServerError(res, err);
    if (result.affectedRows === 0) return res.status(404).json({ error: 'not_found', message: 'No se encontró la aplicación con ese ID' });
    res.json({ message: "Solicitud de Prestamo eliminada correctamente" });
  });
};

// =====================================
// Scoring crediticio (modelo logístico)
// =====================================

// POST /score — endpoint stateless: recibe los datos del solicitante y devuelve
// la probabilidad de default + la decisión, sin tocar la base de datos.
const scoreApplicant = (req, res) => {
  const body = req.body || {};

  if (body.monthly_income === undefined || body.monthly_income === null || body.monthly_income === '') {
    return res.status(422).json({ error: 'missing_fields', message: 'monthly_income es obligatorio' });
  }

  try {
    const r = scoringService.predict(body);
    return res.json({
      score: Number(r.probability.toFixed(4)),
      decision: r.decision,
      threshold: r.threshold,
      adapter: r.adapter,
    });
  } catch (err) {
    console.error('scoring_error', err);
    // Fail-safe: ante un fallo del modelo no se aprueba automáticamente.
    return res.status(503).json({
      error: 'scoring_unavailable',
      message: 'El modelo de scoring no está disponible',
      decision: 'manual_review',
    });
  }
};

// =====================================
// Loan Simulations
// =====================================

// GET /loan_simulations?user_id=...&id=...
const getLoanSimulations = (req, res) => {
  const { user_id, id } = req.query;
  let sql = 'SELECT * FROM loan_simulations';
  const params = [];
  const conditions = [];

  if (id) {
    conditions.push('id = ?');
    params.push(id);
  }

  if (user_id) {
    conditions.push('user_id = ?');
    params.push(user_id);
  }

  if (conditions.length > 0) {
    sql += ' WHERE ' + conditions.join(' AND ');
  }

  sql += ' ORDER BY created_at DESC';

  database.query(sql, params, (err, results) => {
    if (err) return sendServerError(res, err);
    
    // Si se busca por ID específico, devolver el objeto único o 404
    if (id) {
      if (!results || results.length === 0) {
        return res.status(404).json({ error: 'not_found', message: 'No se encontró la simulación con ese ID' });
      }
      return res.json(results[0]);
    }
    
    res.json(results);
  });
};

// POST /loan_simulations
const createLoanSimulation = (req, res) => {
  if (!req.body || Object.keys(req.body).length === 0) {
    return res.status(400).json({ error: 'invalid_json', message: 'Se esperaba un JSON con los datos de la simulación' });
  }

  const { user_id, amount, months, interest_rate, monthly_payment, total_payment, total_interest } = req.body;

  if (!user_id || amount === undefined || months === undefined || interest_rate === undefined || monthly_payment === undefined || total_payment === undefined || total_interest === undefined) {
    return res.status(422).json({ 
      error: 'missing_fields', 
      message: 'Se requieren los campos: user_id, amount, months, interest_rate, monthly_payment, total_payment, total_interest' 
    });
  }

  const sql = `INSERT INTO loan_simulations
    (user_id, amount, months, interest_rate, monthly_payment, total_payment, total_interest)
    VALUES (?, ?, ?, ?, ?, ?, ?)`;

  database.query(sql, [user_id, amount, months, interest_rate, monthly_payment, total_payment, total_interest], (err, result) => {
    if (err) return sendServerError(res, err);
    res.status(201).json({ message: "Simulacion creada correctamente"});
  });
};

// PUT /loan_simulations/:id
const updateLoanSimulation = (req, res) => {
  const { id } = req.params;
  if (!req.body || Object.keys(req.body).length === 0) {
    return res.status(400).json({ error: 'invalid_json', message: 'Se esperaba un JSON con los campos a actualizar' });
  }

  const fields = [];
  const values = [];
  Object.entries(req.body).forEach(([key, value]) => {
    fields.push(`${key} = ?`);
    values.push(value);
  });

  if (fields.length === 0) return res.status(400).json({ error: 'missing_fields', message: 'No se enviaron campos a actualizar' });

  values.push(id);
  const sql = `UPDATE loan_simulations SET ${fields.join(', ')}, created_at = CURRENT_TIMESTAMP WHERE id = ?`;

  database.query(sql, values, (err, result) => {
    if (err) return sendServerError(res, err);
    if (result.affectedRows === 0) return res.status(404).json({ error: 'not_found', message: 'No se encontró la simulación con ese ID' });
    res.json({ message: "Simulacion actualizada correctamente" });
  });
};

// DELETE /loan_simulations/:id
const deleteLoanSimulation = (req, res) => {
  const { id } = req.params;
  const sql = 'DELETE FROM loan_simulations WHERE id = ?';
  database.query(sql, [id], (err, result) => {
    if (err) return sendServerError(res, err);
    if (result.affectedRows === 0) return res.status(404).json({ error: 'not_found', message: 'No se encontró la simulación con ese ID' });
    res.json({ message: "Simulacion eliminada correctamente" });
  });
};


// =====================================
// EXTRACCIÓN DE DOCUMENTOS (OCR/PDF)
// =====================================

// =====================================
// EXTRACCIÓN DE DOCUMENTOS (OCR/PDF)
// =====================================

// Auxiliar 1: extrae texto crudo según tipo MIME
const extraerTextoBruto = async (mimeType, fileBuffer) => {
  if (mimeType.includes('pdf')) {
    let funcionExtraerPDF;
    if (typeof pdfParse === 'function') funcionExtraerPDF = pdfParse;
    else if (pdfParse && typeof pdfParse.default === 'function') funcionExtraerPDF = pdfParse.default;
    else if (pdfParse && typeof pdfParse.pdf === 'function') funcionExtraerPDF = pdfParse.pdf;
    else throw new Error('Librería pdf-parse no exportó función válida.');
    const pdfData = await funcionExtraerPDF(fileBuffer);
    return String(pdfData.text || '');
  }
  if (mimeType.includes('image') || mimeType.includes('jpeg') || mimeType.includes('png')) {
    const { data } = await Tesseract.recognize(fileBuffer, 'spa');
    return String(data.text || '');
  }
  return null; // tipo no soportado
};

// Auxiliar 2: detecta el tipo de documento a partir del texto
const detectarTipoDocumento = (textoUpper, textoBruto) => {
  if (textoUpper.includes('CÉDULA') || textoUpper.includes('CEDULA') ||
      (textoUpper.includes('REPUBLICA DE CHILE') && textoBruto.match(/\b\d{1,2}(?:\.\d{3}){2}-[\dKk]\b/))) {
    return 'Cedula';
  }
  if (textoUpper.includes('LIQUIDACIÓN') || textoUpper.includes('LIQUIDACION') || textoUpper.includes('REMUNERACIONES')) {
    return 'Liquidacion';
  }
  if (textoUpper.includes('BOLETA') || textoUpper.includes('FACTURA') ||
      textoUpper.includes('ENEL') || textoUpper.includes('AGUAS') || textoUpper.includes('VTR')) {
    return 'ComprobanteDomicilio';
  }
  if (textoUpper.includes('ACTIVOS Y PASIVOS')) {
    return 'DeclaracionActivosPasivos';
  }
  if (textoUpper.includes('HONORARIOS') || textoUpper.includes('RENTA') || textoUpper.includes('SII')) {
    return 'DocumentoTributario';
  }
  return 'Desconocido';
};

// Auxiliar 3: extrae datos específicos de cédula (edad, nombre, nacionalidad)
const extraerDatosCedula = (textoBruto, textoUpper) => {
  let edadCalculada = null;
  const dateRegex = /(\d{1,2})[\s\-.,]*([A-Z]{3,4})[\s\-.,]*(\d{4})/ig;
  const fechasEncontradas = [...textoBruto.matchAll(dateRegex)];
  if (fechasEncontradas.length > 0) {
    const anioNacimiento = Number.parseInt(fechasEncontradas[0][3], 10);
    edadCalculada = new Date().getFullYear() - anioNacimiento;
  }

  const palabrasProhibidas = new Set ([
    'REPUBLICA', 'REPÚBLICA', 'CHILE', 'CEDULA', 'IDENTIDAD', 'IDENTIFICACIÓN',
    'APELLIDOS', 'NOMBRES', 'NACIONALIDAD', 'SEXO', 'SERVICIO', 'REGISTRO', 'CIVIL',
    'ESPECIMEN', 'HOSEN', 'RUN', 'DOCUMENTO', 'EMISION', 'VENCIMIENTO', 'TITULAR',
    'FIRMA', 'NACIMIENTO', 'NUMERO', 'EXTRANJERO', 'CHILENA', 'CHILENO', 'MASCULINO',
    'FEMENINO', 'ENE', 'FEB', 'MAR', 'ABR', 'MAY', 'MAYO', 'JUN', 'JUL', 'AGO',
    'SEP', 'OCT', 'NOV', 'DIC'
  ]);
  const palabras = textoBruto.match(/[A-ZÁÉÍÓÚÑ]{3,}/ig) || [];
  const nombresValidos = palabras.filter(p => !palabrasProhibidas.includes(p.toUpperCase()));
  const nombreFinal = nombresValidos.length >= 2 ? nombresValidos.slice(0, 4).join(' ') : null;

  const nacionalidadFinal =
    (textoUpper.includes('EXTRANJER') || textoUpper.includes('HAITI') || textoUpper.includes('VENEZ'))
      ? 'EXTRANJERA'
      : 'CHILENA';

  return { edadCalculada, nombreFinal, nacionalidadFinal };
};

// Auxiliar 4: extrae datos financieros, domicilio y antigüedad laboral
const extraerDatosFinancieros = (textoBruto) => {
  const limpiarMonto = (str) => {
    if (!str) return null;
    const limpio = Number.parseInt(str.replaceAll('.', '').replaceAll(',', ''), 10);
    return Number.isNaN(limpio) ? null : limpio;
  };

  const sueldoMatch = textoBruto.match(/(?:Alcance l[íi]quido a pagar|L[íi]quido a Pagar):\s*(?:\$\s*)?([\d.,]+)/i);
  const honorariosMatch = textoBruto.match(/Total Honorarios\s*(?:[$=]+\s*)?([\d.,]+)/i);
  const direccionMatch = textoBruto.match(/(?:Direcci[óo]n|Domicilio):\s*([^\n\r]+)/i);
  const deudaMatch = textoBruto.match(/Deuda total:\s*(?:\$\s*)?([\d.,]+)/i);
  const activoMatch = textoBruto.match(/ACTIVO CORRIENTE:\s*(?:\$\s*)?([\d.,]+)/i);
  const pasivoMatch = textoBruto.match(/PASIVO CORRIENTE:\s*(?:\$\s*)?([\d.,]+)/i);
  
  let activosPasivosStr = null;
  if (activoMatch || pasivoMatch) {
    const montoActivo = activoMatch ? activoMatch[1] : '0';
    const montoPasivo = pasivoMatch ? pasivoMatch[1] : '0';
    activosPasivosStr = `Activos: $${montoActivo} - Pasivos: $${montoPasivo}`;
  }

  let antiguedadMeses = null;
  const fechaIngresoMatch = textoBruto.match(/Fecha de ingreso:\s*(\d{2}[-/]\d{2}[-/]\d{4})/i);
  if (fechaIngresoMatch) {
    const partes = fechaIngresoMatch[1].split(/[-/]/);
    const fechaIngreso = new Date(`${partes[2]}-${partes[1]}-${partes[0]}`);
    const hoy = new Date();
    antiguedadMeses = (hoy.getFullYear() - fechaIngreso.getFullYear()) * 12
      + (hoy.getMonth() - fechaIngreso.getMonth());
  }

  const obtenerIngreso = (sueldoMatch, honorariosMatch, limpiarMonto) => {
  if (sueldoMatch) return limpiarMonto(sueldoMatch[1]);
  if (honorariosMatch) return limpiarMonto(honorariosMatch[1]);
  return null;
};

  const ingresoFinal = obtenerIngreso(sueldoMatch, honorariosMatch, limpiarMonto);
  
  return {
    ingresoFinal,
    direccion: direccionMatch ? direccionMatch[1].trim() : null,
    deuda_cmf: deudaMatch ? limpiarMonto(deudaMatch[1]) : null,
    activosPasivosStr,
    antiguedadMeses,
    limpiarMonto,
  };
};

const extractDocument = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No se envió ningún documento' });
    }

    const mimeType = String(req.file.mimetype || '').toLowerCase();

    // 1. EXTRACCIÓN DE TEXTO
    let textoBruto;
    try {
      textoBruto = await extraerTextoBruto(mimeType, req.file.buffer);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      return res.status(500).json({ 
        success: false, 
        message: 'El PDF no pudo ser leído.', 
        error: errorMessage 
      });
    }

    if (textoBruto === null) {
      return res.status(400).json({ success: false, message: `Formato no soportado: ${mimeType}` });
    }

    console.log(' TEXTO OCR COMPLETO:');
    console.log(textoBruto);
    console.log('═══════════════════════════════════════════════════════');

    // 2. TIPO DE DOCUMENTO
    const textoUpper = textoBruto.toUpperCase();
    const tipoDocumento = detectarTipoDocumento(textoUpper, textoBruto);

    // 3. RUT
    const RUT_PATTERN = /\b(\d{1,2}(?:\.\d{3}){2}|\d{7,8})-[\dk]\b/i;
    const rutMatch = textoBruto.exec(RUT_PATTERN);
    // 4. DATOS SEGÚN TIPO
    let nombreFinal = null;
    let edadCalculada = null;
    let nacionalidadFinal = null;
    let fechaVencimientoFinal = null;

    if (tipoDocumento === 'Cedula') {
      fechaVencimientoFinal = extraerFechaVencimiento(textoBruto);
      console.log(' Texto OCR completo:', textoBruto);
      console.log(' Fecha vencimiento extraída:', fechaVencimientoFinal);
      ({ edadCalculada, nombreFinal, nacionalidadFinal } = extraerDatosCedula(textoBruto, textoUpper));
    } else {
      const nombreCompletoPdf = textoBruto.exec(/Nombre Completo:\s*([^\n\r]+)/i);
      if (nombreCompletoPdf) nombreFinal = nombreCompletoPdf[1].trim();
    }

    // 5. DATOS FINANCIEROS
    const { ingresoFinal, direccion, deuda_cmf, activosPasivosStr, antiguedadMeses } =
      extraerDatosFinancieros(textoBruto);

    // 6. RESPUESTA
    return res.json({
      success: true,
      tipo_documento: tipoDocumento,
      datos_extraidos: {
        identificador: {
          nombre_completo: nombreFinal,
          rut: rutMatch ? rutMatch[1].trim() : null,
          nacionalidad: nacionalidadFinal,
          edad: edadCalculada,
          fecha_vencimiento: fechaVencimientoFinal
        },
        laboral: {
          alcance_liquido: ingresoFinal,
          antiguedad_meses: antiguedadMeses
        },
        domicilio: { direccion },
        financiero: {
          deuda_cmf,
          activos_pasivos: activosPasivosStr
        }
      }
    });
  } catch (error) {
    console.error('Error procesando documento:', error);
    return res.status(500).json({ success: false, message: 'Error procesando documento.', error: error.message });
  }
};

// =====================================
// VERIFICACIÓN DE CARNET TRASERO
// =====================================

const extraerUrl = (texto) => {
  if (!texto) return null;
  const match = String(texto).exec(/https?:\/\/[^\s|]+/i);
  return match ? match[0] : null;
};

const decodificarQR = async (buffer) => {
  try {
    let image = await Jimp.read(buffer);

    if (image.bitmap.width > 1200 || image.bitmap.height > 1200) {
      image.resize(1000, Jimp.AUTO); 
    }

    let code = scan(image);
    if (!code) {
      const clonedImage = image.clone()
        .greyscale()     
        .contrast(0.5)   
        .threshold({ max: 150 });

      code = scan(clonedImage);
    }

    if (!code) return null;

    return {
      texto_qr: code.data,
      url: extraerUrl(code.data)
    };
  } catch (error) {
    console.error("Error decodificando QR:", error);
    return null;
  }
};

// Función auxiliar interna para no repetir el mapeo de bits
const scan = (jimpImage) => {
  const { data, width, height } = jimpImage.bitmap;
  const uint8Data = new Uint8ClampedArray(data.buffer, data.byteOffset, data.byteLength);
  return jsQR(uint8Data, width, height);
};

const normalizarRut = (rut) => {
  if (!rut) return '';

  let limpio = String(rut)
    .toUpperCase()
    .replaceAll(/RUN/g, '')
    .replaceAll(/RUT/g, '')
    .replaceAll(/:/g, '')
    .replaceAll(/\./g, '')
    .replace(/\s+/g, '')
    .replace(/[^0-9K-]/g, '');

  if (!limpio) return '';

  if (limpio.includes('-')) {
    const partes = limpio.split('-');
    const numero = partes[0];
    const dv = partes[1];

    if (!numero || !dv) return '';
    return `${numero}-${dv}`;
  }

  // Caso tipo 12345678K, sin guion
  if (/^\d{7,8}[0-9K]$/.test(limpio)) {
    return `${limpio.slice(0, -1)}-${limpio.slice(-1)}`;
  }

  return limpio;
};

const validarRut = (rut) => {
  const limpio = normalizarRut(rut);

  if (!limpio?.includes('-')) return false;

  const [num, dv] = limpio.split('-');

  if (!/^\d{7,8}$/.test(num)) return false;
  if (!/^[0-9K]$/.test(dv)) return false;

  let suma = 0;
  let multiplicador = 2;

  for (let i = num.length - 1; i >= 0; i--) {
    suma += Number.parseInt(num[i], 10) * multiplicador;
    multiplicador = multiplicador === 7 ? 2 : multiplicador + 1;
  }

  const resto = suma % 11;
  let dvCalculado;

  switch (resto) {
    case 0:
      dvCalculado = '0';
      break;
    case 1:
      dvCalculado = 'K';
      break;
    default:
      dvCalculado = String(11 - resto);
  }

  return dvCalculado === dv;
};

const extraerDatosRegistroCivilDesdeTexto = (texto) => {
  if (!texto) {
    return {
      run: null,
      numero_documento: null
    };
  }
  const textoLimpio = String(texto)
    .replace(/\s+/g, ' ')
    .trim();

  // 1. Arreglamos la separación de espacios y forzamos a que el RUT empiece con un número
const runMatch =
    textoLimpio.exec(/(?:RUN|RUT)\s*(?::\s*)?([0-9][0-9.\-\s]{6,11}[0-9Kk])/i) ||
    textoLimpio.exec(/\b(\d{7,8}-?[0-9Kk])\b/i);

  // 2. Aplicamos el mismo parche protector para documentoMatch
  const documentoMatch = textoLimpio.match(
    /(?:N[°º]?\s*Documento\s*\/?\s*N[°º]?\s*Pasaporte|N[°º]?\s*Documento|Documento|Pasaporte)\s*(?::\s*)?([A-Z0-9.-]+)/i
);

  
  return {
    run: runMatch ? normalizarRut(runMatch[1]) : null,
    numero_documento: documentoMatch ? documentoMatch[1].trim() : null
  };
};

// ObtenerDatosRegistroCivil

const normalizarClaveParametro = (clave) => {
  return String(clave || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
};

const esClaveDocumento = (clave) => {
  const claves = ["serial", "nrodocumento", "numerodocumento", "ndocumento", "documento", "numdocumento", "numdoc", "nrodoc"];
  return claves.includes(clave);
};

const extraerParamsDesdeURL = (texto, datos) => {
  const url = new URL(texto);
  for (const [key, value] of url.searchParams.entries()) {
    const clave = normalizarClaveParametro(key);
    if (clave === "run" || clave === "rut") datos.run = value;
    if (esClaveDocumento(clave)) datos.numero_documento = value;
  }
};

const obtenerDatosRegistroCivil = (textoQR) => {
  if (!textoQR) return { run: null, numero_documento: null };

  let texto = String(textoQR);
  try {
    texto = decodeURIComponent(texto);
  } catch (e) {
    // Si no se puede decodificar, usamos el texto original
    console.warn('No se pudo decodificar URI, usando texto original:', e.message);
    // texto ya tiene el valor original de String(textoQR)
  }

  const datos = { run: null, numero_documento: null };

  try {
    extraerParamsDesdeURL(texto, datos);
  } catch (error) {
    console.error("No se pudo interpretar el QR como URL:", error.message);
  }

  // Fallback por si RUN no venía como parámetro normal
  if (!datos.run) {
    const runMatch =
      texto.exec(/(?:RUN|RUT)\s*[=:]\s*([0-9.\-\s]{7,14}[0-9Kk])/i) ||
      texto.exec(/\b\d{7,8}-?[0-9Kk]\b/i);
    if (runMatch) {
      datos.run = runMatch[1] || runMatch[0];
    }
  }
  if (!datos.numero_documento) {
  const serialMatch = texto.exec(/(?:serial|documento|numdoc|nrodoc)\s*[=:]\s*([A-Z0-9.-]+)/i);
  if (serialMatch) {
    datos.numero_documento = serialMatch[1];
    }
  }
  return {
    run: datos.run ? normalizarRut(datos.run) : null,
    numero_documento: datos.numero_documento ? String(datos.numero_documento).trim() : null
  };
};

const esFechaVencida = (fechaString) => {
  if (!fechaString) return true;

  const parsedFecha = parseFecha(fechaString);
  if (!parsedFecha) return true;

  const [day, month, year] = parsedFecha.split('/').map(Number);
  const fechaVencimiento = new Date(year, month - 1, day);

  const ahora = new Date();
  const hoyChile = new Date(
    ahora.toLocaleString('en-US', { timeZone: 'America/Santiago' })
  );

  hoyChile.setHours(0, 0, 0, 0);
  fechaVencimiento.setHours(0, 0, 0, 0);

  return fechaVencimiento < hoyChile;
};

const verifyCarnetBack = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'Falta imagen del carnet trasero'
      });
    }

    const mimeType = String(req.file.mimetype || '').toLowerCase();

    if (!mimeType.includes('image')) {
      return res.status(400).json({
        success: false,
        message: 'Solo se aceptan imágenes para verificación de carnet'
      });
    }

    const rutDelantero =
      req.body.rutDelantero ||
      req.body.rut_delantero ||
      req.body.rut ||
      null;

    const fechaVencimientoDelantera =
      req.body.fechaVencimientoDelantera ||
      req.body.fecha_vencimiento ||
      req.body.fechaVencimiento ||
      null;

    if (!rutDelantero) {
      return res.status(422).json({
        success: false,
        message: 'Falta enviar el RUT extraído desde la parte delantera del carnet'
      });
    }

    if (!fechaVencimientoDelantera) {
      return res.status(422).json({
        success: false,
        message: 'Falta enviar la fecha de vencimiento extraída desde la parte delantera del carnet'
      });
    }

    const qrInfo = await decodificarQR(req.file.buffer);

    if (!qrInfo) {
      return res.status(400).json({
        success: false,
        message: 'No se detectó QR en la imagen.'
      });
    }

    if (!qrInfo.url) {
      return res.status(422).json({
        success: false,
        message: 'Se detectó un QR, pero no contiene una URL válida.',
        resultado: {
          qr_detectado: true,
          texto_qr: qrInfo.texto_qr
        }
      });
    }

    //const datosRegistroCivil = await obtenerDatosRegistroCivil(qrInfo.url);
    console.log("URL del QR:", qrInfo.url);

    const datosRegistroCivil = obtenerDatosRegistroCivil(qrInfo.texto_qr || qrInfo.url);

    console.log("Datos extraídos desde QR:", {
      run: datosRegistroCivil.run,
      serial_detectado: !!datosRegistroCivil.numero_documento
    });

    if (!datosRegistroCivil?.run) {
      return res.status(422).json({
        success: false,
        message: 'Se detectó el QR, pero no se pudo extraer el RUN desde la URL del QR.',
        resultado: {
          qr_detectado: true,
          url_registro_civil: qrInfo.url,
          rut_delantero: normalizarRut(rutDelantero),
          rut_valido: validarRut(rutDelantero),
          fecha_vencimiento: parseFecha(fechaVencimientoDelantera),
          fecha_vencida: esFechaVencida(fechaVencimientoDelantera)
        }
      });
    }

    const rutCoincide =
      normalizarRut(rutDelantero) === normalizarRut(datosRegistroCivil.run);

    const rutValido = validarRut(rutDelantero);
    const fechaVencida = esFechaVencida(fechaVencimientoDelantera);

    return res.json({
      success: true,
      resultado: {
        qr_detectado: true,

        rut_delantero: normalizarRut(rutDelantero),
        rut_registro_civil: normalizarRut(datosRegistroCivil.run),
        rut_coincide: rutCoincide,

        rut_valido: rutValido,

        fecha_vencimiento: parseFecha(fechaVencimientoDelantera),
        fecha_vencida: fechaVencida,

        numero_documento: datosRegistroCivil.numero_documento,

        verificacion_ok: rutCoincide && rutValido && !fechaVencida
      }
    });

  } catch (error) {
    console.error("Error verificando carnet:", error);

    return res.status(500).json({
      success: false,
      message: 'Error verificando carnet.',
      error: error.message
    });
  }
};


// Funciones auxiliares
const extraerTextoOCR = async (buffer) => {
  const { data } = await Tesseract.recognize(buffer, 'spa');
  return String(data.text || '');
};


const extraerRut = (texto) => {
  const match = texto.match(/\b(\d{1,2}(?:\.\d{3}){2}-[\dkK]|\d{7,8}-[\dkK])\b/i);
  return match ? match[1] : null;
};

const extraerNombre = (texto) => {
  // Reutilizar lógica de extractDocument para nombres
  const palabras = texto.match(/[A-ZÁÉÍÓÚÑ]{3,}/ig) || [];
  const palabrasProhibidas = Set([
    "REPUBLICA", "CHILE", "CEDULA", "IDENTIDAD", "APELLIDOS", "NOMBRES", 
    "NACIONALIDAD", "SEXO", "SERVICIO", "REGISTRO", "CIVIL", "ESPECIMEN", 
    "HOSEN", "RUN", "DOCUMENTO", "EMISION", "VENCIMIENTO", "TITULAR", "FIRMA", 
    "NACIMIENTO", "NUMERO", "EXTRANJERO", "CHILENA", "CHILENO", "MASCULINO", "FEMENINO",
    "ENE", "FEB", "MAR", "ABR", "MAY", "MAYO", "JUN", "JUL", "AGO", "SEP", "OCT", "NOV", "DIC"
  ]);
  const nombresValidos = palabras.filter(p => !palabrasProhibidas.includes(p.toUpperCase()));
  return nombresValidos.length >= 2 ? nombresValidos.slice(0, 4).join(" ") : null;
};

const SPANISH_MONTHS = {
  ENE: 1, ENERO: 1,
  FEB: 2, FEBRERO: 2,
  MAR: 3, MARZO: 3,
  ABR: 4, ABRIL: 4,
  MAY: 5, MAYO: 5,
  JUN: 6, JUNIO: 6,
  JUL: 7, JULIO: 7,
  AGO: 8, AGOSTO: 8,
  SEP: 9, SET: 9, SEPT: 9, SEPTIEMBRE: 9,
  OCT: 10, OCTUBRE: 10,
  NOV: 11, NOVIEMBRE: 11,
  DIC: 12, DICIEMBRE: 12,
};

const parseFecha = (fecha) => {
  if (!fecha) return null;

  const fechaLimpia = String(fecha)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/\./g, " ")
    .replace(/\s+/g, " ")
    .trim();

  const numericMatch = fechaLimpia.exec(
    /^(\d{1,2})\s*[\/\-]\s*(\d{1,2})\s*[\/\-]\s*(\d{2,4})$/
  );

  if (numericMatch) {
    const day = Number.parseInt(numericMatch[1], 10);
    const month = Number.parseInt(numericMatch[2], 10);
    let year = Number.parseInt(numericMatch[3], 10);

    if (year < 100) year += 2000;

    if (
      Number.isNaN(day) ||
      Number.isNaN(month) ||
      Number.isNaN(year) ||
      day < 1 ||
      day > 31 ||
      month < 1 ||
      month > 12
    ) {
      return null;
    }

    return `${String(day).padStart(2, "0")}/${String(month).padStart(2, "0")}/${year}`;
  }

  const namedMatch = fechaLimpia.exec(
    /^(\d{1,2})\s*([A-ZÑ]{3,})\s*(\d{2,4})$/
  );

  if (namedMatch) {
    const day = Number.parseInt(namedMatch[1], 10);
    const monthName = namedMatch[2];
    let year = Number.parseInt(namedMatch[3], 10);

    const month =
      SPANISH_MONTHS[monthName] ||
      SPANISH_MONTHS[monthName.slice(0, 3)];

    if (
      !month ||
      Number.isNaN(day) ||
      Number.isNaN(year) ||
      day < 1 ||
      day > 31
    ) {
      return null;
    }

    if (year < 100) year += 2000;

    return `${String(day).padStart(2, "0")}/${String(month).padStart(2, "0")}/${year}`;
  }

  return null;
};

const extraerFechaVencimiento = (texto) => {
  if (!texto) return null;

  const textoNormalizado = String(texto)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/\s+/g, " ")
    .trim();

  const meses =
    "ENE|ENERO|FEB|FEBRERO|MAR|MARZO|ABR|ABRIL|MAY|MAYO|JUN|JUNIO|JUL|JULIO|AGO|AGOSTO|SEP|SET|SEPT|SEPTIEMBRE|OCT|OCTUBRE|NOV|NOVIEMBRE|DIC|DICIEMBRE";

  const patronFecha = `(\\d{1,2}\\s*(?:${meses})\\s*\\d{2,4}|\\d{1,2}\\s*[\\/\\-]\\s*\\d{1,2}\\s*[\\/\\-]\\s*\\d{2,4})`;

  // Caso ideal del carnet:
  // FECHA DE VENCIMIENTO 07 MAR 2030
  const regexConEtiqueta = new RegExp(
    `FECHA\\s*DE\\s*VENCIMIENTO\\s*(${patronFecha})`,
    "i"
  );

  const matchConEtiqueta = textoNormalizado.exec(regexConEtiqueta);

  if (matchConEtiqueta) {
    return parseFecha(matchConEtiqueta[1]);
  }

  // Caso OCR con texto entre medio:
  // FECHA DE VENCIMIENTO algo algo 07 MAR 2030
  const regexCercaDeVencimiento = new RegExp(
    `VENCIMIENTO.{0,80}?(${patronFecha})`,
    "i"
  );

  const matchCerca = textoNormalizado.exec(regexCercaDeVencimiento);

  if (matchCerca) {
    return parseFecha(matchCerca[1]);
  }

  // Fallback para el carnet de prueba:
  // Si detecta varias fechas, se queda con la más nueva.
  // En el carnet normalmente:
  // nacimiento = 1999
  // emisión = 2024
  // vencimiento = 2030
  const regexTodasLasFechas = new RegExp(patronFecha, "gi");
  const coincidencias = textoNormalizado.exec(regexTodasLasFechas) || [];

  const fechaEsPlausible = (fecha) => {
    const partes = fecha.split("/").map(Number);
    const anio = partes[2];

    // Evita años absurdos como 2072.
    // Para este proyecto dejamos un rango razonable de cédulas.
    return anio >= 2000 && anio <= 2045;
  };

  const fechasValidas = coincidencias
    .map(fecha => parseFecha(fecha))
    .filter(Boolean)
    .filter(fechaEsPlausible);

  if (fechasValidas.length === 0) return null;

  fechasValidas.sort((a, b) => {
    const [diaA, mesA, anioA] = a.split("/").map(Number);
    const [diaB, mesB, anioB] = b.split("/").map(Number);

    const fechaA = new Date(anioA, mesA - 1, diaA);
    const fechaB = new Date(anioB, mesB - 1, diaB);

    return fechaB.getTime() - fechaA.getTime();
  });

  return fechasValidas[0];
};

//const validarRut = (rut) => {
  //if (!rut) return false;
  //const limpio = String(rut).replace(/\./g, '').replace(/\s+/g, '').toUpperCase();
  //const [num, dv] = limpio.split('-');
  //if (!num || !dv) return false;
  // Calcular dígito verificador (algoritmo módulo 11)
  //let suma = 0;
  //let multiplicador = 2;
  //for (let i = num.length - 1; i >= 0; i--) {
    //suma += parseInt(num[i]) * multiplicador;
    //multiplicador = multiplicador === 7 ? 2 : multiplicador + 1;
  //}
  //const resto = suma % 11;
  //const dvCalculado = resto === 0 ? '0' : resto === 1 ? 'K' : (11 - resto).toString();
  //return dvCalculado === dv;
//};

//const esFechaVencida = (fechaString) => {
  //if (!fechaString) return true;
  //const parsedFecha = parseFecha(fechaString);
  //if (!parsedFecha) return true;
  //const [day, month, year] = parsedFecha.split('/').map(Number);
  //const fecha = new Date(year, month - 1, day);
  
  // Usar zona horaria de Chile (UTC-3 o UTC-4)
  //const ahora = new Date();
  //const chilenow = new Date(ahora.toLocaleString('en-US', { timeZone: 'America/Santiago' }));
  //chilenow.setHours(0, 0, 0, 0);
  //fecha.setHours(0, 0, 0, 0);
  
  //return fecha < chilenow;
//};

const normalizar = (str) => {
  return str ? String(str).toUpperCase().replace(/\s+/g, ' ').trim() : '';
};

//const normalizarRut = (rut) => {
  //if (!rut) return '';
  //return String(rut).toUpperCase().replace(/\./g, '').replace(/\s+/g, '').trim();
//};

const compararDatos = (origen, destino, campos) => {
  return campos.every(campo => {
    if (!origen?.[campo] || !destino?.[campo]) return false;
    if (campo === 'rut') {
      return normalizarRut(origen[campo]) === normalizarRut(destino[campo]);
    }
    return normalizar(origen[campo]) === normalizar(destino[campo]);
  });
};

const compararDatosRegistroCivil = (qrPayload, registroCivil) => {
  if (!qrPayload || !registroCivil.rut || !registroCivil.nombre) return false;
  return validarRut(registroCivil.rut) &&
         normalizarRut(qrPayload.rut) === normalizarRut(registroCivil.rut) &&
         normalizar(qrPayload.nombre) === normalizar(registroCivil.nombre);
};

// =====================================
// WEBPAY PLUS (Transbank)
// =====================================

const initiateWebpayPayment = async (req, res) => {
  try {
    const { loan_application_id, user_id, amount } = req.body;

    if (!loan_application_id || !user_id || !amount) {
      return res.status(422).json({
        error: 'missing_fields',
        message: 'Faltan campos obligatorios: loan_application_id, user_id, amount'
      });
    }

    // Credenciales de prueba de Transbank
    const commerceCode = '597055555532';
    const apiKey = '579B532A7440BB0C9079DED94D31EA1615BACEB56610332264630D42D0A36B1C';

    const transaction = WebpayPlus.Transaction.buildForIntegration(commerceCode, apiKey);

    const buyOrder = `LN-${Date.now()}`;
    const returnUrl = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/pay-loans?buyOrder=${buyOrder}`;

    console.log('Iniciando pago Webpay:', { buyOrder, user_id, amount: Math.round(amount), returnUrl });

    const response = await transaction.create(
      buyOrder,
      user_id,
      Math.round(amount),
      returnUrl
    );

    console.log('Respuesta completa de Webpay:', JSON.stringify(response, null, 2));

    const sql = `INSERT INTO webpay_transactions
      (loan_application_id, user_id, buy_order, token, amount, status, response_code)
      VALUES (?, ?, ?, ?, ?, 'initiated', ?)`;

    database.query(
      sql,
      [loan_application_id, user_id, buyOrder, response.token, amount, response.responseCode || 0],
      (err) => {
        if (err) {
          console.error('Error guardando transacción Webpay:', err);
          return res.status(500).json({ error: 'internal_error', details: err.message });
        }

        // Devolver los datos en formato JSON para que el frontend maneje la redirección de forma segura
        return res.json({
          url: response.url,
          token: response.token
        });
      }
    );
    
  } catch (error) {
    console.error('Error iniciando pago Webpay:', error.message, error.stack);
    res.status(500).json({
      error: 'webpay_error',
      message: error.message
    });
  }
};

const webpayCallback = async (req, res) => {
  try {
    const { token_ws } = req.body;

    if (!token_ws) {
      return res.status(400).json({ error: 'missing_token' });
    }

    // Credenciales de prueba de Transbank
    const commerceCode = '597055555532';
    const apiKey = '579B532A7440BB0C9079DED94D31EA1615BACEB56610332264630D42D0A36B1C';

    const transaction = WebpayPlus.Transaction.buildForIntegration(commerceCode, apiKey);
    const response = await transaction.commit(token_ws);

    const newStatus = response.response_code === 0 ? 'completed' : 'failed';
    const updateSql = `UPDATE webpay_transactions
      SET status = ?, response_code = ?, updated_at = NOW()
      WHERE token = ?`;

    database.query(updateSql, [newStatus, response.responseCode, token_ws], async (err) => {
      if (err) {
        console.error('Error actualizando transacción:', err);
        return res.json({
          success: false,
          message: 'Error procesando la transacción'
        });
      }

      if (newStatus === 'completed') {
        const getSql = `SELECT loan_application_id, user_id, amount FROM webpay_transactions WHERE token = ?`;
        database.query(getSql, [token_ws], async (err, results) => {
          if (err || !results || results.length === 0) {
            return res.json({
              success: false,
              message: 'Transacción no encontrada'
            });
          }

          const { loan_application_id, user_id, amount } = results[0];

          try {
            const paymentNotes = `Webpay (${token_ws.substring(0, 10)}...)`;

            const response = await fetch(`http://host.docker.internal:8081/payments`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                loan_application_id: loan_application_id,
                user_id: user_id,
                amount: amount,
                payment_method: 'webpay',
                notes: paymentNotes

              }),
            });
            if (!response.ok) {
              throw new Error(`La API de pagos respondió con un error: ${response.status}`);
            }
            res.json({
              success: true,
              message: 'Pago procesado exitosamente'
            });
          } catch (paymentErr) {
            console.warn('Advertencia test1: pago confirmado en Webpay pero error al guardar en BD de pagos:', paymentErr);
            res.json({
              success: true,
              message: 'Pago confirmado (puede haber retraso en la actualización)'
            });
          }
        });
      } else {
        res.json({
          success: false,
          message: 'El pago fue rechazado por el banco'
        });
      }
    });
  } catch (error) {
    console.error('Error en callback de Webpay:', error);
    res.json({
      success: false,
      message: 'Error procesando respuesta de Webpay'
    });
  }
};

module.exports = {
  getLoanApplications,
  createLoanApplication,
  updateLoanApplication,
  deleteLoanApplication,
  getLoanSimulations,
  createLoanSimulation,
  updateLoanSimulation,
  deleteLoanSimulation,
  scoreApplicant,
  extractDocument,
  verifyCarnetBack,
  initiateWebpayPayment,
  webpayCallback
};
