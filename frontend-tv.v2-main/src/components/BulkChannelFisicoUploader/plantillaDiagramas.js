// Plantilla de la carga masiva de diagramas (hoja "Diagramas").
//
// Las columnas son las que lee backend-tv.v2-main/src/controllers/
// bulkChannelFisico.controller.js. Si el controlador pasa a leer una columna
// nueva (o cambia las obligatorias), actualiza esta lista: el test
// plantillaDiagramas.test.js compara ambos y falla si se desfasan.
//
// Cada fila del Excel es una RAMA. Filas con el mismo (nombre_señal, region)
// forman UN diagrama; cada fila adicional agrega otra rama de color distinto.

export const HOJA_DIAGRAMAS = "Diagramas";
export const HOJA_INSTRUCCIONES = "Instrucciones";
export const NOMBRE_ARCHIVO_PLANTILLA = "carga_masiva_diagramas.xlsx";

const col = (key, requerido, etapa, descripcion, ejemplo) => ({
  key,
  requerido,
  etapa,
  descripcion,
  ejemplo,
});

// Las 4 etapas intermedias (DCM, Encoder, DCM VMX, RTES) comparten la misma
// estructura de switch / puerto / port id; solo cambia el prefijo.
const etapa = (nombre, prefijo, ej) => [
  col(`switch_${prefijo}_in`, true, nombre, `Switch por el que ENTRA a ${nombre} (se crea si no existe).`, ej.switchIn),
  col(`puerto_${prefijo}_in`, false, nombre, `Puerto del switch de entrada de ${nombre}.`, ej.portIn),
  col(`portid_${prefijo}_in`, false, nombre, `Port ID / interfaz de entrada de ${nombre}.`, "P1"),
  col(`switch_${prefijo}_out`, true, nombre, `Switch por el que SALE de ${nombre} (puede ser el mismo de entrada).`, ej.switchOut),
  col(`puerto_${prefijo}_out`, false, nombre, `Puerto del switch de salida de ${nombre}.`, ej.portOut),
  col(`portid_${prefijo}_out`, false, nombre, `Port ID / interfaz de salida de ${nombre}.`, "P2"),
];

export const COLUMNAS_DIAGRAMA = [
  // --- Identificación -------------------------------------------------------
  col("nombre_señal", true, "Identificación",
    "Nombre de la señal. Debe existir una Signal con este nameChannel (misma escritura).", "TNT"),
  col("region", true, "Identificación",
    "Variante / tecnología de la señal. Debe coincidir con el tipoTecnologia de la Signal. " +
      "Señal + región = 1 diagrama; varias filas con lo mismo = ramas del mismo diagrama.", "HD"),
  col("categoria", true, "Identificación", "Categoría. Solo informativa (aparece en el resumen).", "NACIONAL"),
  col("sitio", true, "Identificación", "Sitio. Se exige que no esté vacío; no se dibuja en el diagrama.", "TEMUCO"),

  // --- Satélite / IRD / switch de entrada -----------------------------------
  col("satelite", true, "Satélite / IRD", "Satélite (se crea el equipo \"satélite + polarización\" si no existe).", "SATELITE-1"),
  col("polarizacion", true, "Satélite / IRD", "Polarización del satélite.", "H"),
  col("ird_real", false, "Satélite / IRD",
    "Nombre del IRD tal como está en el catálogo de IRDs. Si está vacío o no existe, se usa un IRD genérico \"IRD <señal>\".", "IRD-TNT-01"),
  col("switch_entrada", true, "Satélite / IRD", "Switch de entrada donde llega el IRD (se crea si no existe).", "SW-ENTRADA-01"),
  col("puerto_entrada", false, "Satélite / IRD", "Puerto del switch de entrada.", "Gi1/0/5"),
  col("mcast_out_ird", true, "Satélite / IRD", "IP multicast de salida del IRD.", "239.1.1.10"),

  // --- DCM ------------------------------------------------------------------
  col("dcm", true, "DCM", "Equipo DCM. DEBE existir ya en el catálogo de equipos (no se crea solo).", "DCM-01"),
  ...etapa("DCM", "dcm", { switchIn: "SW-DCM-IN", switchOut: "SW-DCM-OUT", portIn: "Gi1/0/1", portOut: "Gi1/0/2" }),
  col("mcast_out_dcm", true, "DCM", "IP multicast de salida del DCM.", "239.2.1.10"),

  // --- Encoder (Titan) ------------------------------------------------------
  col("encoder_tlhost", true, "Encoder", "Encoder Titan. DEBE existir ya en el catálogo de equipos (no se crea solo).", "TL-HOST-01"),
  ...etapa("Encoder", "encoder", { switchIn: "SW-ENC-IN", switchOut: "SW-ENC-OUT", portIn: "Gi1/0/3", portOut: "Gi1/0/4" }),
  col("mcast_out_clear", true, "Encoder", "IP multicast de salida del encoder (señal en claro).", "239.3.1.10"),

  // --- DCM VMX --------------------------------------------------------------
  col("dcm_vmx", true, "DCM VMX", "Equipo DCM VMX. DEBE existir ya en el catálogo de equipos (no se crea solo).", "DCM-VMX-01"),
  ...etapa("DCM VMX", "dcm_vmx", { switchIn: "SW-VMX-IN", switchOut: "SW-VMX-OUT", portIn: "Gi1/0/6", portOut: "Gi1/0/7" }),
  col("mcast_out_dcm_vmx", true, "DCM VMX", "IP multicast de salida del DCM VMX.", "239.4.1.10"),

  // --- RTES -----------------------------------------------------------------
  col("rtes", true, "RTES", "Equipo RTES. DEBE existir ya en el catálogo de equipos (no se crea solo).", "RTES-01"),
  ...etapa("RTES", "rtes", { switchIn: "SW-RTES-IN", switchOut: "SW-RTES-OUT", portIn: "Gi1/0/8", portOut: "Gi1/0/9" }),
  col("mcast_rtes_out", true, "RTES", "IP multicast de salida del RTES.", "239.5.1.10"),

  // --- Salida hacia MPLS ----------------------------------------------------
  col("router_asr", true, "Salida a MPLS", "Router ASR (se crea si no existe).", "ASR-01"),
  col("nodo_mpls", true, "Salida a MPLS", "Nodo MPLS destino (se crea si no existe).", "MPLS-TEMUCO"),
  col("mcast_prod", true, "Salida a MPLS",
    "IP multicast de producción que sale hacia el MPLS. Es la que se busca en el buscador por IP.", "239.10.5.20"),
  col("puerto_prod", false, "Salida a MPLS", "Puerto UDP del multicast hacia el MPLS.", "5000"),
  col("unicast_mcast", false, "Salida a MPLS", "IP fuente (unicast) asociada al multicast de producción.", "10.20.30.40"),
];

