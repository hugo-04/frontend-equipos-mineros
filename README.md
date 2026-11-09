# Registro de equipos mineros — Frontend

Aplicación web (Next.js, App Router) para registrar equipos mineros, ver cuáles **requieren mantenimiento** según su horómetro y
llevar el historial de mantenimientos. Consume el backend REST [`BACKEND`](../BACKEND) (Spring Boot, JWT).

## Qué hace

| Pantalla        | Descripción                                                                                                                                                                                        |
| --------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/login`        | Usuario y contraseña, validados con Zod; estado de carga; errores claros y genéricos                                                                                                               |
| `/equipos`      | Tabla (tarjetas en móvil) con código, tipo, horómetro y **estado**. Búsqueda por código y filtros por tipo y estado. Crear, editar, ver detalle y eliminar (con confirmación que nombra el equipo) |
| `/equipos/[id]` | Datos del equipo, estado, botón **Registrar mantenimiento** (notas opcionales) e historial paginado                                                                                                |

Skeletons con la forma real del contenido, estados vacíos útiles, 404 amigable, `error.tsx` y `global-error.tsx`, modo claro/oscuro y
animaciones sutiles con Motion que respetan `prefers-reduced-motion`.

## Arquitectura

Modular por funcionalidad. Flujo de dependencias: `app` → `features` → `shared`. Una feature no importa de otra salvo por su
`index.ts` público (ArchUnit-style, se cumple por convención y revisión). Los componentes **nunca llaman a `fetch`** (regla de ESLint):
lo hace la capa `api/`.

```
src/
├── app/                          # SOLO rutas, layouts y route handlers
│   ├── (auth)/login/             # página de login
│   ├── (protected)/              # layout que valida la sesión en el servidor
│   │   └── equipos/ , equipos/[id]/ (+ loading.tsx)
│   ├── api/
│   │   ├── auth/login|logout|sesion-invalida/route.ts
│   │   ├── proxy/[...path]/route.ts    # reenvía al backend adjuntando el token
│   │   └── health/route.ts
│   └── layout.tsx, not-found.tsx, error.tsx, global-error.tsx
├── features/
│   ├── auth/ · equipos/ · mantenimientos/ · tipos/    # { api/, types/, schemas/, hooks/, components/ }
├── shared/
│   ├── api/        # cliente HTTP, ApiError, classifyError, handleMutationError
│   ├── server/     # solo servidor: sesión, llamada al backend, lista blanca, Origin, límite de login, logger, CSP
│   ├── types/      # api.generated.ts (openapi-typescript) y tipos globales
│   ├── components/ # ui/ (estilo shadcn sobre Radix), ConfirmDialog, PageHeader, EmptyState, ErrorPanel…
│   ├── lib/ · schemas/ · providers/
└── proxy.ts                      # convención de Next.js 16 (reemplaza a middleware.ts)
```

- **Tipos y contrato (contract-first):** `npm run types:api` genera `src/shared/types/api.generated.ts` desde
  [`openapi/openapi.yaml`](openapi/openapi.yaml) (copia del contrato del backend; hay que re-copiarla si el backend cambia).
  Las **respuestas del API se validan con Zod** en la capa `api/`; lo que no cumpla el contrato se trata como error del sistema.
- **TanStack Query** para todas las consultas y escrituras. Claves centralizadas (`equipoKeys.list()`, `.detail(id)`,
  `.mantenimientos(id)`); `retry` solo ante red caída o 5xx (nunca 4xx); al registrar un mantenimiento se invalidan detalle, historial y lista.
- **Zod + React Hook Form** (`zodResolver`): un esquema por formulario alineado con el contrato del backend
  (`codigo` 3–30 `[A-Za-z0-9-]`, `tipoId` entero > 0, `horometro` 0–999999.9 con un decimal, `notas` ≤ 500). Al editar, el horómetro
  no puede bajar del valor actual. Eliminar y registrar mantenimiento también validan sus parámetros con Zod antes de llamar al API.

## Cómo levantarlo en local

Requisitos: Node `>=24` (ver `.nvmrc`) y el backend corriendo.

```bash
npm ci
cp .env.example .env.local      # BACKEND_URL=http://localhost:8080
npm run dev                     # http://localhost:3000
```

Backend: en `../BACKEND`, `cp .env.example .env`, rellena los secretos (ver su README) y `docker compose up --build`
(para el navegador no hace falta CORS: solo habla con `/api/*` del mismo origen).
Sin backend a mano: `node scripts/backend-simulado.mjs` levanta uno **simulado** (usuario `admin`, clave `admin-simulado-123`) con la
misma forma del contrato; sirve para desarrollar y para el escaneo ZAP del CI.

### Variables de entorno

| Variable      | Descripción                                                                                                      |
| ------------- | ---------------------------------------------------------------------------------------------------------------- |
| `BACKEND_URL` | URL base del backend (sin `/` final). **Solo de servidor**: sin prefijo `NEXT_PUBLIC_`, el navegador nunca la ve |

## Autenticación por cookie (BFF)

El token JWT **nunca llega al JavaScript del navegador** y no se guarda en `localStorage`/`sessionStorage`.

1. `POST /api/auth/login` recibe usuario/contraseña, llama a `POST {BACKEND_URL}/auth/login` y guarda el JWT en una cookie
   **`httpOnly`, `Secure` (en producción), `SameSite=Lax`, `Path=/`** (en producción con prefijo `__Host-`), con `Max-Age` que nunca supera la
   vida del token. Al navegador solo responde `{ ok: true, usuario: { username, rol } }`.
2. `/api/proxy/[...path]` lee la cookie, reenvía a `BACKEND_URL` con `Authorization: Bearer …` y devuelve estado y cuerpo tal cual (incluido el
   `ErrorResponse`). Si el backend responde 401 borra la cookie. Solo reenvía rutas de una **lista blanca** (método + patrón), descarta
   cualquier parámetro que no sea `page`/`size`, **nunca reenvía las cookies del navegador**, y en POST/PUT/DELETE exige que `Origin`
   coincida con el host de la app. Tiene timeout (10 s) y límite de cuerpo (16 KB).
3. **Doble defensa de rutas:** `proxy.ts` redirige a `/login?from=<ruta>` si no hay cookie vigente, y el layout `(protected)` **valida la sesión contra el
   backend en cada render** (si el backend no responde o rechaza el token, redirige a `/api/auth/sesion-invalida`, que borra la cookie y manda al login:
   falla cerrado y sin bucles).
4. Un usuario autenticado que entra a `/login` va a `/equipos`. Sesión vencida en una consulta → se limpia el caché de Query, toast "Tu sesión
   expiró" y redirección al login. `POST /api/auth/logout` borra la cookie y el cliente limpia el caché.

## Manejo de errores

`ApiError` (`status`, `code`, `message`, `details`, `traceId`) y `classifyError(error)` → `validation | unauthorized | forbidden | notFound | conflict |
rateLimited | system | network`. **Un solo lugar** (`handleMutationError`) traduce a notificaciones; lo usan los `onError` de todas las mutaciones:

| Caso                               | Comportamiento                                                                                                                                                    |
| ---------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 400/422                            | `details[].field` → `setError` en el campo; toast de advertencia "Revisa los campos marcados" (si el campo no existe en el formulario, el mensaje va en el toast) |
| 409                                | marca el campo (por ejemplo `codigo`) y toast con el mensaje del backend                                                                                          |
| 404                                | toast informativo y refresca la lista                                                                                                                             |
| 401                                | sesión vencida: ver arriba                                                                                                                                        |
| 403                                | "No tienes permiso para esta acción"                                                                                                                              |
| 429                                | "Demasiados intentos…" con el `Retry-After`                                                                                                                       |
| 5xx, red caída, respuesta inválida | mensaje amable y genérico, **sin trazas ni detalles técnicos**, con el "Código de error" (`traceId`, si viene) y botón Reintentar                                 |

El contrato del backend entrega `details[].reason` (el prompt decía `message`): se aceptan ambos. `traceId` es opcional.

## Pruebas

```bash
npm run lint && npm run typecheck && npm run test && npm run build
```

**167 pruebas** (Vitest + Testing Library): esquemas Zod (casos válidos e inválidos), `classifyError` y mapeo de `details`, componentes
(formulario de equipo con errores accesibles, 409 en el campo, error de sistema sin detalles, badge de estado, diálogo de confirmación)
y la **seguridad**: `from` del login (`//evil.com`, `https://…`, `/\evil`, `%0d%0a`), lista blanca del proxy (`..`, `%2e%2e`, esquemas y hosts externos,
rutas fuera de la lista), que el token **jamás** salga en el cuerpo del login ni del proxy, que se borre la cookie en 401, que se rechacen
escrituras con `Origin` ajeno, el límite de login (429), el backend caído (falla cerrado sin filtrar el error), `proxy.ts` (redirecciones, nonce distinto
por petición) y las cabeceras de seguridad.

## OWASP Top 10:2025 → qué se hizo

| Categoría                         | Qué se hizo                                                                                                                                                                                                                                                                                                           |
| --------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **A01 Control de acceso roto**    | Protección real en el servidor: `proxy.ts` + validación de sesión en el layout + proxy con cookie. `from` solo acepta rutas internas. Proxy con **lista blanca** (método+ruta), normalización y rechazo de `..`, `//`, `\`, `%`, esquemas y hosts del usuario; solo habla con `BACKEND_URL` (sin SSRF)                |
| **A02 Configuración incorrecta**  | **CSP con nonce** por petición (`script-src` sin `unsafe-inline` ni `unsafe-eval` en producción), HSTS, `nosniff`, `Referrer-Policy`, `Permissions-Policy`, `frame-ancestors 'none'` y `X-Frame-Options`. `poweredByHeader: false`, `productionBrowserSourceMaps: false`. Ninguna variable secreta con `NEXT_PUBLIC_` |
| **A03 Cadena de suministro**      | `package-lock.json` versionado, `npm ci` en CI, `npm audit --audit-level=high` que falla el build, Dependabot, pocas dependencias, sin scripts de CDN, acciones fijadas por SHA con `permissions` mínimos, gitleaks y CodeQL                                                                                          |
| **A04 Fallos criptográficos**     | Solo HTTPS en producción (HSTS, `upgrade-insecure-requests`, cookie `Secure` y `__Host-`); nada sensible en `localStorage`, `sessionStorage` ni en la URL; el token nunca se imprime                                                                                                                                  |
| **A05 Inyección y XSS**           | Sin `dangerouslySetInnerHTML` ni `eval` (reglas de ESLint en error); notas y códigos se renderizan como texto; `encodeURIComponent` en las URLs; Zod en entrada y salida; la CSP como segunda barrera                                                                                                                 |
| **A06 Diseño inseguro**           | Confirmación en acciones destructivas; **límite de intentos de login por IP en el route handler** (además del 429 del backend); límite de tamaño y timeout en el proxy; las reglas críticas las valida también el backend                                                                                             |
| **A07 Fallas de autenticación**   | Cookie `httpOnly` + `Secure` + `SameSite=Lax` con expiración acorde al token; mensaje de login genérico; logout que borra la cookie y limpia el caché; **CSRF**: `SameSite` + verificación de `Origin` en toda escritura; sesión vencida → login                                                                      |
| **A08 Integridad**                | Respuestas validadas con Zod antes de usarse; sin carga dinámica de código de terceros; build reproducible con lockfile; despliegue con `scripts/deploy-frontend.sh`, que corre las pruebas antes de publicar y verifica la versión desplegada                                                                        |
| **A09 Registro y alertas**        | Los route handlers registran en el servidor los fallos de login, 401/403 y 5xx **sin credenciales ni tokens** (`[seguridad] …`); el `traceId` del backend se muestra al usuario en los errores del sistema                                                                                                            |
| **A10 Condiciones excepcionales** | `error.tsx`, `not-found.tsx`, `global-error.tsx`; **falla cerrado** (si no se puede validar la sesión, es no autenticado); `AbortController` con timeout en toda llamada al backend; nunca se muestran errores crudos; red caída y respuestas inválidas con manejo explícito                                          |

Las respuestas autenticadas y del proxy llevan `Cache-Control: no-store`, y las llamadas del servidor usan `cache: 'no-store'`.

## CI/CD

[`ci.yml`](.github/workflows/ci.yml), en cada push/PR: lint, tipos, pruebas, build y `npm audit --audit-level=high`; **gitleaks**; **CodeQL**
(en repos privados necesita GitHub Advanced Security; se apaga con la variable `CODEQL_HABILITADO=false`); y **OWASP ZAP baseline** contra la app levantada con el
backend simulado (`scripts/backend-simulado.mjs`; avisos aceptados, con motivo, en [`.zap/rules.tsv`](.zap/rules.tsv)). Acciones fijadas por SHA; Dependabot las mantiene.

## Despliegue (Railway)

Backend, MySQL y frontend se despliegan en **Railway**. El frontend usa el mismo mecanismo que el `deploy.sh` del backend: se construye una
imagen con el [`Dockerfile`](Dockerfile) (Node de `.nvmrc`, salida `standalone` de Next, usuario sin root), se publica en GHCR con el **SHA corto del commit** como tag y
Railway la despliega. Desplegar y hacer rollback son la misma operación con otro tag.

1. En Railway crea un servicio para el frontend y define su variable `BACKEND_URL` con la URL del backend (por ejemplo la interna de Railway). Es solo del servidor: se lee al arrancar, no al construir.
2. Exporta `RAILWAY_TOKEN` (o, con un token de cuenta o de workspace, `RAILWAY_API_TOKEN` junto con `RAILWAY_PROJECT` y `RAILWAY_ENVIRONMENT`), `RAILWAY_SERVICE`, `APP_URL` (URL pública del frontend) y `REGISTRY_IMAGE` (por ejemplo `ghcr.io/mi-org/equipos-mineros-frontend`). Hay que haber iniciado sesión en GHCR (`docker login ghcr.io`) y la imagen debe poder descargarla Railway (paquete público, como el del backend).
3. `./scripts/deploy-frontend.sh`: verifica herramientas y variables, `npm ci` + lint/tipos/pruebas, construye y publica la imagen, anota la versión que corre ahora
   (la lee de `APP_URL/api/health`), despliega en Railway y **verifica `/api/health` con reintentos y que responda la versión nueva**. Si falla el despliegue o la verificación, redesplega la versión anterior.
   Se puede ejecutar varias veces seguidas: si esa versión ya está arriba y sana, no hace nada.

Códigos de salida (los mismos que el backend): `0` salió bien · `1` falló antes de tocar producción · `2` falló y el rollback funcionó · `3` falló y no había versión anterior a la que volver · `4` falló el despliegue y el rollback también.
`SIMULATE_FAILURE=health` hace fallar la verificación a propósito para demostrar el rollback, y `OMITIR_PRUEBAS=1` se salta lint, tipos y pruebas si el CI ya las corrió.
Las pruebas del script, con Railway y las demás herramientas simuladas, están en [`scripts/test/deploy_frontend_test.sh`](scripts/test/deploy_frontend_test.sh) y corren en el CI.

**Despliegue automático con GitHub Actions:** [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml) corre en cada push a `main` (y a mano desde *Actions → Deploy → Run workflow*, con `simulate_failure` para demostrar el rollback). Primero lint, tipos, pruebas, build y las pruebas del script; después ejecuta `./scripts/deploy-frontend.sh` con `OMITIR_PRUEBAS=1`. Inicia sesión en GHCR con el `GITHUB_TOKEN` de la corrida y la imagen sale de `ghcr.io/<usuario>/<repo>`. Solo hay que cargar en *Settings → Secrets and variables → Actions* `RAILWAY_API_TOKEN` (token de cuenta o de workspace), `RAILWAY_PROJECT` (id del proyecto), `RAILWAY_SERVICE` y `APP_URL`; el entorno `production` ya va fijo en el workflow. Con un token de proyecto bastan `RAILWAY_TOKEN`, `RAILWAY_SERVICE` y `APP_URL`. Si el despliegue hace rollback, el paso termina en rojo.

**Orden de despliegue con el backend:** el `PUT /equipos/{id}` del backend ya no acepta `tipoId` (solo `codigo` y `horometro`), así que este frontend y el backend
nuevo van juntos. Se despliega **primero el backend** (`./deploy.sh`) y enseguida este frontend (`./scripts/deploy-frontend.sh`); en el rato que el frontend viejo siga
arriba con el backend nuevo, editar un equipo falla con `400`.

## Versiones instaladas (verificadas con `npm view`)

Next.js 16.4.5 · React / React DOM 19.3.1 · TypeScript 5.9.3 · Zod 4.6.7 · React Hook Form 7.91.0 · @hookform/resolvers 7.0.3 · TanStack Query 5.107.1 ·
Sonner 2.0.8 · Tailwind CSS 4.3.5 · Motion 14.10.1 · lucide-react 1.70.0 · next-themes 0.4.6 · openapi-typescript 7.13.0 · Vitest 5.1.0 ·
Testing Library React 16.3.3 · ESLint 9.39.5 · Prettier 3.9.10.

## Decisiones y supuestos

- **TypeScript 5.9.3, no 7.x.** `openapi-typescript` 7.13 declara `peerDependencies: typescript ^5`, y se prefirió una combinación compatible a forzar el peer. Se pasará a 7 cuando el generador lo soporte.
- **Node `>=24` (`.nvmrc` = 24).** Es la versión instalada y con la que se probó todo. La _Active LTS_ más reciente es la 26; no estaba disponible en este entorno y no se pudo validar el build con ella, así que se dejó la 24 (LTS, soportada). Al pasar a 26 basta cambiar `.nvmrc` (lo lee el CI), la imagen base del `Dockerfile` y `engines`.
- **Next.js 16: `proxy.ts` en lugar de `middleware.ts`**, APIs asíncronas (`cookies()`, `headers()`, `params`, `searchParams`) y Turbopack por defecto.
- **Componentes de UI escritos a mano al estilo shadcn/ui** (Radix + `class-variance-authority`, sin la CLI interactiva), con tokens de color como variables CSS (ámbar sobre pizarra/zinc, modo claro/oscuro, contraste AA).
- **Los listados se piden completos al backend** (todas las páginas de hasta 100, con tope de 50) porque la búsqueda y los filtros de equipos son en el cliente, como pide el enunciado; la tabla pagina en el cliente (10 por página). El **historial de mantenimientos sí usa la paginación del backend**.
- **`style-src` conserva `'unsafe-inline'`.** Sonner, Motion y Next inyectan estilos en línea; el riesgo es bajo y los scripts sí van con nonce y sin `unsafe-inline`. Está registrado como aviso aceptado en ZAP.
- **La CSP con nonce vuelve dinámicas todas las páginas** (no hay generación estática): es el costo esperado de esa protección y aquí no hay contenido público que cachear.
- **Límite de login del frontend en memoria** (por instancia, de mejor esfuerzo): si hubiera varias instancias en Railway, cada una tendría su propio contador; el límite fuerte es el del backend (429).
- **Sesión validada contra el backend en cada render protegido** (`GET /tipos?page=1&size=1`): una llamada extra por navegación a cambio de detectar de inmediato un token revocado o un backend caído. Si no se puede validar, se trata como no autenticado.
- **El ancla del rol:** el rol y el usuario que se muestran salen de los claims del JWT **sin verificar firma** (solo para la interfaz); la autorización real la decide siempre el backend (por ejemplo, `DELETE` solo para `ADMIN` → 403 → toast).
- **Al editar un equipo solo se cambian el código y el horómetro.** El tipo es inmutable (el estado y los mantenimientos dependen de su intervalo): en el formulario se
  muestra de solo lectura con la nota "El tipo no se puede cambiar. Si te equivocaste, elimina el equipo y créalo de nuevo", y nunca viaja en la actualización. Hay dos esquemas de Zod
  (`crearEquipoSchema` y `editarEquipoSchema`), y el de edición pide que el horómetro no sea menor al actual porque es un acumulado que nunca baja.
- **Las horas restantes las calcula el backend**, no el frontend: la tabla muestra `horasRestantes`, y el detalle `horasDesdeUltimoMant` y "Faltan X h para el mantenimiento" (o "Requiere mantenimiento").
  Tras registrar un mantenimiento se refrescan el detalle, el historial y la lista, porque cambian el estado y las horas restantes. Las notas del mantenimiento son opcionales: vacías o solo con espacios no se envían.
- **Las fechas se muestran en hora de Perú** (`America/Lima`, UTC-5 sin horario de verano). La zona va fija a propósito para que el servidor y el navegador muestren lo mismo.
- **`details[].reason`** (contrato real) en lugar de `details[].message` (prompt); se aceptan ambos.
- **Backend corregido antes del frontend** (rama `fix/seguridad-owasp` del backend): pendiente de desplegar con su `deploy.sh`; el frontend funciona con y sin `traceId`, maneja 429 y 413, y consume los listados paginados nuevos.
- **Paginación del backend desde 0** (`page=0` es la primera página, como Spring Data): el frontend la usa así y muestra "Página n+1".
- **Cookie `__Host-` en producción:** exige `Secure`, así que en `http://localhost` con `next start` funciona en Chrome y Firefox (tratan `localhost` como seguro) pero no en Safari; en desarrollo (`npm run dev`) el nombre es `sesion` sin prefijo y funciona en todos.
- **Verificado de punta a punta** contra el backend real (Docker + MySQL): login, redirecciones, listado, creación, duplicado (409) y validación (400) mapeados al formulario, mantenimiento, baja, logout, y en el navegador (login → formulario con validaciones → alta con toast), sin errores de consola, sin token en `localStorage`/`sessionStorage` y sin scripts en línea sin nonce.
- **No ejecutado en este entorno:** ZAP, CodeQL y gitleaks (solo corren en GitHub), y el despliegue real en Railway (requiere credenciales y el servicio creado). Sí se probó: la imagen construida y corriendo contra un backend simulado (health con versión, login, proxy, redirecciones, usuario sin root) y `deploy-frontend.sh` con las herramientas simuladas (15 casos: éxito, rollback, variables faltantes, idempotencia, etc.).

## Uso de IA

Se usó **Claude Code** (Anthropic, modelo **Claude Sonnet 5.5**). Se le enviaron **prompts estructurados** con los requisitos y los **criterios de aceptación** definidos, y con ellos Claude Code:

- **Creó el README.**
- **Creó todo el CI/CD** (workflows de GitHub Actions y script de despliegue con verificación y rollback) y la automatización de las pruebas.
- **Creó las pruebas unitarias** según los criterios de aceptación definidos (esquemas, errores, componentes y seguridad).
