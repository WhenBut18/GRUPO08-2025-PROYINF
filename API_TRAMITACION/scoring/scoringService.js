// Interfaz única de scoring usada por el resto del backend.
//
// Responsabilidades (compartidas por todos los adapters):
//   1. Construir las 5 features desde los datos crudos de la solicitud.
//      - debt_ratio_kaggle = deuda_cmf / monthly_income (carga total de deuda
//        sobre ingreso). OJO: NO es el DTI de negocio (cuota/ingreso ≤ 0.30).
//   2. Imputar nulos con las medianas del entrenamiento (medians.json), igual
//      que hizo el notebook antes de escalar.
//   3. Delegar la matemática (escalado + sigmoid) al adapter activo.
//   4. Comparar la probabilidad con el threshold y devolver la decisión.
//
// Los artefactos y el adapter se cargan UNA sola vez al importar este módulo
// (al iniciar la API), no por request.

const fs = require('node:fs');
const path = require('node:path');
const getAdapter = require('./adapters');

const MODEL_DIR = path.join(__dirname, 'model');

const medians = JSON.parse(
  fs.readFileSync(path.join(MODEL_DIR, 'medians.json'), 'utf8')
);
const { threshold } = JSON.parse(
  fs.readFileSync(path.join(MODEL_DIR, 'coeficientes.json'), 'utf8')
);

const FEATURES = [
  'monthly_income',
  'debt_ratio_kaggle',
  'edad',
  'deuda_relativa',
  'num_creditos',
];

const adapter = getAdapter();
adapter.load(); // carga única al iniciar la API

const toNum = (v) => {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  return Number.isNaN(n) ? null : n;
};

// Construye las 5 features e imputa los nulos con la mediana del entrenamiento.
function buildFeatures(raw) {
  const monthly_income = toNum(raw.monthly_income);
  const deuda_cmf = toNum(raw.deuda_cmf);

  let debt_ratio_kaggle = null;
  if (monthly_income && monthly_income > 0 && deuda_cmf !== null) {
    debt_ratio_kaggle = deuda_cmf / monthly_income;
  }

  const f = {
    monthly_income,
    debt_ratio_kaggle,
    edad: toNum(raw.edad),
    deuda_relativa: toNum(raw.deuda_relativa),
    num_creditos: toNum(raw.num_creditos),
  };

  for (const k of FEATURES) {
    if (f[k] === null || Number.isNaN(f[k])) f[k] = medians[k];
  }
  return f;
}

// raw: { monthly_income, deuda_cmf?, edad?, deuda_relativa?, num_creditos? }
function predict(raw) {
  const features = buildFeatures(raw);
  const probability = adapter.predictProba(features);
  const decision = probability >= threshold ? 'reject' : 'approve';
  return { probability, decision, threshold, adapter: adapter.name, features };
}

// Cascada de decisión completa para el flujo de creación de solicitud:
//   1) filtros duros (edad fuera de [18,75], DTI = cuota/ingreso > 0.30)
//   2) modelo logístico sobre lo que pasa los filtros duros
//   3) decisión final + fail-safe ante error del modelo
//
// input: { monthly_income, monthly_payment, edad?, deuda_cmf?, deuda_relativa?, num_creditos? }
// retorna: { status, score, scoring_decision }
function decide(input) {
  const income = Number(input.monthly_income);
  const cuota = Number(input.monthly_payment);
  const edadNum = (input.edad === undefined || input.edad === null || input.edad === '')
    ? null
    : Number(input.edad);
  const dti = (income && income > 0) ? (cuota / income) : null;

  // 1) FILTROS DUROS (reglas de negocio; no entran al modelo para evitar leakage)
  if (edadNum !== null && !Number.isNaN(edadNum) && (edadNum < 18 || edadNum > 75)) {
    return { status: 'rejected', score: null, scoring_decision: 'hard_filter_edad' };
  }
  if (dti !== null && dti > 0.3) {
    return { status: 'rejected', score: null, scoring_decision: 'hard_filter_dti' };
  }

  // 2) MODELO LOGÍSTICO
  try {
    const r = predict(input);
    const score = Number(r.probability.toFixed(4));

    // 3) DECISIÓN FINAL
    // NOTA PRODUCCIÓN: en un sistema real, score >= threshold debería ir a
    // 'under_review' (revisión humana), NO a 'rejected' automático. Se deja
    // rechazo automático por requerimiento actual del equipo.
    if (r.decision === 'reject') {
      return { status: 'rejected', score, scoring_decision: 'model_reject' };
    }
    return { status: 'approved', score, scoring_decision: 'model_approve' };
  } catch (err) {
    console.error('scoring_error', err);
    // Fail-safe: si el modelo falla, va a revisión manual (no aprueba ni rechaza solo).
    return { status: 'under_review', score: null, scoring_decision: 'scoring_unavailable' };
  }
}

module.exports = { predict, decide, buildFeatures, threshold, FEATURES };
