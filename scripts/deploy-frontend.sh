#!/usr/bin/env bash
# Despliega el frontend en Vercel. Pensado para que el deploy.sh principal lo invoque, o para correrlo solo.
#
#   VERCEL_TOKEN=... VERCEL_ORG_ID=... VERCEL_PROJECT_ID=... APP_URL=https://mi-app.vercel.app ./scripts/deploy-frontend.sh
#
# Variables obligatorias:
#   VERCEL_TOKEN, VERCEL_ORG_ID, VERCEL_PROJECT_ID  credenciales del proyecto de Vercel (nunca se imprimen)
#   APP_URL                                         URL pública del frontend, para verificar el despliegue
# Variables opcionales:
#   HEALTH_RETRIES (por defecto 12) y HEALTH_INTERVAL en segundos (por defecto 5)
#   OMITIR_PRUEBAS=1  omite lint/typecheck/test (solo si CI ya los corrió)
#   SIMULATE_FAILURE=health  simula que la verificación falla, para demostrar el rollback
#
# Códigos de salida: 0 ok · 1 falta una herramienta o variable · 2 falló el despliegue y se hizo rollback
#                    3 falló la verificación y no había a qué volver / el rollback también falló · 4 falló la construcción
# Se puede ejecutar varias veces seguidas: cada ejecución construye y publica una versión nueva sin romper la anterior.
set -euo pipefail

VERCEL_CLI_VERSION="${VERCEL_CLI_VERSION:-65.12.1}"
HEALTH_RETRIES="${HEALTH_RETRIES:-12}"
HEALTH_INTERVAL="${HEALTH_INTERVAL:-5}"

paso() { printf '\n==> %s\n' "$*"; }
falla() { printf 'ERROR: %s\n' "$*" >&2; }
vercel() { npx --yes "vercel@${VERCEL_CLI_VERSION}" "$@" --token "$VERCEL_TOKEN"; }

cd "$(dirname "$0")/.."

paso "PASO 1/6 Verificando herramientas y variables"
for herramienta in node npm npx curl; do
  command -v "$herramienta" >/dev/null 2>&1 || { falla "falta la herramienta '$herramienta'"; exit 1; }
done
faltan=()
for variable in VERCEL_TOKEN VERCEL_ORG_ID VERCEL_PROJECT_ID APP_URL; do
  [ -n "${!variable:-}" ] || faltan+=("$variable")
done
if [ "${#faltan[@]}" -gt 0 ]; then
  falla "faltan variables de entorno: ${faltan[*]}"
  exit 1
fi
case "$APP_URL" in https://*) ;; *) falla "APP_URL debe empezar con https://"; exit 1 ;; esac
APP_URL="${APP_URL%/}"
export VERCEL_ORG_ID VERCEL_PROJECT_ID

paso "PASO 2/6 Instalando dependencias desde el lockfile y comprobando calidad"
npm ci
if [ "${OMITIR_PRUEBAS:-0}" != "1" ]; then
  npm run lint && npm run typecheck && npm run test || { falla "lint, tipos o pruebas fallaron"; exit 4; }
fi

paso "PASO 3/6 Comprobando que BACKEND_URL está configurada en Vercel (solo servidor)"
if ! vercel env ls production 2>/dev/null | grep -q "BACKEND_URL"; then
  falla "BACKEND_URL no está definida en el entorno 'production' del proyecto de Vercel (vercel env add BACKEND_URL production)"
  exit 1
fi

paso "PASO 4/6 Construyendo"
vercel pull --yes --environment=production >/dev/null || { falla "no se pudo traer la configuración del proyecto"; exit 4; }
vercel build --prod >/dev/null || { falla "la construcción falló"; exit 4; }

paso "PASO 5/6 Publicando en producción"
if ! URL_DESPLIEGUE="$(vercel deploy --prebuilt --prod)"; then
  falla "el comando de despliegue falló; la versión anterior sigue sirviendo"
  exit 2
fi
echo "     Despliegue: $URL_DESPLIEGUE"

paso "PASO 6/6 Verificando la URL pública y /api/health"
verificar() {
  local base="$1" intento codigo
  if [ "${SIMULATE_FAILURE:-}" = "health" ]; then base="$base/__fallo_simulado__"; echo "     SIMULATE_FAILURE=health: verificando una URL inexistente"; fi
  for intento in $(seq 1 "$HEALTH_RETRIES"); do
    codigo="$(curl -s -o /dev/null -w '%{http_code}' --max-time 10 "$base/api/health" || true)"
    if [ "$codigo" = "200" ] && [ "$(curl -s -o /dev/null -w '%{http_code}' --max-time 10 "$base/login" || true)" = "200" ]; then
      echo "     Intento $intento/$HEALTH_RETRIES: /api/health y /login responden 200"
      return 0
    fi
    echo "     Intento $intento/$HEALTH_RETRIES: http=$codigo"
    sleep "$HEALTH_INTERVAL"
  done
  return 1
}

if verificar "$APP_URL"; then
  echo "DESPLIEGUE OK: $APP_URL"
  exit 0
fi

paso "ROLLBACK: la nueva versión no pasó la verificación"
if vercel rollback --yes >/dev/null 2>&1 && SIMULATE_FAILURE= verificar "$APP_URL"; then
  echo "ROLLBACK ejecutado: la versión anterior vuelve a servir en $APP_URL"
  exit 2
fi
falla "el rollback no pudo completarse: revisa Vercel manualmente (Deployments -> Instant Rollback)"
exit 3
