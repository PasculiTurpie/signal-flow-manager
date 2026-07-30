// src/pages/ServicesMultiHost.jsx
import React, {
    useEffect,
    useMemo,
    useRef,
    useState,
    useCallback,
} from "react";
import api from "../../utils/api";
import "../../components/Loader__Spinner/loader__spinner.css";

/**
 * Listado de Señales desde múltiples hosts Titan
 * - Descubre hosts Titan desde api.getEquipo() (tipoNombre.tipoNombre === "titan")
 * - Consulta en paralelo las APIs Titans directamente (sin proxy intermedio)
 * - Columnas: Name, Inputs IP, Outputs[0].Outputs, Fuente (pattern/still/live/fail), State.State
 * - Botón Exportar CSV (aplica al filtrado)
 * - Alarmas ratificadas: Audio/Video con reglas estrictas (evita falsos positivos)
 * - Switch: Pattern/Still como falla
 * - Errores: alerta si detecta Outputs Url duplicados
 *
 * Ajustes solicitados:
 * ✅ Tabla "Señales en falla": ordenar por columnas (Opción 1: usa sortConfig global)
 * ✅ Mostrar SOLO fallas: audio, video, ambas, o señal en Stop
 * ✅ Agregar columna "Tipo de falla" (Audio / Video / Audio+Video / Stopped / combinaciones)
 */

const TITAN_SERVICES_PATH = "/api/v1/servicesmngt/services";
const env =
    typeof import.meta !== "undefined" && import.meta?.env
        ? import.meta.env
        : {};
const TITAN_PROTOCOL = env.VITE_TITAN_PROTOCOL || "http";
const TITAN_REQUEST_OPTIONS = {
    path: TITAN_SERVICES_PATH,
    protocol: TITAN_PROTOCOL,
};

// ───────────────────────── estado de hosts Titan (dinámico vía getEquipo) ─────────────────────────
const useTitanHosts = () => {
    const [hosts, setHosts] = useState([]); // [{label, ip}]
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    const loadHosts = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const response = await api.getEquipo();
            const equipos = Array.isArray(response?.data) ? response.data : [];
            const seenIps = new Set();
            const titanHosts = [];

            for (const item of equipos) {
                const typeNameRaw = pickFirst(
                    item?.tipoNombre?.tipoNombre,
                    item?.tipoNombre?.nombre,
                    item?.tipoNombre,
                    item?.tipo,
                    item?.tipo_equipo
                );
                const typeName =
                    typeof typeNameRaw === "string"
                        ? typeNameRaw.trim().toLowerCase()
                        : "";

                if (!typeName || !typeName.includes("titan")) continue;

                const ip = pickFirst(item?.ip_gestion, item?.ipGestion);
                const normalizedIp = ip ? String(ip).trim() : "";
                if (!normalizedIp || seenIps.has(normalizedIp)) continue;

                seenIps.add(normalizedIp);
                const rawName = item?.nombre ? String(item.nombre).trim() : "";
                titanHosts.push({
                    label: rawName || normalizedIp || "(sin nombre)",
                    ip: normalizedIp,
                });
            }

            console.log(titanHosts);

            titanHosts.sort((a, b) =>
                a.label.localeCompare(b.label, undefined, {
                    numeric: true,
                    sensitivity: "base",
                })
            );

            if (titanHosts.length === 0) {
                setError(
                    "No se encontraron equipos Titan con IP de gestión configurada."
                );
            }
            setHosts(titanHosts);
        } catch (err) {
            setHosts([]);
            setError(`Equipos Titan: ${describeError(err)}`);
        } finally {
            setLoading(false);
        }
    }, []);

    return { hosts, loading, error, loadHosts, setHosts };
};

// Anchos fijos de columnas críticas (tabla principal)
const COL_WIDTHS = {
    fuente: 260,
    estado: 140,
    alarma: 120,
};

/* ───────────────────────── utils ───────────────────────── */

function pickFirst(...cands) {
    for (const v of cands) if (v !== undefined && v !== null) return v;
    return undefined;
}

/** get(obj, 'Outputs[0][0].Outputs[0].Url') seguro (soporta [idx] y .prop) */
function get(obj, path, def = undefined) {
    if (!obj || !path) return def;
    const norm = String(path)
        .replace(/\[(\w+)\]/g, ".$1") // [0] -> .0
        .replace(/^\./, "");
    const out = norm.split(".").reduce((acc, key) => {
        if (acc == null) return undefined;
        return acc[key];
    }, obj);
    return out === undefined ? def : out;
}

/** extrae el array de servicios desde múltiples formas de respuesta */
function extractServicesArray(resp) {
    const r = resp ?? {};
    if (Array.isArray(r)) return r;
    if (Array.isArray(r.services)) return r.services;
    if (Array.isArray(r.Services)) return r.Services;
    if (Array.isArray(r.data?.services)) return r.data.services;
    if (Array.isArray(r.data?.Services)) return r.data.Services;
    if (Array.isArray(r.result)) return r.result;
    return [];
}

/* ───────────────────────── detección de fuente y alarmas (ratificadas) ───────────────────────── */

// Mensajes explícitos que SÍ significan falla
const FAIL_NAMES = new Set([
    "Video Signal Missing",
    "Audio Signal Silent",
    "Video Signal Frozen",
    "Input Source Loss",
]);

function detectVideoSource(svc) {
    const state = get(svc, "State.State");
    const streaming = !!get(svc, "State.Streaming", false);

    const msgs = get(svc, "State.Messages", []);
    const failMsgs = Array.isArray(msgs)
        ? msgs.filter((m) => {
              if (!m) return false;
              if (typeof m === "string") return FAIL_NAMES.has(m);
              const name = m.Name;
              return typeof name === "string" && FAIL_NAMES.has(name);
          })
        : [];

    const emuMode = get(
        svc,
        "Device.Template.Tracks.VideoTracks[0].EmulationMode.Mode",
        "Off"
    );
    const patternName = get(
        svc,
        "Device.Template.Tracks.VideoTracks[0].EmulationMode.PatternName",
        null
    );
    const stillPictureEnabled = !!get(
        svc,
        "Device.Template.Tracks.VideoTracks[0].Variants[0].StillPicture",
        false
    );
    const stillPictureFilename = get(
        svc,
        "Device.Template.Tracks.VideoTracks[0].Variants[0].StillPictureFilename",
        null
    );

    const liveInputUrl = pickFirst(
        get(svc, "Input[0].IPInputList[0].Url"),
        get(svc, "Input.IPInputList[0].Url"),
        get(svc, "IPInputList[0].Url"),
        get(svc, "Input.Url"),
        get(svc, "InputUrl")
    );

    if (failMsgs.length > 0) {
        const reason = failMsgs
            .map((m) => (typeof m === "string" ? m : m?.Name || m?.Description))
            .filter(Boolean)
            .join(" | ");
        return {
            encodingState: state,
            streaming,
            mode: "fail",
            sourceName: reason || liveInputUrl || "(input issue)",
            reason: reason || null,
            liveInputUrl,
            emulationMode: emuMode,
            patternName,
            stillPictureEnabled,
            stillPictureFilename,
        };
    }

    if (emuMode && String(emuMode).toLowerCase() === "pattern") {
        return {
            encodingState: state,
            streaming,
            mode: "pattern",
            sourceName: patternName ?? "(pattern)",
            reason: null,
            liveInputUrl,
            emulationMode: emuMode,
            patternName,
            stillPictureEnabled,
            stillPictureFilename,
        };
    }

    if (stillPictureEnabled) {
        return {
            encodingState: state,
            streaming,
            mode: "still",
            sourceName: stillPictureFilename ?? "(still picture)",
            reason: null,
            liveInputUrl,
            emulationMode: emuMode,
            patternName,
            stillPictureEnabled,
            stillPictureFilename,
        };
    }

    return {
        encodingState: state,
        streaming,
        mode: "live",
        sourceName: liveInputUrl ?? "",
        reason: null,
        liveInputUrl,
        emulationMode: emuMode,
        patternName,
        stillPictureEnabled,
        stillPictureFilename,
    };
}

