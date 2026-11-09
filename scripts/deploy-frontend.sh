#!/usr/bin/env bash
# deploy-frontend.sh: despliega el frontend en Railway, comprueba que quedó sano y, si no, vuelve a la versión anterior.
#
# Es la única lógica de despliegue. GitHub Actions solo prepara el entorno y ejecuta este mismo script
# (también se puede correr a mano: ./scripts/deploy-frontend.sh). Es el mismo mecanismo que el deploy.sh del backend.
#
# Qué hace, en orden:
#   1. Revisa que estén las herramientas y las variables de entorno.
#   2. Instala desde el lockfile (npm ci) y corre lint, typecheck y pruebas (se salta con OMITIR_PRUEBAS=1).
#   3. Construye la imagen y la sube con el SHA corto del commit como tag.
#   4. Anota qué versión está corriendo ahora, por si hay que volver a ella.
#   5. Despliega la nueva en Railway. BACKEND_URL no pasa por acá: se configura en las variables del servicio en Railway.
#   6. Consulta /api/health con reintentos y confirma que la versión que responde es la nueva.
#   7. Si falló el 5 o el 6, hace rollback al tag que se anotó en el paso 4.
#
# Códigos de salida:
#   0  salió bien
#   1  falló antes de tocar producción (variables, herramientas, pruebas o build)
#   2  el despliegue falló y el rollback funcionó: producción quedó en la versión anterior
#   3  el despliegue falló y no había versión anterior a la que volver (primer despliegue)
#   4  el despliegue falló y el rollback también: hay que intervenir a mano, ya
#
# Variables obligatorias:
#   RAILWAY_TOKEN     token de proyecto de Railway (obligatoria, salvo que se use RAILWAY_API_TOKEN)
#   RAILWAY_SERVICE   nombre o id del servicio del frontend en Railway
#   APP_URL           URL pública del frontend (ej. https://equipos-web.up.railway.app)
#   REGISTRY_IMAGE    imagen sin tag (ej. ghcr.io/mi-org/equipos-mineros-frontend)
# Variables opcionales:
#   RAILWAY_API_TOKEN    alternativa a RAILWAY_TOKEN: un token de cuenta o de workspace, para cuando la cuenta de
#                        Railway todavía no puede crear tokens de proyecto. Ese token no apunta a un proyecto, así
#                        que con él hay que definir también RAILWAY_PROJECT y RAILWAY_ENVIRONMENT
#   RAILWAY_PROJECT      id del proyecto de Railway (solo se usa con RAILWAY_API_TOKEN)
#   RAILWAY_ENVIRONMENT  entorno de Railway (si no se indica, usa el del token)
#   HEALTH_RETRIES       intentos de /api/health (por defecto 10)
#   HEALTH_INTERVAL      segundos entre intentos (por defecto 5)
#   HEALTH_TIMEOUT       segundos máximos por petición (por defecto 5)
#   PUSH_RETRIES         intentos de docker push antes de dar el paso 3 por fallido (por defecto 3)
#   PUSH_INTERVAL        segundos entre intentos de docker push (por defecto 10)
#   OMITIR_PRUEBAS       con 1 se salta lint, typecheck y pruebas (solo si el CI ya las corrió)
#   DEPLOY_STATE_DIR     carpeta donde se guardan los tags (por defecto .deploy)
#   SIMULATE_FAILURE     con "health" la verificación de la versión nueva falla a propósito,
#                        para demostrar el rollback. Viene apagado.
set -Eeuo pipefail

cd "$(dirname "${BASH_SOURCE[0]}")/.."

# Códigos de salida (los mismos de la lista de arriba)
readonly EXIT_OK=0
readonly EXIT_PRECONDICION=1
readonly EXIT_ROLLBACK_OK=2
readonly EXIT_SIN_PREVIA=3
readonly EXIT_ROLLBACK_FALLO=4

# Valores por defecto; todos se pueden cambiar con variables de entorno
HEALTH_RETRIES="${HEALTH_RETRIES:-10}"
HEALTH_INTERVAL="${HEALTH_INTERVAL:-5}"
HEALTH_TIMEOUT="${HEALTH_TIMEOUT:-5}"
PUSH_RETRIES="${PUSH_RETRIES:-3}"
PUSH_INTERVAL="${PUSH_INTERVAL:-10}"
DEPLOY_STATE_DIR="${DEPLOY_STATE_DIR:-.deploy}"
SIMULATE_FAILURE="${SIMULATE_FAILURE:-}"

