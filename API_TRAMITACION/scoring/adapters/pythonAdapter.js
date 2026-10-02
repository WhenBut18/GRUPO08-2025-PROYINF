// STUB — adapter Python (pendiente de implementar).
//
// Cuándo usarlo: cuando se reemplace la regresión logística por un modelo
// no-lineal (árboles, gradient boosting, etc.) que no se pueda reimplementar
// trivialmente en JS. Debe llamar a un microservicio FastAPI (recomendado) o a
// un subprocess `python predict.py` que cargue los .pkl con joblib y exponga
// predict_proba.
//
// Debe respetar el MISMO contrato que jsPureAdapter:
//   name, load(), isReady(), predictProba(features) -> number
//
// Para activarlo: SCORING_ADAPTER=python en el .env (una vez implementado).

module.exports = {
  name: 'python',
  load() {
    throw new Error('pythonAdapter no implementado — usa SCORING_ADAPTER=js');
  },
  isReady: () => false,
  predictProba() {
    throw new Error('pythonAdapter no implementado — usa SCORING_ADAPTER=js');
  },
};
