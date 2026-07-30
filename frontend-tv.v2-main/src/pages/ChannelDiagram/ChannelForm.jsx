// src/pages/ChannelDiagram/ChannelForm.jsx
import { Field, Formik, Form, useFormikContext } from "formik";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import api from "../../utils/api";
import Select from "react-select";
import Swal from "sweetalert2";
import "./ChannelForm.css";
import { prepareDiagramState } from "./diagramUtils";
import { HANDLE_IDS } from "./handleConstants.js";
import { clearLocalStorage } from "../../utils/localStorageUtils";
import {
  ensureEdgeHandlesForNodes,
  ensureHandleId,
  inferNodeHandleType,
  toHandleTypeKey,
} from "./handleStandard.js";
import { makeHandle, isValidHandle } from "./handles";

// 🔹 Construye SOLO la línea inferior del tooltip (Origen/Destino)
const buildEdgeTooltip = (labelStart = "", labelEnd = "") => {
  const hasStart = Boolean(labelStart);
  const hasEnd = Boolean(labelEnd);

  if (!hasStart && !hasEnd) return "";

  const parts = [];
  if (hasStart) parts.push(`Origen: ${labelStart}`);
  if (hasEnd) parts.push(`Destino: ${labelEnd}`);

  return parts.join(" | ");
};

// ✅ Normaliza dirección: guarda SIEMPRE en DB como "ida" | "vuelta" | "bi"
// Compatibilidad: "bidireccional" => "bi"
const normalizeDirection = (raw) => {
  const v = String(raw || "").trim().toLowerCase();
  if (v === "ida") return "ida";
  if (v === "vuelta") return "vuelta";
  if (v === "bi") return "bi";
  if (v === "bidireccional") return "bi";
  return "ida";
};

export function toPayload(nodes = [], edges = [], viewport = null) {
  const DEFAULT_SOURCE_HANDLE = makeHandle("out", "right", 1);
  const DEFAULT_TARGET_HANDLE = makeHandle("in", "left", 1);

  const normalizedNodes = (Array.isArray(nodes) ? nodes : []).map((node) => ({
    id: node.id,
    type: node.type || "default",
    equipo:
      node.equipo ??
      node.data?.equipoId ??
      (node.data && node.data.equipo ? node.data.equipo : undefined),
    data: { ...node.data },
    position: {
      x: Number.isFinite(Number(node?.position?.x)) ? Number(node.position.x) : 0,
      y: Number.isFinite(Number(node?.position?.y)) ? Number(node.position.y) : 0,
    },
  }));

  const normalizedEdges = (Array.isArray(edges) ? edges : []).map((edge) => {
    const sourceHandle = isValidHandle(edge?.sourceHandle)
      ? edge.sourceHandle
      : DEFAULT_SOURCE_HANDLE;
    const targetHandle = isValidHandle(edge?.targetHandle)
      ? edge.targetHandle
      : DEFAULT_TARGET_HANDLE;

    const rawData = edge?.data || {};

    const labelStart = rawData.labelStart ?? edge.labelStart ?? "";
    const labelEnd = rawData.labelEnd ?? edge.labelEnd ?? "";

    // ✅ Guarda SOLO ida / vuelta / bi (con compatibilidad bidireccional -> bi)
    const direction = normalizeDirection(rawData.direction);

    const tooltipTitle = edge?.label || rawData.label || edge?.id || "";
    const tooltip = buildEdgeTooltip(labelStart, labelEnd);

    // ✅ Color persistido (prioridad data.color, fallback style.stroke)
    const color = rawData.color || edge?.style?.stroke || undefined;

    return {
      id: edge.id,
      source: edge.source,
      target: edge.target,
      sourceHandle,
      targetHandle,
      type: "customDirectional",
      label: edge.label || "",
      data: {
        ...rawData,
        labelStart,
        labelEnd,
        direction,
        tooltipTitle,
        tooltip,
        ...(color ? { color } : {}),
      },
      style: edge.style || {},
    };
  });

  const normalizedViewport =
    viewport && typeof viewport === "object"
      ? {
          x: Number.isFinite(Number(viewport.x)) ? Number(viewport.x) : 0,
          y: Number.isFinite(Number(viewport.y)) ? Number(viewport.y) : 0,
          zoom: Number.isFinite(Number(viewport.zoom)) ? Number(viewport.zoom) : 1,
        }
      : null;

  return {
    nodes: normalizedNodes,
    edges: normalizedEdges,
    viewport: normalizedViewport,
  };
}

// ⛔️ Opción B: ya NO usamos ARROW_CLOSED aquí (lo dibuja el Edge custom)
// const ARROW_CLOSED = { type: 1 };

const SAME_X_EPS = 8;

// ---- react-select estilos consistentes (altura 38px, ancho 100%) ----
const selectStyles = {
  container: (base) => ({ ...base, width: "100%" }),
  control: (base, state) => ({
    ...base,
    minHeight: 38,
    height: 38,
    borderRadius: 8,
    borderColor: state.isFocused ? "#375d9d" : "#d1d5db",
    boxShadow: state.isFocused ? "0 0 0 3px rgba(55, 93, 157, 0.20)" : "none",
    "&:hover": { borderColor: state.isFocused ? "#375d9d" : "#cbd5e1" },
  }),
  valueContainer: (base) => ({ ...base, padding: "2px 8px" }),
  indicatorsContainer: (base) => ({ ...base, height: 38 }),
  dropdownIndicator: (base) => ({ ...base, padding: "6px 8px" }),
  clearIndicator: (base) => ({ ...base, padding: "6px 8px" }),
  menu: (base) => ({ ...base, zIndex: 20 }),
};

const STORAGE_KEY = "channel-form-draft";

const formatSignalLabel = (signal) => {
  if (!signal || typeof signal !== "object") return "";
  const name =
    signal?.nameChannel ||
    signal?.nombre ||
    signal?.signalName ||
    signal?.signal ||
    signal?.label;
  const technology = signal?.tipoTecnologia || signal?.tipo || signal?.technology;
  const parts = [];
  if (name) parts.push(String(name));
  if (technology) parts.push(String(technology));
  return parts.join(" - ");
};

const defaultFormikValues = {
  id: "",
  label: "",
  posX: "",
  posY: "",
  edgeId: "",
  source: "",
  target: "",
  edgeLabel: "",
  edgeLabelStart: "",
  edgeLabelEnd: "",
};

// ✅ SELECT DIRECCIÓN: deja SOLO ida + bi (se guarda como "bi" en DB)
const EDGE_DIR_OPTIONS = [
  { value: "ida", label: "Ida (source → target)" },
  { value: "bi", label: "Bidireccional (↔)" },
];

