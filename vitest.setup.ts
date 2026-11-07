import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

// Se limpia lo que haya quedado montado para que una prueba no contamine a la siguiente
afterEach(() => cleanup());
