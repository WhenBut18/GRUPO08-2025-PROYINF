require('dotenv').config();

const API_VALIDACIONES_URL = process.env.API_VALIDACIONES_URL || 'http://localhost:8081';

const registerPayment = async (loanApplicationId, userId, amount, paymentMethod, notes) => {
  const response = await fetch(`${API_VALIDACIONES_URL}/payments`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      loan_application_id: loanApplicationId,
      user_id: userId,
      amount,
      payment_method: paymentMethod,
      notes
    })
  });

  if (!response.ok) {
    throw new Error(`API_VALIDACIONES error: ${response.status}`);
  }

  return await response.json();
};

module.exports = { registerPayment };