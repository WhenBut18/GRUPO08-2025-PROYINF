// Adapter JS puro: reimplementa la inferencia del modelo lineal (StandardScaler
// + LogisticRegression) directamente en Node, sin Python ni runtimes externos.
//
//   score = sigmoid( intercept + Σ coef_i * (x_i - mean_i) / scale_i )
//
// Recibe las 5 features YA construidas e imputadas (eso vive en scoringService).
// Los artefactos se leen UNA sola vez vía load().

const fs = require('node:fs');
const path = require('node:path');

const MODEL_DIR = path.join(__dirname, '..', 'model');

let coef = null;       // coeficientes en el orden canónico de feature_names
let intercept = null;
let mean = null;
let scale = null;
let order = null;      // orden canónico de las features (de scaler.json)
let ready = false;

function load() {
  const coeficientes = JSON.parse(
    fs.readFileSync(path.join(MODEL_DIR, 'coeficientes.json'), 'utf8')
  );
  const scaler = JSON.parse(
    fs.readFileSync(path.join(MODEL_DIR, 'scaler.json'), 'utf8')
  );

  order = scaler.feature_names;
  mean = scaler.mean;
  scale = scaler.scale;
  intercept = coeficientes.intercept;
  coef = order.map((f) => coeficientes[f]); // coef alineado con mean/scale

  ready = true;
}

const sigmoid = (z) => 1 / (1 + Math.exp(-z));

// features: { monthly_income, debt_ratio_kaggle, edad, deuda_relativa, num_creditos }
function predictProba(features) {
  if (!ready) load();

  let z = intercept;
  for (let i = 0; i < order.length; i++) {
    const standardized = (features[order[i]] - mean[i]) / scale[i];
    z += coef[i] * standardized;
  }
  return sigmoid(z); // P(default)
}

module.exports = {
  name: 'js',
  load,
  isReady: () => ready,
  predictProba,
};
