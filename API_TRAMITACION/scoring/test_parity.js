// Test de paridad: el adapter JS puro debe reproducir predict_proba del pipeline
// (StandardScaler + LogisticRegression) sobre las features ya imputadas.
//
// El StandardScaler es una transformación lineal determinista (x - mean) / scale
// con los parámetros de scaler.json; la LogisticRegression aplica
// sigmoid(intercept + coef·x). Por eso la "referencia sklearn" es reproducible
// analíticamente a partir de los mismos JSON, sin necesidad del .pkl.
//
// Estas referencias se REGENERARON tras recalibrar scaler.json/medians.json al
// mercado chileno (ver hito final/INFORME-Soluciones-Scoring.md). Si se vuelven a
// tocar los coeficientes o el scaler, regenerarlas calculando la fórmula de forma
// independiente al adapter (no copiar la salida del adapter a ciegas).
//
// Uso:  node scoring/test_parity.js   (sale con código !=0 si falla)

const svc = require('./scoringService');

const cases = [
  { monthly_income: 1200000, deuda_cmf: 300000, edad: 34, deuda_relativa: 0.4, num_creditos: 5 },
  { monthly_income: 700000, deuda_cmf: null, edad: null, deuda_relativa: null, num_creditos: null },
  { monthly_income: 400000, deuda_cmf: 600000, edad: 22, deuda_relativa: 1.2, num_creditos: 12 },
  { monthly_income: 2500000, deuda_cmf: 100000, edad: 60, deuda_relativa: 0.05, num_creditos: 3 },
];
// Referencia del pipeline (StandardScaler + LogisticRegression) recalibrado,
// calculada de forma independiente al adapter sobre los mismos JSON.
const reference = [0.4574700379, 0.4360694142, 0.9319714532, 0.1184547792];

const TOL = 1e-6;
let maxDiff = 0;

cases.forEach((c, i) => {
  const p = svc.predict(c).probability;
  const diff = Math.abs(p - reference[i]);
  maxDiff = Math.max(maxDiff, diff);
  console.log(`case ${i}: js=${p.toFixed(10)} sklearn=${reference[i].toFixed(10)} diff=${diff.toExponential(2)}`);
});

console.log(`\nmax diff = ${maxDiff.toExponential(3)} (tol ${TOL})`);
if (maxDiff < TOL) {
  console.log('PARITY OK');
  process.exit(0);
} else {
  console.error('PARITY FAILED — el adapter JS diverge de sklearn');
  process.exit(1);
}
