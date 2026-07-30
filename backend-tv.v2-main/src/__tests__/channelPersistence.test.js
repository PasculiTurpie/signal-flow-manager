const { before, after, beforeEach, afterEach, test } = require("node:test");
const assert = require("node:assert/strict");
const http = require("node:http");
const mongoose = require("mongoose");

const app = require("../app");
const Channel = require("../models/channel.model");
const DiagramAudit = require("../models/diagramAudit.model");
const AuditLog = require("../models/auditLog.model");
const { signAccessToken } = require("../../utils/jwt");

const TEST_CHANNEL_ID = new mongoose.Types.ObjectId().toString();
const TEST_USER_ID = new mongoose.Types.ObjectId().toString();

let server;
let baseUrl;

const original = {};
let channelState;
let auditEntries;

const fakeSession = () => ({
  async startTransaction() {},
  async commitTransaction() {},
  async abortTransaction() {},
  async endSession() {},
});

const cloneState = () => ({
  _id: TEST_CHANNEL_ID,
  nodes: channelState.nodes.map((node) => ({
    ...node,
    position: { ...node.position },
    data: node.data
      ? {
          ...node.data,
          handles: Array.isArray(node.data.handles)
            ? node.data.handles.map((h) => ({ ...h }))
            : undefined,
        }
      : undefined,
    handles: Array.isArray(node.handles)
      ? node.handles.map((h) => ({ ...h }))
      : undefined,
  })),
  edges: channelState.edges.map((edge) => ({
    ...edge,
    data: edge.data ? { ...edge.data } : undefined,
  })),
});

const buildQuery = (result) => ({
  session() {
    return this;
  },
  select() {
    return this;
  },
  lean() {
    return Promise.resolve(result ? JSON.parse(JSON.stringify(result)) : result);
  },
});

const applyUpdate = (update) => {
  const { $set = {}, $unset = {} } = update || {};
  Object.entries($set).forEach(([path, value]) => {
    if (path.startsWith("nodes.$.")) {
      const key = path.replace("nodes.$.", "");
      const node = channelState.nodes.find(
        (n) => String(n.id) === String(channelState._lastNodeId)
      );
      if (!node) return;
      if (key.startsWith("position.")) {
        const coord = key.replace("position.", "");
        node.position[coord] = value;
      } else if (key.startsWith("data.")) {
        const dataKey = key.replace("data.", "");
        node.data = node.data || {};
        node.data[dataKey] = value;
      }
    }
    if (path.startsWith("edges.$.")) {
      const key = path.replace("edges.$.", "");
      const edge = channelState.edges.find(
        (e) => String(e.id) === String(channelState._lastEdgeId)
      );
      if (!edge) return;
      if (key.startsWith("data.")) {
        const dataKey = key.replace("data.", "");
        edge.data = edge.data || {};
        edge.data[dataKey] = value;
      } else {
        edge[key] = value;
      }
    }
  });
  Object.entries($unset).forEach(([path]) => {
    if (path.startsWith("nodes.$.")) {
      const key = path.replace("nodes.$.", "");
      const node = channelState.nodes.find(
        (n) => String(n.id) === String(channelState._lastNodeId)
      );
      if (!node) return;
      if (key.startsWith("data.")) {
        const dataKey = key.replace("data.", "");
        if (node.data) delete node.data[dataKey];
      }
    }
    if (path.startsWith("edges.$.")) {
      const key = path.replace("edges.$.", "");
      const edge = channelState.edges.find(
        (e) => String(e.id) === String(channelState._lastEdgeId)
      );
      if (!edge) return;
      if (key.startsWith("data.")) {
        const dataKey = key.replace("data.", "");
        if (edge.data) delete edge.data[dataKey];
      } else {
        delete edge[key];
      }
    }
  });
};

before(async () => {
  server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));
  const { port } = server.address();
  baseUrl = `http://127.0.0.1:${port}/api/v1`;
});

after(async () => {
  await new Promise((resolve) => server.close(resolve));
});

beforeEach(() => {
  original.startSession = mongoose.startSession;
  original.findById = Channel.findById;
  original.updateOne = Channel.updateOne;
  original.auditCreate = DiagramAudit.create;
  original.auditLogCreate = AuditLog.create;

  mongoose.startSession = async () => fakeSession();

  Channel.findById = (id) => {
    const match = id && String(id) === TEST_CHANNEL_ID ? cloneState() : null;
    return buildQuery(match);
  };

  Channel.updateOne = async (filter, update) => {
    if (filter["nodes.id"]) {
      channelState._lastNodeId = filter["nodes.id"];
    }
    if (filter["edges.id"]) {
      channelState._lastEdgeId = filter["edges.id"];
    }
    applyUpdate(update);
    return { acknowledged: true, modifiedCount: 1, matchedCount: 1 };
  };

  DiagramAudit.create = async (docs) => {
    const entry = {
      ...docs[0],
      _id: new mongoose.Types.ObjectId(),
    };
    auditEntries.push(entry);
    return [entry];
  };

  AuditLog.create = async () => null;

  channelState = {
    _id: TEST_CHANNEL_ID,
    nodes: [
      {
        id: "node-1",
        position: { x: 0, y: 0 },
        data: {
          handles: [
            { id: "out-right-1", type: "source", side: "right" },
            { id: "in-left-1", type: "target", side: "left" },
          ],
        },
        handles: [
          { id: "out-right-1", type: "source", side: "right" },
          { id: "in-left-1", type: "target", side: "left" },
        ],
      },
      {
        id: "node-2",
        position: { x: 200, y: 100 },
        data: {
          handles: [
            { id: "out-right-1", type: "source", side: "right" },
            { id: "in-left-1", type: "target", side: "left" },
          ],
        },
        handles: [
          { id: "out-right-1", type: "source", side: "right" },
          { id: "in-left-1", type: "target", side: "left" },
        ],
      },
    ],
    edges: [
      {
        id: "edge-1",
        source: "node-1",
        target: "node-2",
        sourceHandle: "out-right-1",
        targetHandle: "in-left-1",
        data: { tooltipTitle: "Etiqueta centro", tooltip: "A to B" },
      },
    ],
  };
  auditEntries = [];
});

