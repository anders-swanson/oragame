import { describe, expect, it } from "vitest";
import { computeLayout } from "./layout";

describe("responsive layout", () => {
  it("reserves compact room for the bottom topic description strip", () => {
    for (const [width, height] of [
      [390, 844],
      [360, 640],
      [320, 480]
    ]) {
      const layout = computeLayout(width, height);

      expect(layout.isCompact).toBe(true);
      expect(layout.infoHeight).toBeGreaterThanOrEqual(104);
      expect(layout.gridX).toBeGreaterThanOrEqual(0);
      expect(layout.gridY + layout.gridHeight + layout.infoHeight + layout.padding).toBeLessThanOrEqual(height);
    }
  });

  it("keeps the desktop grid and side panel inside the viewport", () => {
    const layout = computeLayout(1180, 760);

    expect(layout.isCompact).toBe(false);
    expect(layout.gridX + layout.gridWidth).toBeLessThan(layout.sideX);
    expect(layout.sideX + layout.sideWidth + layout.padding).toBeLessThanOrEqual(layout.width);
    expect(layout.gridY + layout.gridHeight + layout.padding).toBeLessThanOrEqual(layout.height);
  });
});
