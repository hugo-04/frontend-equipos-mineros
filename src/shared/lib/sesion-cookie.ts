// El nombre de la cookie de sesión vive en un archivo aparte, sin código de servidor, para que lo pueda importar proxy.ts
export const COOKIE_SESION = process.env.NODE_ENV === "production" ? "__Host-sesion" : "sesion";