/** 🎨 Paleta de colores para enlaces (hex) */
const EDGE_COLOR_OPTIONS = [
  { value: "#3b82f6", label: "Azul" },
  { value: "#22c55e", label: "Verde" },
  { value: "#ef4444", label: "Rojo" },
  { value: "#f59e0b", label: "Ámbar" },
  { value: "#a855f7", label: "Morado" },
  { value: "#06b6d4", label: "Cian" },
  { value: "#64748b", label: "Gris" },
  { value: "#111827", label: "Negro" },
];

// ✅ default por dirección (bi usa el "verde")
const defaultEdgeColorByDir = (dir) =>
  normalizeDirection(dir) === "bi" ? "#22c55e" : "#3b82f6";

const FormValuesObserver = ({ onChange }) => {
  const { values } = useFormikContext();
  useEffect(() => onChange(values), [values, onChange]);
  return null;
};

const toNumberOr = (val, def = 0) => {
  const n = Number(val);
  return Number.isFinite(n) ? n : def;
};
const tipoToKey = toHandleTypeKey;
const toId = (v) => {
  if (!v) return null;
  if (typeof v === "string") return v;
  if (typeof v === "object" && v._id) return String(v._id);
  return null;
};

const removeEquipoFromGroupedOptions = (grouped, valueToRemove) => {
  const v = String(valueToRemove);
  return grouped
    .map((g) => ({
      ...g,
      options: (g.options || []).filter((opt) => String(opt.value) !== v),
    }))
    .filter((g) => (g.options || []).length > 0);
};

const insertEquipoIntoGroupedOptions = (grouped, option) => {
  const tipo = option?.meta?.tipo || "";
  const labelByTipo = {
    satelite: "Satélites",
    ird: "IRD",
    switch: "Switches",
    router: "Routers",
  };
  const groupLabel = labelByTipo[tipo] || "Otros equipos";

  const next = grouped.map((g) => ({ ...g, options: [...(g.options || [])] }));
  const idx = next.findIndex((g) => g.label === groupLabel);

  const byLabel = (a, b) => a.label.localeCompare(b.label, "es", { sensitivity: "base" });

  if (idx >= 0) {
    if (!next[idx].options.some((o) => String(o.value) === String(option.value))) {
      next[idx].options.push(option);
      next[idx].options.sort(byLabel);
    }
    return next;
  }

  next.push({ label: groupLabel, options: [option] });

  const order = ["Satélites", "IRD", "Switches", "Routers", "Otros equipos"];
  next.sort((a, b) => order.indexOf(a.label) - order.indexOf(b.label));
  return next;
};

function pickHandlesByGeometry(srcNode, tgtNode, directionRaw) {
  // ✅ normalizamos por si viene algo viejo (bidireccional -> bi)
  const direction = normalizeDirection(directionRaw);

  const srcTipo =
    inferNodeHandleType(srcNode) || tipoToKey(srcNode?.data?.equipo?.tipoNombre?.tipoNombre);
  if (srcTipo === "satelite") {
    return {
      sourceHandle: ensureHandleId(HANDLE_IDS.OUT_RIGHT_PRIMARY),
      targetHandle: ensureHandleId(HANDLE_IDS.IN_LEFT_PRIMARY),
    };
  }

  const sx = Number(srcNode?.position?.x ?? 0);
  const sy = Number(srcNode?.position?.y ?? 0);
  const tx = Number(tgtNode?.position?.x ?? 0);
  const ty = Number(tgtNode?.position?.y ?? 0);

  const sameX = Math.abs(sx - tx) <= SAME_X_EPS;

  const ensureByType = (rawSourceHandle, rawTargetHandle) => {
    const baseHandles = {
      sourceHandle: ensureHandleId(rawSourceHandle),
      targetHandle: ensureHandleId(rawTargetHandle),
    };

    const ensured = ensureEdgeHandlesForNodes(baseHandles, srcNode, tgtNode, baseHandles);

    return {
      sourceHandle: ensured.sourceHandle || baseHandles.sourceHandle,
      targetHandle: ensured.targetHandle || baseHandles.targetHandle,
    };
  };

  // ✅ "bi": mantiene tu lógica antigua de "vuelta" (handles invertidos)
  if (sameX && sy !== ty) {
    const srcIsUpper = sy < ty;
    if (direction === "ida") {
      return srcIsUpper
        ? ensureByType(HANDLE_IDS.OUT_BOTTOM_PRIMARY, HANDLE_IDS.IN_TOP_PRIMARY)
        : ensureByType(HANDLE_IDS.OUT_TOP_PRIMARY, HANDLE_IDS.IN_BOTTOM_PRIMARY);
    }
    return srcIsUpper
      ? ensureByType(HANDLE_IDS.OUT_BOTTOM_SECONDARY, HANDLE_IDS.IN_TOP_SECONDARY)
      : ensureByType(HANDLE_IDS.OUT_TOP_SECONDARY, HANDLE_IDS.IN_BOTTOM_SECONDARY);
  }

  return direction === "ida"
    ? ensureByType(HANDLE_IDS.OUT_RIGHT_PRIMARY, HANDLE_IDS.IN_LEFT_PRIMARY)
    : ensureByType(HANDLE_IDS.OUT_LEFT_PRIMARY, HANDLE_IDS.IN_RIGHT_PRIMARY);
}

