// Test de la cascada de decisión (filtros duros -> modelo -> decisión final).
// Valida el comportamiento integrado de scoringService.decide() sin necesidad
// de levantar Express ni MySQL.
//
// Uso:  node scoring/test_cascade.js   (sale con código !=0 si falla)

const svc = require('./scoringService');

const cases = [
  {
    name: 'edad > 75 -> filtro duro edad',
    input: { monthly_income: 2000000, monthly_payment: 300000, edad: 80 },
    expect: { status: 'rejected', scoring_decision: 'hard_filter_edad' },
  },
  {
    name: 'edad < 18 -> filtro duro edad',
    input: { monthly_income: 2000000, monthly_payment: 300000, edad: 16 },
    expect: { status: 'rejected', scoring_decision: 'hard_filter_edad' },
  },
  {
    name: 'DTI > 30% -> filtro duro dti',
    input: { monthly_income: 1000000, monthly_payment: 400000, edad: 40 },
    expect: { status: 'rejected', scoring_decision: 'hard_filter_dti' },
  },
  {
    name: 'perfil bajo riesgo -> aprobado por modelo',
    input: { monthly_income: 2500000, monthly_payment: 300000, edad: 60, deuda_cmf: 100000, deuda_relativa: 0.05, num_creditos: 3 },
    expect: { status: 'approved', scoring_decision: 'model_approve' },
  },
  {
    name: 'perfil alto riesgo -> rechazado por modelo',
    input: { monthly_income: 400000, monthly_payment: 100000, edad: 22, deuda_cmf: 600000, deuda_relativa: 1.2, num_creditos: 12 },
    expect: { status: 'rejected', scoring_decision: 'model_reject' },
  },
  {
    name: 'edad null + datos faltantes -> imputa y decide (no falla)',
    input: { monthly_income: 700000, monthly_payment: 200000 },
    expectField: 'status', // solo verificamos que devuelve un status válido
  },
];

let failures = 0;
for (const c of cases) {
  const out = svc.decide(c.input);
  let ok = true;
  if (c.expect) {
    ok = out.status === c.expect.status && out.scoring_decision === c.expect.scoring_decision;
  } else if (c.expectField) {
    ok = ['pending', 'under_review', 'approved', 'rejected'].includes(out.status);
  }
  if (!ok) failures++;

  const prefix = ok ? 'OK ' : 'FAIL';
  const resultDetail = JSON.stringify(out);
  console.log(prefix + ' | ' + c.name + ' -> ' + resultDetail);
}

console.log(`\n${failures === 0 ? 'CASCADE OK' : `CASCADE FAILED (${failures})`}`);
process.exit(failures === 0 ? 0 : 1);
