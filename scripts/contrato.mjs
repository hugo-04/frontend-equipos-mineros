#!/usr/bin/env node
// Mantiene al día la copia del contrato del backend (openapi/openapi.yaml), que es de donde salen los tipos del frontend.
//
//   npm run contrato:copiar      copia el contrato del backend y regenera los tipos (src/shared/types/api.generated.ts)
//   npm run contrato:verificar   falla si la copia no es igual a la del backend (no cambia nada)
//
// El backend se busca en ../BACKEND; con otra carpeta, define CONTRATO_BACKEND con la ruta de su openapi.yaml.
import { copyFileSync, existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const aqui = dirname(fileURLToPath(import.meta.url));
const origen = resolve(
  process.env.CONTRATO_BACKEND ??
    resolve(aqui, "../../BACKEND/src/main/resources/openapi/openapi.yaml"),
);
const copia = resolve(aqui, "../openapi/openapi.yaml");
const soloVerificar = process.argv.includes("--verificar");

if (!existsSync(origen)) {
  console.error(`No encuentro el contrato del backend en ${origen}.`);
  console.error("Define CONTRATO_BACKEND con la ruta de su openapi.yaml.");
  process.exit(2);
}

// Se comparan sin fijarse en los saltos de línea, que cambian entre Windows y Linux
const leer = (ruta) => readFileSync(ruta, "utf8").replaceAll("\r\n", "\n");
const iguales = existsSync(copia) && leer(origen) === leer(copia);

if (soloVerificar) {
  if (iguales) {
    console.log("El contrato del frontend es igual al del backend.");
    process.exit(0);
  }
  console.error(
    "El contrato del frontend NO es igual al del backend. Corre: npm run contrato:copiar",
  );
  process.exit(1);
}

if (iguales) {
  console.log("El contrato ya estaba al día.");
} else {
  copyFileSync(origen, copia);
  console.log(`Contrato copiado desde ${origen}`);
}