PASO_ACTUAL="inicio"
TAG=""
PREVIOUS_TAG=""
HTTP_CODE=""
HTTP_BODY=""

# Para escribir el log con fecha
ahora() { date -u +'%Y-%m-%dT%H:%M:%SZ'; }
log() { printf '[%s] %s\n' "$(ahora)" "$*"; }
paso() {
  PASO_ACTUAL="$1"
  printf '\n[%s] ==> PASO %s\n' "$(ahora)" "$1"
}
error() { printf '[%s] ERROR: %s\n' "$(ahora)" "$*" >&2; }

# Si algo falla sin que lo hayamos previsto, dice qué paso fue y en qué línea. Hasta el paso 5 no se tocó producción.
al_fallar() {
  local codigo=$? linea=$1
  error "falló el paso \"$PASO_ACTUAL\" (línea $linea, código $codigo). No se tocó producción antes del paso 5."
  exit "$EXIT_PRECONDICION"
}
trap 'al_fallar $LINENO' ERR

# Paso 1: revisar que estén las herramientas y las variables
verificar_requisitos() {
  local faltan=0 herramienta variable
  for herramienta in git docker npm railway curl; do
    if ! command -v "$herramienta" >/dev/null 2>&1; then
      error "no se encontró la herramienta '$herramienta' en el PATH. Instálala e intenta de nuevo."
      faltan=1
    fi
  done
  for variable in RAILWAY_SERVICE APP_URL REGISTRY_IMAGE; do
    if [ -z "${!variable:-}" ]; then
      error "falta la variable de entorno $variable (ver el encabezado de deploy-frontend.sh y el README)."
      faltan=1
    fi
  done
  # El token de proyecto (RAILWAY_TOKEN) ya sabe a qué proyecto y entorno apunta. El de cuenta o de workspace
  # (RAILWAY_API_TOKEN) no, así que con ese hay que indicar el proyecto y el entorno.
  if [ -z "${RAILWAY_TOKEN:-}" ] && [ -z "${RAILWAY_API_TOKEN:-}" ]; then
    error "falta la variable de entorno RAILWAY_TOKEN (o RAILWAY_API_TOKEN junto con RAILWAY_PROJECT y RAILWAY_ENVIRONMENT)."
    faltan=1
  fi
  if [ -z "${RAILWAY_TOKEN:-}" ] && [ -n "${RAILWAY_API_TOKEN:-}" ]; then
    for variable in RAILWAY_PROJECT RAILWAY_ENVIRONMENT; do
      if [ -z "${!variable:-}" ]; then
        error "con RAILWAY_API_TOKEN hace falta también la variable de entorno $variable."
        faltan=1
      fi
    done
  fi
  case "$SIMULATE_FAILURE" in
    ""|health) ;;
    *) error "SIMULATE_FAILURE='$SIMULATE_FAILURE' no es válido. Valores permitidos: vacío o 'health'."; faltan=1 ;;
  esac
  [ "$faltan" -eq 0 ] || exit "$EXIT_PRECONDICION"
  APP_URL="${APP_URL%/}"
  log "Herramientas y variables OK (servicio=$RAILWAY_SERVICE, imagen=$REGISTRY_IMAGE)"
}

# Pide una URL y deja el código en HTTP_CODE y el cuerpo en HTTP_BODY ("000" si no hubo respuesta)
http_get() {
  local salida
  salida="$(mktemp)"
  HTTP_CODE="$(curl -sS --max-time "$HEALTH_TIMEOUT" -o "$salida" -w '%{http_code}' "$1" 2>/dev/null)" || HTTP_CODE="000"
  HTTP_BODY="$(cat "$salida" 2>/dev/null || true)"
  rm -f "$salida"
}

version_de() {
  printf '%s' "$1" | sed -n 's/.*"version" *: *"\([^"]*\)".*/\1/p' | head -1
}

# Paso 4: averiguar qué versión está corriendo ahora, leyéndola del /api/health
detectar_version_desplegada() {
  http_get "$APP_URL/api/health"
  local version
  version="$(version_de "$HTTP_BODY")"
  case "$version" in
    ""|dev|local|test) echo "" ;;   # no es un tag de imagen al que se pueda volver
    *) echo "$version" ;;
  esac
}

