const { test, describe } = require("node:test");
const assert = require("node:assert/strict");

const {
  isIpLikeKeyword,
  parseKeyword,
  isMplsNode,
  extractMulticastEntries,
  collectMplsMulticastMatches,
  mergeSignalResults,
} = require("./mplsMulticast");

// Canal con la misma forma que genera bulkChannelFisico.controller.js
const bulkChannel = () => ({
  nodes: [
    { id: "asr", data: { label: "ASR-01", equipoTipo: "router" } },
    { id: "mpls", data: { label: "NODO TEMUCO", equipoTipo: "mpls" } },
    { id: "sw_in", data: { label: "SW-IN", equipoTipo: "switch" } },
  ],
  edges: [
    {
      id: "e_swin_asr",
      source: "sw_in",
      target: "asr",
      data: { direction: "bi", labelStart: "", labelEnd: "" },
    },
    {
      id: "e_asr_mpls",
      source: "asr",
      target: "mpls",
      data: {
        direction: "ida",
        labelStart: "",
        labelEnd: "IP MULT VMX 239.10.5.20:5000 / IP FUENTE 10.20.30.40",
      },
    },
    {
      id: "e_ird_swin",
      source: "ird",
      target: "sw_in",
      data: { direction: "ida", labelStart: "PORT DATA IP MULT: 239.1.1.1", labelEnd: "" },
    },
  ],
});

describe("isIpLikeKeyword", () => {
  test("acepta IP completa, parcial y con puerto", () => {
    ["239.10.5.20", "239.10.5", "239.10.", "239.1", "239.10.5.20:5000"].forEach((k) =>
      assert.equal(isIpLikeKeyword(k), true, k)
    );
  });

  test("rechaza números de canal y texto", () => {
    ["101", "tnt", "", "239", "a.b.c.d", "239.10.5.20.1"].forEach((k) =>
      assert.equal(isIpLikeKeyword(k), false, k)
    );
  });
});

describe("parseKeyword", () => {
  test("IP completa es exacta; parcial es por prefijo", () => {
    assert.equal(parseKeyword("239.10.5.20").exact, true);
    assert.equal(parseKeyword("239.10.5").exact, false);
    assert.equal(parseKeyword("239.10.5.20:5000").port, "5000");
  });
});

describe("isMplsNode", () => {
  test("detecta por id, tipo o nombre", () => {
    assert.equal(isMplsNode({ id: "mpls" }), true);
    assert.equal(isMplsNode({ id: "n1", data: { equipoTipo: "MPLS" } }), true);
    assert.equal(
      isMplsNode({ id: "n2", equipo: { nombre: "x", tipoNombre: { tipoNombre: "Nodo MPLS" } } }),
      true
    );
    assert.equal(isMplsNode({ id: "asr", data: { label: "ASR-01" } }), false);
    assert.equal(isMplsNode(undefined), false);
  });
});

describe("extractMulticastEntries", () => {
  test("ignora la IP FUENTE unicast y conserva el puerto", () => {
    const edge = bulkChannel().edges[1];
    const entries = extractMulticastEntries(edge);
    assert.equal(entries.length, 1);
    assert.equal(entries[0].value, "239.10.5.20:5000");
  });

  test("data.multicast se acepta aunque no esté en rango multicast", () => {
    const entries = extractMulticastEntries({ data: { multicast: "10.0.0.9" } });
    assert.deepEqual(
      entries.map((e) => e.value),
      ["10.0.0.9"]
    );
  });
});