const ChannelForm = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { id: channelIdParam } = useParams();
  const isEditMode = Boolean(channelIdParam);

  const [optionsSelectChannel, setOptionSelectChannel] = useState([]);
  const [signalsLoading, setSignalsLoading] = useState(true);
  const [signalsError, setSignalsError] = useState(null);
  const [allEquipoOptions, setAllEquipoOptions] = useState([]);
  const [selectedValue, setSelectedValue] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const [currentChannel, setCurrentChannel] = useState(null);
  const [loadingChannel, setLoadingChannel] = useState(isEditMode);
  const [channelError, setChannelError] = useState(null);

  const [optionsSelectEquipo, setOptionSelectEquipo] = useState([]);
  const [selectedEquipoValue, setSelectedEquipoValue] = useState(null);
  const [selectedIdEquipo, setSelectedIdEquipo] = useState(null);
  const [selectedEquipoTipo, setSelectedEquipoTipo] = useState(null);
  const [equiposLoaded, setEquiposLoaded] = useState(false);

  const [draftNodes, setDraftNodes] = useState([]);
  const [draftEdges, setDraftEdges] = useState([]);

  const [edgeSourceSel, setEdgeSourceSel] = useState(null);
  const [edgeTargetSel, setEdgeTargetSel] = useState(null);

  // 🎨 Select de color
  const [edgeColorSel, setEdgeColorSel] = useState(EDGE_COLOR_OPTIONS[0]);

  const [initialValues, setInitialValues] = useState(defaultFormikValues);
  const [formValues, setFormValues] = useState(defaultFormikValues);
  const [edgeDirection, setEdgeDirection] = useState(EDGE_DIR_OPTIONS[0]);
  const [isRestoring, setIsRestoring] = useState(true);

  useEffect(() => {
    if (isEditMode) setIsRestoring(false);
  }, [isEditMode]);

  const persistDraft = useCallback((payload) => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    } catch (err) {
      console.warn("No se pudo guardar el borrador del formulario:", err);
    }
  }, []);

  const clearDraft = useCallback(() => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.removeItem(STORAGE_KEY);
    } catch (err) {
      console.warn("No se pudo limpiar el borrador:", err);
    }
  }, []);

  useEffect(() => {
    if (isEditMode) return;

    if (typeof window === "undefined") {
      setIsRestoring(false);
      return;
    }

    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        setIsRestoring(false);
        return;
      }

      const stored = JSON.parse(raw);

      if (stored?.formValues && typeof stored.formValues === "object") {
        const mergedValues = { ...defaultFormikValues, ...stored.formValues };
        setInitialValues(mergedValues);
        setFormValues(mergedValues);
      }

      if (stored?.selectedValue) setSelectedValue(stored.selectedValue);
      if (stored?.selectedId) setSelectedId(stored.selectedId);
      if (stored?.selectedEquipoValue) setSelectedEquipoValue(stored.selectedEquipoValue);
      if (stored?.selectedIdEquipo) setSelectedIdEquipo(stored.selectedIdEquipo);
      if (stored?.selectedEquipoTipo) setSelectedEquipoTipo(stored.selectedEquipoTipo);
      if (Array.isArray(stored?.draftNodes)) setDraftNodes(stored.draftNodes);

      // ✅ normaliza direcciones al restaurar edges (bidireccional -> bi)
      if (Array.isArray(stored?.draftEdges)) {
        const restoredEdges = stored.draftEdges.map((e) => {
          const d = e?.data || {};
          const dir = normalizeDirection(d.direction);
          return { ...e, data: { ...d, direction: dir } };
        });
        setDraftEdges(restoredEdges);
      }

      if (stored?.edgeSourceSel) setEdgeSourceSel(stored.edgeSourceSel);
      if (stored?.edgeTargetSel) setEdgeTargetSel(stored.edgeTargetSel);

      if (stored?.edgeColorSel) setEdgeColorSel(stored.edgeColorSel);
      const storedColor = stored?.edgeColorValue;
      if (storedColor) {
        const found = EDGE_COLOR_OPTIONS.find((c) => c.value === storedColor);
        if (found) setEdgeColorSel(found);
      }

      const dirValue = stored?.edgeDirectionValue || stored?.edgeDirection?.value;
      if (dirValue) {
        const normalized = normalizeDirection(dirValue);
        const dirOpt =
          EDGE_DIR_OPTIONS.find((opt) => opt.value === normalized) || EDGE_DIR_OPTIONS[0];
        setEdgeDirection(dirOpt);

        if (!storedColor && !stored?.edgeColorSel) {
          const def = defaultEdgeColorByDir(dirOpt.value);
          const defOpt = EDGE_COLOR_OPTIONS.find((c) => c.value === def);
          if (defOpt) setEdgeColorSel(defOpt);
        }
      }
    } catch (err) {
      console.warn("No se pudo restaurar el borrador:", err);
    } finally {
      setIsRestoring(false);
    }
  }, [isEditMode]);

  useEffect(() => {
    if (isEditMode || isRestoring) return;

    const hasFormValues = Object.values(formValues || {}).some((val) => {
      if (typeof val === "number") return !Number.isNaN(val) && val !== 0;
      if (typeof val === "string") return val.trim() !== "";
      return Boolean(val);
    });

    const shouldPersist =
      hasFormValues ||
      Boolean(
        selectedValue ||
          selectedId ||
          selectedEquipoValue ||
          selectedIdEquipo ||
          selectedEquipoTipo ||
          draftNodes.length ||
          draftEdges.length ||
          edgeSourceSel ||
          edgeTargetSel ||
          edgeColorSel ||
          (edgeDirection?.value && edgeDirection.value !== EDGE_DIR_OPTIONS[0].value)
      );

    if (!shouldPersist) {
      clearDraft();
      return;
    }

    persistDraft({
      formValues,
      selectedValue,
      selectedId,
      selectedEquipoValue,
      selectedIdEquipo,
      selectedEquipoTipo,
      draftNodes,
      draftEdges,
      edgeSourceSel,
      edgeTargetSel,
      edgeDirectionValue: edgeDirection?.value || null,
      edgeColorSel,
      edgeColorValue: edgeColorSel?.value || null,
    });
  }, [
    draftEdges,
    draftNodes,
    edgeDirection,
    edgeSourceSel,
    edgeTargetSel,
    edgeColorSel,
    formValues,
    clearDraft,
    persistDraft,
    selectedEquipoTipo,
    selectedEquipoValue,
    selectedId,
    selectedIdEquipo,
    selectedValue,
    isRestoring,
    isEditMode,
  ]);

  useEffect(() => {
    if (!isEditMode) {
      setCurrentChannel(null);
      setChannelError(null);
      setLoadingChannel(false);
      return;
    }

    let active = true;
    setLoadingChannel(true);
    setChannelError(null);

    (async () => {
      try {
        const response = await api.getChannelDiagramById(channelIdParam);
        const payload = response?.data ?? response;
        const diagram = Array.isArray(payload) ? payload[0] : payload;

        if (!diagram) throw new Error("No se encontró el diagrama solicitado para edición.");
        if (diagram?.isSample) throw new Error("Los diagramas de demostración no se pueden editar.");

        const { nodes: normalizedNodes, edges: normalizedEdges } = prepareDiagramState(diagram);
        if (!active) return;

        // ✅ normaliza direcciones cargadas desde API (bidireccional -> bi)
        const fixedEdges = (normalizedEdges || []).map((e) => {
          const d = e?.data || {};
          const dir = normalizeDirection(d.direction);
          return { ...e, data: { ...d, direction: dir } };
        });

        setCurrentChannel(diagram);
        setDraftNodes(normalizedNodes);
        setDraftEdges(fixedEdges);
        setEdgeSourceSel(null);
        setEdgeTargetSel(null);
        setEdgeDirection(EDGE_DIR_OPTIONS[0]);
        setEdgeColorSel(EDGE_COLOR_OPTIONS[0]);

        const signalData = diagram?.signal || diagram?.signalId || diagram?.channel;
        const signalId = toId(signalData) || (typeof signalData === "string" ? signalData : null);
        if (signalId) {
          const signalLabel =
            formatSignalLabel(typeof signalData === "object" ? signalData : diagram?.signal) ||
            signalId;
          setSelectedValue(signalId);
          setSelectedId(signalLabel);
        }
      } catch (error) {
        if (!active) return;
        const message =
          error?.response?.data?.message ||
          error?.response?.data?.error ||
          error?.message ||
          "No se pudo cargar el diagrama para editarlo.";
        setChannelError(message);
        Swal.fire("Error", message, "error");
      } finally {
        if (active) setLoadingChannel(false);
      }
    })();

    return () => {
      active = false;
    };
  }, [channelIdParam, isEditMode]);

  // Cargar señales y filtrar disponibles
  useEffect(() => {
    let mounted = true;
    (async () => {
      setSignalsLoading(true);
      setSignalsError(null);
      try {
        const [signalsRes, channelsRes] = await Promise.all([
          api.getSignal(),
          api.listChannelDiagrams(),
        ]);

        const signals = Array.isArray(signalsRes?.data) ? signalsRes.data : [];
        const channels = Array.isArray(channelsRes?.data) ? channelsRes.data : [];

        const usedSet = new Set(channels.map((ch) => toId(ch?.signal)).filter(Boolean));

        let editingSignalOption = null;
        if (isEditMode) {
          const channelMatch = channels.find((ch) => String(ch?._id) === String(channelIdParam));
          const baseSignal = channelMatch?.signal || currentChannel?.signal;
          const editingSignalId =
            toId(baseSignal) || (typeof baseSignal === "string" ? String(baseSignal) : null);
          if (editingSignalId) {
            usedSet.delete(editingSignalId);
            const editingSignalLabel =
              formatSignalLabel(typeof baseSignal === "object" ? baseSignal : currentChannel?.signal) ||
              editingSignalId;
            editingSignalOption = {
              value: editingSignalId,
              label: editingSignalLabel,
              raw:
                (typeof baseSignal === "object" && baseSignal) ||
                currentChannel?.signal ||
                channelMatch?.signal ||
                null,
            };
          }
        }

        const unusedSignals = signals.filter((s) => !usedSet.has(toId(s?._id)));

        let options = unusedSignals.map((opt) => ({
          label: `${opt.nameChannel ?? opt.nombre ?? "Sin nombre"} - ${
            opt.tipoTecnologia ?? opt.tipo ?? ""
          }`.trim(),
          value: opt._id,
          raw: opt,
        }));

        if (editingSignalOption) {
          const exists = options.some((opt) => String(opt.value) === String(editingSignalOption.value));
          if (!exists) options = [editingSignalOption, ...options];
        }

        if (!mounted) return;
        setOptionSelectChannel(options);

        setSelectedValue((prevSelectedValue) => {
          if (isEditMode) {
            const current = options.find((opt) => String(opt.value) === String(prevSelectedValue));
            if (current) {
              setSelectedId(current.label);
              return prevSelectedValue;
            }
            if (editingSignalOption) {
              setSelectedId(editingSignalOption.label);
              return editingSignalOption.value;
            }
            setSelectedId(null);
            return null;
          }

          const preId = searchParams.get("signalId");
          if (preId) {
            const found = options.find((o) => String(o.value) === String(preId));
            if (found) {
              setSelectedId(found.label);
              return found.value;
            }
            setSelectedId(null);
            return null;
          }

          if (prevSelectedValue) {
            const match = options.find((o) => String(o.value) === String(prevSelectedValue));
            if (match) {
              setSelectedId(match.label);
              return prevSelectedValue;
            }
          }

          setSelectedId(null);
          return null;
        });
      } catch (e) {
        if (!mounted) return;
        setSignalsError(e);
      } finally {
        if (mounted) setSignalsLoading(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [searchParams, isEditMode, channelIdParam, currentChannel]);

  // Cargar equipos
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const res = await api.getEquipo();
        const arr = res.data || [];

        const satelites = [];
        const irds = [];
        const switches = [];
        const routers = [];
        const otros = [];

        for (const eq of arr) {
          const key = tipoToKey(eq?.tipoNombre);
          const baseName = (eq?.nombre?.toUpperCase?.() || eq?.nombre || "").trim();
          const pol = eq?.satelliteRef?.satelliteType?.typePolarization
            ? String(eq.satelliteRef.satelliteType.typePolarization).trim()
            : null;

          const option = {
            label: key === "satelite" && pol ? `${baseName} ${pol}` : baseName,
            value: eq?._id,
            meta: { tipo: key },
          };

          if (key === "satelite") satelites.push(option);
          else if (key === "ird") irds.push(option);
          else if (key === "switch") switches.push(option);
          else if (key === "router") routers.push(option);
          else otros.push(option);
        }

        const byLabel = (a, b) => a.label.localeCompare(b.label, "es", { sensitivity: "base" });
        satelites.sort(byLabel);
        irds.sort(byLabel);
        switches.sort(byLabel);
        routers.sort(byLabel);
        otros.sort(byLabel);

        const grouped = [
          { label: "Satélites", options: satelites },
          { label: "IRD", options: irds },
          { label: "Switches", options: switches },
          { label: "Routers", options: routers },
          { label: "Otros equipos", options: otros },
        ].filter((g) => g.options.length > 0);

        if (mounted) {
          setAllEquipoOptions(grouped.map((g) => ({ label: g.label, options: [...g.options] })));
          setOptionSelectEquipo(grouped.map((g) => ({ label: g.label, options: [...g.options] })));
          setEquiposLoaded(true);
        }
      } catch (e) {
        console.warn("Error cargando equipos:", e?.message);
      }
    })();

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (!equiposLoaded || !allEquipoOptions.length) return;

    setOptionSelectEquipo((prev) => {
      let next = allEquipoOptions.map((group) => ({
        label: group.label,
        options: [...(group.options || [])],
      }));

      draftNodes.forEach((node) => {
        const equipoId = node?.data?.equipoId;
        if (equipoId) next = removeEquipoFromGroupedOptions(next, equipoId);
      });

      const prevSerialized = JSON.stringify(prev);
      const nextSerialized = JSON.stringify(next);
      if (prevSerialized === nextSerialized) return prev;
      return next;
    });
  }, [draftNodes, allEquipoOptions, equiposLoaded]);

  const handleSelectedChannel = (e) => {
    setSelectedValue(e?.value || null);
    setSelectedId(e?.label || null);
  };

  const handleSelectedEquipo = (e) => {
    setSelectedEquipoValue(e?.value || null);
    setSelectedIdEquipo(e?.label || null);
    setSelectedEquipoTipo(e?.meta?.tipo || null);
  };

  const handleRemoveNode = useCallback(
    async (nodeId) => {
      const node = draftNodes.find((n) => String(n.id) === String(nodeId));
      if (!node) return;

      const confirm = await Swal.fire({
        icon: "warning",
        title: `Eliminar nodo "${nodeId}"`,
        text: "Se eliminará el nodo y los enlaces asociados. El equipo volverá a estar disponible en la lista.",
        showCancelButton: true,
        confirmButtonText: "Sí, eliminar",
        cancelButtonText: "Cancelar",
      });

      if (!confirm.isConfirmed) return;

      const remainingNodes = draftNodes.filter((n) => String(n.id) !== String(nodeId));
      setDraftNodes(remainingNodes);

      const removedEdgesIds = new Set();
      const remainingEdges = draftEdges
        .filter((e) => {
          const touches = String(e.source) === String(nodeId) || String(e.target) === String(nodeId);
          if (touches) removedEdgesIds.add(e.id);
          return !touches;
        })
        .map((e) => {
          // ✅ asegura normalización por si venían viejos
          const d = e?.data || {};
          return { ...e, data: { ...d, direction: normalizeDirection(d.direction) } };
        });

      setDraftEdges(remainingEdges);

      setEdgeSourceSel((prev) => (prev?.value === nodeId ? null : prev));
      setEdgeTargetSel((prev) => (prev?.value === nodeId ? null : prev));

      const equipoId = node?.data?.equipoId;
      const equipoNombre = node?.data?.equipoNombre || "";
      const equipoTipo = node?.data?.equipoTipo || "";

      if (equipoId) {
        const option = { label: equipoNombre, value: equipoId, meta: { tipo: equipoTipo } };
        setOptionSelectEquipo((prev) => insertEquipoIntoGroupedOptions(prev, option));
      }

      setSelectedEquipoValue((prev) => (String(prev) === String(equipoId) ? null : prev));
      setSelectedIdEquipo((prev) => (String(prev) === String(equipoNombre) ? null : prev));
      setSelectedEquipoTipo((prev) => (String(prev) === String(equipoTipo) ? null : prev));

      Swal.fire({
        icon: "success",
        title: "Nodo eliminado",
        html: `
          <div style="text-align:left">
            <div><b>Nodo:</b> ${nodeId}</div>
            <div><b>Equipo devuelto:</b> ${equipoNombre || "-"}</div>
            <div><b>Enlaces removidos:</b> ${removedEdgesIds.size}</div>
          </div>
        `,
        timer: 1400,
        showConfirmButton: false,
      });
    },
    [draftNodes, draftEdges]
  );

  const handleRemoveEdge = useCallback(async (edgeId) => {
    const edge = draftEdges.find((e) => String(e.id) === String(edgeId));
    if (!edge) return;

    const confirm = await Swal.fire({
      icon: "warning",
      title: `Eliminar enlace "${edgeId}"`,
      text: "El enlace seleccionado se eliminará del borrador.",
      showCancelButton: true,
      confirmButtonText: "Sí, eliminar",
      cancelButtonText: "Cancelar",
    });

    if (!confirm.isConfirmed) return;

    setDraftEdges((prev) => prev.filter((e) => String(e.id) !== String(edgeId)));

    Swal.fire({
      icon: "success",
      title: "Enlace eliminado",
      timer: 1200,
      showConfirmButton: false,
    });
  }, [draftEdges]);

  const handleClearAll = useCallback(async () => {
    const nodeCount = draftNodes.length;
    const edgeCount = draftEdges.length;

    const confirm = await Swal.fire({
      icon: "warning",
      title: "Vaciar borrador",
      html: `Se eliminarán <b>${nodeCount}</b> nodos y <b>${edgeCount}</b> enlaces. 
             Se restaurará el listado completo de equipos.`,
      showCancelButton: true,
      confirmButtonText: "Sí, vaciar todo",
      cancelButtonText: "Cancelar",
    });

    if (!confirm.isConfirmed) return;

    setDraftNodes([]);
    setDraftEdges([]);

    setEdgeSourceSel(null);
    setEdgeTargetSel(null);
    setEdgeDirection(EDGE_DIR_OPTIONS[0]);
    setEdgeColorSel(EDGE_COLOR_OPTIONS[0]);

    setSelectedEquipoValue(null);
    setSelectedIdEquipo(null);
    setSelectedEquipoTipo(null);

    setOptionSelectEquipo(allEquipoOptions.map((g) => ({ label: g.label, options: [...g.options] })));

    Swal.fire({
      icon: "success",
      title: "Borrador vacío",
      html: `
        <div style="text-align:left">
          <div><b>Nodos eliminados:</b> ${nodeCount}</div>
          <div><b>Enlaces eliminados:</b> ${edgeCount}</div>
          <div><b>Equipos:</b> restaurados</div>
        </div>
      `,
      timer: 1400,
      showConfirmButton: false,
    });
  }, [draftNodes.length, draftEdges.length, allEquipoOptions]);

  const edgeNodeOptions = useMemo(
    () =>
      draftNodes.map((n) => ({
        value: n.id,
        label: `${n.id} — ${n.data?.label || ""}`.trim(),
      })),
    [draftNodes]
  );

  const selectedSignalOption = useMemo(
    () => optionsSelectChannel.find((opt) => String(opt.value) === String(selectedValue)) || null,
    [optionsSelectChannel, selectedValue]
  );

  const selectedEquipoOption = useMemo(() => {
    if (!selectedEquipoValue) return null;
    for (const group of optionsSelectEquipo) {
      const found = group.options?.find((opt) => String(opt.value) === String(selectedEquipoValue));
      if (found) return found;
    }
    return null;
  }, [optionsSelectEquipo, selectedEquipoValue]);

  useEffect(() => {
    if (!selectedValue || selectedSignalOption) return;
    setSelectedId(null);
  }, [selectedSignalOption, selectedValue]);

  const handleFormValuesChange = useCallback((vals) => setFormValues(vals), []);

  const handleCreateFlowClick = useCallback(() => {
    if (isEditMode) return;
    const cleaned = clearLocalStorage();
    if (cleaned) console.info("localStorage limpiado por click en 'Crear flujo'");
  }, [isEditMode]);

  if (isEditMode && channelError) {
    return (
      <div className="chf__wrapper">
        <nav aria-label="breadcrumb" className="chf__breadcrumb">
          <ol className="breadcrumb">
            <li className="breadcrumb-item">
              <Link to="/channel_diagram-list">Listar</Link>
            </li>
            <li className="breadcrumb-item active" aria-current="page">
              Editar
            </li>
          </ol>
        </nav>
        <h2 className="chf__title">Editar diagrama</h2>
        <div className="chf__alert chf__alert--error">{channelError}</div>
        <button className="chf__btn chf__btn--primary" type="button" onClick={() => navigate(-1)}>
          Volver
        </button>
      </div>
    );
  }

  return (
    <div className="chf__wrapper">
      <nav aria-label="breadcrumb" className="chf__breadcrumb">
        <ol className="breadcrumb">
          <li className="breadcrumb-item">
            <Link to="/channel_diagram-list">Listar</Link>
          </li>
          <li className="breadcrumb-item active" aria-current="page">
            {isEditMode ? "Editar" : "Formulario"}
          </li>
        </ol>
      </nav>

      <h2 className="chf__title">{isEditMode ? "Editar diagrama" : "Crear un diagrama"}</h2>

      {isEditMode && (selectedId || currentChannel) ? (
        <p className="chf__subtitle">
          Señal actual: {selectedId || formatSignalLabel(currentChannel?.signal) || "—"}
        </p>
      ) : null}

      {isEditMode && loadingChannel ? (
        <div className="chf__alert chf__alert--info">Cargando diagrama para edición…</div>
      ) : null}

      {isEditMode && !loadingChannel && currentChannel?.metadata?.title ? (
        <div className="chf__alert chf__alert--muted">{currentChannel.metadata.title}</div>
      ) : null}

      <Formik
        initialValues={initialValues}
        enableReinitialize
        onSubmit={async (_, { resetForm }) => {
          const submittingEdit = isEditMode;
          if (submittingEdit) setLoadingChannel(true);

          try {
            if (!selectedValue) {
              Swal.fire({
                icon: "warning",
                title: "Seleccione una señal",
                text: "Debes elegir la señal a la que pertenecerá este flujo.",
              });
              return;
            }

            if (draftNodes.length === 0) {
              Swal.fire({
                icon: "warning",
                title: "Sin nodos",
                text: "Agrega al menos un nodo antes de crear el flujo.",
              });
              return;
            }

            const diagramPayload = toPayload(draftNodes, draftEdges, null);

            const payload = {
              signal: selectedValue,
              channel: selectedValue,
              signalId: selectedValue,
              channelId: isEditMode ? channelIdParam : selectedValue,
              nodes: diagramPayload.nodes,
              edges: diagramPayload.edges,
              diagram: diagramPayload,
            };

            if (isEditMode) {
              await api.saveChannelDiagram(channelIdParam, diagramPayload);

              Swal.fire({
                icon: "success",
                title: "Flujo actualizado",
                html: `
                  <p><strong>Señal:</strong> ${selectedId}</p>
                  <p><strong>Nodos:</strong> ${diagramPayload.nodes.length}</p>
                  <p><strong>Enlaces:</strong> ${diagramPayload.edges.length}</p>
                `,
              });

              setCurrentChannel((prev) =>
                prev
                  ? {
                      ...prev,
                      nodes: diagramPayload.nodes,
                      edges: diagramPayload.edges,
                      diagram: { ...(prev.diagram || {}), ...diagramPayload },
                      signal: selectedSignalOption?.raw || prev.signal,
                    }
                  : prev
              );

              navigate(`/channels/${String(channelIdParam)}`);
              return;
            }

            await api.createChannelDiagram(payload);

            Swal.fire({
              icon: "success",
              title: "Flujo creado",
              html: `
                <p><strong>Señal:</strong> ${selectedId}</p>
                <p><strong>Nodos:</strong> ${diagramPayload.nodes.length}</p>
                <p><strong>Enlaces:</strong> ${diagramPayload.edges.length}</p>
              `,
            });

            setDraftNodes([]);
            setDraftEdges([]);
            setEdgeSourceSel(null);
            setEdgeTargetSel(null);
            setEdgeDirection(EDGE_DIR_OPTIONS[0]);
            setEdgeColorSel(EDGE_COLOR_OPTIONS[0]);
            setSelectedValue(null);
            setSelectedId(null);
            setSelectedEquipoValue(null);
            setSelectedIdEquipo(null);
            setSelectedEquipoTipo(null);
            setInitialValues(defaultFormikValues);
            setFormValues(defaultFormikValues);
            clearDraft();
            resetForm();
          } catch (e) {
            const data = e?.response?.data;
            Swal.fire({
              icon: "error",
              title: isEditMode ? "Error al actualizar flujo" : "Error al crear flujo",
              html: `
                <div style="text-align:left">
                  <div><b>Status:</b> ${e?.response?.status || "?"}</div>
                  <div><b>Mensaje:</b> ${
                    data?.message || data?.error || e.message || "Error desconocido"
                  }</div>
                  ${data?.missing ? `<div><b>Faltan:</b> ${JSON.stringify(data.missing)}</div>` : ""}
                  ${data?.errors ? `<pre>${JSON.stringify(data.errors, null, 2)}</pre>` : ""}
                </div>
              `,
            });
          } finally {
            if (submittingEdit) setLoadingChannel(false);
          }
        }}
      >
        {({ values, setFieldValue }) => (
          <Form className="chf__form">
            <FormValuesObserver onChange={handleFormValuesChange} />

            {/* ---- Señal ---- */}
            <fieldset className="chf__fieldset">
              <legend className="chf__legend">Señal</legend>

              {signalsLoading ? (
                <Select
                  className="select-width"
                  isLoading
                  isDisabled
                  placeholder="Cargando señales…"
                  styles={selectStyles}
                />
              ) : signalsError ? (
                <div className="chf__alert chf__alert--error">
                  <strong>Error al cargar señales.</strong>
                  <div className="chf__alert-actions">
                    <button type="button" className="chf__btn" onClick={() => window.location.reload()}>
                      Reintentar
                    </button>
                  </div>
                </div>
              ) : optionsSelectChannel.length === 0 ? (
                <div className="chf__empty">
                  <h4>No hay señales disponibles</h4>
                  <p>Todas las señales ya están vinculadas a un diagrama. Crea una nueva señal para continuar.</p>
                  <button
                    type="button"
                    className="chf__btn chf__btn--primary"
                    onClick={() => navigate("/signals/new")}
                  >
                    + Crear nueva señal
                  </button>
                </div>
              ) : (
                <div className="chf__row">
                  <div className="chf__select-inline">
                    <Select
                      className="select-width"
                      isSearchable
                      options={optionsSelectChannel}
                      onChange={handleSelectedChannel}
                      value={selectedSignalOption}
                      placeholder="Seleccione una señal"
                      noOptionsMessage={() => "No hay señales disponibles"}
                      styles={selectStyles}
                    />
                  </div>
                  <div className="chf__available">
                    <span className="chf__badge chf__badge--primary">{optionsSelectChannel.length} disponibles</span>
                  </div>
                </div>
              )}
            </fieldset>

            {/* ---- Nodo ---- */}
            <fieldset className="chf__fieldset">
              <legend
                className="chf__legend"
                style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}
              >
                <span>Agregar nodo</span>
                <button
                  type="button"
                  className="chf__btn chf__btn--secondary"
                  onClick={handleClearAll}
                  title="Vaciar nodos/edges y restaurar equipos"
                >
                  🧹 Vaciar todo
                </button>
              </legend>

              <div className="chf__grid chf__grid--3 chf__grid--align-end">
                <label className="chf__label">
                  Id Nodo
                  <Field className="chf__input" placeholder="Id Nodo" name="id" />
                </label>

                <label className="chf__label">
                  Equipo
                  <Select
                    className="chf__select"
                    name="equipo"
                    placeholder="Equipos"
                    options={optionsSelectEquipo}
                    onChange={handleSelectedEquipo}
                    value={selectedEquipoOption}
                    styles={selectStyles}
                  />
                </label>

                <label className="chf__label">
                  Etiqueta
                  <Field className="chf__input" placeholder="Etiqueta visible" name="label" />
                </label>

                <label className="chf__label">
                  Pos X
                  <Field className="chf__input" placeholder="Pos X" name="posX" />
                </label>

                <label className="chf__label">
                  Pos Y
                  <Field className="chf__input" placeholder="Pos Y" name="posY" />
                </label>

                <button
                  className="chf__btn chf__btn--secondary"
                  type="button"
                  onClick={() => {
                    if (!values.id?.trim()) return Swal.fire({ icon: "warning", title: "Id Nodo requerido" });
                    if (!selectedEquipoValue) return Swal.fire({ icon: "warning", title: "Seleccione un equipo/tipo" });

                    const node = {
                      id: values.id.trim(),
                      type: "custom",
                      data: {
                        label: values.label?.trim() || values.id.trim(),
                        equipoId: selectedEquipoValue,
                        equipoNombre: selectedIdEquipo,
                        equipoTipo: selectedEquipoTipo,
                      },
                      position: {
                        x: toNumberOr(values.posX, 0),
                        y: toNumberOr(values.posY, 0),
                      },
                    };

                    if (draftNodes.some((n) => n.id === node.id)) {
                      return Swal.fire({
                        icon: "warning",
                        title: "Nodo duplicado",
                        text: `Ya existe un nodo con id "${node.id}".`,
                      });
                    }

                    setDraftNodes((prev) => [...prev, node]);
                    setOptionSelectEquipo((prev) => removeEquipoFromGroupedOptions(prev, selectedEquipoValue));

                    setSelectedEquipoValue(null);
                    setSelectedIdEquipo(null);
                    setSelectedEquipoTipo(null);

                    setFieldValue("id", "");
                    setFieldValue("label", "");
                    setFieldValue("posX", "");
                    setFieldValue("posY", "");
                  }}
                >
                  + Agregar nodo
                </button>
              </div>

              {draftNodes.length > 0 && (
                <ul className="chf__list">
                  {draftNodes.map((n) => (
                    <li
                      key={n.id}
                      className="chf__list-item"
                      style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}
                    >
                      <div style={{ flex: "1 1 auto" }}>
                        <code>{n.id}</code> — {n.data?.label} — {n.data?.equipoNombre}{" "}
                        <span className="chf__badge">{n.data?.equipoTipo || "-"}</span>
                      </div>
                      <button
                        type="button"
                        className="chf__btn chf__btn--danger"
                        onClick={() => handleRemoveNode(n.id)}
                        title="Eliminar nodo y devolver equipo"
                      >
                        🗑 Eliminar
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </fieldset>

            {/* ---- Enlace ---- */}
            <fieldset className="chf__fieldset">
              <legend className="chf__legend">Agregar enlace</legend>

              <div className="chf__grid chf__grid--4 chf__grid--align-end chf__row-gap">
                <label className="chf__label">
                  Id Enlace
                  <Field className="chf__input" placeholder="Id Enlace" name="edgeId" />
                </label>

                <label className="chf__label">
                  Source (Nodo)
                  <Select
                    className="chf__select"
                    placeholder="Source"
                    isDisabled={edgeNodeOptions.length === 0}
                    options={edgeNodeOptions}
                    value={edgeSourceSel}
                    onChange={(opt) => {
                      setEdgeSourceSel(opt);
                      setFieldValue("source", opt?.value || "");
                    }}
                    styles={selectStyles}
                    noOptionsMessage={() => (draftNodes.length === 0 ? "Agrega nodos primero" : "Sin coincidencias")}
                  />
                </label>

                <label className="chf__label">
                  Target (Nodo)
                  <Select
                    className="chf__select"
                    placeholder="Target"
                    isDisabled={edgeNodeOptions.length === 0}
                    options={edgeNodeOptions}
                    value={edgeTargetSel}
                    onChange={(opt) => {
                      setEdgeTargetSel(opt);
                      setFieldValue("target", opt?.value || "");
                    }}
                    styles={selectStyles}
                    noOptionsMessage={() => (draftNodes.length === 0 ? "Agrega nodos primero" : "Sin coincidencias")}
                  />
                </label>

                {/* ✅ SELECT DIRECCIÓN MODIFICADO (ida | bi) */}
                <label className="chf__label">
                  Dirección
                  <Select
                    className="chf__select"
                    options={EDGE_DIR_OPTIONS}
                    value={edgeDirection}
                    onChange={(opt) => {
                      const safeValue = normalizeDirection(opt?.value);
                      const safeOpt =
                        EDGE_DIR_OPTIONS.find((o) => o.value === safeValue) || EDGE_DIR_OPTIONS[0];

                      setEdgeDirection(safeOpt);

                      const maybeDefault = EDGE_COLOR_OPTIONS[0]?.value;
                      const isUsingFirstDefault = (edgeColorSel?.value || "") === (maybeDefault || "");
                      if (isUsingFirstDefault) {
                        const def = defaultEdgeColorByDir(safeOpt?.value);
                        const defOpt = EDGE_COLOR_OPTIONS.find((c) => c.value === def);
                        if (defOpt) setEdgeColorSel(defOpt);
                      }
                    }}
                    placeholder="Dirección"
                    styles={selectStyles}
                  />
                </label>
              </div>

              {/* 🎨 Selector de color */}
              <div className="chf__grid chf__grid--2 chf__grid--align-end">
                <label className="chf__label">
                  Color del enlace
                  <Select
                    className="chf__select"
                    options={EDGE_COLOR_OPTIONS}
                    value={edgeColorSel}
                    onChange={(opt) => setEdgeColorSel(opt)}
                    styles={selectStyles}
                    formatOptionLabel={(opt) => (
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <span
                          style={{
                            width: 14,
                            height: 14,
                            borderRadius: 4,
                            background: opt.value,
                            border: "1px solid rgba(0,0,0,0.15)",
                          }}
                        />
                        <span>{opt.label}</span>
                        <code style={{ marginLeft: "auto", opacity: 0.7 }}>{opt.value}</code>
                      </div>
                    )}
                  />
                </label>

                <div className="chf__label" style={{ marginTop: 22 }}>
                  <div style={{ fontSize: 12, color: "#64748b", marginBottom: 6 }}>Vista previa</div>
                  <div style={{ height: 10, borderRadius: 999, background: edgeColorSel?.value || "#3b82f6" }} />
                </div>
              </div>

              <div className="chf__grid chf__grid--align-end">
                <label className="chf__label">
                  Titulo
                  <Field className="chf__input label-main" placeholder="Descripción enlace..." name="edgeLabel" />
                </label>
              </div>

              <div className="chf__grid chf__grid--2 chf__grid--align-end">
                <label className="chf__label">
                  Puerto Origen
                  <Field className="chf__input" placeholder="p.ej. Puerto origen" name="edgeLabelStart" />
                </label>

                <label className="chf__label">
                  Puerto Destino
                  <Field className="chf__input" placeholder="p.ej. Puerto destino" name="edgeLabelEnd" />
                </label>
              </div>

              <div className="chf__container">
                <button
                  className="chf__btn chf__btn--secondary btn--enlace"
                  type="button"
                  onClick={() => {
                    const id = values.edgeId?.trim();
                    const src = values.source?.trim();
                    const tgt = values.target?.trim();

                    if (!id) return Swal.fire({ icon: "warning", title: "Id Enlace requerido" });
                    if (!src || !tgt) {
                      return Swal.fire({
                        icon: "warning",
                        title: "Source y Target requeridos",
                        text: "Debes seleccionar los nodos a conectar.",
                      });
                    }
                    if (src === tgt) {
                      return Swal.fire({
                        icon: "warning",
                        title: "Enlace inválido",
                        text: "Source y Target no pueden ser el mismo nodo.",
                      });
                    }

                    const srcNode = draftNodes.find((n) => n.id === src);
                    const tgtNode = draftNodes.find((n) => n.id === tgt);
                    if (!srcNode || !tgtNode) {
                      return Swal.fire({
                        icon: "warning",
                        title: "Nodos no encontrados",
                        text: "Verifica que los nodos source y target ya estén agregados.",
                      });
                    }

                    // ✅ ahora SOLO ida o bi
                    const dir = normalizeDirection(edgeDirection?.value);

                    // ✅ Color elegido (o default por dirección)
                    const color = edgeColorSel?.value || defaultEdgeColorByDir(dir);

                    const handleByDir = pickHandlesByGeometry(srcNode, tgtNode, dir);

                    const trimmedLabel = values.edgeLabel?.trim();
                    const labelStart = values.edgeLabelStart?.trim();
                    const labelEnd = values.edgeLabelEnd?.trim();

                    const endpointLabels = {};
                    if (labelStart) endpointLabels.source = labelStart;
                    if (labelEnd) endpointLabels.target = labelEnd;

                    const edge = {
                      id,
                      source: src,
                      target: tgt,
                      sourceHandle: handleByDir.sourceHandle,
                      targetHandle: handleByDir.targetHandle,
                      label: trimmedLabel || id,

                      // ✅ edge custom
                      type: "customDirectional",

                      // ✅ color
                      style: { stroke: color, strokeWidth: 2 },

                      data: {
                        direction: dir, // ✅ queda "bi" en DB
                        color,
                        label: trimmedLabel || id,
                        labelStart: labelStart || "",
                        labelEnd: labelEnd || "",
                        ...(Object.keys(endpointLabels).length ? { endpointLabels } : {}),
                      },
                    };

                    if (draftEdges.some((e) => e.id === edge.id)) {
                      return Swal.fire({
                        icon: "warning",
                        title: "Enlace duplicado",
                        text: `Ya existe un enlace con id "${edge.id}".`,
                      });
                    }

                    setDraftEdges((prev) => [...prev, edge]);

                    setFieldValue("edgeId", "");
                    setFieldValue("source", "");
                    setFieldValue("target", "");
                    setFieldValue("edgeLabel", "");
                    setFieldValue("edgeLabelStart", "");
                    setFieldValue("edgeLabelEnd", "");

                    setEdgeSourceSel(null);
                    setEdgeTargetSel(null);
                    setEdgeDirection(EDGE_DIR_OPTIONS[0]);
                    setEdgeColorSel(EDGE_COLOR_OPTIONS[0]);
                  }}
                >
                  + Agregar enlace
                </button>
              </div>

              {draftEdges.length > 0 && (
                <ul className="chf__list">
                  {draftEdges.map((e) => {
                    const label = e?.data?.label || "";
                    const labelStart = e?.data?.labelStart || e?.data?.endpointLabels?.source || "";
                    const labelEnd = e?.data?.labelEnd || e?.data?.endpointLabels?.target || "";
                    const edgeColor = e?.data?.color || e?.style?.stroke || "#475569";
                    const dir = normalizeDirection(e?.data?.direction);

                    return (
                      <li
                        key={e.id}
                        className="chf__list-item"
                        style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}
                      >
                        <div style={{ flex: "1 1 auto" }}>
                          <code>{e.id}</code> — {e.source} ({e.sourceHandle}) → {e.target} ({e.targetHandle}) — {label}
                          {labelStart ? <span className="chf__badge chf__badge--muted">ini: {labelStart}</span> : null}
                          {labelEnd ? <span className="chf__badge chf__badge--muted">fin: {labelEnd}</span> : null}

                          <span
                            title={edgeColor}
                            style={{
                              display: "inline-block",
                              width: 12,
                              height: 12,
                              borderRadius: 3,
                              marginLeft: 8,
                              background: edgeColor,
                              border: "1px solid rgba(0,0,0,0.15)",
                              verticalAlign: "middle",
                            }}
                          />

                          {/* ✅ mostrar lindo, pero guardar "bi" */}
                          <span className="chf__muted" style={{ marginLeft: 8, color: edgeColor }}>
                            {dir === "bi" ? "bidireccional" : dir}
                          </span>
                        </div>

                        <button
                          type="button"
                          className="chf__btn chf__btn--danger"
                          onClick={() => handleRemoveEdge(e.id)}
                          title="Eliminar enlace"
                        >
                          🗑 Eliminar
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </fieldset>

            <div className="chf__actions">
              <button
                className="chf__btn chf__btn--primary"
                type="submit"
                disabled={!selectedValue || (isEditMode && loadingChannel)}
                title={
                  !selectedValue
                    ? "Seleccione una señal para continuar"
                    : isEditMode
                    ? "Actualizar flujo"
                    : "Crear flujo"
                }
                onClick={!isEditMode ? handleCreateFlowClick : undefined}
              >
                {isEditMode ? "Actualizar flujo" : "Crear flujo"}
              </button>
              <button className="chf__btn" type="button" onClick={() => navigate(-1)}>
                Cancelar
              </button>
            </div>
          </Form>
        )}
      </Formik>
    </div>
  );
};

export default ChannelForm;