import axios from "axios";

// --- Control de refresh único + cola ---
let isRefreshing = false;
let refreshPromise = null;
const queue = [];
function subscribeTokenRefresh(cb) {
    queue.push(cb);
}
function onRefreshed() {
    queue.forEach((cb) => cb());
    queue.length = 0;
}

const env = typeof import.meta !== "undefined" ? import.meta.env ?? {} : {};

const RAW_TITAN_TIMEOUT = env.VITE_TITAN_TIMEOUT;
const PARSED_TITAN_TIMEOUT = Number(RAW_TITAN_TIMEOUT);
const DEFAULT_TITAN_TIMEOUT = Number.isNaN(PARSED_TITAN_TIMEOUT)
    ? 10_000
    : PARSED_TITAN_TIMEOUT;

const DEFAULT_TITAN_OPTIONS = Object.freeze({
    path: env.VITE_TITAN_SERVICES_PATH || "/api/v1/servicesmngt/services",
    username: env.VITE_TITAN_USERNAME || "Operator",
    password: env.VITE_TITAN_PASSWORD || "titan",
    protocol: env.VITE_TITAN_PROTOCOL || "http",
    timeout: DEFAULT_TITAN_TIMEOUT,
});

function normalizeTitanOptions(pathOrOptions) {
    if (typeof pathOrOptions === "string") {
        return { path: pathOrOptions };
    }
    if (pathOrOptions && typeof pathOrOptions === "object") {
        const { path, username, password, protocol, timeout } = pathOrOptions;
        const normalized = {};
        if (path !== undefined) normalized.path = path;
        if (username !== undefined) normalized.username = username;
        if (password !== undefined) normalized.password = password;
        if (protocol !== undefined) normalized.protocol = protocol;
        if (timeout !== undefined) {
            const parsedTimeout = Number(timeout);
            if (!Number.isNaN(parsedTimeout)) {
                normalized.timeout = parsedTimeout;
            }
        }
        return normalized;
    }
    return {};
}

class Api {
    constructor(url) {
        this._axios = axios.create({ baseURL: url, withCredentials: true });

        this._axios.interceptors.request.use((config) => {
            return config; // backend lee cookies httpOnly
        });

        this._axios.interceptors.response.use(
            (res) => res,
            async (error) => {
                const original = error.config;
                const status = error?.response?.status;
                const code = error?.response?.data?.error;

                if (
                    status === 401 &&
                    code === "token_expired" &&
                    !original._retry
                ) {
                    original._retry = true;

                    if (!isRefreshing) {
                        isRefreshing = true;
                        refreshPromise = this._axios
                            .post("/auth/refresh")
                            .then((r) => {
                                isRefreshing = false;
                                onRefreshed();
                                window.dispatchEvent(
                                    new Event("auth:refreshed")
                                );
                                return r;
                            })
                            .catch((e) => {
                                isRefreshing = false;
                                onRefreshed();
                                throw e;
                            });
                    }

                    return new Promise((resolve, reject) => {
                        subscribeTokenRefresh(async () => {
                            try {
                                await refreshPromise;
                                resolve(this._axios(original));
                            } catch (e) {
                                reject(e);
                            }
                        });
                    });
                }

                return Promise.reject(error);
            }
        );
    }

    // ====== AUTH ======
    login(values) {
        return this._axios.post("/auth/login", values).then((res) => {
            window.dispatchEvent(new Event("auth:login"));
            return res.data;
        });
    }

    logout() {
        return this._axios.post("/auth/logout").then((res) => res.data);
    }

    profile(options = {}) {
        const config = { ...options };
        return this._axios
            .get("/auth/me", config)
            .then((res) => res.data)
            .catch(async (e) => {
                if (axios.isCancel && axios.isCancel(e)) {
                    throw e;
                }
                if (e?.code === "ERR_CANCELED") {
                    throw e;
                }
                if (e?.response?.status === 404) {
                    const retryConfig = { ...options };
                    const r = await this._axios.get("/auth/me", retryConfig);
                    return r.data;
                }
                throw e;
            });
    }

