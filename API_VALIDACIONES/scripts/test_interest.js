const paymentController = require('../src/controllers/paymentController');

const examples = [
  { amount: 500000, termMonths: 6 },
  { amount: 2000000, termMonths: 12 },
  { amount: 7000000, termMonths: 36 },
  { amount: 15000000, termMonths: 120 }
];

for (const ex of examples) {
  const res = paymentController.calculateVariableInterest(ex.amount, ex.termMonths);
  console.log('\nExample:', ex);
  console.log(JSON.stringify(res, null, 2));
}
