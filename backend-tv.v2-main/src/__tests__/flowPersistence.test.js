const { before, after, beforeEach, test } = require("node:test");
const assert = require("node:assert/strict");
const http = require("node:http");
const mongoose = require("mongoose");
const path = require("node:path");

const { signAccessToken } = require("../../utils/jwt");

const flowModelPath = path.resolve(__dirname, "../models/flow.model.js");
const store = createFlowStore();

const auditLogPath = path.resolve(__dirname, "../models/auditLog.model.js");
require.cache[auditLogPath] = {
  id: auditLogPath,
  filename: auditLogPath,
  loaded: true,
  exports: {
    create: async () => {},
  },
};

require.cache[flowModelPath] = {
  id: flowModelPath,
  filename: flowModelPath,
  loaded: true,
  exports: store.Model,
};

const app = require("../app");

let server;
let baseUrl;
const TEST_USER_ID = new mongoose.Types.ObjectId().toString();
const token = signAccessToken({ id: TEST_USER_ID, email: "qa@example.com" });

before(async () => {
  server = http.createServer(app);
  await new Promise((resolve) => {
    server.listen(0, () => {
      const { port } = server.address();
      baseUrl = `http://127.0.0.1:${port}/api/v1`;
      resolve();
    });
  });
});

after(async () => {
  if (server) {
    await new Promise((resolve) => server.close(resolve));
  }
});

beforeEach(() => {
  store.clear();
});

const demoPayload = {
  name: "Demo Flow",
  nodes: [
    {
      nodeId: "node-1",
      position: { x: 0, y: 50 },
      data: { label: "Nodo 1" },
    },
    {
      nodeId: "node-2",
      position: { x: 300, y: 80 },
      data: { label: "Nodo 2" },
    },
  ],
  edges: [
    {
      edgeId: "edge-1",
      source: "node-1",
      target: "node-2",
      sourceHandle: null,
      targetHandle: null,
    },
  ],
};

test("POST /flows crea un nuevo flujo", async () => {
  const response = await requestJson("POST", "/flows", demoPayload);

  assert.equal(response.status, 201);
  assert.equal(response.body.ok, true);
  assert.equal(response.body.data.name, demoPayload.name);
  assert.equal(response.body.data.nodes.length, demoPayload.nodes.length);
  assert.equal(response.body.data.edges.length, demoPayload.edges.length);
});

test("PATCH /flows/:id/nodes/:nodeId/position persiste coordenadas", async () => {
  const created = await requestJson("POST", "/flows", demoPayload);
  const flowId = created.body.data._id;

  const response = await requestJson(
    "PATCH",
    `/flows/${flowId}/nodes/node-1/position`,
    { position: { x: 120, y: 160 } }
  );

  assert.equal(response.status, 200);
  assert.equal(response.body.ok, true);
  assert.deepEqual(response.body.data.position, { x: 120, y: 160 });

  const persisted = store.get(flowId);
  const node = persisted.nodes.find((entry) => entry.nodeId === "node-1");
  assert.deepEqual(node.position, { x: 120, y: 160 });
});

test("PATCH /flows/:id/edges/:edgeId/connection actualiza handles", async () => {
  const created = await requestJson("POST", "/flows", demoPayload);
  const flowId = created.body.data._id;

  const response = await requestJson(
    "PATCH",
    `/flows/${flowId}/edges/edge-1/connection`,
    {
      source: "node-1",
      sourceHandle: "source-right",
      target: "node-2",
      targetHandle: "target-left",
    }
  );

  assert.equal(response.status, 200);
  assert.equal(response.body.ok, true);
  assert.equal(response.body.data.sourceHandle, "source-right");
  assert.equal(response.body.data.targetHandle, "target-left");

  const persisted = store.get(flowId);
  const edge = persisted.edges.find((entry) => entry.edgeId === "edge-1");
  assert.equal(edge.sourceHandle, "source-right");
  assert.equal(edge.targetHandle, "target-left");
});

test("PATCH /flows/:id/edges/:edgeId/connection valida payload", async () => {
  const created = await requestJson("POST", "/flows", demoPayload);
  const flowId = created.body.data._id;

  const response = await requestJson(
    "PATCH",
    `/flows/${flowId}/edges/edge-1/connection`,
    {}
  );

  assert.equal(response.status, 400);
  assert.equal(response.body.ok, false);
});

async function requestJson(method, path, body) {
  const payload = body ? JSON.stringify(body) : undefined;

  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      "content-type": "application/json",
      Cookie: `access_token=${token}`,
    },
    body: payload,
  });

  const contentType = response.headers.get("content-type") || "";
  const isJson = contentType.includes("application/json");
  const parsedBody = isJson ? await response.json() : await response.text();

  return { status: response.status, body: parsedBody };
}

function createFlowStore() {
  const flows = new Map();

  class FlowDocument {
    constructor(payload) {
      this._id = String(payload._id || new mongoose.Types.ObjectId());
      this.name = payload.name;
      this.description = payload.description || null;
      this.nodes = Array.isArray(payload.nodes)
        ? payload.nodes.map((node) => ({
            nodeId: String(node.nodeId),
            type: node.type || undefined,
            data: node.data ? JSON.parse(JSON.stringify(node.data)) : undefined,
            position: { x: Number(node.position.x), y: Number(node.position.y) },
          }))
        : [];
      this.edges = Array.isArray(payload.edges)
        ? payload.edges.map((edge) => ({
            edgeId: String(edge.edgeId),
            type: edge.type || undefined,
            data: edge.data ? JSON.parse(JSON.stringify(edge.data)) : undefined,
            source: String(edge.source),
            sourceHandle:
              edge.sourceHandle === null || edge.sourceHandle === undefined
                ? null
                : String(edge.sourceHandle),
            target: String(edge.target),
            targetHandle:
              edge.targetHandle === null || edge.targetHandle === undefined
                ? null
                : String(edge.targetHandle),
          }))
        : [];
    }

    async save() {
      flows.set(this._id, this.toObject());
      return this;
    }

    toObject() {
      return {
        _id: this._id,
        name: this.name,
        description: this.description,
        nodes: this.nodes.map((node) => ({
          nodeId: node.nodeId,
          type: node.type,
          data: node.data ? JSON.parse(JSON.stringify(node.data)) : undefined,
          position: { ...node.position },
        })),
        edges: this.edges.map((edge) => ({
          edgeId: edge.edgeId,
          type: edge.type,
          data: edge.data ? JSON.parse(JSON.stringify(edge.data)) : undefined,
          source: edge.source,
          sourceHandle: edge.sourceHandle,
          target: edge.target,
          targetHandle: edge.targetHandle,
        })),
      };
    }
  }

  class FlowModel {
    static async create(payload) {
      const doc = new FlowDocument(payload);
      await doc.save();
      return doc.toObject();
    }

    static findById(id) {
      const doc = flows.get(String(id));
      const instance = doc ? new FlowDocument(doc) : null;

      return {
        async lean() {
          return doc ? JSON.parse(JSON.stringify(doc)) : null;
        },
        then(onFulfilled, onRejected) {
          return Promise.resolve(instance).then(onFulfilled, onRejected);
        },
        catch(onRejected) {
          return Promise.resolve(instance).catch(onRejected);
        },
      };
    }
  }

  return {
    Model: FlowModel,
    get: (id) => JSON.parse(JSON.stringify(flows.get(String(id)))),
    clear: () => flows.clear(),
  };
}
