// STUB — adapter ONNX (pendiente de implementar).
//
// Cuándo usarlo: alternativa al pythonAdapter que mantiene todo dentro de Node.
// Se convierte el modelo sklearn a ONNX (skl2onnx) y se ejecuta con
// `onnxruntime-node`. Útil para modelos no-lineales sin pagar un contenedor
// Python aparte. La imputación con medianas seguiría en scoringService.
//
// Debe respetar el MISMO contrato que jsPureAdapter:
//   name, load(), isReady(), predictProba(features) -> number
//
// Para activarlo: SCORING_ADAPTER=onnx en el .env (una vez implementado, e
// instalada la dependencia onnxruntime-node).

module.exports = {
  name: 'onnx',
  load() {
    throw new Error('onnxAdapter no implementado — usa SCORING_ADAPTER=js');
  },
  isReady: () => false,
  predictProba() {
    throw new Error('onnxAdapter no implementado — usa SCORING_ADAPTER=js');
  },
};