    // ====== API ======
    createUser(values) {
        return this._axios.post("/users", values).then((r) => r.data);
    }
    updateUserId(id, values) {
        return this._axios.put(`/users/${id}`, values).then((r) => r.data);
    }
    getUserInfo() {
        return this._axios.get("/users").then((r) => r.data);
    }
    getUserId(id) {
        return this._axios.get(`/users/${id}`).then((r) => r.data);
    }
    deleteUserId(id) {
        return this._axios.delete(`/users/${id}`).then((r) => r.data);
    }

    createSatelite(values) {
        return this._axios.post("/satellites", values).then((r) => r.data);
    }
    getSatellites() {
        return this._axios.get("/satellites").then((r) => r.data);
    }
    getSatelliteId(id) {
        return this._axios.get(`/satellites/${id}`).then((r) => r.data);
    }
    deleteSatelliteId(id) {
        return this._axios.delete(`/satellites/${id}`).then((r) => r.data);
    }
    updateSatelite(values, id) {
        return this._axios.put(`/satellites/${id}`, values).then((r) => r.data);
    }

    getPolarizations() {
        return this._axios.get("/polarizations").then((r) => r.data);
    }

    getSignal() {
        return this._axios.get("/signals").then((r) => r);
    }
    createSignal(values) {
        return this._axios.post("/signals", values).then((r) => r.data);
    }
    getIdSignal(id) {
        return this._axios.get(`/signals/${id}`).then((r) => r);
    }
    deleteSignal(id) {
        return this._axios.delete(`/signals/${id}`).then((r) => r);
    }
    updateSignal(id, values) {
        return this._axios.put(`/signals/${id}`, values).then((r) => r.data);
    }
    searchChannels(keyword) {
        return this._axios
            .get("/search", { params: { keyword } })
            .then((r) => r);
    }

    // ====== IRD / EQUIPOS ======
    getIrd() {
        return this._axios.get("/irds").then((r) => r);
    }
    createIrd(values) {
        return this._axios.post("/irds", values).then((r) => r.data);
    }
    getIdIrd(id) {
        return this._axios.get(`/irds/${id}`).then((r) => r);
    }
    deleteIrd(id) {
        return this._axios.delete(`/irds/${id}`).then((r) => r);
    }
    updateIrd(id, values) {
        return this._axios.put(`/irds/${id}`, values).then((r) => r.data);
    }
    // SUGERENCIA APLICADA: recrear/sincronizar Equipo desde el IRD (POST /irds/:id/recreate-equipo)
    recreateEquipoFromIrd(id) {
        return this._axios
            .post(`/irds/${id}/recreate-equipo`)
            .then((r) => r.data);
    }
    // Opcional: si decides manejarlo via PUT con flag recreateEquipo=true
    updateIrdWithRecreate(id, values) {
        return this._axios
            .put(`/irds/${id}`, values, { params: { recreateEquipo: true } })
            .then((r) => r.data);
    }

    validateExcelIrds(file) {
        const formData = new FormData();
        formData.append("file", file);
        return this._axios
            .post("/irds/validate-excel", formData, {
                headers: { "Content-Type": "multipart/form-data" },
            })
            .then((r) => r.data);
    }

    bulkCreateIrds(file) {
        const formData = new FormData();
        formData.append("file", file);
        return this._axios
            .post("/irds/bulk-create", formData, {
                headers: { "Content-Type": "multipart/form-data" },
            })
            .then((r) => r.data);
    }

    getContact() {
        return this._axios.get("/contacts").then((r) => r);
    }
    createContact(values) {
        // Enviamos el body CORRECTO (antes lo mandaba vacío)
        const payload = {
            nombreContact: values.nombreContact?.trim(),
            email: values.email ? values.email.trim() : "",
            telefono: values.telefono ? values.telefono.trim() : "",
        };

        return this._axios.post("/contacts", payload).then((r) => r);
    }
    deleteContact(id) {
        return this._axios.delete(`/contacts/${id}`).then((r) => r);
    }
    updateContact(id, values) {
        const payload = {
            nombreContact: values.nombreContact?.trim(),
            email: values.email ? values.email.trim() : "",
            telefono: values.telefono ? values.telefono.trim() : "",
        };

        return this._axios.put(`/contacts/${id}`, payload).then((r) => r);
    }
    getIdContact(id) {
        return this._axios.get(`/contacts/${id}`).then((r) => r);
    }