afterEach(() => {
  mongoose.startSession = original.startSession;
  Channel.findById = original.findById;
  Channel.updateOne = original.updateOne;
  DiagramAudit.create = original.auditCreate;
  AuditLog.create = original.auditLogCreate;
  channelState = null;
  auditEntries = null;
});

const token = signAccessToken({ id: TEST_USER_ID, email: "test@example.com" });

async function patch(url, body) {
  const res = await fetch(url, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Cookie: `access_token=${token}`,
    },
    body: JSON.stringify(body),
  });
  const json = await res.json();
  return { status: res.status, body: json };
}

test("PATCH node position actualiza coordenadas y audita", async () => {
  const response = await patch(
    `${baseUrl}/channels/${TEST_CHANNEL_ID}/node/node-1/position`,
    { position: { x: 120, y: 80 } }
  );

  assert.equal(response.status, 200);
  assert.equal(response.body.ok, true);
  assert.deepEqual(channelState.nodes[0].position, { x: 120, y: 80 });
  assert.equal(auditEntries.length, 1);
  assert.equal(auditEntries[0].entityType, "node");
  assert.equal(auditEntries[0].action, "move");
});

test("PATCH node position rechaza payload inválido", async () => {
  const response = await patch(
    `${baseUrl}/channels/${TEST_CHANNEL_ID}/node/node-1/position`,
    { position: { x: "hola", y: 50 } }
  );

  assert.equal(response.status, 400);
  assert.equal(response.body.ok, false);
});

test("PATCH node position soporta IDs numéricos", async () => {
  channelState.nodes[0].id = 101;
  channelState.edges[0].source = 101;

  const response = await patch(
    `${baseUrl}/channels/${TEST_CHANNEL_ID}/node/101/position`,
    { position: { x: 45, y: 55 } }
  );

  assert.equal(response.status, 200);
  assert.equal(response.body.ok, true);
  assert.deepEqual(channelState.nodes[0].position, { x: 45, y: 55 });
});

test("PATCH edge reconnect valida handles y persiste", async () => {
  const response = await patch(
    `${baseUrl}/channels/${TEST_CHANNEL_ID}/edge/edge-1/reconnect`,
    { target: "node-2", targetHandle: "in-left-1" }
  );

  assert.equal(response.status, 200);
  assert.equal(response.body.ok, true);
  assert.equal(channelState.edges[0].targetHandle, "in-left-1");
  assert.equal(auditEntries.length, 1);
  assert.equal(auditEntries[0].entityType, "edge");
  assert.equal(auditEntries[0].action, "reconnect");
});

test("PATCH edge reconnect falla con handle inválido", async () => {
  const response = await patch(
    `${baseUrl}/channels/${TEST_CHANNEL_ID}/edge/edge-1/reconnect`,
    { targetHandle: "out-right-99" }
  );

  assert.equal(response.status, 409);
  assert.equal(response.body.ok, false);
});

test("PATCH edge reconnect permite handles implícitos cuando no hay definición en nodo", async () => {
  channelState.nodes.forEach((node) => {
    if (node.data) delete node.data.handles;
    delete node.handles;
  });

  const response = await patch(
    `${baseUrl}/channels/${TEST_CHANNEL_ID}/edge/edge-1/reconnect`,
    { target: "node-2", targetHandle: "in-left-2" }
  );

  assert.equal(response.status, 200);
  assert.equal(response.body.ok, true);
  assert.equal(channelState.edges[0].targetHandle, "in-left-2");
});

test("PATCH edge reconnect rechaza handles implícitos con tipo incorrecto", async () => {
  channelState.nodes.forEach((node) => {
    if (node.data) delete node.data.handles;
    delete node.handles;
  });

  const response = await patch(
    `${baseUrl}/channels/${TEST_CHANNEL_ID}/edge/edge-1/reconnect`,
    { targetHandle: "out-right-1" }
  );

  assert.equal(response.status, 409);
  assert.equal(response.body.ok, false);
});

test("PATCH edge reconnect soporta IDs numéricos y normaliza nodos", async () => {
  channelState.nodes[0].id = 101;
  channelState.nodes[1].id = 202;
  channelState.edges[0].id = 303;
  channelState.edges[0].source = 101;
  channelState.edges[0].target = 202;

  const response = await patch(
    `${baseUrl}/channels/${TEST_CHANNEL_ID}/edge/303/reconnect`,
    { target: 202, targetHandle: "in-left-1" }
  );

  assert.equal(response.status, 200);
  assert.equal(response.body.ok, true);
  assert.equal(channelState.edges[0].target, "202");
  assert.equal(channelState.edges[0].targetHandle, "in-left-1");
});

test("PATCH edge tooltip actualiza texto", async () => {
  const response = await patch(
    `${baseUrl}/channels/${TEST_CHANNEL_ID}/edge/edge-1/tooltip`,
    { tooltipTitle: "Etiqueta centro", tooltip: "Nodo 1 to Nodo 2" }
  );

  assert.equal(response.status, 200);
  assert.equal(response.body.ok, true);
  assert.equal(channelState.edges[0].data.tooltip, "Nodo 1 to Nodo 2");
  assert.equal(auditEntries.length, 1);
  assert.equal(auditEntries[0].action, "edit");
});