export const CLAVES_DIAGRAMA = COLUMNAS_DIAGRAMA.map((c) => c.key);
export const OBLIGATORIAS_DIAGRAMA = COLUMNAS_DIAGRAMA.filter((c) => c.requerido).map((c) => c.key);

const ancho = (texto, min, max) =>
  Math.min(max, Math.max(min, String(texto ?? "").length + 2));

/**
 * Libro con dos hojas:
 *  - "Diagramas": SOLO los encabezados (es la que lee la carga masiva). Sin
 *    filas de ejemplo a propósito: si alguien sube la plantilla sin editarla,
 *    no se intenta crear un diagrama con datos de mentira.
 *  - "Instrucciones": qué es cada columna, si es obligatoria y un ejemplo. La
 *    carga masiva la ignora.
 * Recibe la librería XLSX como parámetro para poder probarse sin navegador.
 */
export const construirPlantillaDiagramas = (XLSX) => {
  const wb = XLSX.utils.book_new();

  const diagramas = XLSX.utils.aoa_to_sheet([CLAVES_DIAGRAMA]);
  diagramas["!cols"] = CLAVES_DIAGRAMA.map((k) => ({ wch: ancho(k, 14, 28) }));
  XLSX.utils.book_append_sheet(wb, diagramas, HOJA_DIAGRAMAS);

  const filas = [
    ["Plantilla de carga masiva de diagramas"],
    [`Complete la hoja «${HOJA_DIAGRAMAS}»: una fila por RAMA. Las demás hojas se ignoran al subir el archivo.`],
    ["Señal + región = 1 diagrama. Varias filas con la misma señal y región = ramas (colores distintos) del mismo diagrama."],
    ["Antes de subir: debe existir la Signal (nombre_señal + region) y los equipos dcm, encoder_tlhost, dcm_vmx y rtes."],
    ["Primero se muestra una previsualización; no se guarda nada hasta confirmar."],
    [],
    ["Columna", "Obligatoria", "Etapa", "Descripción", "Ejemplo"],
    ...COLUMNAS_DIAGRAMA.map((c) => [c.key, c.requerido ? "Sí" : "No", c.etapa, c.descripcion, c.ejemplo]),
  ];
  const instrucciones = XLSX.utils.aoa_to_sheet(filas);
  instrucciones["!cols"] = [{ wch: 24 }, { wch: 12 }, { wch: 16 }, { wch: 90 }, { wch: 18 }];
  XLSX.utils.book_append_sheet(wb, instrucciones, HOJA_INSTRUCCIONES);

  return wb;
};