describe("mcast_prod rotulado como IP MULT", () => {
  test("se encuentra aunque no esté en el rango 224-239", () => {
    const channel = bulkChannel();
    channel.edges[1].data.labelEnd = "IP MULT VMX 192.168.50.7:5000 / IP FUENTE 10.20.30.40";
    const found = collectMplsMulticastMatches(channel, "192.168.50.7");
    assert.equal(found.length, 1);
    assert.equal(found[0].value, "192.168.50.7:5000");
    // y la IP fuente sigue sin contarse como multicast
    assert.equal(collectMplsMulticastMatches(channel, "10.20.30.40").length, 0);
  });

  test("tolera variantes de rótulo y mayúsculas", () => {
    ["IP MULT: 239.9.9.9", "ip mult vmx 239.9.9.9", "IP MULTICAST 239.9.9.9"].forEach((label) => {
      const channel = bulkChannel();
      channel.edges[1].data.labelEnd = label;
      assert.equal(collectMplsMulticastMatches(channel, "239.9.9.9").length, 1, label);
    });
  });
});

describe("collectMplsMulticastMatches", () => {
  test("encuentra por IP exacta, con y sin puerto", () => {
    const byIp = collectMplsMulticastMatches(bulkChannel(), "239.10.5.20");
    assert.equal(byIp.length, 1);
    assert.equal(byIp[0].edgeId, "e_asr_mpls");
    assert.equal(byIp[0].mplsNode, "NODO TEMUCO");

    assert.equal(collectMplsMulticastMatches(bulkChannel(), "239.10.5.20:5000").length, 1);
    assert.equal(collectMplsMulticastMatches(bulkChannel(), "239.10.5.20:6000").length, 0);
  });

  test("IP parcial funciona por prefijo", () => {
    assert.equal(collectMplsMulticastMatches(bulkChannel(), "239.10.5").length, 1);
    assert.equal(collectMplsMulticastMatches(bulkChannel(), "239.10.").length, 1);
    // prefijo de texto (tipo autocompletar): "239.1" calza con 239.10.5.20
    assert.equal(collectMplsMulticastMatches(bulkChannel(), "239.1").length, 1);
    // pero no es subcadena: "39.10" o "239.11" no calzan
    assert.equal(collectMplsMulticastMatches(bulkChannel(), "239.11").length, 0);
    assert.equal(collectMplsMulticastMatches(bulkChannel(), "10.5").length, 0);
  });

  test("IP exacta no confunde .20 con .200", () => {
    const channel = bulkChannel();
    channel.edges[1].data.labelEnd = "IP MULT VMX 239.10.5.200";
    assert.equal(collectMplsMulticastMatches(channel, "239.10.5.20").length, 0);
    assert.equal(collectMplsMulticastMatches(channel, "239.10.5.200").length, 1);
  });

  test("no devuelve multicast de aristas que no van al MPLS", () => {
    assert.equal(collectMplsMulticastMatches(bulkChannel(), "239.1.1.1").length, 0);
  });

  test("no devuelve la IP fuente unicast", () => {
    assert.equal(collectMplsMulticastMatches(bulkChannel(), "10.20.30.40").length, 0);
  });

  test("arista invertida (vuelta) con source MPLS cuenta como salida al MPLS", () => {
    const channel = {
      nodes: [
        { id: "a", data: { label: "ASR" } },
        { id: "m", data: { label: "X", equipoTipo: "mpls" } },
      ],
      edges: [
        { id: "e1", source: "m", target: "a", data: { direction: "vuelta", multicast: "239.2.2.2" } },
      ],
    };
    assert.equal(collectMplsMulticastMatches(channel, "239.2.2.2").length, 1);
  });

  test("keyword no IP devuelve vacío", () => {
    assert.deepEqual(collectMplsMulticastMatches(bulkChannel(), "tnt"), []);
  });
});

describe("mergeSignalResults", () => {
  test("multicast primero y sin duplicar", () => {
    const base = [{ _id: "1" }, { _id: "2" }];
    const mcast = [{ _id: "2", mplsMulticast: [{}] }, { _id: "3", mplsMulticast: [{}] }];
    const merged = mergeSignalResults(base, mcast);
    assert.deepEqual(
      merged.map((s) => s._id),
      ["2", "3", "1"]
    );
    assert.ok(merged[0].mplsMulticast);
  });
});
