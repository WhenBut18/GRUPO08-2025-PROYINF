const database = require('../db');

// =====================================================
// GET /payments/:user_id
// =====================================================
const getPayments = (req, res) => {
  const userId = req.params.user_id || req.userId;

  if (!userId) {
    return res.status(400).json({ error: 'missing_user_id', message: 'Usuario no identificado' });
  }

  const query = 'SELECT * FROM payments WHERE user_id = ? ORDER BY payment_date DESC';

  database.query(query, [userId], (err, results) => {
    if (err) {
      console.error('Error obteniendo pagos:', err);
      return res.status(500).json({ error: 'internal_error', message: 'Error interno del servidor' });
    }
    res.json(results);
  });
};

// =====================================================
// POST /payments
// =====================================================
const createPayment = (req, res) => {
  if (!req.body || Object.keys(req.body).length === 0) {
    return res.status(400).json({ error: 'invalid_json', message: 'Se esperaba un JSON con los datos del pago' });
  }

  const { loan_application_id, user_id, amount, payment_method, notes } = req.body;

  if (!loan_application_id || !user_id || !amount || !payment_method) {
    return res.status(422).json({
      error: 'missing_fields',
      message: 'Faltan datos obligatorios: loan_application_id, user_id, amount, payment_method'
    });
  }

  const insertQuery = `
    INSERT INTO payments (loan_application_id, user_id, amount, payment_method, notes)
    VALUES (?, ?, ?, ?, ?)
  `;

  database.query(insertQuery, [loan_application_id, user_id, amount, payment_method, notes || null], (err, result) => {
    if (err) {
      console.error('Error registrando pago:', err);
      return res.status(500).json({ error: 'internal_error', message: 'Error al registrar el pago' });
    }
    res.status(201).json({ message: 'Pago registrado exitosamente', paymentId: result.insertId });
  });
};

// =====================================================
// PUT /payments/:id
// =====================================================
const updatePayment = (req, res) => {
  const { id } = req.params;

  if (!id) return res.status(400).json({ error: 'missing_id', message: 'ID del pago requerido' });

  if (!req.body || Object.keys(req.body).length === 0) {
    return res.status(400).json({ error: 'invalid_json', message: 'Se esperaba un JSON con los campos a actualizar' });
  }

  const fields = [];
  const values = [];

  Object.entries(req.body).forEach(([key, value]) => {
    fields.push(`${key} = ?`);
    values.push(value);
  });

  if (fields.length === 0)
    return res.status(400).json({ error: 'missing_fields', message: 'No se enviaron campos para actualizar' });

  values.push(id);

  const sql = `UPDATE payments SET ${fields.join(', ')}`;

  database.query(sql, values, (err, result) => {
    if (err) {
      console.error('Error actualizando pago:', err);
      return res.status(500).json({ error: 'internal_error', message: 'Error al actualizar el pago' });
    }
    if (result.affectedRows === 0)
      return res.status(404).json({ error: 'not_found', message: 'No se encontró el pago con ese ID' });

    res.json({ message: 'Pago actualizado correctamente' });
  });
};

// =====================================================
// DELETE /payments/:id
// =====================================================
const deletePayment = (req, res) => {
  const { id } = req.params;

  if (!id) return res.status(400).json({ error: 'missing_id', message: 'ID del pago requerido' });

  const sql = 'DELETE FROM payments WHERE id = ?';

  database.query(sql, [id], (err, result) => {
    if (err) {
      console.error('Error eliminando pago:', err);
      return res.status(500).json({ error: 'internal_error', message: 'Error al eliminar el pago' });
    }
    if (result.affectedRows === 0)
      return res.status(404).json({ error: 'not_found', message: 'No se encontró el pago con ese ID' });

    res.json({ message: 'Pago eliminado correctamente' });
  });
};

// =====================================================
// Calcular intereses variables (ya existente)
// =====================================================
const MIN_AMOUNT = 100000;
const MAX_AMOUNT = 5000000;
const MIN_MONTHS = 3;
const MAX_MONTHS = 60;

