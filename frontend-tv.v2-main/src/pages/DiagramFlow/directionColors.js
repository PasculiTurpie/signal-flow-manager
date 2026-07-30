export const EDGE_DIRECTION_COLORS = {
    ida: "blue",
    vuelta: "green",
    bi: "#1565c0",
};

export function getDirectionColor(direction = "ida") {
    if (!direction) return EDGE_DIRECTION_COLORS.ida;

    const normalized = String(direction).trim().toLowerCase();
    return EDGE_DIRECTION_COLORS[normalized] ?? EDGE_DIRECTION_COLORS.ida;
}
