const { test, describe } = require("node:test");
const assert = require("node:assert/strict");

const {
  normalizeChannel,
  normalizeChannels,
  normalizeNode,
  normalizeEdge,
} = require("./channelNormalizer");

describe("channelNormalizer", () => {
  test("normalizeNode produces stable structure", () => {
    const input = {
      id: "b",
      type: "custom",
      label: " Node B  ",
      data: {
        label: " Node B  ",
        labelPosition: { x: "20", y: "10" },
      },
      position: { x: "100", y: null },
    };

    const first = normalizeNode(input);
    const second = normalizeNode({ ...input });

    assert.deepStrictEqual(first, second);
    assert.equal(first.data.label, "Node B");
    assert.equal(first.position.x, 100);
    assert.equal(first.position.y, 0);
    assert.equal(first.data.labelPosition.x, 20);
    assert.equal(first.data.labelPosition.y, 10);
  });

  test("normalizeEdge sorts endpoint data and trims labels", () => {
    const input = {
      id: "edge-2",
      source: "b",
      target: "a",
      label: "  Label  ",
      data: {
        label: "  Label  ",
        endpointLabels: { source: " foo ", target: null },
        endpointLabelPositions: { source: { x: "10", y: "20" }, target: {} },
      },
    };

    const normalized = normalizeEdge(input);
    assert.equal(normalized.label, "Label");
    assert.equal(normalized.data.endpointLabels.source, "foo");
    assert.ok(!("target" in normalized.data.endpointLabels));
    assert.deepStrictEqual(normalized.data.endpointLabelPositions.source, {
      x: 10,
      y: 20,
    });
    assert.ok(!("target" in normalized.data.endpointLabelPositions));
  });

  test("normalizeChannel sorts nodes and edges deterministically", () => {
    const channel = {
      _id: "chan-1",
      nodes: [
        { id: "b", position: { x: 200, y: 10 }, data: { label: "B" } },
        { id: "a", position: { x: 100, y: 5 }, data: { label: "A" } },
      ],
      edges: [
        { id: "edge-2", source: "b", target: "a" },
        { id: "edge-1", source: "a", target: "b" },
      ],
    };

    const first = normalizeChannel(channel);
    const second = normalizeChannel({ ...channel });

    assert.deepStrictEqual(first, second);
    assert.deepStrictEqual(
      first.nodes.map((node) => node.id),
      ["a", "b"]
    );
    assert.deepStrictEqual(
      first.edges.map((edge) => edge.id),
      ["edge-1", "edge-2"]
    );
  });

  test("normalizeChannel enforces canonical node ids on edges", () => {
    const channel = {
      nodes: [
        { id: " Node-A ", position: { x: 0, y: 0 }, data: { label: "A" } },
        { id: "NODE-B", position: { x: 10, y: 10 }, data: { label: "B" } },
      ],
      edges: [
        { id: "edge-1", source: "node-a", target: " node-b " },
        { id: "edge-2", source: "NODE-B", target: "Node-A" },
      ],
    };

    const normalized = normalizeChannel(channel);

    assert.deepStrictEqual(
      normalized.edges.map((edge) => ({ id: edge.id, source: edge.source, target: edge.target })),
      [
        { id: "edge-1", source: "Node-A", target: "NODE-B" },
        { id: "edge-2", source: "NODE-B", target: "Node-A" },
      ]
    );
  });

  test("normalizeChannel keeps distinct case-sensitive node ids", () => {
    const channel = {
      nodes: [
        { id: "NodeA", position: { x: 0, y: 0 }, data: { label: "NodeA" } },
        { id: "nodea", position: { x: 10, y: 10 }, data: { label: "nodea" } },
      ],
      edges: [
        { id: "edge-1", source: "NodeA", target: "nodea" },
        { id: "edge-2", source: "nodea", target: "NodeA" },
      ],
    };

    const normalized = normalizeChannel(channel);

    assert.deepStrictEqual(
      normalized.edges.map((edge) => ({ source: edge.source, target: edge.target })),
      [
        { source: "NodeA", target: "nodea" },
        { source: "nodea", target: "NodeA" },
      ]
    );
  });

  test("normalizeChannels skips invalid entries", () => {
    const payload = [
      { id: "chan-1", nodes: [], edges: [] },
      null,
      undefined,
    ];

    const normalized = normalizeChannels(payload);
    assert.equal(normalized.length, 1);
    assert.equal(normalized[0].id, "chan-1");
  });
});
