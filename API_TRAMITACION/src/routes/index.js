const express = require('express');
const router = new express.Router();
const ctrl = require('../controllers/index');
const multer = require('multer')

const index = require('../controllers/index');

const upload = multer({ storage: multer.memoryStorage(),
                        limits: {
                            fileSize: 8000000
                        }
 });

// Healthcheck
router.get('/', (req, res) => res.json({ message: 'API_TRAMITACION OK' }));

// Loan Applications CRUD
router.get('/loan_applications', ctrl.getLoanApplications);        // GET con filtro opcional ?user_id=, ?id=, ?status=, ?simulation_id=
router.post('/loan_applications', ctrl.createLoanApplication);
router.put('/loan_applications/:id', ctrl.updateLoanApplication);
router.delete('/loan_applications/:id', ctrl.deleteLoanApplication);

// Loan Simulations CRUD
router.get('/loan_simulations', ctrl.getLoanSimulations);          // GET con filtro opcional ?user_id= o ?id=
router.post('/loan_simulations', ctrl.createLoanSimulation);
router.put('/loan_simulations/:id', ctrl.updateLoanSimulation);
router.delete('/loan_simulations/:id', ctrl.deleteLoanSimulation);

// Scoring crediticio (modelo logístico) — endpoint stateless
router.post('/score', ctrl.scoreApplicant);

// Endpoint para extraer documentos
router.post('/extract-document', upload.single('documento'), index.extractDocument);

// Nuevo: Endpoint para verificar carnet trasero
router.post('/verify-carnet-back', upload.single('documento'), index.verifyCarnetBack);

// Webpay endpoints
router.post('/initiate_webpay_payment', index.initiateWebpayPayment);
router.post('/webpay_callback', index.webpayCallback);

module.exports = router;