# Sube la imagen al registro. GHCR a veces rechaza el primer push de un paquete recién creado y acepta el
# siguiente, así que se reintenta antes de dar el paso por fallido.
publicar_imagen() {
  local imagen="$1" intento
  for ((intento = 1; intento <= PUSH_RETRIES; intento++)); do
    docker push "$imagen" && return 0
    error "docker push falló (intento $intento/$PUSH_RETRIES)."
    [ "$intento" -lt "$PUSH_RETRIES" ] && sleep "$PUSH_INTERVAL"
  done
  return 1
}

# El despliegue en Railway. Con su CLI no se elige un tag de imagen directamente, así que se sube una carpeta
# con un Dockerfile de una sola línea (FROM <imagen>:<tag>). Desplegar y hacer rollback son la misma
# operación con otro tag, así que no hay dos caminos que mantener.
desplegar_tag() {
  local tag="$1" carpeta
  carpeta="$(mktemp -d)"
  printf 'FROM %s:%s\n' "$REGISTRY_IMAGE" "$tag" >"$carpeta/Dockerfile"
  log "Desplegando $REGISTRY_IMAGE:$tag en Railway (servicio $RAILWAY_SERVICE)..."
  # --path-as-root: sin esa opción la CLI toma como raíz del archivo el directorio donde se ejecuta y esta carpeta
  # temporal queda fuera de él ("prefix not found"). Con la opción, la carpeta con el Dockerfile es la raíz.
  local args=(up "$carpeta" --path-as-root --service "$RAILWAY_SERVICE" --ci)
  [ -n "${RAILWAY_ENVIRONMENT:-}" ] && args+=(--environment "$RAILWAY_ENVIRONMENT")
  [ -n "${RAILWAY_PROJECT:-}" ] && args+=(--project "$RAILWAY_PROJECT")
  local resultado=0
  railway "${args[@]}" || resultado=$?
  rm -rf "$carpeta"
  return "$resultado"
}

# Para no desplegar dos veces lo mismo: ¿la versión nueva ya está arriba y sana? Una sola consulta, sin reintentos.
ya_desplegada_y_sana() {
  http_get "$APP_URL/api/health"
  [ "$HTTP_CODE" = "200" ] && [ "$(version_de "$HTTP_BODY")" = "$1" ]     && printf '%s' "$HTTP_BODY" | grep -q '"status" *: *"UP"'
}

