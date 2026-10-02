// Selector de adapter de scoring según la variable de entorno SCORING_ADAPTER.
// Default: 'js' (adapter JS puro, sin dependencias externas).
//
// Permite intercambiar la implementación del modelo (JS puro / Python / ONNX)
// sin tocar el resto del sistema: scoringService.js depende solo de esta fábrica.

module.exports = function getAdapter() {
  const which = (process.env.SCORING_ADAPTER || 'js').toLowerCase();
  switch (which) {
    case 'python':
      return require('./pythonAdapter');
    case 'onnx':
      return require('./onnxAdapter');
    case 'js':
    default:
      return require('./jsPureAdapter');
  }
};