    getTipoTech() {
        return this._axios.get("/type-tech").then((r) => r);
    }
    deleteTipoTech(id) {
        return this._axios.delete(`/type-tech/${id}`).then((r) => r);
    }
    createTipoTech(values) {
        return this._axios.post("/type-tech", values).then((r) => r.data);
    }
    getIdTipoTech(id) {
        return this._axios.get(`/type-tech/${id}`).then((r) => r);
    }
    updateTipoTech(id, values) {
        return this._axios.put(`/type-tech/${id}`, values).then((r) => r);
    }

    getEquipo() {
        return this._axios.get("/equipos").then((r) => r);
    }
    deleteEquipo(id) {
        return this._axios.delete(`/equipos/${id}`).then((r) => r);
    }
    createEquipo(values) {
        return this._axios.post("/equipos", values).then((r) => r.data);
    }
    getIdEquipo(id) {
        return this._axios.get(`/equipos/${id}`).then((r) => r);
    }
    updateEquipo(id, values) {
        return this._axios.put(`/equipos/${id}`, values).then((r) => r);
    }

    getTipoEquipo() {
        return this._axios.get("/tipo-equipo").then((r) => r);
    }

    deleteTipoEquipo(id) {
        return this._axios.delete(`/tipo-equipo/${id}`).then((r) => r.data);
    }

    createTipoEquipo(values) {
        return this._axios.post("/tipo-equipo", values).then((r) => r.data);
    }

    getIdTipoEquipo(id) {
        return this._axios.get(`/tipo-equipo/${id}`).then((r) => r.data);
    }

    updateTipoEquipo(id, values) {
        return this._axios
            .put(`/tipo-equipo/${id}`, values)
            .then((r) => r.data);
    }

    // api.js (dentro de class Api)

getTipoEquipoByName(name) {
  const safe = encodeURIComponent(String(name ?? "").trim());
  return this._axios.get(`/tipo-equipo/by-name/${safe}`).then((r) => r.data);
}

async getOrCreateTipoEquipo(tipoNombre) {
  const name = String(tipoNombre ?? "").trim();
  if (!name) throw new Error("tipoNombre is required");

  // 1) intento obtener
  try {
    const existing = await this.getTipoEquipoByName(name);
    return existing;
  } catch (e) {
    const status = e?.response?.status;
    // si NO es 404, es un error real
    if (status && status !== 404) throw e;
  }

  // 2) intento crear
  try {
    const created = await this.createTipoEquipo({ tipoNombre: name });
    return created;
  } catch (e) {
    const status = e?.response?.status;

    // 3) si ya existe (409), lo obtengo y sigo
    if (status === 409) {
      const existing = await this.getTipoEquipoByName(name);
      return existing;
    }

    throw e;
  }
}


    createChannelDiagram(payload) {
        return this._axios.post(`/channels`, payload).then((r) => r.data);
    }
    getChannelDiagramById(id) {
        return this._axios.get(`/channels/${id}`).then((r) => r);
    }
    listChannelDiagrams(params = {}) {
        return this._axios.get(`/channels`, { params }).then((r) => r);
    }
    getChannelDiagramBySignal(signalId) {
        if (!signalId) {
            return Promise.resolve([]);
        }
        return this._axios
            .get(`/channels`, { params: { signal: signalId } })
            .then((r) => r.data);
    }
    updateChannelDiagram(id, payload) {
        return this._axios.put(`/channels/${id}`, payload).then((r) => r.data);
    }
    async getChannelDiagram(id) {
        if (!id) {
            return { nodes: [], edges: [], viewport: null };
        }
        const response = await this._axios.get(`/channels/${id}/diagram`);
        const diagram = response?.data || {};
        return {
            nodes: Array.isArray(diagram.nodes) ? diagram.nodes : [],
            edges: Array.isArray(diagram.edges) ? diagram.edges : [],
            viewport:
                diagram && typeof diagram.viewport === "object"
                    ? diagram.viewport
                    : null,
        };
    }
    saveChannelDiagram(id, payload) {
        if (!id) {
            return Promise.reject(new Error("Channel id is required"));
        }
        return this._axios
            .put(`/channels/${id}/diagram`, payload)
            .then((r) => r.data);
    }
    deleteChannelDiagram(id) {
        return this._axios.delete(`/channels/${id}`).then((r) => r.data);
    }
    updateChannelFlow(id, payload) {
        return this._axios
            .put(`/channels/${id}/flow`, payload)
            .then((r) => r.data);
    }

