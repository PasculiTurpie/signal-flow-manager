const { test, describe } = require("node:test");
const assert = require("node:assert/strict");

const { diagnose } = require("../../scripts/diagnoseMplsMulticast");

const channel = (overrides = {}) => ({
  _id: "c1",
  signal: "s1",
  nodes: [
    { id: "asr", data: { label: "ASR-01", equipoTipo: "router" } },
    { id: "mpls", data: { label: "MPLS-X", equipoTipo: "mpls" } },
  ],
  edges: [
    {
      id: "e_asr_mpls",
      source: "asr",
      target: "mpls",
      data: { direction: "ida", labelEnd: "IP MULT VMX 239.10.5.20:5000 / IP FUENTE 10.20.30.40" },
    },
  ],
  ...overrides,
});

describe("diagnose", () => {
  test("OK cuando el buscador la encontraría", () => {
    const { hits } = diagnose([channel()], "239.10.5.20", new Map([["s1", "TNT (HD)"]]));
    assert.equal(hits.length, 1);
    assert.match(hits[0].veredicto, /^OK/);
    assert.equal(hits[0].señal, "TNT (HD)");
    assert.equal(hits[0].camposConLaIP[0].campo, "data.labelEnd");
  });

  test("explica cuando el destino no se reconoce como MPLS", () => {
    const c = channel();
    c.nodes[1] = { id: "n9", data: { label: "Nodo Temuco", equipoTipo: "switch" } };
    c.edges[0].target = "n9";
    const { hits } = diagnose([c], "239.10.5.20");
    assert.match(hits[0].veredicto, /no llega a un nodo reconocido como MPLS/);
  });

  test("explica cuando la IP no se reconoce como multicast", () => {
    const c = channel();
    c.edges[0].data.labelEnd = "destino 192.168.1.9";
    const { hits } = diagnose([c], "192.168.1.9");
    assert.match(hits[0].veredicto, /no se reconoce como multicast/);
  });

  test("avisa cuando la IP está solo en nodos", () => {
    const c = channel();
    c.edges[0].data.labelEnd = "";
    c.nodes[0].data.multicast = "239.77.7.7";
    const { hits, soloEnNodos } = diagnose([c], "239.77.7.7");
    assert.equal(hits.length, 0);
    assert.equal(soloEnNodos.length, 1);
  });

  test("sin coincidencias devuelve vacío", () => {
    const { hits, soloEnNodos } = diagnose([channel()], "1.2.3.4");
    assert.deepEqual([hits, soloEnNodos], [[], []]);
  });
});
