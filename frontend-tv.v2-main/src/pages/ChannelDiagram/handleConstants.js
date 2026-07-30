const freeze = Object.freeze;

export const HANDLE_IDS = freeze({
  OUT_RIGHT_PRIMARY: "out-right-1",
  OUT_RIGHT_SECONDARY: "out-right-2",
  OUT_BOTTOM_PRIMARY: "out-bottom-1",
  OUT_BOTTOM_SECONDARY: "out-bottom-2",
  OUT_BOTTOM_TERTIARY: "out-bottom-3",
  IN_LEFT_PRIMARY: "in-left-1",
  IN_LEFT_SECONDARY: "in-left-2",
  IN_BOTTOM_PRIMARY: "in-bottom-1",
  IN_BOTTOM_SECONDARY: "in-bottom-2",
  IN_BOTTOM_TERTIARY: "in-bottom-3",
  OUT_TOP_PRIMARY: "out-top-1",
  OUT_TOP_SECONDARY: "out-top-2",
  IN_TOP_PRIMARY: "in-top-1",
  IN_TOP_SECONDARY: "in-top-2",
  OUT_LEFT_PRIMARY: "out-left-1",
  IN_RIGHT_PRIMARY: "in-right-1",
});

const withSides = (config) =>
  freeze({
    top: freeze(config.top ?? []),
    right: freeze(config.right ?? []),
    bottom: freeze(config.bottom ?? []),
    left: freeze(config.left ?? []),
  });

export const EMPTY_HANDLE_CONFIG = freeze({
  source: withSides({}),
  target: withSides({}),
});

export const ROUTER_HANDLE_CONFIG = freeze({
  source: withSides({
    right: [HANDLE_IDS.OUT_RIGHT_PRIMARY, HANDLE_IDS.OUT_RIGHT_SECONDARY],
    bottom: [
      HANDLE_IDS.OUT_BOTTOM_PRIMARY,
      HANDLE_IDS.OUT_BOTTOM_SECONDARY,
      HANDLE_IDS.OUT_BOTTOM_TERTIARY,
    ],
  }),
  target: withSides({
    left: [HANDLE_IDS.IN_LEFT_PRIMARY, HANDLE_IDS.IN_LEFT_SECONDARY],
    bottom: [
      HANDLE_IDS.IN_BOTTOM_PRIMARY,
      HANDLE_IDS.IN_BOTTOM_SECONDARY,
      HANDLE_IDS.IN_BOTTOM_TERTIARY,
    ],
  }),
});

export const SATELITE_HANDLE_CONFIG = freeze({
  source: withSides({ right: [HANDLE_IDS.OUT_RIGHT_PRIMARY] }),
  target: withSides({}),
});

export const IRD_HANDLE_CONFIG = freeze({
  source: withSides({}),
  target: withSides({ left: [HANDLE_IDS.IN_LEFT_PRIMARY] }),
});

export const SWITCH_HANDLE_CONFIG = freeze({
  source: withSides({
    top: [HANDLE_IDS.OUT_TOP_PRIMARY],
    bottom: [HANDLE_IDS.OUT_BOTTOM_PRIMARY],
  }),
  target: withSides({
    top: [HANDLE_IDS.IN_TOP_PRIMARY],
    bottom: [HANDLE_IDS.IN_BOTTOM_PRIMARY],
  }),
});

export const DEFAULT_NODE_HANDLE_CONFIG = freeze({
  source: withSides({ top: [HANDLE_IDS.OUT_TOP_PRIMARY] }),
  target: withSides({ top: [HANDLE_IDS.IN_TOP_PRIMARY] }),
});

export const ROUTER_HANDLE_PRESETS = freeze([
  { id: HANDLE_IDS.IN_LEFT_PRIMARY, type: "target", side: "left", topPct: 25, leftPct: 0 },
  { id: HANDLE_IDS.IN_LEFT_SECONDARY, type: "target", side: "left", topPct: 75, leftPct: 0 },
  { id: HANDLE_IDS.OUT_RIGHT_PRIMARY, type: "source", side: "right", topPct: 25, leftPct: 100 },
  { id: HANDLE_IDS.OUT_RIGHT_SECONDARY, type: "source", side: "right", topPct: 75, leftPct: 100 },
  { id: HANDLE_IDS.IN_BOTTOM_PRIMARY, type: "target", side: "bottom", topPct: 100, leftPct: 20 },
  { id: HANDLE_IDS.IN_BOTTOM_SECONDARY, type: "target", side: "bottom", topPct: 100, leftPct: 50 },
  { id: HANDLE_IDS.IN_BOTTOM_TERTIARY, type: "target", side: "bottom", topPct: 100, leftPct: 80 },
  { id: HANDLE_IDS.OUT_BOTTOM_PRIMARY, type: "source", side: "bottom", topPct: 100, leftPct: 25 },
  { id: HANDLE_IDS.OUT_BOTTOM_SECONDARY, type: "source", side: "bottom", topPct: 100, leftPct: 55 },
  { id: HANDLE_IDS.OUT_BOTTOM_TERTIARY, type: "source", side: "bottom", topPct: 100, leftPct: 85 },
]);

export const ROUTER_HANDLE_OPTIONS = freeze({
  source: freeze([
    { id: HANDLE_IDS.OUT_RIGHT_PRIMARY, side: "right" },
    { id: HANDLE_IDS.OUT_RIGHT_SECONDARY, side: "right" },
    { id: HANDLE_IDS.OUT_BOTTOM_PRIMARY, side: "bottom" },
    { id: HANDLE_IDS.OUT_BOTTOM_SECONDARY, side: "bottom" },
    { id: HANDLE_IDS.OUT_BOTTOM_TERTIARY, side: "bottom" },
  ]),
  target: freeze([
    { id: HANDLE_IDS.IN_LEFT_PRIMARY, side: "left" },
    { id: HANDLE_IDS.IN_LEFT_SECONDARY, side: "left" },
    { id: HANDLE_IDS.IN_BOTTOM_PRIMARY, side: "bottom" },
    { id: HANDLE_IDS.IN_BOTTOM_SECONDARY, side: "bottom" },
    { id: HANDLE_IDS.IN_BOTTOM_TERTIARY, side: "bottom" },
  ]),
});

export const HANDLE_CONFIG_BY_TYPE = freeze({
  router: ROUTER_HANDLE_CONFIG,
  satelite: SATELITE_HANDLE_CONFIG,
  ird: IRD_HANDLE_CONFIG,
  switch: SWITCH_HANDLE_CONFIG,
  default: DEFAULT_NODE_HANDLE_CONFIG,
});
