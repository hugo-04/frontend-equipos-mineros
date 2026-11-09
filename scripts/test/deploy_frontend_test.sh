#!/usr/bin/env bash
# Pruebas de deploy-frontend.sh, sin bats: un arnés mínimo hecho en bash.
#
# git, docker, npm, railway y curl se reemplazan por mocks que viven en un PATH temporal. El mock de railway
# y el de curl comparten un "estado del hosting" (qué tag está corriendo), y con eso se simula un despliegue
# normal, una versión que no levanta, un rollback que falla, etc. Nunca se toca Railway de verdad.
#
# Uso: ./scripts/test/deploy_test.sh        (sale con código != 0 si alguna prueba falla)
set -uo pipefail

RAIZ="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
TMP_BASE="$(mktemp -d)"
trap 'rm -rf "$TMP_BASE"' EXIT

PASARON=0
FALLARON=0
FALLIDAS=()

# Los mocks de las herramientas
crear_mocks() {
  local bin="$1"
  mkdir -p "$bin"

  cat >"$bin/git" <<'MOCK'
#!/usr/bin/env bash
[ "$1" = "rev-parse" ] && echo "${MOCK_GIT_SHA:-abc1234}"
exit 0
MOCK

  cat >"$bin/docker" <<'MOCK'
#!/usr/bin/env bash
echo "docker $*" >>"$MOCK_STATE/calls.log"
if [ "$1" = "push" ] && [ "${MOCK_DOCKER_PUSH_FAIL:-0}" = "1" ]; then
  echo "denied: requested access to the resource is denied" >&2
  exit 1
fi
exit 0
MOCK

  cat >"$bin/npm" <<'MOCK'
#!/usr/bin/env bash
echo "npm $*" >>"$MOCK_STATE/calls.log"
exit "${MOCK_NPM_EXIT:-0}"
MOCK

  # railway up <carpeta> --service X --ci : lee el tag del Dockerfile y "despliega" ese tag
  cat >"$bin/railway" <<'MOCK'
#!/usr/bin/env bash
echo "railway $*" >>"$MOCK_STATE/calls.log"
[ "$1" = "up" ] || exit 0
tag="$(sed -n 's/^FROM .*:\(.*\)$/\1/p' "$2/Dockerfile")"
echo "$tag" >>"$MOCK_STATE/deployed_tags.log"
for malo in ${MOCK_RAILWAY_FAIL_TAGS:-}; do
  if [ "$malo" = "$tag" ]; then echo "railway: build failed for $tag" >&2; exit 1; fi
done
# Despliegue "fantasma": el comando termina bien pero la app nueva nunca toma el tráfico
for fantasma in ${MOCK_RAILWAY_NOOP_TAGS:-}; do
  [ "$fantasma" = "$tag" ] && exit 0
done
echo "$tag" >"$MOCK_STATE/live_tag"
exit 0
MOCK

  # curl -sS --max-time N -o ARCHIVO -w '%{http_code}' URL
  cat >"$bin/curl" <<'MOCK'
#!/usr/bin/env bash
salida="" ; url=""
while [ $# -gt 0 ]; do
  case "$1" in
    -o) salida="$2"; shift 2 ;;
    -w|--max-time) shift 2 ;;
    -*) shift ;;
    *) url="$1"; shift ;;
  esac
done
responder() { [ -n "$salida" ] && printf '%s' "$2" >"$salida"; printf '%s' "$1"; exit 0; }
case "$url" in
  *__fallo_simulado__*) responder 404 '{"code":"RUTA_NO_ENCONTRADA"}' ;;
esac
if [ ! -s "$MOCK_STATE/live_tag" ]; then
  exit 7   # nada desplegado todavía: no hay a qué conectarse
fi
live="$(cat "$MOCK_STATE/live_tag")"
for malo in ${MOCK_UNHEALTHY_TAGS:-}; do
  [ "$malo" = "$live" ] && responder 503 "{\"status\":\"DOWN\",\"version\":\"$live\"}"