    getDiagramNodes(diagramId) {
        if (!diagramId) return Promise.resolve([]);
        return this._axios
            .get(`/diagrams/${diagramId}/nodes`)
            .then((r) => r.data?.nodes ?? []);
    }

    createDiagramNode(diagramId, payload) {
        return this._axios
            .post(`/diagrams/${diagramId}/nodes`, payload)
            .then((r) => r.data?.nodes ?? []);
    }

    updateDiagramNode(diagramId, nodeId, payload) {
        return this._axios
            .put(`/diagrams/${diagramId}/nodes/${nodeId}`, payload)
            .then((r) => r.data?.node ?? null);
    }

    deleteDiagramNode(diagramId, nodeId) {
        return this._axios
            .delete(`/diagrams/${diagramId}/nodes/${nodeId}`)
            .then((r) => r.data);
    }

    getDiagramEdges(diagramId) {
        if (!diagramId) return Promise.resolve([]);
        return this._axios
            .get(`/diagrams/${diagramId}/edges`)
            .then((r) => r.data?.edges ?? []);
    }

    createDiagramEdge(diagramId, payload) {
        return this._axios
            .post(`/diagrams/${diagramId}/edges`, payload)
            .then((r) => r.data?.edges ?? []);
    }

    updateDiagramEdge(diagramId, edgeId, payload) {
        return this._axios
            .put(`/diagrams/${diagramId}/edges/${edgeId}`, payload)
            .then((r) => r.data?.edge ?? null);
    }

    deleteDiagramEdge(diagramId, edgeId) {
        return this._axios
            .delete(`/diagrams/${diagramId}/edges/${edgeId}`)
            .then((r) => r.data);
    }

    patchChannelNode(channelId, nodeId, payload) {
        return this._axios
            .patch(`/channels/${channelId}/node/${nodeId}`, payload)
            .then((r) => r.data);
    }

    patchChannelNodePosition(channelId, nodeId, position) {
        return this._axios
            .patch(`/channels/${channelId}/node/${nodeId}/position`, {
                position,
            })
            .then((r) => r.data);
    }

    patchChannelNodeHandles(channelId, nodeId, payload) {
        return this._axios
            .patch(`/channels/${channelId}/node/${nodeId}/handles`, payload)
            .then((r) => r.data);
    }

    patchChannelEdge(channelId, edgeId, payload) {
        return this._axios
            .patch(`/channels/${channelId}/edge/${edgeId}`, payload)
            .then((r) => r.data);
    }

    patchChannelEdgeReconnect(channelId, edgeId, payload) {
        return this._axios
            .patch(`/channels/${channelId}/edge/${edgeId}/reconnect`, payload)
            .then((r) => r.data);
    }

    patchChannelEdgeTooltip(channelId, edgeId, payload) {
        return this._axios
            .patch(`/channels/${channelId}/edge/${edgeId}/tooltip`, payload)
            .then((r) => r.data);
    }

    patchChannelLabelPositions(channelId, payload, config = {}) {
        return this._axios
            .patch(`/channels/${channelId}/label-positions`, payload, config)
            .then((r) => r.data);
    }

    /**
     * Crea un nuevo edge en el channel
     * @param {string} channelId - ID del channel
     * @param {object} edge - Datos del edge a crear
     * @returns {Promise<object>} { ok, edge, auditId }
     */
    createChannelEdge(channelId, edge) {
        return this._axios
            .post(`/channels/${channelId}/edges`, edge)
            .then((r) => r.data);
    }

