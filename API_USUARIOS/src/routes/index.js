const express = require('express');
const router = new express.Router();

const ctrl = require('../controllers/index');

// Healthcheck
router.get('/', (req, res) => res.json({ message: 'API_USUARIOS OK' }));

// Auth
router.post('/auth/register', ctrl.register);
router.post('/auth/login', ctrl.login);

// Users CRUD
router.get('/users/:id', ctrl.getUser);
router.post('/users', ctrl.createUser);
router.put('/users/:id', ctrl.updateUser);
router.delete('/users/:id', ctrl.deleteUser);

module.exports = router;

