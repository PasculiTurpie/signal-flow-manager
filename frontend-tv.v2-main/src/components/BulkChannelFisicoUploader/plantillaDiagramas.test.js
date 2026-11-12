import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import * as XLSX from "xlsx";

import {
  COLUMNAS_DIAGRAMA,
  CLAVES_DIAGRAMA,
  OBLIGATORIAS_DIAGRAMA,
  HOJA_DIAGRAMAS,
  HOJA_INSTRUCCIONES,
  construirPlantillaDiagramas,
} from "./plantillaDiagramas.js";

const CONTROLADOR = new URL(
  "../../../../backend-tv.v2-main/src/controllers/bulkChannelFisico.controller.js",
  import.meta.url
);
const fuenteControlador = () => readFileSync(CONTROLADOR, "utf8");

describe("columnas de la plantilla vs. controlador del backend", () => {
  test("no hay columnas repetidas", () => {
    assert.equal(new Set(CLAVES_DIAGRAMA).size, CLAVES_DIAGRAMA.length);
  });

  test("las obligatorias coinciden con REQUIRED_FIELDS del controlador", (t) => {
    const fuente = fuenteControlador();
    const bloque = fuente.match(/const REQUIRED_FIELDS = \[([\s\S]*?)\];/);
    if (!bloque) {
      t.skip("el controlador ya no declara REQUIRED_FIELDS como lista literal");
      return;
    }
    const obligatoriasBackend = [...bloque[1].matchAll(/"([^"]+)"/g)].map((m) => m[1]);
    assert.ok(obligatoriasBackend.length > 0);
    assert.deepEqual([...OBLIGATORIAS_DIAGRAMA].sort(), [...obligatoriasBackend].sort());
  });

  test("toda columna que el controlador lee está en la plantilla", () => {
    const fuente = fuenteControlador();
    const leidas = new Set();
    for (const m of fuente.matchAll(/\b(?:row|first)\.([a-zA-Z_ñ0-9]+)/g)) leidas.add(m[1]);
    for (const m of fuente.matchAll(/\b(?:row|first)\["([^"]+)"\]/g)) leidas.add(m[1]);
    assert.ok(leidas.size > 40, "debería detectar las columnas que lee el controlador");
    const faltan = [...leidas].filter((k) => !CLAVES_DIAGRAMA.includes(k));
    assert.deepEqual(faltan, [], `el controlador lee columnas que faltan en la plantilla: ${faltan}`);
  });

  test("toda columna de la plantilla la usa el controlador (salvo 'sitio', que solo se exige)", () => {
    const fuente = fuenteControlador();
    const sinUso = CLAVES_DIAGRAMA.filter(
      (k) => k !== "sitio" && !new RegExp(`(?:row|first)(?:\\.${k}\\b|\\["${k}"\\])`).test(fuente)
    );
    assert.deepEqual(sinUso, []);
  });
});

describe("Excel de la plantilla", () => {
  // Mismo recorrido que el botón: se arma el libro y se serializa como .xlsx
  const buffer = XLSX.write(construirPlantillaDiagramas(XLSX), { type: "buffer", bookType: "xlsx" });
  const wb = XLSX.read(buffer, { type: "buffer" });

  test("hoja Diagramas: solo encabezados, en el orden definido", () => {
    const ws = wb.Sheets[HOJA_DIAGRAMAS];
    assert.ok(ws, `falta la hoja ${HOJA_DIAGRAMAS}`);
    const [encabezados] = XLSX.utils.sheet_to_json(ws, { header: 1 });
    assert.deepEqual(encabezados, CLAVES_DIAGRAMA);
    // sin filas de datos: subir la plantilla sin editar no crea diagramas de mentira
    assert.deepEqual(XLSX.utils.sheet_to_json(ws, { defval: "" }), []);
  });

  test("hoja Instrucciones: una fila por columna con la obligatoriedad correcta", () => {
    const ws = wb.Sheets[HOJA_INSTRUCCIONES];
    assert.ok(ws, `falta la hoja ${HOJA_INSTRUCCIONES}`);
    const filas = XLSX.utils.sheet_to_json(ws, { header: 1 });
    const idx = filas.findIndex((f) => f[0] === "Columna");
    assert.ok(idx >= 0);
    const tabla = filas.slice(idx + 1);
    assert.equal(tabla.length, COLUMNAS_DIAGRAMA.length);
    tabla.forEach((fila, i) => {
      assert.equal(fila[0], COLUMNAS_DIAGRAMA[i].key);
      assert.equal(fila[1], COLUMNAS_DIAGRAMA[i].requerido ? "Sí" : "No");
      assert.ok(String(fila[3]).length > 0, `sin descripción: ${fila[0]}`);
    });
  });
});
