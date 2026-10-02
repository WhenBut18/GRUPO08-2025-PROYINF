#!/usr/bin/env bash
# Wrapper para ejecutar JMeter (instalado en WSL, en ~/tools) sin tener que
# recordar JAVA_HOME ni la ruta del binario.
#
# Uso:
#   ./run.sh <plan.jmx> [args extra de jmeter...]
# Ejemplos:
#   ./run.sh plan-score.jmx -Jusers=100 -Jrampup=30 -Jduration=60 \
#            -l result-score.jtl -e -o report-score
#   ./run.sh --gui            # abre la GUI (solo para diseñar, requiere X server)
#
# Parametros -J que aceptan los planes (con sus defaults):
#   host=localhost  port=(8080/8082 segun plan)  users=50  rampup=30
#   duration=60  threshold=1000  email/password (login)  user_id (loan_applications)

set -euo pipefail

export JAVA_HOME="${JAVA_HOME:-$HOME/tools/jdk-17.0.12+7}"
export PATH="$JAVA_HOME/bin:$PATH"
JMETER_BIN="$HOME/tools/apache-jmeter-5.6.3/bin/jmeter"

if [[ ! -x "$JMETER_BIN" ]]; then
  echo "ERROR: no encuentro JMeter en $JMETER_BIN" >&2
  echo "Reinstala con los pasos del README (seccion 'Instalacion en WSL')." >&2
  exit 1
fi

if [[ "${1:-}" == "--gui" ]]; then
  exec "$JMETER_BIN"
fi

if [[ $# -lt 1 ]]; then
  echo "Uso: ./run.sh <plan.jmx> [args extra de jmeter]" >&2
  echo "     ./run.sh --gui" >&2
  exit 1
fi

PLAN="$1"; shift
# -n = modo headless (sin GUI), lo recomendado para mediciones reales.
exec "$JMETER_BIN" -n -t "$PLAN" "$@"