done
responder 200 "{\"status\":\"UP\",\"version\":\"$live\"}"
MOCK

  chmod +x "$bin"/*
}

# Cada prueba arranca con su propio escenario limpio
# nuevo_escenario [tag_en_produccion]
nuevo_escenario() {
  ESC="$(mktemp -d "$TMP_BASE/esc.XXXX")"
  mkdir -p "$ESC/state"
  : >"$ESC/state/calls.log"
  : >"$ESC/state/deployed_tags.log"
  crear_mocks "$ESC/bin"
  if [ -n "${1:-}" ]; then echo "$1" >"$ESC/state/live_tag"; fi

  export MOCK_STATE="$ESC/state"
  export PATH="$ESC/bin:$PATH_ORIGINAL"
  export RAILWAY_TOKEN="token-de-prueba" RAILWAY_SERVICE="equipos-web" APP_URL="https://equipos-web.example.test"
  export REGISTRY_IMAGE="ghcr.io/org/equipos-mineros-frontend"
  export HEALTH_RETRIES=3 HEALTH_INTERVAL=0 HEALTH_TIMEOUT=1
  export DEPLOY_STATE_DIR="$ESC/deploy-state"
  unset SIMULATE_FAILURE MOCK_GIT_SHA MOCK_DOCKER_PUSH_FAIL MOCK_NPM_EXIT MOCK_RAILWAY_FAIL_TAGS
  unset MOCK_RAILWAY_NOOP_TAGS MOCK_UNHEALTHY_TAGS
  unset RAILWAY_API_TOKEN RAILWAY_PROJECT RAILWAY_ENVIRONMENT
  CODIGO=""
  SALIDA="$ESC/salida.log"
}

ejecutar_deploy() {
  bash "$RAIZ/scripts/deploy-frontend.sh" >"$SALIDA" 2>&1
  CODIGO=$?
}

# Funciones para comprobar los resultados
FALLO_ACTUAL=0
fallo() { echo "      x $*"; FALLO_ACTUAL=1; }

afirmar_codigo() {
  [ "$CODIGO" = "$1" ] || fallo "código de salida esperado $1, obtenido $CODIGO"
}
afirmar_distinto_de_cero() {
  [ "$CODIGO" != "0" ] || fallo "se esperaba un código de salida distinto de 0"
}
afirmar_salida_contiene() {
  grep -qF -- "$1" "$SALIDA" || fallo "la salida no contiene: '$1'"
}
afirmar_salida_no_contiene() {
  ! grep -qF -- "$1" "$SALIDA" || fallo "la salida NO debería contener: '$1'"
}
afirmar_tag_en_produccion() {
  [ "$(cat "$ESC/state/live_tag" 2>/dev/null)" = "$1" ] || fallo "en producción se esperaba '$1' y hay '$(cat "$ESC/state/live_tag" 2>/dev/null)'"
}
afirmar_despliegues() {
  local n
  n="$(grep -c . "$ESC/state/deployed_tags.log" || true)"
  [ "$n" = "$1" ] || fallo "se esperaban $1 despliegues (railway up) y hubo $n: $(tr '\n' ' ' <"$ESC/state/deployed_tags.log")"
}
afirmar_sin_llamadas() {
  ! grep -q "^$1" "$ESC/state/calls.log" || fallo "no debía llamarse a '$1'"
}

prueba() {
  local nombre="$1" funcion="$2"
  FALLO_ACTUAL=0
  echo "- $nombre"
  "$funcion"
  if [ "$FALLO_ACTUAL" -eq 0 ]; then
    PASARON=$((PASARON + 1)); echo "    ok"
  else
    FALLARON=$((FALLARON + 1)); FALLIDAS+=("$nombre")
    echo "    --- salida de deploy-frontend.sh ---"; sed 's/^/    | /' "$SALIDA"; echo "    ---------------------------"
  fi
}

# (1) despliegue exitoso -> exit 0
t_exito() {
  nuevo_escenario "old1234"
  ejecutar_deploy
  afirmar_codigo 0
  afirmar_tag_en_produccion "abc1234"
  afirmar_despliegues 1
  afirmar_salida_contiene "DESPLIEGUE OK"
  afirmar_salida_contiene "PASO 6/7"
  [ "$(cat "$DEPLOY_STATE_DIR/previous_tag" 2>/dev/null)" = "old1234" ] || fallo "no se guardó la versión previa en previous_tag"
  grep -q "docker build --build-arg APP_VERSION=abc1234 -t ghcr.io/org/equipos-mineros-frontend:abc1234" "$ESC/state/calls.log" \
    || fallo "la imagen no se etiquetó con el SHA corto"
}

# (2) falla en health -> rollback al tag previo y exit != 0
t_rollback_por_health() {
  nuevo_escenario "old1234"
  export MOCK_UNHEALTHY_TAGS="abc1234"
  ejecutar_deploy
  afirmar_codigo 2
  afirmar_distinto_de_cero
  afirmar_salida_contiene "ROLLBACK ejecutado a old1234"
  afirmar_tag_en_produccion "old1234"
  afirmar_despliegues 2
}

# (2b) el mecanismo SIMULATE_FAILURE=health fuerza el fallo y dispara el rollback
t_rollback_por_falla_simulada() {
  nuevo_escenario "old1234"
  export SIMULATE_FAILURE="health"
  ejecutar_deploy
  afirmar_codigo 2
  afirmar_salida_contiene "SIMULATE_FAILURE=health"
  afirmar_salida_contiene "ROLLBACK ejecutado a old1234"
  afirmar_tag_en_produccion "old1234"
}

# (2c) el propio comando de despliegue falla -> también hay rollback
t_rollback_si_falla_el_comando_de_despliegue() {
  nuevo_escenario "old1234"
  export MOCK_RAILWAY_FAIL_TAGS="abc1234"
  ejecutar_deploy
  afirmar_codigo 2
  afirmar_salida_contiene "ROLLBACK ejecutado a old1234"
  afirmar_tag_en_produccion "old1234"
}

# (2d) la versión nueva "se despliega" pero la app que responde sigue siendo la vieja
t_rollback_si_la_version_no_cambia() {
  nuevo_escenario "old1234"
  export MOCK_RAILWAY_NOOP_TAGS="abc1234"
  ejecutar_deploy
  afirmar_codigo 2
  afirmar_salida_contiene "todavía no la abc1234"
  afirmar_salida_contiene "ROLLBACK ejecutado a old1234"
}

# (3) falta una variable -> exit 1 con mensaje claro
t_falta_variable() {
  nuevo_escenario "old1234"
  unset RAILWAY_TOKEN
  ejecutar_deploy
  afirmar_codigo 1
  afirmar_salida_contiene "falta la variable de entorno RAILWAY_TOKEN"
  afirmar_sin_llamadas "npm"
  afirmar_sin_llamadas "docker"
  afirmar_sin_llamadas "railway"
}

# (3b) falta una herramienta -> exit 1 con mensaje claro
t_falta_herramienta() {
  nuevo_escenario "old1234"
  rm -f "$ESC/bin/railway"
  if PATH="$ESC/bin:/usr/bin:/bin" command -v railway >/dev/null 2>&1; then
    echo "      (omitida: hay un railway real instalado en /usr/bin)"; return
  fi
  PATH="$ESC/bin:/usr/bin:/bin" bash "$RAIZ/scripts/deploy-frontend.sh" >"$SALIDA" 2>&1
  CODIGO=$?
  afirmar_codigo 1
  afirmar_salida_contiene "no se encontró la herramienta 'railway'"
}

# (3c) valor inválido de SIMULATE_FAILURE
t_simulate_failure_invalido() {
  nuevo_escenario "old1234"
  export SIMULATE_FAILURE="todo"
  ejecutar_deploy
  afirmar_codigo 1
  afirmar_salida_contiene "SIMULATE_FAILURE='todo' no es válido"
}

# (4) segunda ejecución seguida sin cambios no rompe nada ni vuelve a desplegar
t_idempotente() {
  nuevo_escenario "old1234"
  ejecutar_deploy
  afirmar_codigo 0
  ejecutar_deploy
  afirmar_codigo 0
  afirmar_despliegues 1
  afirmar_tag_en_produccion "abc1234"
  afirmar_salida_contiene "ya estaba desplegada y saludable"
}

# (5) falla el rollback -> código de salida propio (4) y mensaje muy visible
t_rollback_falla() {
  nuevo_escenario "old1234"
  export MOCK_UNHEALTHY_TAGS="abc1234" MOCK_RAILWAY_FAIL_TAGS="old1234"
  ejecutar_deploy
  afirmar_codigo 4
  afirmar_salida_contiene "EL ROLLBACK A old1234 TAMBIÉN FALLÓ"
  afirmar_salida_no_contiene "ROLLBACK ejecutado a"
}

# (6) primer despliegue (no hay versión previa) funciona y lo dice claro
t_primer_despliegue() {
  nuevo_escenario ""
  ejecutar_deploy
  afirmar_codigo 0
  afirmar_tag_en_produccion "abc1234"
  afirmar_salida_contiene "No hay versión previa desplegada (primer despliegue)"
}

# (6b) primer despliegue que falla: no hay a qué volver y se dice claro (código 3)
t_primer_despliegue_falla() {
  nuevo_escenario ""
  export MOCK_UNHEALTHY_TAGS="abc1234"
  ejecutar_deploy
  afirmar_codigo 3
  afirmar_distinto_de_cero
  afirmar_salida_contiene "NO HAY ROLLBACK POSIBLE"
}

# (7) si fallan las pruebas no se construye ni se despliega nada
t_fallan_las_pruebas() {
  nuevo_escenario "old1234"
  export MOCK_NPM_EXIT=1
  ejecutar_deploy
  afirmar_codigo 1
  afirmar_salida_contiene 'falló el paso "2/7'
  afirmar_sin_llamadas "docker"
  afirmar_despliegues 0
  afirmar_tag_en_produccion "old1234"
}

# (8) si no se puede publicar la imagen se aborta antes de tocar producción
t_falla_el_push() {
  nuevo_escenario "old1234"
  export MOCK_DOCKER_PUSH_FAIL=1
  ejecutar_deploy
  afirmar_codigo 1
  afirmar_salida_contiene 'falló el paso "3/7'
  afirmar_despliegues 0
  afirmar_tag_en_produccion "old1234"
}

# (9) el token nunca aparece en los logs
t_no_filtra_secretos() {
  nuevo_escenario "old1234"
  ejecutar_deploy
  afirmar_salida_no_contiene "token-de-prueba"
}

# (10) con un token de cuenta (RAILWAY_API_TOKEN) el despliegue apunta al proyecto y al entorno indicados
t_token_de_cuenta() {
  nuevo_escenario "old1234"
  unset RAILWAY_TOKEN
  export RAILWAY_API_TOKEN="api-token-de-prueba" RAILWAY_PROJECT="proyecto-123" RAILWAY_ENVIRONMENT="production"
  ejecutar_deploy
  afirmar_codigo 0
  afirmar_tag_en_produccion "abc1234"
  grep -q "^railway up .*--project proyecto-123" "$ESC/state/calls.log" || fallo "railway up no recibió --project"
  grep -q "^railway up .*--environment production" "$ESC/state/calls.log" || fallo "railway up no recibió --environment"
  afirmar_salida_no_contiene "api-token-de-prueba"
}

# (10b) con un token de cuenta, si falta el proyecto -> exit 1 con mensaje claro y sin tocar nada
t_token_de_cuenta_sin_proyecto() {
  nuevo_escenario "old1234"
  unset RAILWAY_TOKEN
  export RAILWAY_API_TOKEN="api-token-de-prueba" RAILWAY_ENVIRONMENT="production"
  ejecutar_deploy
  afirmar_codigo 1
  afirmar_salida_contiene "con RAILWAY_API_TOKEN hace falta también la variable de entorno RAILWAY_PROJECT"
  afirmar_sin_llamadas "docker"
  afirmar_sin_llamadas "railway"
}

# (10c) con el token de proyecto no se manda --project (el token ya sabe cuál es)
t_token_de_proyecto_sin_project() {
  nuevo_escenario "old1234"
  ejecutar_deploy
  afirmar_codigo 0
  ! grep -q -e "--project" "$ESC/state/calls.log" || fallo "con RAILWAY_TOKEN no debía mandarse --project"
}

# Ejecución de todas las pruebas
PATH_ORIGINAL="$PATH"
echo "== Pruebas de deploy-frontend.sh =="
prueba "(1) despliegue exitoso termina en 0 y etiqueta con el SHA" t_exito
prueba "(2) health falla -> rollback al tag previo y exit != 0" t_rollback_por_health
prueba "(2b) SIMULATE_FAILURE=health dispara el rollback" t_rollback_por_falla_simulada
prueba "(2c) falla el comando de despliegue -> rollback" t_rollback_si_falla_el_comando_de_despliegue
prueba "(2d) la versión nueva no toma el tráfico -> rollback" t_rollback_si_la_version_no_cambia
prueba "(3) falta una variable -> exit 1 con mensaje claro" t_falta_variable
prueba "(3b) falta una herramienta -> exit 1 con mensaje claro" t_falta_herramienta
prueba "(3c) SIMULATE_FAILURE inválido -> exit 1" t_simulate_failure_invalido
prueba "(4) segunda ejecución seguida no rompe ni redespliega" t_idempotente
prueba "(5) falla el rollback -> código de salida propio (4)" t_rollback_falla
prueba "(6) primer despliegue sin versión previa" t_primer_despliegue
prueba "(6b) primer despliegue fallido -> código 3, sin rollback posible" t_primer_despliegue_falla
prueba "(7) fallan las pruebas -> no se construye ni se despliega" t_fallan_las_pruebas
prueba "(8) falla el push de la imagen -> no se toca producción" t_falla_el_push
prueba "(9) el token no se imprime en los logs" t_no_filtra_secretos
prueba "(10) token de cuenta: despliega con --project y --environment" t_token_de_cuenta
prueba "(10b) token de cuenta sin proyecto -> exit 1 con mensaje claro" t_token_de_cuenta_sin_proyecto
prueba "(10c) token de proyecto: no manda --project" t_token_de_proyecto_sin_project

echo
echo "== Resultado: $PASARON pasaron, $FALLARON fallaron =="
if [ "$FALLARON" -ne 0 ]; then
  printf ' - %s\n' "${FALLIDAS[@]}"
  exit 1
fi