    // ====== TITANS ======
    async getTitanServices(host, pathOrOptions = undefined) {
        if (!host) {
            throw new Error("Titan host is required");
        }

        const options = {
            ...DEFAULT_TITAN_OPTIONS,
            ...normalizeTitanOptions(pathOrOptions),
        };

        const params = new URLSearchParams();
        params.set("host", host);
        if (options.path) params.set("path", options.path);
        if (options.protocol) params.set("protocol", options.protocol);

        const url = `/titans/services?${params.toString()}`;
        const response = await this._axios.get(url);
        return response.data;
    }
    async getTitanServicesMulti(hosts, pathOrOptions = undefined) {
        const normalizedHosts = Array.isArray(hosts)
            ? hosts
            : typeof hosts === "string"
            ? hosts
                  .split(",")
                  .map((item) => item.trim())
                  .filter(Boolean)
            : [];

        const uniqueHosts = Array.from(new Set(normalizedHosts));

        if (uniqueHosts.length === 0) {
            return [];
        }

        const options = {
            ...DEFAULT_TITAN_OPTIONS,
            ...normalizeTitanOptions(pathOrOptions),
        };

        const params = new URLSearchParams();
        params.set("hosts", uniqueHosts.join(","));
        if (options.path) params.set("path", options.path);
        if (options.protocol) params.set("protocol", options.protocol);

        try {
            const response = await this._axios.get(
                `/titans/services/multi?${params.toString()}`
            );
            return Array.isArray(response.data) ? response.data : [];
        } catch (error) {
            const multiErrorMessage =
                error?.response?.data?.error ||
                error?.response?.data?.message ||
                error?.response?.statusText ||
                error?.message ||
                error;
            const results = await Promise.allSettled(
                uniqueHosts.map(async (host) => {
                    const payload = await this.getTitanServices(
                        host,
                        pathOrOptions
                    );
                    return { ok: true, host, ip: host, data: payload };
                })
            );

            return results.map((entry, index) => {
                const host = uniqueHosts[index];
                if (entry.status === "fulfilled") {
                    return entry.value;
                }

                const errorReason = entry.reason;
                const output = { ok: false, host, ip: host };

                if (errorReason && typeof errorReason === "object") {
                    if (errorReason.response) {
                        output.status = errorReason.response.status;
                        output.statusText = errorReason.response.statusText;
                        output.error =
                            errorReason.response.data ??
                            errorReason.response.statusText;
                    } else if (errorReason.message) {
                        output.error = errorReason.message;
                    } else {
                        output.error = errorReason;
                    }
                } else {
                    output.error = errorReason ?? multiErrorMessage;
                }

                return output;
            });
        }
    }

    // ====== AUDIT ======
    getAuditLogs(params = {}) {
        const qs = new URLSearchParams();
        const push = (k, v) => {
            if (v === undefined || v === null || v === "") return;
            if (Array.isArray(v))
                v.forEach((item) => qs.append(k, String(item)));
            else qs.set(k, String(v));
        };
        push("page", params.page);
        push("limit", params.limit);
        push("sort", params.sort);
        push("q", params.q);
        push("userId", params.userId);
        push("email", params.email);
        push("action", params.action);
        push("method", params.method);
        push("ip", params.ip);
        push("resource", params.resource);
        push("status", params.status);
        push("statusMin", params.statusMin);
        push("statusMax", params.statusMax);
        push("dateFrom", params.dateFrom);
        push("dateTo", params.dateTo);

        const query = qs.toString();
        const url = `/audits${query ? `?${query}` : ""}`;
        return this._axios.get(url).then((res) => res.data);
    }

    exportAuditLogsCSV(params = {}) {
        const qs = new URLSearchParams();
        const push = (k, v) => {
            if (v === undefined || v === null || v === "") return;
            if (Array.isArray(v))
                v.forEach((item) => qs.append(k, String(item)));
            else qs.set(k, String(v));
        };
        [
            "page",
            "limit",
            "sort",
            "q",
            "userId",
            "email",
            "action",
            "method",
            "ip",
            "resource",
            "status",
            "statusMin",
            "statusMax",
            "dateFrom",
            "dateTo",
        ].forEach((k) => push(k, params[k]));

        const query = qs.toString();
        const url = `/audits/export${query ? `?${query}` : ""}`;
        return this._axios.get(url, { responseType: "blob" });
    }
}

const apiBaseUrl =
    env.VITE_API_BASE_URL ||
    process.env.VITE_API_BASE_URL ||
    "https://signal-operacionestv.grupogtd.com/api/v1/";

const api = new Api(apiBaseUrl);
export default api;
