const express = require('express');
const router = new express.Router();
const paymentController = require('../controllers/paymentController'); // Importa el nuevo controlador

// Endpoints de prueba/ejemplo
router.get('/', (req, res) => res.json({message: 'API_Validaciones operativa'}));

// ================== Endpoints de Pagos (CRUD completo) ================== //
router.get('/payments/:user_id', paymentController.getPayments);   // GET
router.post('/payments', paymentController.createPayment);         // POST
router.put('/payments/:id', paymentController.updatePayment);      // PUT
router.delete('/payments/:id', paymentController.deletePayment);   // DELETE

// Calcular intereses variables
router.get('/interest', paymentController.calculateInterest);


module.exports = router; 