/** VideoAlarm SOLO si hay mensaje explícito de falla; opcionalmente pattern/still si el flag está activo */
function detectVideoAlarm(svc, treatPatternOrStillAsFail) {
    const msgs = get(svc, "State.Messages", []);
    const hasExplicitVideoFail =
        Array.isArray(msgs) &&
        msgs.some((m) => {
            const name = typeof m === "string" ? m : m?.Name;
            return (
                name === "Video Signal Missing" ||
                name === "Video Signal Frozen" ||
                name === "Input Source Loss"
            );
        });

    const emuMode = get(
        svc,
        "Device.Template.Tracks.VideoTracks[0].EmulationMode.Mode",
        "Off"
    );
    const modeLower = String(emuMode || "").toLowerCase();
    const patternOrStill =
        modeLower === "pattern" ||
        modeLower === "still" ||
        !!get(
            svc,
            "Device.Template.Tracks.VideoTracks[0].Variants[0].StillPicture",
            false
        );

    const videoAlarm =
        hasExplicitVideoFail || (treatPatternOrStillAsFail && patternOrStill);

    return { videoAlarm, hasExplicitVideoFail, patternOrStill };
}

/** AudioAlarm SOLO si hay mensaje explícito o silencio habilitado + niveles ≤ umbral */
function detectAudioAlarm(svc) {
    const msgs = get(svc, "State.Messages", []);
    const hasExplicitAudioFail =
        Array.isArray(msgs) &&
        msgs.some((m) => {
            const name = typeof m === "string" ? m : m?.Name;
            return name === "Audio Signal Silent";
        });

    if (hasExplicitAudioFail) {
        return {
            audioAlarm: true,
            reason: "explicit",
            audioLevelDb: null,
            audioThreshold: null,
        };
    }

    // Si el monitoreo de silencio no está habilitado, no marcamos por nivel
    const silenceEnable =
        !!get(svc, "GlobalConfiguration.AudioSilenceParameters.Enable", false) ||
        !!get(
            svc,
            "Device.Template.GlobalConfiguration.AudioSilenceParameters.Enable",
            false
        );

    if (!silenceEnable) {
        return {
            audioAlarm: false,
            reason: "silence_monitor_disabled",
            audioLevelDb: null,
            audioThreshold: null,
        };
    }

    // Con monitoreo de silencio habilitado: nivel vs umbral
    const threshold =
        pickFirst(
            get(svc, "GlobalConfiguration.AudioSilenceParameters.Threshold"),
            get(
                svc,
                "Device.Template.GlobalConfiguration.AudioSilenceParameters.Threshold"
            )
        ) ?? -70;

    const levels = get(svc, "State.AudioLevels", []);
    const flat = Array.isArray(levels)
        ? levels.flat().filter((v) => typeof v === "number")
        : [];

    if (flat.length === 0) {
        // Sin muestras de nivel → no asumimos falla
        return {
            audioAlarm: false,
            reason: "no_levels",
            audioLevelDb: null,
            audioThreshold: threshold,
        };
    }

    const maxLevel = Math.max(...flat);
    const audioAlarm = maxLevel <= threshold;
    return {
        audioAlarm,
        reason: "threshold",
        audioLevelDb: maxLevel,
        audioThreshold: threshold,
    };
}

/** Suma de errores TS (PID errors o total CC errors) */
function getTsErrors(svc) {
    const pidErrors = get(svc, "State.EtrStatistics[0].PidErrors", []);
    const totalCce = get(
        svc,
        "State.EtrStatistics[0].TotalContinuityCountErrors",
        0
    );
    let sum = 0;
    if (Array.isArray(pidErrors)) {
        for (const p of pidErrors) {
            const n = Number(p?.errors);
            if (!Number.isNaN(n)) sum += n;
        }
    }
    const total = sum || Number(totalCce) || 0;
    return total;
}

/* ───────────────────────── tipo de falla (nuevo) ───────────────────────── */

function computeFailureType(row) {
    const audioFail = row?.audioAlarm === true;
    const videoFail = row?._explicitVideoFail === true || row?.videoAlarm === true;
    const stopped = row?.state === "Stopped";

    // Solo lo que pediste mostrar (audio, video, ambas, stop)
    const parts = [];
    if (audioFail) parts.push("Audio");
    if (videoFail) parts.push("Video");
    if (stopped) parts.push("Stopped");

    // Orden “bonito”
    if (parts.length === 0) return "";
    if (parts.length === 1) return parts[0];

    // Audio+Video(+Stopped)
    return parts.join("+");
}

/* ───────────────────────── extracción por fila ───────────────────────── */
function extractRow(hostLabel, ip, svc, opts = {}) {
    const { treatPatternOrStillAsFail = false } = opts;
    const s = svc ?? {};
    const name = pickFirst(
        get(s, "Name"),
        get(s, "name"),
        get(s, "ServiceName"),
        get(s, "serviceName")
    );

    const inputUrl = pickFirst(
        get(s, "Input[0].IPInputList[0].Url"),
        get(s, "Input.IPInputList[0].Url"),
        get(s, "IPInputList[0].Url"),
        get(s, "Input.Url"),
        get(s, "InputUrl")
    );

    const outputUrlExact = pickFirst(
        get(s, "Outputs[0][0].Outputs[0].Url"),
        get(s, "Outputs[0][0].Outputs.Url")
    );
    const outputUrlFallback = pickFirst(
        get(s, "Outputs[0].Outputs[0].Url"),
        get(s, "Outputs[0].Outputs.Url"),
        get(s, "Outputs[0][0].Outputs[0]"),
        get(s, "Outputs[0].Url"),
        get(s, "Outputs.Url"),
        get(s, "Output.Url")
    );
    const outputUrl = pickFirst(outputUrlExact, outputUrlFallback);

    const stateVal = pickFirst(
        get(s, "State.State"),
        get(s, "state.state"),
        get(s, "State"),
        get(s, "state")
    );

    // ───── Inputs IP (lista + índice activo) ─────
    const activeInputIndexRaw = pickFirst(
        get(s, "Input[0].ActiveInputIndex"),
        get(s, "Input.ActiveInputIndex")
    );
    const activeInputIndex = Number.isInteger(activeInputIndexRaw)
        ? activeInputIndexRaw
        : 0;

    const ipInputListRaw =
        get(s, "Input[0].IPInputList") ??
        get(s, "Input.IPInputList") ??
        get(s, "IPInputList") ??
        [];

    const ipInputs = Array.isArray(ipInputListRaw)
        ? ipInputListRaw.map((ii, idx) => ({
              url: ii?.Url ?? "",
              source: ii?.Source ?? "",
              iface: ii?.Interface ?? "",
              isActive: idx === activeInputIndex,
          }))
        : [];

    // Fuente descriptiva (NO decide falla)
    const src = detectVideoSource(s);
    const sourceText =
        src.mode === "fail"
            ? `fail: ${src.sourceName ?? ""}`
            : src.mode === "pattern"
            ? `pattern: ${src.sourceName ?? ""}`
            : src.mode === "still"
            ? `still: ${src.sourceName ?? ""}`
            : `live: ${src.sourceName ?? ""}`;

    // Alarmas según reglas ratificadas y preferencia de UI
    const { videoAlarm, hasExplicitVideoFail, patternOrStill } =
        detectVideoAlarm(s, treatPatternOrStillAsFail);
    const { audioAlarm, audioLevelDb, audioThreshold } = detectAudioAlarm(s);
    const tsErrors = getTsErrors(s);

    const row = {
        host: hostLabel,
        ip,
        name: name ?? "(sin nombre)",
        inputUrl: inputUrl ?? "",
        outputs: outputUrl ?? "",
        sourceMode: src.mode,
        sourceName: src.sourceName ?? "",
        sourceText,
        state:
            typeof stateVal === "object"
                ? JSON.stringify(stateVal)
                : stateVal ?? "",
        // Datos de alarmas
        audioAlarm,
        audioLevelDb,
        audioThreshold,
        videoAlarm,
        tsErrors,
        // Inputs IP
        ipInputs,
        activeInputIndex,
        // Flags internos útiles
        _explicitVideoFail: !!hasExplicitVideoFail,
        _patternOrStill: !!patternOrStill,
    };

    // NUEVO: tipo de falla calculado desde row (audio/video/stop)
    row.failureType = computeFailureType(row);

    return row;
}