const getBaseRate = (amount) => {
  if (amount <= 500000) return 15.0;
  else if (amount <= 1000000) return 13;
  else if (amount <= 2000000) return 11;
  else if (amount <= 5000000) return 9;
  return 7;
};

const getTermAdj = (termMonths) => {
  if (termMonths <= 6) return -1;
  else if (termMonths <= 12) return 0;
  else if (termMonths <= 24) return 0;
  else if (termMonths <= 60) return 1;
  return 1.5;
};

function calculateVariableInterest(amount, termMonths) {
  amount = Number(amount) || 0;
  termMonths = Number(termMonths) || 0;

  let baseRate = getBaseRate(amount);
  let termAdj = getTermAdj(termMonths);

  let annualRate = baseRate + termAdj;
  if (annualRate < 5) annualRate = 5;
  if (annualRate > 15) annualRate = 15;

  const monthlyRate = annualRate / 12 / 100;

  let monthlyPayment = 0;
  if (monthlyRate === 0 || termMonths === 0) {
    monthlyPayment = termMonths > 0 ? amount / termMonths : 0;
  } else {
    const pow = Math.pow(1 + monthlyRate, termMonths);
    monthlyPayment = amount * monthlyRate * pow / (pow - 1);
  }

  const totalPayment = monthlyPayment * termMonths;
  const totalInterest = totalPayment - amount;

  const amortization = [];
  let remaining = amount;
  const periodsToShow = Math.min(termMonths, 12);
  for (let i = 1; i <= periodsToShow; i++) {
    const interestPortion = remaining * monthlyRate;
    const principalPortion = monthlyPayment - interestPortion;
    remaining = Math.max(0, remaining - principalPortion);
    amortization.push({
      month: i,
      payment: Number(monthlyPayment.toFixed(2)),
      interest: Number(interestPortion.toFixed(2)),
      principal: Number(principalPortion.toFixed(2)),
      remaining: Number(remaining.toFixed(2))
    });
  }

  return {
    amount: Number(amount),
    termMonths: Number(termMonths),
    annualRate: Number(annualRate.toFixed(2)),
    monthlyRate: Number(monthlyRate.toFixed(6)),
    monthlyPayment: Number(monthlyPayment.toFixed(2)),
    totalPayment: Number(totalPayment.toFixed(2)),
    totalInterest: Number(totalInterest.toFixed(2)),
    amortization
  };
}

const calculateInterest = (req, res) => {
  const amount = req.query.amount || req.body?.amount;
  const term = req.query.termMonths || req.query.term || req.body?.termMonths || req.body?.term;

  if (!amount || !term) {
    return res.status(400).json({ error: 'missing_params', message: 'Parámetros requeridos: amount y termMonths' });
  }

  const numericAmount = Number(amount);
  const numericTerm = Number(term);

  if (Number.isNaN(numericAmount) || Number.isNaN(numericTerm)) {
    return res.status(400).json({ error: 'invalid_params', message: 'amount y termMonths deben ser numéricos' });
  }

  if (numericAmount < MIN_AMOUNT || numericAmount > MAX_AMOUNT) {
    return res.status(400).json({ error: 'out_of_range', message: `El monto debe estar entre ${MIN_AMOUNT} y ${MAX_AMOUNT}` });
  }

  if (numericTerm < MIN_MONTHS || numericTerm > MAX_MONTHS) {
    return res.status(400).json({ error: 'out_of_range', message: `El plazo (meses) debe estar entre ${MIN_MONTHS} y ${MAX_MONTHS}` });
  }

  try {
    const result = calculateVariableInterest(numericAmount, numericTerm);
    return res.json(result);
  } catch (err) {
    console.error('Error calculando interés:', err);
    return res.status(500).json({ error: 'internal_error', message: 'Error interno calculando interés' });
  }
};

// =====================================================
// EXPORTS
// =====================================================
module.exports = {
  getPayments,
  createPayment,
  updatePayment,
  deletePayment,
  calculateVariableInterest,
  calculateInterest
};
