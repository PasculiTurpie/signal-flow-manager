const { describe, test } = require("node:test");
const assert = require("node:assert/strict");

const {
  normalizeHandleId,
  sanitizeHandles,
} = require("./handleSanitizer.js");

describe("handleSanitizer", () => {
  test("normalizeHandleId canonicalizes loose inputs", () => {
    assert.equal(normalizeHandleId("Out_Right"), "out-right-1");
    assert.equal(normalizeHandleId(" sourceLeft-02 "), "out-left-2");
    assert.equal(normalizeHandleId("tgtbottom3"), "in-bottom-3");
  });

  test("normalizeHandleId discards null-like literals", () => {
    assert.equal(normalizeHandleId("none"), undefined);
    assert.equal(normalizeHandleId("UNDEFINED"), undefined);
    assert.equal(normalizeHandleId(" Na "), undefined);
  });

  test("sanitizeHandles drops invalid entries and normalizes ids", () => {
    const result = sanitizeHandles([
      { id: "Out_Right", type: "source", side: "RIGHT" },
      { id: "target_left", type: "target", side: "left", topPct: "25" },
      { id: "none", type: "target", side: "left" },
    ]);

    assert.deepEqual(result, [
      { id: "out-right-1", type: "source", side: "right", topPct: 50, leftPct: 100 },
      { id: "in-left-1", type: "target", side: "left", topPct: 25, leftPct: 0 },
    ]);
  });
});