/* ───────────────────────── Titans helpers ───────────────────────── */

function describeError(error) {
    if (!error) return "Error desconocido";
    if (typeof error === "string") return error;
    const response = error.response;
    if (response) {
        const status = response.status ?? "?";
        const statusText = response.statusText ? ` ${response.statusText}` : "";
        const data = response.data;
        let detail = "";
        if (data) {
            if (typeof data === "string") detail = data;
            else if (typeof data?.error === "string") detail = data.error;
            else if (typeof data?.message === "string") detail = data.message;
            else {
                try {
                    detail = JSON.stringify(data);
                } catch {
                    detail = String(data);
                }
            }
            if (detail) detail = ` - ${detail}`;
        }
        return `HTTP ${status}${statusText}${detail}`.trim();
    }
    if (error?.message) return error.message;
    try {
        return JSON.stringify(error);
    } catch {
        return String(error);
    }
}

function describeTitanEntryError(entry) {
    if (!entry) return "sin datos";
    if (typeof entry === "string") return entry;
    if (entry.error) {
        if (typeof entry.error === "string") return entry.error;
        if (entry.error?.message) return entry.error.message;
        try {
            return JSON.stringify(entry.error);
        } catch {
            return String(entry.error);
        }
    }
    if (entry.message) return entry.message;
    if (entry.status || entry.statusText) {
        const status = entry.status ?? "?";
        const text = entry.statusText ? ` ${text}` : "";
        return `HTTP ${status}${text}`.trim();
    }
    return "error desconocido";
}

function unwrapTitanPayload(entry) {
    if (!entry || typeof entry !== "object") return entry;
    if (entry.data !== undefined) return entry.data;
    if (entry.payload !== undefined) return entry.payload;
    if (entry.body !== undefined) return entry.body;
    if (entry.result !== undefined) return entry.result;
    return entry;
}

function normalizeTitanMultiResponse(payload) {
    if (!payload) return [];
    if (Array.isArray(payload)) return payload;
    if (Array.isArray(payload.results)) return payload.results;
    if (Array.isArray(payload.data)) return payload.data;
    if (Array.isArray(payload.items)) return payload.items;
    if (Array.isArray(payload.hosts)) return payload.hosts;
    return [];
}

function getEntryHost(entry) {
    if (!entry) return null;
    return (
        entry.host ??
        entry.ip ??
        entry.hostIp ??
        remindingBugFixHost(entry)
    );
}

// Extra: fallback seguro (evita undefined raro en entry)
function remindingBugFixHost(entry) {
    if (!entry || typeof entry !== "object") return null;
    if (typeof entry.hostname === "string") return entry.hostname;
    if (typeof entry.host === "string") return entry.host;
    return null;
}

function isEntryOk(entry) {
    if (!entry) return false;
    if (typeof entry.ok === "boolean") return entry.ok;
    if ("error" in entry && entry.error) return false;
    if (entry.status !== undefined) {
        const status = Number(entry.status);
        if (!Number.isNaN(status)) return status >= 200 && status < 300;
    }
    return true;
}

function processTitanEntries(entries, hostMap, opts) {
    const rows = [];
    const errors = [];
    const seenHosts = new Set();

    for (const entry of entries) {
        const hostIp = getEntryHost(entry);
        if (hostIp) seenHosts.add(hostIp);
        const hostInfo = hostMap.get(hostIp) || {
            label: hostIp ?? "(desconocido)",
            ip: hostIp ?? "(desconocido)",
        };

        if (isEntryOk(entry)) {
            const payload = unwrapTitanPayload(entry);
            const services = extractServicesArray(payload);
            rows.push(
                ...services.map((svc) =>
                    extractRow(hostInfo.label, hostInfo.ip, svc, opts)
                )
            );
        } else {
            errors.push(
                `${hostInfo.label} (${hostInfo.ip}): ${describeTitanEntryError(
                    entry
                )}`
            );
        }
    }

    return { rows, errors, seenHosts };
}

/* ───────────────────────── Duplicados de Output URLs ───────────────────────── */

function collectDuplicateOutputErrors(rows) {
    const map = new Map(); // url -> [{name, ip}]
    for (const r of rows) {
        const url = typeof r.outputs === "string" ? r.outputs.trim() : "";
        if (!url) continue;
        const key = url.toLowerCase();
        if (!map.has(key)) map.set(key, []);
        map.get(key).push({ name: r.name, ip: r.ip });
    }
    const errors = [];
    for (const [url, list] of map.entries()) {
        if (list.length > 1) {
            const refs = list.map((x) => `${x.name} @ ${x.ip}`).join("; ");
            errors.push(
                `Output Url duplicado: ${url} (usado por ${list.length} señales: ${refs})`
            );
        }
    }
    return errors;
}

/* ───────────────────────── CSV ───────────────────────── */

function escapeCsvField(v) {
    if (v === null || v === undefined) return "";
    const s = String(v);
    if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
}

function rowsToCsv(rows) {
    const headers = [
        "Host",
        "IP",
        "Name",
        "Input.IPInputList.Url",
        "Outputs[0].Outputs.Url",
        "Fuente",
        "State.State",
        "TipoFalla",
        "AudioAlarm",
        "VideoAlarm",
        "AudioLevelDb",
        "AudioThreshold",
        "TsErrors",
    ];
    const lines = [headers.map(escapeCsvField).join(",")];
    for (const r of rows) {
        lines.push(
            [
                r.host,
                r.ip,
                r.name,
                r.inputUrl,
                typeof r.outputs === "string"
                    ? r.outputs
                    : JSON.stringify(r.outputs),
                r.sourceText,
                r.state,
                r.failureType,
                r.audioAlarm,
                r.videoAlarm,
                r.audioLevelDb ?? "",
                r.audioThreshold ?? "",
                r.tsErrors ?? 0,
            ]
                .map(escapeCsvField)
                .join(",")
        );
    }
    return lines.join("\r\n");
}

