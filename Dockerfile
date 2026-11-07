# syntax=docker/dockerfile:1

# La imagen base va fijada por digest, que no cambia nunca; cuando sale una nueva, Dependabot propone actualizarla.
# Es la misma versión de Node de .nvmrc (24).
ARG NODE_IMAGE=node:24-alpine@sha256:a34ab6d7f6f4813f4d0c5469d74685604b962fbdbf5793a7bc7b4998ecb867c8

# Etapa 1: instalar dependencias exactamente como dice el lockfile
FROM ${NODE_IMAGE} AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# Etapa 2: construir. next build pide BACKEND_URL solo para compilar; la URL real se lee en runtime desde Railway.
FROM ${NODE_IMAGE} AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1 BACKEND_URL=http://localhost:8080
RUN npm run build

# Etapa 3: ejecutar solo lo necesario (salida standalone de Next), sin root
FROM ${NODE_IMAGE} AS runtime
WORKDIR /app

# El tag de la imagen (el SHA corto del commit). El /api/health lo devuelve y deploy-frontend.sh lo usa para
# saber qué versión quedó corriendo.
ARG APP_VERSION=dev
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 APP_VERSION=${APP_VERSION} HOSTNAME=0.0.0.0 PORT=3000

RUN addgroup -S app && adduser -S app -G app
COPY --from=build --chown=app:app /app/.next/standalone ./
COPY --from=build --chown=app:app /app/.next/static ./.next/static

USER app
EXPOSE 3000

# Si el /api/health no responde, wget falla y el contenedor queda como "unhealthy"
HEALTHCHECK --interval=15s --timeout=5s --start-period=30s --retries=3 \
    CMD wget -q -O /dev/null "http://127.0.0.1:${PORT}/api/health" || exit 1

# Railway pone su propio PORT; server.js lo lee
CMD ["node", "server.js"]