# Paso 6: consultar /api/health hasta que responda UP con la versión esperada, o hasta que se acaben los intentos.
# Uso: esperar_salud TAG [simulada]
esperar_salud() {
  local esperado="$1" simulada="${2:-}" url intento version estado
  url="$APP_URL/api/health"
  if [ "$simulada" = "simulada" ]; then
    url="$APP_URL/__fallo_simulado__/api/health"
    log "SIMULATE_FAILURE=health: la verificación apunta a $url, que NO existe, para forzar el fallo."
  fi
  for ((intento = 1; intento <= HEALTH_RETRIES; intento++)); do
    http_get "$url"
    version="$(version_de "$HTTP_BODY")"
    estado="$(printf '%s' "$HTTP_BODY" | sed -n 's/.*"status" *: *"\([^"]*\)".*/\1/p' | head -1)"
    log "Health intento $intento/$HEALTH_RETRIES: http=$HTTP_CODE status=${estado:--} version=${version:--} (se espera $esperado)"
    if [ "$HTTP_CODE" = "200" ] && [ "$estado" = "UP" ]; then
      if [ "$version" = "$esperado" ]; then
        log "Health OK: la versión $esperado está arriba y la base de datos responde."
        return 0
      fi
      log "El servicio responde pero con la versión '${version:--}', todavía no la $esperado."
    fi
    [ "$intento" -lt "$HEALTH_RETRIES" ] && sleep "$HEALTH_INTERVAL"
  done
  error "la versión $esperado no quedó saludable tras $HEALTH_RETRIES intentos."
  return 1
}

# Paso 7: volver a la versión anterior. Es el mismo despliegue de siempre, solo que con el tag viejo.
rollback() {
  local motivo="$1"
  trap - ERR
  printf '\n[%s] ==> PASO 7/7 ROLLBACK (motivo: %s)\n' "$(ahora)" "$motivo"
  if [ -z "$PREVIOUS_TAG" ]; then
    error "NO HAY ROLLBACK POSIBLE: era el primer despliegue y no existe una versión previa a la que volver."
    error "El despliegue de $TAG falló. Producción puede estar sin servicio. Revisa los logs de Railway."
    exit "$EXIT_SIN_PREVIA"
  fi
  log "Volviendo a la versión previa $PREVIOUS_TAG..."
  if desplegar_tag "$PREVIOUS_TAG" && esperar_salud "$PREVIOUS_TAG"; then
    printf '\n[%s] ############################################################\n' "$(ahora)"
    printf '[%s] ROLLBACK ejecutado a %s\n' "$(ahora)" "$PREVIOUS_TAG"
    printf '[%s] La versión %s NO quedó en producción (este despliegue se reporta como FALLIDO).\n' "$(ahora)" "$TAG"
    printf '[%s] ############################################################\n' "$(ahora)"
    exit "$EXIT_ROLLBACK_OK"
  fi
  printf '\n[%s] !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!\n' "$(ahora)" >&2
  error "EL ROLLBACK A $PREVIOUS_TAG TAMBIÉN FALLÓ. PRODUCCIÓN PUEDE ESTAR CAÍDA."
  error "Acción manual: redesplegar una versión buena desde el panel de Railway."
  printf '[%s] !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!\n' "$(ahora)" >&2
  exit "$EXIT_ROLLBACK_FALLO"
}

# El flujo completo, paso por paso
main() {
  log "Inicio del despliegue"
  [ "$SIMULATE_FAILURE" = "health" ] &&
    log "ATENCIÓN: SIMULATE_FAILURE=health está activo. El despliegue FALLARÁ A PROPÓSITO para probar el rollback."

  paso "1/7 Verificando herramientas y variables de entorno"
  verificar_requisitos

  paso "2/7 Dependencias, lint, tipos y pruebas"
  npm ci
  if [ "${OMITIR_PRUEBAS:-0}" != "1" ]; then
    npm run lint
    npm run typecheck
    npm run test
  fi
  log "Calidad OK"

  paso "3/7 Construyendo y publicando la imagen"
  TAG="$(git rev-parse --short=7 HEAD)"
  local imagen="$REGISTRY_IMAGE:$TAG"
  log "Tag de esta versión: $TAG (nunca solo 'latest')"
  # Sin --provenance=false Docker agrega a la imagen un manifiesto de atestación y la publica como un índice
  # OCI; GHCR rechaza (denied) ese índice al ponerle la etiqueta. Con esas dos opciones sale un manifiesto simple.
  docker build --provenance=false --sbom=false --build-arg "APP_VERSION=$TAG" -t "$imagen" .
  publicar_imagen "$imagen"
  log "Imagen publicada: $imagen"

  paso "4/7 Guardando la versión actualmente desplegada"
  mkdir -p "$DEPLOY_STATE_DIR"
  PREVIOUS_TAG="$(detectar_version_desplegada)"
  if [ -n "$PREVIOUS_TAG" ]; then
    printf '%s\n' "$PREVIOUS_TAG" >"$DEPLOY_STATE_DIR/previous_tag"
    log "Versión previa guardada para rollback: $PREVIOUS_TAG"
  else
    rm -f "$DEPLOY_STATE_DIR/previous_tag"
    log "No hay versión previa desplegada (primer despliegue): si algo falla NO habrá a qué volver."
  fi

  # Si lo corren dos veces seguidas sin cambios, la segunda no redespliega nada
  if [ -z "$SIMULATE_FAILURE" ] && ya_desplegada_y_sana "$TAG"; then
    paso "5/7 Despliegue omitido: $TAG ya está en producción y sana (el script es idempotente)"
    printf '\n[%s] DESPLIEGUE OK: %s ya estaba desplegada y saludable. Nada que hacer.\n' "$(ahora)" "$TAG"
    exit "$EXIT_OK"
  fi

  paso "5/7 Desplegando $TAG en Railway"
  trap - ERR   # a partir de aquí cualquier fallo se resuelve con rollback, no con "exit 1"
  if ! desplegar_tag "$TAG"; then
    error "el comando de despliegue falló."
    rollback "falló el despliegue de $TAG"
  fi

  paso "6/7 Verificando /api/health y la versión desplegada"
  local modo=""
  [ "$SIMULATE_FAILURE" = "health" ] && modo="simulada"
  if ! esperar_salud "$TAG" "$modo"; then
    rollback "la versión $TAG no pasó la verificación de salud"
  fi

  printf '\n[%s] DESPLIEGUE OK: %s está en producción y saludable (previa: %s).\n' \
    "$(ahora)" "$TAG" "${PREVIOUS_TAG:-ninguna}"
  exit "$EXIT_OK"
}

main "$@"