function downloadText(filename, text) {
    const blob = new Blob([text], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
}

/* Helpers UI */
function hostHref(ip) {
    if (!ip) return "#";
    return `${TITAN_PROTOCOL}://${ip}`;
}

/* ───────────────────────── Ordenamiento ───────────────────────── */

function compareRowsWithConfig(a, b, sortConfig) {
    if (!sortConfig || !sortConfig.key) return 0;
    const { primary: aPrimary, secondary: aSecondary } = getSortDataForKey(
        a,
        sortConfig.key
    );
    const { primary: bPrimary, secondary: bSecondary } = getSortDataForKey(
        b,
        sortConfig.key
    );

    const base = comparePrimitive(aPrimary, bPrimary);
    if (base !== 0) {
        return sortConfig.direction === "desc" ? -base : base;
    }

    const tieBreaker = comparePrimitive(aSecondary, bSecondary);
    if (tieBreaker !== 0) {
        return sortConfig.direction === "desc" ? -tieBreaker : tieBreaker;
    }

    return 0;
}

function getSortDataForKey(row, key) {
    switch (key) {
        case "host":
            return { primary: row?.host ?? "", secondary: row?.ip ?? "" };
        case "ip": {
            const numeric = ipToSortableNumber(row?.ip);
            if (numeric !== null) return { primary: numeric, secondary: row?.ip ?? "" };
            return { primary: row?.ip ?? "", secondary: row?.host ?? "" };
        }
        case "name":
            return { primary: row?.name ?? "", secondary: row?.host ?? "" };

        case "source":
            return { primary: row?.sourceText ?? "", secondary: row?.name ?? "" };

        case "failureType":
            return { primary: row?.failureType ?? "", secondary: row?.name ?? "" };

        case "outputs": {
            const out =
                typeof row?.outputs === "string"
                    ? row.outputs
                    : JSON.stringify(row?.outputs ?? "");
            return { primary: out ?? "", secondary: row?.name ?? "" };
        }
        case "audioAlarm":
            return { primary: row?.audioAlarm ? 1 : 0, secondary: row?.name ?? "" };
        case "videoAlarm":
            return { primary: row?.videoAlarm ? 1 : 0, secondary: row?.name ?? "" };
        case "state":
            return { primary: row?.state ?? "", secondary: row?.name ?? "" };
        case "tsErrors": {
            const numeric = Number(row?.tsErrors);
            const primary = Number.isFinite(numeric) ? numeric : 0;
            return { primary, secondary: row?.name ?? "" };
        }
        default:
            return { primary: row?.[key] ?? "", secondary: row?.host ?? "" };
    }
}

function comparePrimitive(a, b) {
    if (a == null && b == null) return 0;
    if (a == null) return -1;
    if (b == null) return 1;

    if (typeof a === "number" && typeof b === "number") {
        if (Number.isNaN(a) && Number.isNaN(b)) return 0;
        if (Number.isNaN(a)) return -1;
        if (Number.isNaN(b)) return 1;
        if (a < b) return -1;
        if (a > b) return 1;
        return 0;
    }

    return String(a).localeCompare(String(b), undefined, {
        numeric: true,
        sensitivity: "base",
    });
}

function ipToSortableNumber(ip) {
    if (typeof ip !== "string") return null;
    const parts = ip.trim().split(".");
    if (parts.length !== 4) return null;
    let value = 0;
    for (const part of parts) {
        if (!/^\d+$/.test(part)) return null;
        const num = Number(part);
        if (Number.isNaN(num)) return null;
        value = value * 256 + Math.min(Math.max(num, 0), 255);
    }
    return value;
}

/* ───────────────────────── Componente ───────────────────────── */

function Spinner({ size = 16, stroke = 2, label = "Cargando…" }) {
    return (
        <span
            role="status"
            aria-live="polite"
            aria-label={label}
            title={label}
            className="spinner"
            style={{ width: size, height: size, borderWidth: stroke }}
        />
    );
}

export default function ServicesMultiHost() {
    const [rows, setRows] = useState([]);
    const [loading, setLoading] = useState(false);
    const [errors, setErrors] = useState([]);
    const [query, setQuery] = useState("");
    const [autoRefresh, setAutoRefresh] = useState(false);
    const [showErrors, setShowErrors] = useState(false);
    const [treatPatternAsFail, setTreatPatternAsFail] = useState(false); // (si lo reactivas)
    const [sortConfig, setSortConfig] = useState({ key: null, direction: "asc" });
    const timerRef = useRef(null);
    const searchRef = useRef(null);

    // hosts Titan desde backend
    const {
        hosts,
        loading: hostsLoading,
        error: hostFetchError,
        loadHosts,
    } = useTitanHosts();

    // Carga de servicios usando los hosts descubiertos
    const loadAll = useCallback(async () => {
        if (!hosts || hosts.length === 0) {
            setRows([]);
            setErrors(
                hostFetchError
                    ? [hostFetchError]
                    : ["No hay hosts Titan para consultar."]
            );
            return;
        }

        setLoading(true);
        setErrors([]);

        const hostMap = new Map(hosts.map((item) => [item.ip, item]));
        const hostIps = hosts.map((item) => item.ip);
        let nextRows = [];
        let nextErrors = [];

        const opts = { treatPatternOrStillAsFail: treatPatternAsFail };

        const pushRowsFromHost = (hostInfo, payload) => {
            const services = extractServicesArray(payload);
            nextRows.push(
                ...services.map((svc) =>
                    extractRow(hostInfo.label, hostInfo.ip, svc, opts)
                )
            );
        };

        try {
            const multiResponse = await api.getTitanServicesMulti(
                hostIps,
                TITAN_REQUEST_OPTIONS
            );
            const entries = normalizeTitanMultiResponse(multiResponse);
            const processed = processTitanEntries(entries, hostMap, opts);

            nextRows = [...processed.rows];
            nextErrors = [...processed.errors];

            // Fallback: por si alguno no vino en el multi
            const missingHosts = hostIps.filter(
                (ip) => !processed.seenHosts.has(ip)
            );
            if (missingHosts.length > 0) {
                const settled = await Promise.allSettled(
                    missingHosts.map((ip) =>
                        api.getTitanServices(ip, TITAN_REQUEST_OPTIONS)
                    )
                );

                settled.forEach((result, index) => {
                    const ip = missingHosts[index];
                    const hostInfo = hostMap.get(ip) || { label: ip, ip };
                    if (result.status === "fulfilled") {
                        pushRowsFromHost(hostInfo, result.value);
                    } else {
                        nextErrors.push(
                            `${hostInfo.label} (${hostInfo.ip}): ${describeError(
                                result.reason
                            )}`
                        );
                    }
                });
            }
        } catch (err) {
            // Fallback total: per-host
            nextRows = [];
            nextErrors = [`Titans multi-host: ${describeError(err)}`];

            const settled = await Promise.allSettled(
                hosts.map((host) =>
                    api.getTitanServices(host.ip, TITAN_REQUEST_OPTIONS)
                )
            );

            settled.forEach((result, index) => {
                const hostInfo = hosts[index];
                if (result.status === "fulfilled") {
                    pushRowsFromHost(hostInfo, result.value);
                } else {
                    nextErrors.push(
                        `${hostInfo.label} (${hostInfo.ip}): ${describeError(
                            result.reason
                        )}`
                    );
                }
            });
        }

        // Agregar errores por URLs de salida duplicadas
        const dupErrors = collectDuplicateOutputErrors(nextRows);
        if (dupErrors.length > 0) {
            nextErrors = [...nextErrors, ...dupErrors];
        }

        setRows(nextRows);
        setErrors(nextErrors);
        setLoading(false);
    }, [hosts, hostFetchError, treatPatternAsFail]);

    // 1) Descubrir hosts en el montaje
    useEffect(() => {
        loadHosts();
    }, [loadHosts]);

    // 2) Cuando cambien los hosts (o terminen de cargar), ejecutar la carga de servicios
    useEffect(() => {
        if (!hostsLoading) {
            if (hostFetchError) {
                setErrors((e) =>
                    e.includes(hostFetchError) ? e : [...e, hostFetchError]
                );
            }
            if (hosts.length > 0) {
                loadAll();
            } else if (!hostFetchError) {
                setRows([]);
            }
        }
    }, [hostsLoading, hosts, hostFetchError, loadAll]);

    // 3) Auto-refresh cada 30s, solo si hay hosts
    useEffect(() => {
        if (!autoRefresh) {
            if (timerRef.current) clearInterval(timerRef.current);
            timerRef.current = null;
            return;
        }
        timerRef.current = setInterval(() => {
            loadAll();
        }, 30_000);
        return () => {
            if (timerRef.current) clearInterval(timerRef.current);
            timerRef.current = null;
        };
    }, [autoRefresh, loadAll]);

    const filtered = useMemo(() => {
        const q = query.trim().toLowerCase();
        let nextRows = rows;

        if (q) {
            nextRows = rows.filter((r) =>
                [
                    r.host,
                    r.ip,
                    r.name,
                    r.inputUrl,
                    r.outputs,
                    r.sourceText,
                    r.failureType,
                    r.state,
                    r.audioAlarm,
                    r.videoAlarm,
                    r.tsErrors,
                ]
                    .filter(Boolean)
                    .some((v) => String(v).toLowerCase().includes(q))
            );
        }

        if (!sortConfig.key) return nextRows;

        return [...nextRows].sort((a, b) =>
            compareRowsWithConfig(a, b, sortConfig)
        );
    }, [rows, query, sortConfig]);

    // ✅ Solo fallas: audio, video, ambas, stop (y combinaciones)
    // ✅ Ordenado por sortConfig (opción 1)
    const failingRows = useMemo(() => {
        const base = filtered.filter((r) => {
            const audioFail = r.audioAlarm === true;
            const videoFail =
                r._explicitVideoFail === true || r.videoAlarm === true;
            const stopped = r.state === "Stopped";
            return audioFail || videoFail || stopped;
        });

        if (!sortConfig?.key) return base;
        return [...base].sort((a, b) =>
            compareRowsWithConfig(a, b, sortConfig)
        );
    }, [filtered, sortConfig]);

    const handleExportCsv = useCallback(() => {
        const stamp = new Date()
            .toISOString()
            .replace(/[:.]/g, "-")
            .replace("T", "_")
            .replace("Z", "");
        const csv = rowsToCsv(filtered);
        downloadText(`titan_signals_${stamp}.csv`, csv);
    }, [filtered]);

    const handleClear = useCallback(() => {
        setQuery("");
        if (searchRef.current) {
            searchRef.current.focus();
            if (typeof searchRef.current.select === "function") {
                searchRef.current.select();
            }
        }
    }, []);

    const handleSort = useCallback((key) => {
        setSortConfig((prev) => {
            if (prev.key === key) {
                return {
                    key,
                    direction: prev.direction === "asc" ? "desc" : "asc",
                };
            }
            return { key, direction: "asc" };
        });
    }, []);

    const handleSortKeyDown = useCallback(
        (event, key) => {
            if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                handleSort(key);
            }
        },
        [handleSort]
    );

    const renderSortLabel = useCallback(
        (label, key) => {
            const isActive = sortConfig.key === key;
            const indicator = isActive
                ? sortConfig.direction === "asc"
                    ? "▲"
                    : "▼"
                : "↕";
            return (
                <span
                    style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 6,
                    }}
                >
                    <span>{label}</span>
                    <span style={{ fontSize: 11, color: "#6b7280" }}>
                        {indicator}
                    </span>
                </span>
            );
        },
        [sortConfig]
    );

    const titanSignalsCount = filtered.length;

    return (
        <div
            className="outlet-main"
            style={{
                padding: 16,
                backgroundColor: "#ffffff",
                minHeight: "100vh",
            }}
        >
            {/* estilos de botones + buscador + filas hover */}
            <style>{`
        a { text-decoration: none; }

        .btn {
          appearance: none;
          border-radius: 8px;
          padding: 8px 12px;
          font-size: 14px;
          line-height: 1;
          cursor: pointer;
          border: 1px solid transparent;
          transition: background 120ms ease, border-color 120ms ease, box-shadow 120ms ease, transform 50ms ease, color 120ms ease;
          background: #f6f8fa;
          color: #24292f;
        }
        .btn:hover:not(:disabled) { background: #eef1f4; }
        .btn:active:not(:disabled) { transform: translateY(1px); }
        .btn:focus-visible {
          outline: none;
          box-shadow: 0 0 0 3px rgba(9,105,218,0.3);
          border-color: #0969da;
        }
        .btn:disabled {
          cursor: not-allowed;
          opacity: 0.85;
        }

        .btn-primary {
          background: #0969da;
          color: #ffffff;
          border-color: #0969da;
        }
        .btn-primary:hover:not(:disabled) { background: #085ec2; border-color: #085ec2; }

        .btn-outline {
          background: #ffffff;
          color: #24292f;
          border-color: #d0d7de;
        }
        .btn-outline:hover:not(:disabled) { background: #f6f8fa; border-color: #c2c8ce; }

        .btn-orange {
          background: #f59e0b;
          color: #ffffff;
          border-color: #f59e0b;
        }
        .btn-orange:hover:not(:disabled) { background: #d97706; border-color: #d97706; }
        .btn-orange:active:not(:disabled) { background: #c76a05; border-color: #c76a05; }
        .btn-orange:disabled {
          background: #d1d5db !important;
          border-color: #d1d5db !important;
          color: #4b5563 !important;
          opacity: 1;
        }

        .badge {
          display: inline-block;
          padding: 2px 8px;
          border-radius: 999px;
          font-size: 12px;
          line-height: 1.4;
          border: 1px solid transparent;
          white-space: nowrap;
        }
        .badge-red { background: #fee2e2; color: #991b1b; border-color: #fecaca; }
        .badge-green { background: #dcfce7; color: #166534; border-color: #bbf7d0; }
        .badge-amber { background: #fef3c7; color: #92400e; border-color: #fde68a; }

        .search-input {
          flex: 1 1 auto;
          padding: 8px 10px;
          border: 1px solid #d1d5db;
          border-radius: 8px;
          background: #ffffff;
          color: #111827;
          transition: border-color 120ms ease, box-shadow 120ms ease, background 120ms ease;
        }
        .search-input::placeholder { color: #6b7280; }
        .search-input:hover { border-color: #c7ccd1; }
        .search-input:focus {
          outline: none;
          border-color: #60a5fa;
          box-shadow: 0 0 0 3px rgba(96,165,250,0.35);
        }
        .search-input:focus-visible {
          outline: none;
          border-color: #60a5fa;
          box-shadow: 0 0 0 3px rgba(96,165,250,0.35);
        }

        /* fila resaltada al pasar el mouse */
        .table-row-hover:hover {
          background-color: #eef2ff;
        }
      `}</style>

            <h2
                style={{
                    margin: 0,
                    marginBottom: 8,
                    display: "flex",
                    alignItems: "baseline",
                    gap: 8,
                }}
            >
                <span>Listado de señales (Titan)</span>
                <span style={{ fontSize: 16, color: "#6b7280" }}>
                    ({`Total señales: ${titanSignalsCount}`})
                </span>
            </h2>

            <div
                style={{
                    display: "flex",
                    gap: 8,
                    alignItems: "center",
                    flexWrap: "wrap",
                    marginBottom: 12,
                }}
            >
                <input
                    ref={searchRef}
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Buscar (host, IP, nombre, estado...)"
                    className="search-input"
                    style={{ minWidth: 260 }}
                />
                <button
                    onClick={handleClear}
                    disabled={!query}
                    className="btn btn-orange btn-clear"
                    aria-label="Limpiar búsqueda"
                    title="Limpiar búsqueda"
                >
                    Limpiar
                </button>
                <button
                    onClick={loadAll}
                    disabled={loading || hostsLoading || hosts.length === 0}
                    className="btn btn-primary"
                >
                    {loading ? (
                        <span
                            style={{
                                display: "inline-flex",
                                alignItems: "center",
                                gap: 8,
                            }}
                        >
                            <Spinner size={14} stroke={2} />
                            Cargando…
                        </span>
                    ) : (
                        "Refrescar"
                    )}
                </button>
                <label
                    style={{ display: "flex", gap: 6, alignItems: "center" }}
                >
                    <input
                        type="checkbox"
                        checked={autoRefresh}
                        onChange={(e) => setAutoRefresh(e.target.checked)}
                        disabled={hostsLoading || hosts.length === 0}
                    />
                    Auto 30s
                </label>

                <label
                    style={{ display: "flex", gap: 6, alignItems: "center" }}
                >
                    <input
                        type="checkbox"
                        checked={showErrors}
                        onChange={(e) => setShowErrors(e.target.checked)}
                        disabled={errors.length === 0}
                    />
                    Mostrar errores
                </label>

                <button
                    onClick={handleExportCsv}
                    disabled={filtered.length === 0}
                    className="btn btn-outline"
                >
                    Exportar CSV
                </button>
            </div>

            {/* Estado de carga/errores de hosts */}
            {(hostsLoading || hostFetchError) && (
                <div
                    style={{
                        background: "#fffbea",
                        border: "1px solid #fcd34d",
                        padding: 8,
                        marginBottom: 12,
                    }}
                >
                    {hostsLoading
                        ? "Descubriendo hosts Titan..."
                        : hostFetchError}
                </div>
            )}

            {showErrors && errors.length > 0 && (
                <div
                    style={{
                        background: "#fff4f4",
                        border: "1px solid #f5c2c7",
                        padding: 8,
                        marginBottom: 12,
                    }}
                >
                    <strong>Errores de conexión y validaciones:</strong>
                    <ul style={{ margin: 0, paddingInlineStart: 18 }}>
                        {errors.map((er, i) => (
                            <li key={i} style={{ whiteSpace: "pre-wrap" }}>
                                {er}
                            </li>
                        ))}
                    </ul>
                </div>
            )}

            {/* Tabla de señales en falla */}
            {failingRows.length > 0 && (
                <div style={{ marginBottom: 12 }}>
                    <div
                        style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 8,
                            marginBottom: 6,
                        }}
                    >
                        <strong>Señales en falla</strong>
                        <span style={{ fontSize: 12, color: "#666" }}>
                            ({failingRows.length})
                        </span>
                    </div>
                    <div
                        style={{
                            display: "inline-block",
                            border: "1px solid #f0c4c4",
                            background: "#fffafa",
                            padding: 0,
                        }}
                    >
                        <table
                            style={{
                                borderCollapse: "collapse",
                                tableLayout: "auto",
                                width: "auto",
                                display: "inline-table",
                                fontSize: 14,
                            }}
                        >
                            <thead style={{ background: "#fdeeee" }}>
                                <tr>
                                    <th
                                        style={{
                                            ...thCompact,
                                            width: 36,
                                            maxWidth: 36,
                                        }}
                                    >
                                        {" "}
                                    </th>

                                    <th
                                        style={{
                                            ...thCompact,
                                            cursor: "pointer",
                                            userSelect: "none",
                                        }}
                                        onClick={() => handleSort("failureType")}
                                        onKeyDown={(e) =>
                                            handleSortKeyDown(e, "failureType")
                                        }
                                        role="button"
                                        tabIndex={0}
                                        title="Ordenar por tipo de falla"
                                    >
                                        {renderSortLabel(
                                            "Tipo falla",
                                            "failureType"
                                        )}
                                    </th>

                                    <th
                                        style={{
                                            ...thCompact,
                                            cursor: "pointer",
                                            userSelect: "none",
                                        }}
                                        onClick={() => handleSort("name")}
                                        onKeyDown={(e) =>
                                            handleSortKeyDown(e, "name")
                                        }
                                        role="button"
                                        tabIndex={0}
                                    >
                                        {renderSortLabel("Name", "name")}
                                    </th>

                                    <th
                                        style={{
                                            ...thCompact,
                                            cursor: "pointer",
                                            userSelect: "none",
                                        }}
                                        onClick={() => handleSort("ip")}
                                        onKeyDown={(e) =>
                                            handleSortKeyDown(e, "ip")
                                        }
                                        role="button"
                                        tabIndex={0}
                                    >
                                        {renderSortLabel("IP", "ip")}
                                    </th>

                                    <th
                                        style={{
                                            ...thCompact,
                                            cursor: "pointer",
                                            userSelect: "none",
                                        }}
                                        onClick={() => handleSort("source")}
                                        onKeyDown={(e) =>
                                            handleSortKeyDown(e, "source")
                                        }
                                        role="button"
                                        tabIndex={0}
                                    >
                                        {renderSortLabel("Fuente", "source")}
                                    </th>

                                    <th
                                        style={{
                                            ...thCompact,
                                            cursor: "pointer",
                                            userSelect: "none",
                                        }}
                                        onClick={() => handleSort("audioAlarm")}
                                        onKeyDown={(e) =>
                                            handleSortKeyDown(e, "audioAlarm")
                                        }
                                        role="button"
                                        tabIndex={0}
                                    >
                                        {renderSortLabel("Audio", "audioAlarm")}
                                    </th>

                                    <th
                                        style={{
                                            ...thCompact,
                                            cursor: "pointer",
                                            userSelect: "none",
                                        }}
                                        onClick={() => handleSort("videoAlarm")}
                                        onKeyDown={(e) =>
                                            handleSortKeyDown(e, "videoAlarm")
                                        }
                                        role="button"
                                        tabIndex={0}
                                    >
                                        {renderSortLabel("Video", "videoAlarm")}
                                    </th>

                                    <th
                                        style={{
                                            ...thCompact,
                                            cursor: "pointer",
                                            userSelect: "none",
                                        }}
                                        onClick={() => handleSort("tsErrors")}
                                        onKeyDown={(e) =>
                                            handleSortKeyDown(e, "tsErrors")
                                        }
                                        role="button"
                                        tabIndex={0}
                                    >
                                        {renderSortLabel("TS Err", "tsErrors")}
                                    </th>
                                </tr>
                            </thead>

                            <tbody>
                                {failingRows.map((r, i) => {
                                    const audioFail = r.audioAlarm === true;
                                    const videoFail =
                                        r._explicitVideoFail === true ||
                                        r.videoAlarm === true;
                                    const stopped = r.state === "Stopped";
                                    const dotColor =
                                        audioFail || videoFail || stopped
                                            ? "red"
                                            : "green";

                                    return (
                                        <tr
                                            key={`fail-${r.ip}-${i}`}
                                            className="table-row-hover"
                                        >
                                            <td
                                                style={{
                                                    ...tdCompact,
                                                    width: 36,
                                                    maxWidth: 36,
                                                }}
                                            >
                                                <span
                                                    style={{
                                                        display: "inline-block",
                                                        width: 12,
                                                        height: 12,
                                                        borderRadius: "50%",
                                                        backgroundColor:
                                                            dotColor,
                                                    }}
                                                    title="fail"
                                                />
                                            </td>

                                            <td
                                                style={tdCompact}
                                                title={r.failureType}
                                            >
                                                <span className="badge badge-red">
                                                    {r.failureType || "Fail"}
                                                </span>
                                            </td>

                                            <td style={tdCompact} title={r.name}>
                                                {r.name}
                                            </td>

                                            <td style={{ ...tdCompact }}>
                                                <a
                                                    href={hostHref(r.ip)}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    style={{
                                                        whiteSpace: "nowrap",
                                                    }}
                                                    title={`${TITAN_PROTOCOL}://${r.ip}`}
                                                >
                                                    {r.ip}
                                                </a>
                                            </td>

                                            <td
                                                style={tdCompact}
                                                title={r.sourceText}
                                            >
                                                {r.sourceText}
                                            </td>

                                            <td style={tdCompact}>
                                                {audioFail ? (
                                                    <span
                                                        className="badge badge-red"
                                                        title={`Alarma audio • Nivel: ${
                                                            r.audioLevelDb ??
                                                            "N/A"
                                                        } dB (umbral ${
                                                            r.audioThreshold ??
                                                            "N/A"
                                                        } dB)`}
                                                    >
                                                        Alarma
                                                    </span>
                                                ) : (
                                                    <span
                                                        className="badge badge-green"
                                                        title={`Audio OK • Nivel: ${
                                                            r.audioLevelDb ??
                                                            "N/A"
                                                        } dB`}
                                                    >
                                                        OK
                                                    </span>
                                                )}
                                            </td>

                                            <td style={tdCompact}>
                                                {videoFail ? (
                                                    <span
                                                        className="badge badge-red"
                                                        title="Alarma video"
                                                    >
                                                        Alarma
                                                    </span>
                                                ) : (
                                                    <span
                                                        className="badge badge-green"
                                                        title="Video OK"
                                                    >
                                                        OK
                                                    </span>
                                                )}
                                            </td>

                                            <td
                                                style={{
                                                    ...tdCompact,
                                                    textAlign: "left",
                                                }}
                                                title="Suma de errores de PID / CC"
                                            >
                                                {r.tsErrors ?? 0}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* Tabla principal (sin cambios funcionales relevantes, solo incluye failureType en filtro/CSV) */}
            <div
                className="table-wrap"
                style={{
                    overflow: "auto",
                    maxHeight: "75vh",
                    border: "1px solid #ddd",
                    position: "relative",
                }}
            >
                <table
                    style={{
                        width: "auto",
                        borderCollapse: "collapse",
                        fontSize: 14,
                        tableLayout: "auto",
                        display: "inline-table",
                    }}
                >
                    <thead
                        style={{
                            position: "sticky",
                            top: 0,
                            background: "#fafafa",
                            zIndex: 100,
                            textAlign: "left",
                        }}
                    >
                        <tr>
                            <th
                                style={{
                                    ...th,
                                    cursor: "pointer",
                                    userSelect: "none",
                                }}
                                onClick={() => handleSort("host")}
                                onKeyDown={(event) =>
                                    handleSortKeyDown(event, "host")
                                }
                                role="button"
                                tabIndex={0}
                            >
                                {renderSortLabel("Host", "host")}
                            </th>
                            <th
                                style={{
                                    ...th,
                                    cursor: "pointer",
                                    userSelect: "none",
                                }}
                                onClick={() => handleSort("ip")}
                                onKeyDown={(event) =>
                                    handleSortKeyDown(event, "ip")
                                }
                                role="button"
                                tabIndex={0}
                            >
                                {renderSortLabel("IP", "ip")}
                            </th>
                            <th
                                style={{
                                    ...th,
                                    cursor: "pointer",
                                    userSelect: "none",
                                }}
                                onClick={() => handleSort("name")}
                                onKeyDown={(event) =>
                                    handleSortKeyDown(event, "name")
                                }
                                role="button"
                                tabIndex={0}
                            >
                                {renderSortLabel("Name", "name")}
                            </th>

                            <th
                                style={{
                                    ...th,
                                    width: "1%",
                                    whiteSpace: "nowrap",
                                }}
                            >
                                Inputs IP
                            </th>

                            <th
                                style={{
                                    ...th,
                                    cursor: "pointer",
                                    userSelect: "none",
                                }}
                                onClick={() => handleSort("outputs")}
                                onKeyDown={(event) =>
                                    handleSortKeyDown(event, "outputs")
                                }
                                role="button"
                                tabIndex={0}
                            >
                                {renderSortLabel("Multicast salida", "outputs")}
                            </th>

                            <th
                                style={{
                                    ...th,
                                    width: COL_WIDTHS.alarma,
                                    maxWidth: COL_WIDTHS.alarma,
                                    cursor: "pointer",
                                    userSelect: "none",
                                }}
                                onClick={() => handleSort("audioAlarm")}
                                onKeyDown={(event) =>
                                    handleSortKeyDown(event, "audioAlarm")
                                }
                                role="button"
                                tabIndex={0}
                            >
                                {renderSortLabel("Audio", "audioAlarm")}
                            </th>
                            <th
                                style={{
                                    ...th,
                                    width: COL_WIDTHS.alarma,
                                    maxWidth: COL_WIDTHS.alarma,
                                    cursor: "pointer",
                                    userSelect: "none",
                                }}
                                onClick={() => handleSort("videoAlarm")}
                                onKeyDown={(event) =>
                                    handleSortKeyDown(event, "videoAlarm")
                                }
                                role="button"
                                tabIndex={0}
                            >
                                {renderSortLabel("Video", "videoAlarm")}
                            </th>
                            <th
                                style={{
                                    ...th,
                                    width: COL_WIDTHS.estado,
                                    maxWidth: COL_WIDTHS.estado,
                                    cursor: "pointer",
                                    userSelect: "none",
                                }}
                                onClick={() => handleSort("state")}
                                onKeyDown={(event) =>
                                    handleSortKeyDown(event, "state")
                                }
                                role="button"
                                tabIndex={0}
                            >
                                {renderSortLabel("Estado", "state")}
                            </th>
                            <th
                                style={{
                                    ...th,
                                    width: 120,
                                    maxWidth: 140,
                                    cursor: "pointer",
                                    userSelect: "none",
                                }}
                                onClick={() => handleSort("tsErrors")}
                                onKeyDown={(event) =>
                                    handleSortKeyDown(event, "tsErrors")
                                }
                                role="button"
                                tabIndex={0}
                            >
                                {renderSortLabel("TS Err", "tsErrors")}
                            </th>
                        </tr>
                    </thead>
                    <tbody>
                        {filtered.length === 0 ? (
                            <tr>
                                <td
                                    colSpan={9}
                                    style={{
                                        padding: 12,
                                        textAlign: "center",
                                        color: "#666",
                                    }}
                                >
                                    {loading || hostsLoading ? (
                                        <span className="loader-center">
                                            <Spinner size={28} stroke={3} />
                                            Cargando señales…
                                        </span>
                                    ) : (
                                        <span className="sin-datos">
                                            Sin datos para mostrar
                                        </span>
                                    )}
                                </td>
                            </tr>
                        ) : (
                            filtered.map((r, idx) => {
                                const audioFail = r.audioAlarm === true;
                                const videoFail =
                                    r._explicitVideoFail === true ||
                                    r.videoAlarm === true;
                                const stopped = r.state === "Stopped";
                                const isStateFail =
                                    audioFail || videoFail || stopped;

                                const stateText =
                                    r.state === "Stopped"
                                        ? "Stopped (fail)"
                                        : r.state;

                                return (
                                    <tr
                                        key={`${r.ip}-${idx}`}
                                        className="table-row-hover"
                                    >
                                        <td style={td}>{r.host}</td>
                                        <td style={td}>
                                            <a
                                                href={hostHref(r.ip)}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                style={{
                                                    whiteSpace: "nowrap",
                                                }}
                                                title={`${TITAN_PROTOCOL}://${r.ip}`}
                                            >
                                                {r.ip}
                                            </a>
                                        </td>
                                        <td style={td}>{r.name}</td>

                                        <td
                                            style={{
                                                ...td,
                                                width: "1%",
                                                whiteSpace: "nowrap",
                                                verticalAlign: "top",
                                                textAlign: "left",
                                            }}
                                        >
                                            {Array.isArray(r.ipInputs) &&
                                            r.ipInputs.length > 0 ? (
                                                <div
                                                    style={{
                                                        display: "inline-flex",
                                                        flexDirection: "column",
                                                        gap: 4,
                                                        width: "auto",
                                                        textAlign: "left",
                                                    }}
                                                >
                                                    {r.ipInputs.map(
                                                        (ii, iiIdx) => (
                                                            <div
                                                                key={iiIdx}
                                                                style={{
                                                                    display:
                                                                        "inline-flex",
                                                                    alignItems:
                                                                        "center",
                                                                    gap: 6,
                                                                    padding:
                                                                        "3px 4px",
                                                                    borderRadius: 4,
                                                                    backgroundColor:
                                                                        "#ffffff",
                                                                    width: "max-content",
                                                                    maxWidth:
                                                                        "300px",
                                                                    textAlign:
                                                                        "left",
                                                                }}
                                                                title={
                                                                    ii.source
                                                                        ? `${ii.url} • Source: ${ii.source}`
                                                                        : ii.url ||
                                                                          "(sin Url)"
                                                                }
                                                            >
                                                                <span
                                                                    style={{
                                                                        display:
                                                                            "inline-block",
                                                                        width: 10,
                                                                        height: 10,
                                                                        borderRadius:
                                                                            "50%",
                                                                        flex: "0 0 auto",
                                                                        backgroundColor:
                                                                            ii.isActive
                                                                                ? "green"
                                                                                : "red",
                                                                    }}
                                                                />
                                                                <span
                                                                    style={{
                                                                        flex: "1 1 auto",
                                                                        fontWeight:
                                                                            ii.isActive
                                                                                ? "bold"
                                                                                : "normal",
                                                                        color: ii.isActive
                                                                            ? "green"
                                                                            : "#111827",
                                                                        overflow:
                                                                            "hidden",
                                                                        textOverflow:
                                                                            "ellipsis",
                                                                        whiteSpace:
                                                                            "nowrap",
                                                                        maxWidth:
                                                                            "260px",
                                                                        textAlign:
                                                                            "left",
                                                                    }}
                                                                >
                                                                    {ii.url ||
                                                                        "(sin Url)"}
                                                                </span>
                                                            </div>
                                                        )
                                                    )}
                                                </div>
                                            ) : (
                                                <span
                                                    style={{
                                                        color: "#6b7280",
                                                        fontStyle: "italic",
                                                    }}
                                                >
                                                    sin IPInputList
                                                </span>
                                            )}
                                        </td>

                                        <td
                                            style={{
                                                ...td,
                                                maxWidth: 420,
                                                overflow: "hidden",
                                                textOverflow: "ellipsis",
                                            }}
                                            title={
                                                typeof r.outputs === "string"
                                                    ? r.outputs
                                                    : JSON.stringify(r.outputs)
                                            }
                                        >
                                            {typeof r.outputs === "string"
                                                ? r.outputs
                                                : JSON.stringify(r.outputs)}
                                        </td>

                                        <td
                                            style={{
                                                ...td,
                                                width: COL_WIDTHS.alarma,
                                                maxWidth: COL_WIDTHS.alarma,
                                                whiteSpace: "nowrap",
                                            }}
                                            title={
                                                audioFail
                                                    ? `Alarma audio • Nivel: ${
                                                          r.audioLevelDb ??
                                                          "N/A"
                                                      } dB • Umbral ${
                                                          r.audioThreshold ??
                                                          "N/A"
                                                      } dB`
                                                    : `Audio OK • Nivel: ${
                                                          r.audioLevelDb ??
                                                          "N/A"
                                                      } dB`
                                            }
                                        >
                                            {audioFail ? (
                                                <span className="badge badge-red">
                                                    Alarma
                                                </span>
                                            ) : (
                                                <span className="badge badge-green">
                                                    OK
                                                </span>
                                            )}
                                        </td>

                                        <td
                                            style={{
                                                ...td,
                                                width: COL_WIDTHS.alarma,
                                                maxWidth: COL_WIDTHS.alarma,
                                                whiteSpace: "nowrap",
                                            }}
                                            title={videoFail ? "Alarma video" : "Video OK"}
                                        >
                                            {videoFail ? (
                                                <span className="badge badge-red">
                                                    Alarma
                                                </span>
                                            ) : (
                                                <span className="badge badge-green">
                                                    OK
                                                </span>
                                            )}
                                        </td>

                                        <td
                                            style={{
                                                ...td,
                                                width: COL_WIDTHS.estado,
                                                maxWidth: COL_WIDTHS.estado,
                                                whiteSpace: "nowrap",
                                            }}
                                            title={stateText}
                                        >
                                            <div
                                                style={{
                                                    display: "inline-flex",
                                                    alignItems: "center",
                                                    gap: 6,
                                                    minWidth: 0,
                                                }}
                                            >
                                                <span
                                                    style={{
                                                        display: "inline-block",
                                                        width: 12,
                                                        height: 12,
                                                        borderRadius: "50%",
                                                        flex: "0 0 auto",
                                                        backgroundColor:
                                                            isStateFail
                                                                ? "red"
                                                                : "green",
                                                    }}
                                                />
                                                <span
                                                    style={{
                                                        overflow: "hidden",
                                                        textOverflow:
                                                            "ellipsis",
                                                        whiteSpace: "nowrap",
                                                        minWidth: 0,
                                                        flex: "1 1 auto",
                                                    }}
                                                >
                                                    {stateText}
                                                </span>
                                            </div>
                                        </td>

                                        <td
                                            style={{
                                                ...td,
                                                textAlign: "left",
                                                whiteSpace: "nowrap",
                                            }}
                                            title="Suma de errores de PID / CC"
                                        >
                                            {r.tsErrors ?? 0}
                                        </td>
                                    </tr>
                                );
                            })
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

/* Encabezados (left) y celdas */
const th = {
    textAlign: "left",
    padding: "10px 8px",
    borderBottom: "1px solid #ddd",
    position: "sticky",
    top: 0,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    background: "#fafafa",
    zIndex: 100,
};

/* Encabezados/celdas compactas para la tabla de fallas (contenido ajustado) */
const thCompact = {
    textAlign: "left",
    padding: "8px 8px",
    borderBottom: "1px solid #f0c4c4",
    whiteSpace: "nowrap",
    position: "sticky",
    top: 0,
    background: "#fdeeee",
    zIndex: 100,
};

const td = {
    padding: "8px 8px",
    borderBottom: "1px solid #eee",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    textAlign: "left",
};

const tdCompact = {
    padding: "6px 8px",
    borderBottom: "1px solid #fdeeee",
    whiteSpace: "nowrap",
    textAlign: "left",
};
